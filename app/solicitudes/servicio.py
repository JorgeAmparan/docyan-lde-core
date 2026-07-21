"""
Servicio de solicitudes: crear + transicionar (ED-2 §2.2/§2.5/§2.6).

DOCYAN LDE™ by XCID.

Núcleo de la solicitud. Converge:
  1. Validación del tipo (catálogo del tenant o "Otra" con etiqueta_libre).
  2. Validación del destinatario contra el Directorio — **guardrail canónico**: un
     destinatario que no existe/está inactivo en ESTE tenant se rechaza
     (`DestinatarioInvalido`). Jamás un email libre, jamás cross-tenant.
  3. Persistencia dual: fila Supabase (`app.solicitudes.modelo`) + nodo `:Solicitud`
     en el grafo con arista `:DERIVA_DE` al dato de origen (provenance heredado).
  4. Notificación vía el motor ED-1 (`Notificador.notificar_solicitud`) — in-app +
     email (Resend), safety gate, reply-to = solicitante para el externo.
  5. Registro FAT (familia F10, `evento_tipo="solicitud"`) por creación, notificación
     y cada transición del ciclo de vida común.

Reusa la máquina de estados común (`app.eventos_dirigidos.ciclo_vida`) — NO la
duplica: las acciones de la solicitud mapean a transiciones ya declaradas ahí.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.eventos_dirigidos import ciclo_vida
from app.eventos_dirigidos.fat import registrar_transicion
from app.solicitudes.modelo import Solicitud

logger = logging.getLogger("docyan.solicitudes.servicio")


class DestinatarioInvalido(ValueError):
    """El destinatario no existe/está inactivo en el tenant (guardrail §5)."""


class TipoInvalido(ValueError):
    """Ni tipo_id del catálogo ni etiqueta_libre válidos."""


class SolicitudNoEncontrada(LookupError):
    """La solicitud referida no existe en el tenant."""


#: Acciones de la solicitud → estado destino del ciclo de vida COMÚN (§2.5). Cada
#: una valida contra `ciclo_vida.TRANSICIONES` (no se declara una máquina nueva).
ACCIONES_SOLICITUD: dict[str, str] = {
    "marcar_leida": ciclo_vida.LEIDO,
    "iniciar_proceso": ciclo_vida.EN_PROCESO,
    "resolver": ciclo_vida.RESUELTO,
    "cancelar": ciclo_vida.CANCELADO,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Creación ──────────────────────────────────────────────────────────────────


def crear_solicitud(
    *,
    tenant_id: str,
    destinatario_id: str,
    tipo_id: str | None,
    etiqueta_libre: str | None,
    mensaje: str | None,
    campos_tipados: dict | None,
    provenance: dict | None,
    consulta_id: str | None,
    solicitante_id: str | None,
    solicitante_nombre: str | None,
    solicitante_email: str | None,
    entidad_id: str | None,
    codo_id: str | None,
    directorio_store: Any,
    tipo_store: Any,
    solicitud_store: Any,
    dkg: Any = None,
    notificador: Any = None,
    fat: Any = None,
) -> Solicitud:
    """
    Crea una solicitud completa (validación + persistencia dual + notificación + FAT).

    `provenance`: dict opcional heredado del dato de origen — `documento_id`,
    `span_inicio`, `span_fin`, `fragmento`, `dato_origen_nodo_id`, `documento_nombre`.
    """
    # 1) Destinatario: DEBE existir y estar activo en el tenant (guardrail §5).
    destinatario = directorio_store.obtener(tenant_id, destinatario_id)
    if destinatario is None or not destinatario.activo:
        raise DestinatarioInvalido(
            "El destinatario no existe en el Directorio del tenant o está inactivo. "
            "El ruteo solo admite destinatarios dados de alta por el admin."
        )

    # 2) Tipo: del catálogo (tipo_id) o "Otra" (etiqueta_libre). Uno de los dos.
    tipo_nombre: str | None = None
    if tipo_id:
        tipo = tipo_store.obtener(tenant_id, tipo_id)
        if tipo is None or not tipo.activo:
            raise TipoInvalido("El tipo de solicitud no existe en el catálogo del tenant.")
        tipo_nombre = tipo.nombre
    elif etiqueta_libre and etiqueta_libre.strip():
        tipo_nombre = etiqueta_libre.strip()
    else:
        raise TipoInvalido("Debe indicar un tipo del catálogo (tipo_id) o una etiqueta_libre.")

    prov = provenance or {}
    solicitud = Solicitud(
        org_id=tenant_id,
        destinatario_id=destinatario_id,
        tipo_id=tipo_id,
        tipo_nombre=tipo_nombre,
        etiqueta_libre=etiqueta_libre.strip() if (etiqueta_libre and not tipo_id) else None,
        estado=ciclo_vida.CREADO,
        dato_origen_nodo_id=prov.get("dato_origen_nodo_id"),
        documento_id=prov.get("documento_id"),
        span_inicio=prov.get("span_inicio"),
        span_fin=prov.get("span_fin"),
        fragmento=prov.get("fragmento"),
        consulta_id=consulta_id,
        solicitante_id=solicitante_id,
        solicitante_nombre=solicitante_nombre,
        solicitante_email=solicitante_email,
        mensaje=mensaje,
        campos_tipados=campos_tipados or {},
        entidad_id=entidad_id,
        codo_id=codo_id,
    )

    # 3) Persistencia Supabase (fuente de listados/bandeja/demanda).
    solicitud = solicitud_store.crear(solicitud)

    # 3b) Nodo en el grafo + arista :DERIVA_DE al dato de origen (provenance).
    _upsert_nodo_grafo(dkg, tenant_id, solicitud)

    # 4) FAT de creación (None → creado).
    _fat(
        fat,
        tenant_id,
        solicitud.id,
        None,
        ciclo_vida.CREADO,
        "crear",
        actor_id=solicitante_id or "api",
    )

    # 5) Notificación (in-app + email). reply_to = solicitante para el externo.
    if notificador is not None:
        try:
            res = notificador.notificar_solicitud(
                tenant_id,
                solicitud={
                    "id": solicitud.id,
                    "mensaje": solicitud.mensaje or "",
                    "tipo_solicitud": tipo_nombre,
                    "fragmento": solicitud.fragmento,
                    "documento_nombre": prov.get("documento_nombre"),
                    "solicitante_nombre": solicitante_nombre,
                    "solicitante_email": solicitante_email,
                },
                destinatario_id=destinatario_id,
                reply_to=solicitante_email,
            )
        except Exception as exc:  # noqa: BLE001 — un fallo de notificación no pierde la solicitud.
            logger.error("notificación de solicitud %s falló: %s", solicitud.id, type(exc).__name__)
            res = None

        if res is not None and res.entregada:
            nuevo = ciclo_vida.NOTIFICADO
            solicitud_store.actualizar_estado(tenant_id, solicitud.id, nuevo)
            _set_estado_grafo(dkg, tenant_id, solicitud.id, nuevo)
            _fat(fat, tenant_id, solicitud.id, ciclo_vida.CREADO, nuevo, "notificar")
            solicitud.estado = nuevo

    return solicitud


# ── Transiciones del ciclo de vida (§2.5) ─────────────────────────────────────


def aplicar_transicion(
    *,
    tenant_id: str,
    solicitud_id: str,
    accion: str,
    actor_id: str,
    solicitud_store: Any,
    dkg: Any = None,
    fat: Any = None,
) -> Solicitud:
    """
    Aplica una acción de solicitud (marcar_leida | iniciar_proceso | resolver |
    cancelar) validando la transición contra la máquina COMÚN. Lanza
    `ciclo_vida.TransicionInvalida` / `AccionDesconocida` / `SolicitudNoEncontrada`.
    """
    destino = ACCIONES_SOLICITUD.get(accion)
    if destino is None:
        raise ciclo_vida.AccionDesconocida(
            f"acción de solicitud desconocida: {accion!r} "
            f"(válidas: {', '.join(ACCIONES_SOLICITUD)})"
        )

    solicitud = solicitud_store.obtener(tenant_id, solicitud_id)
    if solicitud is None:
        raise SolicitudNoEncontrada(f"solicitud {solicitud_id} no existe en el tenant.")

    estado_actual = solicitud.estado or ciclo_vida.CREADO
    ciclo_vida.validar_transicion(estado_actual, destino)  # lanza si inválida

    fecha_resolucion = _now_iso() if destino == ciclo_vida.RESUELTO else None
    actualizada = solicitud_store.actualizar_estado(
        tenant_id, solicitud_id, destino, fecha_resolucion=fecha_resolucion
    )
    _set_estado_grafo(dkg, tenant_id, solicitud_id, destino)
    _fat(fat, tenant_id, solicitud_id, estado_actual, destino, accion, actor_id=actor_id)
    return actualizada or solicitud


# ── Grafo (nodo :Solicitud + :DERIVA_DE) ──────────────────────────────────────


def _upsert_nodo_grafo(dkg: Any, tenant_id: str, s: Solicitud) -> None:
    if dkg is None:
        return
    try:
        dkg.query(
            tenant_id,
            """
            MERGE (sol:Solicitud {id: $id})
            SET sol.tipo_id = $tipo_id,
                sol.tipo_nombre = $tipo_nombre,
                sol.etiqueta_libre = $etiqueta_libre,
                sol.estado = $estado,
                sol.documento_id = $documento_id,
                sol.span_inicio = $span_inicio,
                sol.span_fin = $span_fin,
                sol.fragmento = $fragmento,
                sol.consulta_id = $consulta_id,
                sol.solicitante_id = $solicitante_id,
                sol.destinatario_id = $destinatario_id,
                sol.entidad_id = $entidad_id,
                sol.codo_id = $codo_id,
                sol.fecha_creacion = $fecha_creacion
            WITH sol
            OPTIONAL MATCH (orig {id: $nodo_origen})
            FOREACH (_ IN CASE WHEN orig IS NULL THEN [] ELSE [1] END |
                MERGE (sol)-[:DERIVA_DE]->(orig))
            """,
            {
                "id": s.id,
                "tipo_id": s.tipo_id,
                "tipo_nombre": s.tipo_nombre,
                "etiqueta_libre": s.etiqueta_libre,
                "estado": s.estado,
                "documento_id": s.documento_id,
                "span_inicio": s.span_inicio,
                "span_fin": s.span_fin,
                "fragmento": s.fragmento,
                "consulta_id": s.consulta_id,
                "solicitante_id": s.solicitante_id,
                "destinatario_id": s.destinatario_id,
                "entidad_id": s.entidad_id,
                "codo_id": s.codo_id,
                "fecha_creacion": s.fecha_creacion,
                "nodo_origen": s.dato_origen_nodo_id,
            },
        )
    except (
        Exception
    ) as exc:  # noqa: BLE001 — el grafo nunca tumba la solicitud (fuente = Supabase).
        logger.warning("no se pudo escribir nodo :Solicitud en el grafo: %s", type(exc).__name__)


def _set_estado_grafo(dkg: Any, tenant_id: str, solicitud_id: str, estado: str) -> None:
    if dkg is None:
        return
    try:
        dkg.query(
            tenant_id,
            "MATCH (sol:Solicitud {id: $id}) SET sol.estado = $estado, sol.estado_ts = $ts",
            {"id": solicitud_id, "estado": estado, "ts": _now_iso()},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "no se pudo actualizar estado de :Solicitud en el grafo: %s", type(exc).__name__
        )


def _fat(fat, tenant_id, solicitud_id, estado_anterior, estado_nuevo, accion, actor_id="system"):
    if fat is None:
        return
    try:
        registrar_transicion(
            fat,
            tenant_id,
            evento_tipo="solicitud",
            evento_id=solicitud_id,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            accion=accion,
            actor_id=actor_id,
            actor_tipo="operador" if actor_id not in ("system", "api") else "sistema",
        )
    except Exception as exc:  # noqa: BLE001 — el FAT best-effort no tumba la operación.
        logger.warning("no se pudo registrar FAT de solicitud: %s", type(exc).__name__)
