"""
B13 — gestión de documentos vivos sobre el DKG REAL (FalkorDB).

Ejercita el Cypher de `app/graph/dkg_documents.py` contra un FalkorDB real (se
salta si no hay uno disponible; CI lo provee). Verifica: conteo, listado, borrado
sin residuo del contenido exclusivo y aislamiento entre tenants.
"""
from __future__ import annotations

import uuid

from app.graph import dkg_documents
from tests.conftest import requires_falkordb


def _crear_documento(client, tenant, doc_id, *, nombre, n_contenido):
    """Crea un :DocumentoSource con N nodos de contenido enlazados por :CONTIENE."""
    client.query(
        tenant,
        """
        CREATE (d:DocumentoSource {id: $id, nombre_archivo: $nombre,
                                   tipo_documento: 'MSDS', version_documento: 'v1'})
        """,
        {"id": doc_id, "nombre": nombre},
    )
    for i in range(n_contenido):
        client.query(
            tenant,
            """
            MATCH (d:DocumentoSource {id: $id})
            CREATE (e:Especificacion {id: $eid, valor: $v})
            MERGE (d)-[:CONTIENE]->(e)
            """,
            {"id": doc_id, "eid": f"{doc_id}-e{i}", "v": f"val-{i}"},
        )


@requires_falkordb
def test_contar_listar_eliminar_documento(dkg):
    tenant = f"b13-docs-{uuid.uuid4().hex[:8]}"
    dkg.track(tenant)
    _crear_documento(dkg, tenant, "doc-1", nombre="MSDS-1.pdf", n_contenido=3)
    _crear_documento(dkg, tenant, "doc-2", nombre="MSDS-2.pdf", n_contenido=2)

    assert dkg_documents.contar_documentos(dkg, tenant) == 2
    listado = dkg_documents.listar_documentos(dkg, tenant)
    assert {d["id"] for d in listado} == {"doc-1", "doc-2"}
    assert any(d["contenido_directo"] == 3 for d in listado)

    # Eliminar doc-1: se va el :DocumentoSource y su contenido EXCLUSIVO, sin residuo.
    contadores = dkg_documents.eliminar_documento(dkg, tenant, "doc-1")
    assert contadores["documento_eliminado"] == 1
    assert contadores["contenido_eliminado"] == 3

    assert dkg_documents.contar_documentos(dkg, tenant) == 1
    assert not dkg_documents.documento_existe(dkg, tenant, "doc-1")
    # El contenido exclusivo de doc-1 ya no existe en el grafo.
    huerfanos = dkg.query(
        tenant, "MATCH (e:Especificacion {id: $eid}) RETURN e.id AS id",
        {"eid": "doc-1-e0"},
    )
    assert huerfanos == []
    # doc-2 sigue intacto.
    assert dkg_documents.documento_existe(dkg, tenant, "doc-2")


@requires_falkordb
def test_eliminar_aislado_por_tenant(dkg):
    t_a = f"b13-a-{uuid.uuid4().hex[:8]}"
    t_b = f"b13-b-{uuid.uuid4().hex[:8]}"
    dkg.track(t_a)
    dkg.track(t_b)
    _crear_documento(dkg, t_a, "shared-id", nombre="A.pdf", n_contenido=1)
    _crear_documento(dkg, t_b, "shared-id", nombre="B.pdf", n_contenido=1)

    # Borrar en A no afecta a B (mismo id, grafos distintos).
    dkg_documents.eliminar_documento(dkg, t_a, "shared-id")
    assert dkg_documents.contar_documentos(dkg, t_a) == 0
    assert dkg_documents.contar_documentos(dkg, t_b) == 1
