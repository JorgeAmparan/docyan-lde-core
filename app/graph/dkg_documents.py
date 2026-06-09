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
    # Filtro de exclusividad: el nodo de contenido x no está contenido por ningún
    # OTRO documento (pattern comprehension con WHERE → size()==0).
    _exclusivo = (
        "WHERE NOT 'DocumentoSource' IN labels(x) "
        "AND size([ (o:DocumentoSource)-[:CONTIENE]->(x) WHERE o.id <> $doc_id | o ]) = 0"
    )

    rows = client.query(
        tenant_id,
        f"""
        MATCH (d:DocumentoSource {{id: $doc_id}})-[:CONTIENE*1..]->(x)
        {_exclusivo}
        RETURN count(DISTINCT x) AS c
        """,
        {"doc_id": doc_id},
    )
    contenido = int((rows[0].get("c") if rows else 0) or 0)

    client.query(
        tenant_id,
        f"""
        MATCH (d:DocumentoSource {{id: $doc_id}})-[:CONTIENE*1..]->(x)
        {_exclusivo}
        DETACH DELETE x
        """,
        {"doc_id": doc_id},
    )

    # Finalmente el propio :DocumentoSource (DETACH borra DOCUMENTADA_POR, etc.).
    client.query(
        tenant_id,
        "MATCH (d:DocumentoSource {id: $doc_id}) DETACH DELETE d",
        {"doc_id": doc_id},
    )

    logger.info(
        "documento eliminado | tenant=%s doc=%s | contenido=%d",
        tenant_id, doc_id[:12], contenido,
    )
    return {"contenido_eliminado": contenido, "documento_eliminado": 1}
