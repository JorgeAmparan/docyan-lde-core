"""
B13.3 fix — borrado VERDADERAMENTE sin residuo + idempotencia que se limpia.

DOCYAN LDE™ by XCID.

El bug del "documento que desaparece y deja rastro / queda vivo sin estarlo":
  · `eliminar_documento` debía borrar TAMBIÉN el residuo del SDK (`:Document` +
    `:Chunk` por `:PART_OF`), no solo el contenido por `:CONTIENE`.
  · al borrar, debe limpiarse la marca de idempotencia para que re-subir el MISMO
    archivo RE-EXTRAIGA (en vez de cerrar "completed" reusando un resultado viejo).
"""
from __future__ import annotations

import uuid

from app.graph import dkg_documents
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from tests.conftest import requires_falkordb


@requires_falkordb
def test_borrado_sin_residuo_incluye_chunks_del_sdk(dkg):
    """Tras borrar, NINGÚN rastro del doc queda en el grafo — ni el residuo del SDK."""
    tenant = f"b133-resid-{uuid.uuid4().hex[:8]}"
    dkg.track(tenant)
    doc_id = "sha-doc-1"
    # :DocumentoSource + contenido (vía :CONTIENE) + residuo SDK (:Document + :Chunk vía :PART_OF).
    dkg.query(tenant, "CREATE (d:DocumentoSource {id:$id, nombre_archivo:'x.pdf', tipo_documento:'msds'})", {"id": doc_id})
    dkg.query(tenant, "MATCH (d:DocumentoSource {id:$id}) CREATE (e:Especificacion {id:'e1', valor:'v'}) MERGE (d)-[:CONTIENE]->(e)", {"id": doc_id})
    dkg.query(tenant, "CREATE (doc:Document {id:$id, path:'x', content_hash:$id})", {"id": doc_id})
    for i in range(5):
        dkg.query(tenant, "MATCH (doc:Document {id:$id}) CREATE (c:Chunk {id:$cid, text:'t'}) MERGE (doc)-[:PART_OF]->(c)", {"id": doc_id, "cid": f"c{i}"})

    # Pre-condición: hay rastro (DocumentoSource + 1 contenido + Document + 5 chunks = 8).
    assert dkg_documents.rastro_documento(dkg, tenant, doc_id) > 0

    cont = dkg_documents.eliminar_documento(dkg, tenant, doc_id)
    assert cont["chunks_sdk_eliminados"] == 5

    # Post-condición: CERO rastro — borrado verdaderamente sin residuo (incl. SDK).
    assert dkg_documents.rastro_documento(dkg, tenant, doc_id) == 0
    assert dkg_documents.contar_documentos(dkg, tenant) == 0
    # Ni Document ni Chunk del SDK sobreviven.
    assert (dkg.query(tenant, "MATCH (n) WHERE n:Document OR n:Chunk RETURN count(n) AS c", {})[0]["c"]) == 0


def test_borrar_idempotencia_permite_reextraer():
    """La marca de idempotencia se limpia: re-subir el mismo SHA ya NO es idempotente."""
    disp = JobDispatcher(backend=InMemoryQueueBackend())
    t, sha = "org-x", "sha-abc"
    disp.backend.record_ingested(t, sha, {"resultado": {"document_id": sha}})
    assert disp.buscar_idempotente(t, sha) is not None        # estaba marcado
    disp.borrar_idempotencia(t, sha)
    assert disp.buscar_idempotente(t, sha) is None             # ya no → re-extrae
