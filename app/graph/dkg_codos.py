"""
Listado y contexto de CoDos consultables del tenant (B13 — cierre del ciclo de consulta).

Un "CoDo" (Contexto de Documento) es la unidad consultable que la UI de Consulta
ofrece al usuario. En el grafo del tenant se materializa de dos formas:

  · `:EntidadOperativa` — el equipo/activo al que apunta un QR. Es el CoDo "pleno":
    agrupa uno o más `:DocumentoSource` vía `:DOCUMENTADA_POR`. (Flujo QR / B4.)
  · `:DocumentoSource` SUELTO — documento ingerido directo (onboarding freemium) que
    aún no está atado a ninguna entidad. Es consultable por sí mismo: su contenido
    cuelga vía `:CONTIENE` y la consulta lo alcanza con scope de tenant.

`listar_codos` devuelve AMBOS, de modo que una cuenta freemium recién creada (que
solo tiene un documento, sin entidad) ya tiene un CoDo real que consultar — sin
datos enlatados. `contexto_codo` resuelve un id (entidad o documento) al contexto
que la UI necesita (título, meta, documentos, y el `entidad_id` real cuando aplica).

Multi-tenant ESTRICTO: toda consulta pasa por `client.query(tenant_id, ...)`, que
confina el alcance al grafo `docyan_tenant_<id>`. No hay query cruzada entre tenants.
El patrón evita pattern-comprehension con WHERE (no soportado por FalkorDB): usa
OPTIONAL MATCH + count, como `app/graph/dkg_documents.py`.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("docyan.dkg.codos")


def listar_codos(client: Any, tenant_id: str) -> list[dict]:
    """
    Lista los CoDos consultables del tenant: entidades operativas + documentos
    sueltos (no atados a entidad). Cada item: {id, tipo, nombre, documentos, estado}.

    `tipo` ∈ {"entidad", "documento"}. `documentos` = nº de documentos vivos del CoDo
    (1 para un documento suelto). `estado` ∈ {"ok", "warn"}: "warn" si la entidad
    tiene alertas administrativas pendientes (Tipo 7); los documentos sueltos son "ok".
    """
    # ── Entidades operativas (CoDos plenos) + su conteo de documentos y alertas ──
    entidades = client.query(
        tenant_id,
        """
        MATCH (e:EntidadOperativa)
        OPTIONAL MATCH (e)-[:DOCUMENTADA_POR]->(d:DocumentoSource)
        WITH e, count(DISTINCT d) AS docs
        OPTIONAL MATCH (e)-[:CONTIENE]->(a:Alerta)
        WITH e, docs, count(DISTINCT a) AS alertas
        RETURN e.id AS id,
               coalesce(e.nombre, e.tipo, e.id) AS nombre,
               e.tipo AS tipo_entidad,
               docs AS documentos,
               alertas AS alertas
        ORDER BY nombre
        """,
        {},
    )
    items: list[dict] = [
        {
            "id": r.get("id"),
            "tipo": "entidad",
            "nombre": r.get("nombre") or r.get("id"),
            "tipo_documento": r.get("tipo_entidad"),
            "documentos": int(r.get("documentos") or 0),
            "estado": "warn" if int(r.get("alertas") or 0) > 0 else "ok",
        }
        for r in entidades
    ]

    # ── Documentos SUELTOS (sin entidad que los documente) — caso freemium directo ─
    # Patrón OPTIONAL MATCH + count (FalkorDB-safe): `ents = 0` ⇒ documento suelto.
    sueltos = client.query(
        tenant_id,
        """
        MATCH (d:DocumentoSource)
        OPTIONAL MATCH (e:EntidadOperativa)-[:DOCUMENTADA_POR]->(d)
        WITH d, count(e) AS ents
        WHERE ents = 0
        RETURN d.id AS id,
               coalesce(d.nombre_archivo, d.id) AS nombre,
               d.tipo_documento AS tipo_documento
        ORDER BY nombre
        """,
        {},
    )
    items.extend(
        {
            "id": r.get("id"),
            "tipo": "documento",
            "nombre": r.get("nombre") or r.get("id"),
            "tipo_documento": r.get("tipo_documento"),
            "documentos": 1,
            "estado": "ok",
        }
        for r in sueltos
    )
    return items


def contexto_codo(client: Any, tenant_id: str, codo_id: str) -> dict | None:
    """
    Resuelve un CoDo (entidad o documento suelto) a su contexto de consulta.

    Devuelve {id, tipo, entidad_id, nombre, titulo, meta, documentos[]} o None si el
    id no existe en el grafo del tenant (→ 404 sin filtrar existencia de otros tenants).

    `entidad_id` es el id real de la `:EntidadOperativa` cuando el CoDo es una entidad;
    es None para un documento suelto (la consulta corre con scope de tenant, que para
    una cuenta freemium ES ese documento). Nunca se inventa un id.
    """
    # 1) ¿Es una entidad operativa?
    # `collect({...})` mapea cada documento; cuando no hay (OPTIONAL MATCH null) el
    # mapa sale con id=None y se filtra en Python (evita comprehension-con-WHERE,
    # no soportada por FalkorDB).
    ent = client.query(
        tenant_id,
        """
        MATCH (e:EntidadOperativa {id: $id})
        OPTIONAL MATCH (e)-[:DOCUMENTADA_POR]->(d:DocumentoSource)
        RETURN e.id AS id,
               coalesce(e.nombre, e.tipo, e.id) AS nombre,
               e.tipo AS tipo,
               collect({id: d.id, nombre: coalesce(d.nombre_archivo, d.id),
                        tipo: d.tipo_documento}) AS documentos
        """,
        {"id": codo_id},
    )
    if ent and ent[0].get("id"):
        r = ent[0]
        documentos = [d for d in (r.get("documentos") or []) if d and d.get("id")]
        n_docs = len(documentos)
        return {
            "id": r.get("id"),
            "tipo": "entidad",
            "entidad_id": r.get("id"),
            "nombre": r.get("nombre") or r.get("id"),
            "titulo": r.get("nombre") or r.get("id"),
            "meta": _meta_docs(n_docs),
            "documentos": documentos,
        }

    # 2) ¿Es un documento suelto?
    doc = client.query(
        tenant_id,
        """
        MATCH (d:DocumentoSource {id: $id})
        OPTIONAL MATCH (d)-[:CONTIENE]->(x)
        RETURN d.id AS id,
               coalesce(d.nombre_archivo, d.id) AS nombre,
               d.tipo_documento AS tipo,
               count(x) AS contenido
        """,
        {"id": codo_id},
    )
    if doc and doc[0].get("id"):
        r = doc[0]
        tipo_doc = r.get("tipo")
        nodos = int(r.get("contenido") or 0)
        meta_parts = [p for p in (tipo_doc, f"{nodos} nodos de contenido" if nodos else None) if p]
        return {
            "id": r.get("id"),
            "tipo": "documento",
            "entidad_id": None,  # documento suelto: scope de tenant (= este documento)
            "nombre": r.get("nombre") or r.get("id"),
            "titulo": r.get("nombre") or r.get("id"),
            "meta": " · ".join(meta_parts) if meta_parts else "documento vivo",
            "documentos": [
                {"id": r.get("id"), "nombre": r.get("nombre") or r.get("id"), "tipo": tipo_doc}
            ],
        }

    return None


def _meta_docs(n: int) -> str:
    if n <= 0:
        return "sin documentos vivos"
    return f"{n} documento{'' if n == 1 else 's'} vivo{'' if n == 1 else 's'}"
