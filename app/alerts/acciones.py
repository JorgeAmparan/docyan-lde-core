"""
`AccionSobreAlerta` — acciones del operador sobre una alerta (ED-1 §2.3.2).

DOCYAN LDE™ by XCID.

Antes inexistente (solo un docstring en `tipo7_alertas.py`). Aquí se construye:
`reconocer | iniciar_proceso | escalar | postponer (justificación obligatoria) |
suprimir | resolver | comentar` — exactamente las del doc 01. Cada acción =
transición del ciclo de vida común (`app.eventos_dirigidos.ciclo_vida`) + registro
de quién/cuándo/justificación (nodo `:AccionSobreAlerta` en el grafo) + evento FAT
(familia F10). Una transición inválida es un error explícito, nunca silencio.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.eventos_dirigidos import ciclo_vida
from app.eventos_dirigidos.fat import registrar_transicion

logger = logging.getLogger("docyan.alerts.acciones")


class AlertaNoEncontrada(LookupError):
    """La alerta referida no existe en el tenant."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def aplicar_accion(
    client: Any,
    tenant_id: str,
    alerta_id: str,
    accion: str,
    *,
    actor_id: str,
    justificacion: str | None = None,
    comentario: str | None = None,
    fat: Any = None,
) -> dict:
    """
    Aplica una acción sobre una alerta. Valida la transición (lanza
    `ciclo_vida.TransicionInvalida` / `JustificacionRequerida` / `AccionDesconocida`),
    persiste el nuevo estado + un nodo `:AccionSobreAlerta` con la traza, y registra
    FAT. Devuelve el estado resultante.
    """
    rows = client.query(
        tenant_id, "MATCH (a:Alerta {id:$id}) RETURN a.estado AS estado", {"id": alerta_id}
    )
    if not rows:
        raise AlertaNoEncontrada(f"alerta {alerta_id} no existe en el tenant.")
    estado_actual = rows[0].get("estado") or ciclo_vida.CREADO

    # Valida y calcula el estado destino (o el mismo, para postponer/comentar).
    nuevo_estado = ciclo_vida.aplicar_accion(estado_actual, accion, justificacion=justificacion)

    ts = _now_iso()
    accion_id = f"accion_{uuid.uuid4().hex[:12]}"
    client.query(
        tenant_id,
        """
        MATCH (a:Alerta {id: $alerta_id})
        SET a.estado = $nuevo_estado, a.estado_ts = $ts
        CREATE (ac:AccionSobreAlerta {
            id: $accion_id, accion: $accion, actor_id: $actor_id, timestamp: $ts,
            estado_anterior: $estado_anterior, estado_nuevo: $nuevo_estado,
            justificacion: $justificacion, comentario: $comentario
        })
        MERGE (a)-[:TIENE_ACCION]->(ac)
        """,
        {
            "alerta_id": alerta_id, "nuevo_estado": nuevo_estado, "ts": ts,
            "accion_id": accion_id, "accion": accion, "actor_id": actor_id,
            "estado_anterior": estado_actual, "justificacion": justificacion,
            "comentario": comentario,
        },
    )

    if fat is not None:
        try:
            registrar_transicion(
                fat, tenant_id, evento_tipo="alerta", evento_id=alerta_id,
                estado_anterior=estado_actual, estado_nuevo=nuevo_estado,
                accion=accion, actor_id=actor_id, actor_tipo="operador",
                justificacion=justificacion,
                extra={"comentario": comentario} if comentario else None,
            )
        except Exception as exc:  # noqa: BLE001 — el FAT best-effort no tumba la acción.
            logger.warning("no se pudo registrar FAT de acción: %s", type(exc).__name__)

    return {
        "alerta_id": alerta_id, "accion": accion, "estado_anterior": estado_actual,
        "estado": nuevo_estado, "accion_id": accion_id, "timestamp": ts,
    }
