"""
Despacho de alertas: crear/actualizar `:Alerta` + notificar (ED-1 §2.2/§2.4.5).

DOCYAN LDE™ by XCID.

Núcleo compartido por las TRES rutas de creación de alertas (`origen`):
  - `ingesta`   — `app.alerts.generador` al cierre de ingesta.
  - `scheduler` — `app.alerts.barrido` (barrido diario de vencimientos).
  - `manual`    — endpoint de alerta manual (`/alertas` POST).

Todas convergen aquí para: (1) upsert idempotente del `:Alerta` (MERGE por id),
(2) cómputo de qué threshold cruzó y dedup por `(entidad, fecha, threshold)` —
persistido en `a.thresholds_notificados`, (3) disparo de la notificación por los
canales de la regla, (4) transición de ciclo de vida `creado → notificado` + FAT.

Idempotencia (§2.2.3): una segunda corrida sobre el mismo (entidad, fecha,
threshold) ya alertado NO crea duplicado ni renotifica — `thresholds_notificados`
lo registra en la propia `:Alerta`.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from app.alerts.reglas import URGENCIA_DEFAULT, ReglaAlerta
from app.alerts.safety_validator import validar_alerta
from app.eventos_dirigidos import ciclo_vida
from app.eventos_dirigidos.fat import registrar_transicion
from app.eventos_dirigidos.notificador import ResultadoNotificacion

logger = logging.getLogger("docyan.alerts.despacho")


@dataclass
class ResultadoDespacho:
    alerta_id: str
    resultado: str  # creada | actualizada | sin_cambio | fuera_de_horizonte | cuarentena
    notificada: bool = False
    estado: str = "creado"
    notif: ResultadoNotificacion | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _leer_alerta(client: Any, tenant_id: str, alerta_id: str) -> dict | None:
    rows = client.query(
        tenant_id,
        "MATCH (a:Alerta {id: $id}) RETURN a.thresholds_notificados AS tn, "
        "a.estado AS estado, a.origen AS origen",
        {"id": alerta_id},
    )
    return rows[0] if rows else None


def _upsert_alerta(
    client: Any, tenant_id: str, *, alerta_id: str, descripcion: str, fecha: str | None,
    urgencia: str, entidad_id: str | None, cert_id: str | None, origen: str,
    estado: str, thresholds_notificados: list[int], documento_id: str | None = None,
    tipo: str = "vencimiento",
) -> None:
    client.query(
        tenant_id,
        """
        MERGE (a:Alerta {id: $id})
        SET a.descripcion = $descripcion,
            a.fecha_vencimiento = $fecha,
            a.urgencia = $urgencia,
            a.tipo = $tipo,
            a.entidad_id = $entidad_id,
            a.cert_id = $cert_id,
            a.administrativa = true,
            a.origen = $origen,
            a.estado = $estado,
            a.thresholds_notificados = $notificados
        WITH a
        OPTIONAL MATCH (c {id: $cert_id})
        FOREACH (_ IN CASE WHEN c IS NULL THEN [] ELSE [1] END |
            MERGE (a)-[:DERIVA_DE]->(c))
        WITH a
        OPTIONAL MATCH (ent:EntidadOperativa {id: $entidad_id})
        FOREACH (_ IN CASE WHEN ent IS NULL THEN [] ELSE [1] END |
            MERGE (ent)-[:CONTIENE]->(a))
        """,
        {
            "id": alerta_id, "descripcion": descripcion, "fecha": fecha,
            "urgencia": urgencia, "tipo": tipo, "entidad_id": entidad_id,
            "cert_id": cert_id, "origen": origen, "estado": estado,
            "notificados": [int(t) for t in thresholds_notificados],
        },
    )


def _bandas_cruzadas(dias: int, thresholds: list[int]) -> list[int]:
    """Thresholds cuya banda cruzó el vencimiento (dias <= threshold), ordenados asc."""
    return sorted(t for t in thresholds if dias <= t)


def procesar_vencimiento(
    client: Any,
    tenant_id: str,
    *,
    cert_id: str,
    nombre: str,
    fecha: date,
    entidad_id: str | None,
    hoy: date,
    regla: ReglaAlerta,
    origen: str,
    horizonte_dias: int = 90,
    notificador: Any = None,
    fat: Any = None,
) -> ResultadoDespacho:
    """
    Procesa un vencimiento: crea/actualiza su `:Alerta` y, si cruzó un threshold
    nuevo (y hay notificador), notifica. Gate absoluto de `safety_validator` antes
    de persistir. Devuelve el resultado (creada/actualizada/…) y si se notificó.
    """
    dias = (fecha - hoy).days
    descripcion = f"{nombre} vence el {fecha.isoformat()} (en {dias} días)."

    if not validar_alerta(descripcion).admisible:
        logger.warning("alerta NO administrativa descartada (tenant=%s cert=%s)", tenant_id, cert_id)
        return ResultadoDespacho(alerta_id="", resultado="cuarentena")

    if dias < 0 or dias > horizonte_dias:
        return ResultadoDespacho(alerta_id="", resultado="fuera_de_horizonte")

    alerta_id = f"alert_{cert_id}_{fecha.isoformat()}"
    crossed = _bandas_cruzadas(dias, regla.thresholds)
    urgencia = regla.urgencia_para(min(crossed)) if crossed else URGENCIA_DEFAULT

    existing = _leer_alerta(client, tenant_id, alerta_id)
    creada = existing is None
    prev_notificados = set(existing["tn"] or []) if existing else set()
    estado_actual = (existing.get("estado") if existing else None) or ciclo_vida.CREADO
    origen_final = (existing.get("origen") if existing else None) or origen
    nuevos = [t for t in crossed if t not in prev_notificados]

    # Upsert del nodo (estado/thresholds actuales; la notificación los avanza abajo).
    _upsert_alerta(
        client, tenant_id, alerta_id=alerta_id, descripcion=descripcion,
        fecha=fecha.isoformat(), urgencia=urgencia, entidad_id=entidad_id,
        cert_id=cert_id, origen=origen_final, estado=estado_actual,
        thresholds_notificados=sorted(prev_notificados),
    )

    resultado = "creada" if creada else ("actualizada" if nuevos else "sin_cambio")
    despacho = ResultadoDespacho(alerta_id=alerta_id, resultado=resultado, estado=estado_actual)

    # Notificar solo si hay una banda NUEVA y un notificador (dedup por threshold).
    if notificador is not None and nuevos:
        alerta_dict = {
            "id": alerta_id, "descripcion": descripcion, "urgencia": urgencia,
            "fecha_vencimiento": fecha.isoformat(), "entidad_id": entidad_id, "dias": dias,
        }
        res_notif = notificador.notificar_alerta(
            tenant_id, alerta=alerta_dict, regla=regla, tipo_evento="alerta_vencimiento",
        )
        despacho.notif = res_notif
        if res_notif.entregada:
            despacho.notificada = True
            notificados_final = sorted(prev_notificados | set(crossed))
            nuevo_estado = estado_actual
            if ciclo_vida.transicion_valida(estado_actual, ciclo_vida.NOTIFICADO):
                nuevo_estado = ciclo_vida.NOTIFICADO
            client.query(
                tenant_id,
                "MATCH (a:Alerta {id:$id}) SET a.estado=$estado, "
                "a.thresholds_notificados=$tn, a.notificado_ts=$ts",
                {"id": alerta_id, "estado": nuevo_estado, "tn": notificados_final, "ts": _now_iso()},
            )
            despacho.estado = nuevo_estado
            if fat is not None and nuevo_estado != estado_actual:
                _fat_transicion(fat, tenant_id, alerta_id, estado_actual, nuevo_estado, "notificar")

    return despacho


def crear_alerta_manual(
    client: Any,
    tenant_id: str,
    *,
    descripcion: str,
    fecha_vencimiento: str | None,
    entidad_id: str | None,
    documento_id: str | None,
    regla: ReglaAlerta,
    actor_id: str,
    notificador: Any = None,
    fat: Any = None,
) -> ResultadoDespacho:
    """
    Crea una alerta manual (`origen = manual`) sobre una entidad/documento con fecha
    y destinatarios (los de `regla`), y notifica. Gate de `safety_validator` antes de
    persistir: una descripción no administrativa se rechaza (no se crea).
    """
    if not validar_alerta(descripcion).admisible:
        raise ValueError("La descripción de la alerta no es administrativa (línea §11.1).")

    import uuid

    alerta_id = f"alert_manual_{uuid.uuid4().hex[:12]}"
    urgencia = regla.urgencia_para(min(regla.thresholds)) if regla.thresholds else URGENCIA_DEFAULT

    _upsert_alerta(
        client, tenant_id, alerta_id=alerta_id, descripcion=descripcion,
        fecha=fecha_vencimiento, urgencia=urgencia, entidad_id=entidad_id,
        cert_id=documento_id, origen="manual", estado=ciclo_vida.CREADO,
        thresholds_notificados=[], tipo="manual",
    )
    if fat is not None:
        _fat_transicion(fat, tenant_id, alerta_id, None, ciclo_vida.CREADO, "crear_manual", actor_id=actor_id)

    despacho = ResultadoDespacho(alerta_id=alerta_id, resultado="creada", estado=ciclo_vida.CREADO)

    if notificador is not None:
        alerta_dict = {
            "id": alerta_id, "descripcion": descripcion, "urgencia": urgencia,
            "fecha_vencimiento": fecha_vencimiento, "entidad_id": entidad_id,
        }
        res_notif = notificador.notificar_alerta(
            tenant_id, alerta=alerta_dict, regla=regla, tipo_evento="alerta_manual",
        )
        despacho.notif = res_notif
        if res_notif.entregada:
            despacho.notificada = True
            client.query(
                tenant_id, "MATCH (a:Alerta {id:$id}) SET a.estado=$e, a.notificado_ts=$ts",
                {"id": alerta_id, "e": ciclo_vida.NOTIFICADO, "ts": _now_iso()},
            )
            despacho.estado = ciclo_vida.NOTIFICADO
            if fat is not None:
                _fat_transicion(fat, tenant_id, alerta_id, ciclo_vida.CREADO, ciclo_vida.NOTIFICADO, "notificar")

    return despacho


def _fat_transicion(fat, tenant_id, alerta_id, estado_anterior, estado_nuevo, accion, actor_id="system"):
    try:
        registrar_transicion(
            fat, tenant_id, evento_tipo="alerta", evento_id=alerta_id,
            estado_anterior=estado_anterior, estado_nuevo=estado_nuevo,
            accion=accion, actor_id=actor_id,
            actor_tipo="mo" if actor_id != "system" else "sistema",
        )
    except Exception as exc:  # noqa: BLE001 — el FAT best-effort no tumba el despacho.
        logger.warning("no se pudo registrar FAT de transición: %s", type(exc).__name__)
