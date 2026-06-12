"""
Gestión del ciclo de vida del DOCUMENTO sobre el DKG (B13 §1.5).

En el MVP de Consulta Viva, los "documentos vivos" del cliente NO viven en la
tabla Postgres `documents` (esa es del pipeline DII legado, fuera de alcance);
viven en el grafo del tenant como nodos `:DocumentoSource` (id = SHA-256 del
contenido), creados por el bridge de procedencia al cerrar la ingesta
(`app/graph/dkg_provenance.py`). Su contenido consultable cuelga vía `:CONTIENE`.

Este módulo da las operaciones de cuenta sobre ese modelo:
  · `contar_documentos`  — cuántos documentos vivos tiene el tenant (para el límite).
  · `listar_documentos`  — metadata de cada documento (sin contenido del texto).
  · `eliminar_documento` — quita el `:DocumentoSource` y su contenido EXCLUSIVO del
    grafo (nodos, aristas, procedencia). No toca contenido compartido por OTRO
    documento (grafos multi-documento) ni `:EntidadOperativa` (metadato del QR).

Multi-tenant estricto: toda operación pasa por `client.query(tenant_id, ...)`, que
confina el alcance al grafo `docyan_tenant_<id>` (no hay query cruzada).
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("docyan.dkg.documents")


def contar_documentos(client: Any, tenant_id: str) -> int:
    """Número de documentos vivos (`:DocumentoSource`) del tenant."""
    rows = client.query(
        tenant_id, "MATCH (d:DocumentoSource) RETURN count(d) AS c", {}
    )
    return int((rows[0].get("c") if rows else 0) or 0)


def listar_documentos(client: Any, tenant_id: str) -> list[dict]:
    """
    Lista los documentos vivos del tenant con SOLO metadata (id, archivo, tipo,
    versión, hash, nº de nodos de contenido). Nunca el texto del documento.
    """
    rows = client.query(
        tenant_id,
        """
        MATCH (d:DocumentoSource)
        OPTIONAL MATCH (d)-[:CONTIENE]->(x)
        RETURN d.id AS id,
               d.nombre_archivo AS nombre_archivo,
               d.tipo_documento AS tipo_documento,
               d.version_documento AS version,
               d.hash_contenido AS hash_contenido,
               d.idioma_origen AS idioma_origen,
               count(x) AS contenido_directo
        ORDER BY d.nombre_archivo
        """,
        {},
    )
    return rows


def documento_existe(client: Any, tenant_id: str, doc_id: str) -> bool:
    rows = client.query(
        tenant_id,
        "MATCH (d:DocumentoSource {id: $doc_id}) RETURN d.id AS id",
        {"doc_id": doc_id},
    )
    return bool(rows)


def eliminar_documento(client: Any, tenant_id: str, doc_id: str) -> dict[str, int]:
    """
    Elimina del grafo el `:DocumentoSource` y su contenido EXCLUSIVO (sin residuo).

    Conservador en grafos multi-documento: solo borra los nodos de contenido
    alcanzables vía `:CONTIENE*` que NO estén contenidos por otro `:DocumentoSource`
    distinto. `:EntidadOperativa` (metadato del equipo del QR) nunca se borra: solo
    se desprende su arista (`DETACH DELETE` sobre los nodos de contenido).

    Devuelve contadores {contenido_eliminado, documento_eliminado}.
    """
    # Selección del contenido EXCLUSIVO del documento: nodos alcanzables vía
    # :CONTIENE* que NO estén contenidos por ningún OTRO :DocumentoSource. Se hace
    # con OPTIONAL MATCH + count (FalkorDB no soporta el filtro `| o` dentro de una
    # pattern comprehension con WHERE). `otros = 0` ⇒ el nodo es exclusivo.
    _seleccion_exclusiva = """
        MATCH (d:DocumentoSource {id: $doc_id})-[:CONTIENE*1..]->(x)
        WHERE NOT 'DocumentoSource' IN labels(x)
        WITH DISTINCT x
        OPTIONAL MATCH (o:DocumentoSource)-[:CONTIENE]->(x)
        WHERE o.id <> $doc_id
        WITH x, count(o) AS otros
        WHERE otros = 0
    """

    rows = client.query(
        tenant_id,
        _seleccion_exclusiva + "RETURN count(x) AS c",
        {"doc_id": doc_id},
    )
    contenido = int((rows[0].get("c") if rows else 0) or 0)

    client.query(
        tenant_id,
        _seleccion_exclusiva + "DETACH DELETE x",
        {"doc_id": doc_id},
    )

    # Finalmente el propio :DocumentoSource (DETACH borra DOCUMENTADA_POR, etc.).
    client.query(
        tenant_id,
        "MATCH (d:DocumentoSource {id: $doc_id}) DETACH DELETE d",
        {"doc_id": doc_id},
    )

    # RESIDUO DEL SDK (B13.3 fix): el `:Document {id}` de GraphRAG-SDK y sus `:Chunk`
    # (vía `:PART_OF`) NO cuelgan de `:CONTIENE`, así que la limpieza por contenido
    # no los toca. Sin esto, borrar deja cientos de `:Chunk` huérfanos — el bug del
    # "documento desaparecido que deja rastro". `doc_id` == SHA == `:Document.id`.
    rc = client.query(
        tenant_id,
        "MATCH (doc:Document {id: $doc_id})-[:PART_OF]->(ch:Chunk) RETURN count(ch) AS c",
        {"doc_id": doc_id},
    )
    chunks_sdk = int((rc[0].get("c") if rc else 0) or 0)
    client.query(
        tenant_id,
        "MATCH (doc:Document {id: $doc_id})-[:PART_OF]->(ch:Chunk) DETACH DELETE ch",
        {"doc_id": doc_id},
    )
    client.query(
        tenant_id,
        "MATCH (doc:Document {id: $doc_id}) DETACH DELETE doc",
        {"doc_id": doc_id},
    )

    logger.info(
        "documento eliminado | tenant=%s doc=%s | contenido=%d chunks_sdk=%d",
        tenant_id, doc_id[:12], contenido, chunks_sdk,
    )
    return {"contenido_eliminado": contenido, "documento_eliminado": 1,
            "chunks_sdk_eliminados": chunks_sdk}


def rastro_documento(client: Any, tenant_id: str, doc_id: str) -> int:
    """Cuenta TODO rastro del documento: `:DocumentoSource` + su contenido por
    `:CONTIENE` + el residuo del SDK (`:Document` + `:Chunk` por `:PART_OF`). 0 ⇒
    borrado verdaderamente sin residuo (aserción del test de borrado)."""
    rows = client.query(
        tenant_id,
        """
        OPTIONAL MATCH (d:DocumentoSource {id: $doc_id})
        OPTIONAL MATCH (d)-[:CONTIENE*1..]->(x) WHERE NOT 'DocumentoSource' IN labels(x)
        OPTIONAL MATCH (doc:Document {id: $doc_id})
        OPTIONAL MATCH (doc)-[:PART_OF]->(ch:Chunk)
        RETURN count(DISTINCT d)+count(DISTINCT x)+count(DISTINCT doc)+count(DISTINCT ch) AS total
        """,
        {"doc_id": doc_id},
    )
    return int((rows[0].get("total") if rows else 0) or 0)
