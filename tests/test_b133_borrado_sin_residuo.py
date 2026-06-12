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


def test_invalidar_tenant_borra_caché_incluidas_las_vacías_y_aísla_tenants():
    """B13.3 §5: invalidar_tenant borra TODA la caché del tenant —incluidas las
    respuestas VACÍAS (sin entidad_ids, que la invalidación por-entidad NO captura)—
    y NO toca otros tenants (multi-tenant absoluto)."""
    from app.pcl.pcl_cache import InMemoryCacheBackend, PCLCache

    b = InMemoryCacheBackend()
    cache = PCLCache(backend=b)
    # T: una entrada con entidades + una VACÍA (el caso del doc viejo de Jorge).
    b.setex("pcl:cache:T:h1:fp", 600, '{"entidad_ids":["e1"]}'); b.sadd("pcl:idx:T:fp", "pcl:cache:T:h1:fp")
    b.sadd("pcl:ent:T:e1", "pcl:cache:T:h1:fp")
    b.setex("pcl:cache:T:h2:fp", 600, '{"entidad_ids":[]}'); b.sadd("pcl:idx:T:fp", "pcl:cache:T:h2:fp")
    # Otro tenant, intacto.
    b.setex("pcl:cache:U:h9:fp", 600, '{"entidad_ids":["x"]}')

    n = cache.invalidar_tenant("T")
    assert n == 2                                  # las DOS entradas de T (incl. la vacía)
    assert b.scan("pcl:cache:T:*") == []           # nada de T sobrevive
    assert b.scan("pcl:ent:T:*") == []
    assert b.get("pcl:cache:U:h9:fp") is not None   # U intacto
