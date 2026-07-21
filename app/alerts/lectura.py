"""
Lectura de alertas para el router de administración (ED-1 §2.3.3).

DOCYAN LDE™ by XCID.

Listado por tenant/entidad con filtros de estado y urgencia + detalle con historial
de acciones. El pipeline Tipo 7 (`tipo7_alertas`) sigue sirviendo su
`AlertsDashboardPayload` para la Consulta sin cambios — este módulo es la superficie
ADMIN (más rica: estado, origen, acciones), no reemplaza al T7.
"""
from __future__ import annotations

from typing import Any

_CAMPOS = (
    "a.id AS alerta_id, a.descripcion AS descripcion, a.fecha_vencimiento AS fecha_vencimiento, "
    "a.urgencia AS urgencia, a.entidad_id AS entidad_id, a.estado AS estado, "
    "a.origen AS origen, a.tipo AS tipo, a.administrativa AS administrativa, "
    "a.thresholds_notificados AS thresholds_notificados, a.notificado_ts AS notificado_ts"
)


def _row_alerta(r: dict) -> dict:
    return {
        "alerta_id": r.get("alerta_id"),
        "descripcion": r.get("descripcion") or "",
        "fecha_vencimiento": r.get("fecha_vencimiento"),
        "urgencia": r.get("urgencia") or "media",
        "entidad_id": r.get("entidad_id"),
        "estado": r.get("estado") or "creado",
        "origen": r.get("origen"),
        "tipo": r.get("tipo"),
        "administrativa": bool(r.get("administrativa", True)),
        "thresholds_notificados": list(r.get("thresholds_notificados") or []),
        "notificado_ts": r.get("notificado_ts"),
    }


def listar_alertas(
    client: Any,
    tenant_id: str,
    *,
    entidad_id: str | None = None,
    estado: str | None = None,
    urgencia: str | None = None,
    limit: int = 200,
) -> list[dict]:
    """Lista alertas del tenant con filtros opcionales de entidad/estado/urgencia."""
    if entidad_id:
        cypher = f"MATCH (ent:EntidadOperativa {{id:$eid}})-[:CONTIENE]->(a:Alerta) RETURN {_CAMPOS}"
        params: dict = {"eid": entidad_id}
    else:
        cypher = f"MATCH (a:Alerta) RETURN {_CAMPOS}"
        params = {}
    rows = client.query(tenant_id, cypher, params)
    alertas = [_row_alerta(r) for r in rows]
    if estado:
        alertas = [a for a in alertas if a["estado"] == estado]
    if urgencia:
        alertas = [a for a in alertas if a["urgencia"] == urgencia]
    return alertas[:limit]


def obtener_alerta(client: Any, tenant_id: str, alerta_id: str) -> dict | None:
    rows = client.query(
        tenant_id, f"MATCH (a:Alerta {{id:$id}}) RETURN {_CAMPOS}", {"id": alerta_id}
    )
    if not rows:
        return None
    alerta = _row_alerta(rows[0])
    acciones = client.query(
        tenant_id,
        "MATCH (a:Alerta {id:$id})-[:TIENE_ACCION]->(ac:AccionSobreAlerta) "
        "RETURN ac.id AS id, ac.accion AS accion, ac.actor_id AS actor_id, "
        "ac.timestamp AS timestamp, ac.estado_anterior AS estado_anterior, "
        "ac.estado_nuevo AS estado_nuevo, ac.justificacion AS justificacion, "
        "ac.comentario AS comentario",
        {"id": alerta_id},
    )
    alerta["acciones"] = sorted(
        [dict(a) for a in acciones], key=lambda x: x.get("timestamp") or ""
    )
    return alerta
