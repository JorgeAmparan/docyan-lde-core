"""
Relaciones inmediatas de un CoDo (entidad o documento suelto) — del grafo DKG real.

Alimenta el Expediente del CoDo (UI Capa A · P1 de la Matriz de Cierre): la rama
"Relaciones inmediatas" del árbol y el detalle de relación (`RelDetail`). NO usa
datos canned: cada relación sale del grafo del tenant.

Multi-tenant ESTRICTO: toda consulta pasa por `client.query(tenant_id, ...)`, que
confina el alcance al grafo `docyan_tenant_<id>`.

Patrón FalkorDB-safe (igual que `dkg_codos.py`): una consulta POR TIPO de relación
(no múltiples OPTIONAL MATCH en una sola query, que multiplican filas), `coalesce`
defensivo sobre nombres de propiedad (FalkorDB devuelve null para props ausentes,
no error), y nada de pattern-comprehension con WHERE.

Cada relación devuelta: {id, tipo, icono, titulo, tag, severidad, nota, meta}.
`severidad` ∈ {ok, warn, caution, muted} (mapea al SEV_DOT del prototipo).
`meta` es la cita/identificador que el `RelDetail` muestra como pedigree (`er-cite`).
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("docyan.dkg.relaciones")


def _rows(client: Any, tenant_id: str, cypher: str, params: dict) -> list[dict]:
    """Ejecuta una consulta acotada al tenant; nunca propaga el error a la UI."""
    try:
        return client.query(tenant_id, cypher, params) or []
    except Exception as exc:  # noqa: BLE001 — una relación que falle no tumba el expediente
        logger.warning("relaciones: query falló (%s): %s", tenant_id, type(exc).__name__)
        return []


def relaciones_de_entidad(client: Any, tenant_id: str, entidad_id: str) -> list[dict]:
    """
    Relaciones inmediatas de una `:EntidadOperativa` (NO los documentos del acervo,
    que ya viven en su propia rama): categoría, certificados de vigencia
    (calibración / vencimientos), alertas administrativas, procedimientos clave y
    versiones anteriores. Todo del grafo real.
    """
    rels: list[dict] = []

    # Categoría — :CATEGORIZADA_COMO
    for r in _rows(
        client, tenant_id,
        "MATCH (e:EntidadOperativa {id: $id})-[:CATEGORIZADA_COMO]->(c:CategoriaEntidad) "
        "RETURN c.id AS id, coalesce(c.nombre, c.id) AS titulo",
        {"id": entidad_id},
    ):
        if r.get("id"):
            rels.append({"id": r["id"], "tipo": "categoria", "icono": "tag",
                         "titulo": r.get("titulo") or r["id"], "tag": "Clasificación",
                         "severidad": "muted", "nota": None, "meta": r["id"]})

    # Certificados de vigencia (calibración / vencimientos) — :CONTIENE :CertificadoVigencia
    for r in _rows(
        client, tenant_id,
        "MATCH (e:EntidadOperativa {id: $id})-[:CONTIENE]->(c:CertificadoVigencia) "
        "RETURN c.id AS id, "
        "coalesce(c.nombre, c.titulo, c.descripcion, 'Certificado de vigencia') AS titulo, "
        "coalesce(c.estado, c.vigencia, 'vigencia') AS tag, "
        "coalesce(c.fecha_vencimiento, c.fecha, c.nota) AS nota, "
        "coalesce(c.referencia, c.id) AS meta",
        {"id": entidad_id},
    ):
        if r.get("id"):
            estado = (r.get("tag") or "").lower()
            sev = "warn" if any(k in estado for k in ("vence", "por vencer", "≤")) else "ok"
            rels.append({"id": r["id"], "tipo": "certificado", "icono": "ruler",
                         "titulo": r.get("titulo"), "tag": r.get("tag") or "vigencia",
                         "severidad": sev, "nota": r.get("nota"), "meta": r.get("meta") or r["id"]})

    # Alertas administrativas — :CONTIENE :Alerta (LÍNEA ABSOLUTA: solo administrativas)
    for r in _rows(
        client, tenant_id,
        "MATCH (e:EntidadOperativa {id: $id})-[:CONTIENE]->(a:Alerta) "
        "RETURN a.id AS id, "
        "coalesce(a.descripcion, a.titulo, a.nombre, 'Alerta administrativa') AS titulo, "
        "coalesce(a.urgencia, a.severidad, 'media') AS urgencia, "
        "coalesce(a.fecha_vencimiento, a.fecha, a.nota) AS nota, "
        "coalesce(a.referencia, a.id) AS meta",
        {"id": entidad_id},
    ):
        if r.get("id"):
            urg = (r.get("urgencia") or "").lower()
            sev = "warn" if urg in ("alta", "high") else "caution"
            rels.append({"id": r["id"], "tipo": "alerta", "icono": "alarm-clock",
                         "titulo": r.get("titulo"), "tag": "recordatorio",
                         "severidad": sev, "nota": r.get("nota"), "meta": r.get("meta") or r["id"]})

    # Procedimientos clave — :CONTIENE :Procedimiento
    for r in _rows(
        client, tenant_id,
        "MATCH (e:EntidadOperativa {id: $id})-[:CONTIENE]->(p:Procedimiento) "
        "RETURN p.id AS id, coalesce(p.nombre, p.titulo, p.id) AS titulo, "
        "coalesce(p.referencia, p.id) AS meta",
        {"id": entidad_id},
    ):
        if r.get("id"):
            rels.append({"id": r["id"], "tipo": "procedimiento", "icono": "list-checks",
                         "titulo": r.get("titulo"), "tag": "procedimiento",
                         "severidad": "muted", "nota": None, "meta": r.get("meta") or r["id"]})

    # Versiones anteriores — :VERSION_HISTORICA (entidad → entidad, decisión #11)
    for r in _rows(
        client, tenant_id,
        "MATCH (e:EntidadOperativa {id: $id})-[:VERSION_HISTORICA]->(v:EntidadOperativa) "
        "RETURN v.id AS id, coalesce(v.version_label, v.nombre, 'Versión anterior') AS titulo, "
        "coalesce(v.timestamp, v.fecha, v.id) AS nota",
        {"id": entidad_id},
    ):
        if r.get("id"):
            rels.append({"id": r["id"], "tipo": "version", "icono": "history",
                         "titulo": r.get("titulo"), "tag": "historial",
                         "severidad": "muted", "nota": r.get("nota"), "meta": r["id"]})

    return rels


def relaciones_de_documento(client: Any, tenant_id: str, doc_id: str) -> list[dict]:
    """
    Relaciones inmediatas de un `:DocumentoSource` suelto: la entidad que lo
    documenta, su traducción, recursos de video adjuntos, certificados/alertas que
    contiene y versiones anteriores. Todo del grafo real.
    """
    rels: list[dict] = []

    # Entidad que lo documenta — (:EntidadOperativa)-[:DOCUMENTADA_POR]->(d)
    for r in _rows(
        client, tenant_id,
        "MATCH (e:EntidadOperativa)-[:DOCUMENTADA_POR]->(d:DocumentoSource {id: $id}) "
        "RETURN e.id AS id, coalesce(e.nombre, e.tipo, e.id) AS titulo",
        {"id": doc_id},
    ):
        if r.get("id"):
            rels.append({"id": r["id"], "tipo": "entidad", "icono": "package",
                         "titulo": r.get("titulo"), "tag": "entidad relacionada",
                         "severidad": "muted", "nota": None, "meta": r["id"]})

    # Traducción — :TIENE_TRADUCCION :DocumentoTraducido
    for r in _rows(
        client, tenant_id,
        "MATCH (d:DocumentoSource {id: $id})-[:TIENE_TRADUCCION]->(t:DocumentoTraducido) "
        "RETURN t.id AS id, coalesce(t.nombre, 'Traducción') AS titulo, "
        "coalesce(t.idioma_destino, t.idioma, '') AS idioma",
        {"id": doc_id},
    ):
        if r.get("id"):
            tag = ("→ " + r["idioma"]) if r.get("idioma") else "traducción"
            rels.append({"id": r["id"], "tipo": "traduccion", "icono": "languages",
                         "titulo": r.get("titulo"), "tag": tag, "severidad": "muted",
                         "nota": None, "meta": r["id"]})

    # Recursos de video adjuntos — :CONTIENE :RecursoVideo
    for r in _rows(
        client, tenant_id,
        "MATCH (d:DocumentoSource {id: $id})-[:CONTIENE]->(v:RecursoVideo) "
        "RETURN v.id AS id, coalesce(v.titulo, v.nombre, 'Video de apoyo') AS titulo, "
        "coalesce(v.url, v.id) AS meta",
        {"id": doc_id},
    ):
        if r.get("id"):
            rels.append({"id": r["id"], "tipo": "video", "icono": "play-circle",
                         "titulo": r.get("titulo"), "tag": "video de apoyo",
                         "severidad": "muted", "nota": None, "meta": r.get("meta") or r["id"]})

    # Versiones anteriores — :VERSION_HISTORICA (documento → documento)
    for r in _rows(
        client, tenant_id,
        "MATCH (d:DocumentoSource {id: $id})-[:VERSION_HISTORICA]->(v:DocumentoSource) "
        "RETURN v.id AS id, coalesce(v.version_label, v.nombre_archivo, 'Versión anterior') AS titulo, "
        "coalesce(v.timestamp, v.id) AS nota",
        {"id": doc_id},
    ):
        if r.get("id"):
            rels.append({"id": r["id"], "tipo": "version", "icono": "history",
                         "titulo": r.get("titulo"), "tag": "historial",
                         "severidad": "muted", "nota": r.get("nota"), "meta": r["id"]})

    return rels


def relaciones_de_codo(client: Any, tenant_id: str, codo_id: str, tipo_codo: str) -> list[dict]:
    """Despacha según el tipo de CoDo (entidad | documento)."""
    if tipo_codo == "entidad":
        return relaciones_de_entidad(client, tenant_id, codo_id)
    return relaciones_de_documento(client, tenant_id, codo_id)
