"""
Test de la invalidación viva del caché desde el worker de ingesta (B8.5 §3).

DOCYAN LDE™ by XCID.

B13.3 §5: al terminar una ingesta exitosa, el worker invalida el caché PCL a nivel
TENANT (no solo por-entidad). Una RE-ingesta de un doc borrado/re-extraído puede
cambiar respuestas YA cacheadas — incluidas las que devolvieron VACÍO con el doc
viejo (sin `entidad_ids`, que la invalidación por-entidad NO capturaba: ese era el
bug del documento "fantasma"). El grafo cambió ⇒ la caché vieja del tenant muere.
El aislamiento multi-tenant se preserva: otros tenants quedan intactos.
"""
from types import SimpleNamespace

from app.pcl.pcl_cache import InMemoryCacheBackend, PCLCache
from tests.conftest import FakeEmbedder
from worker.ingest_pipeline import IngestPipeline

RESP = {"payload": {"kind": "info_card", "titulo": "x", "citas": []}}


def test_entidades_modificadas_incluye_documento_y_extras():
    pipe = IngestPipeline()
    res = SimpleNamespace(entity_ids=["e1", "e2"])
    ents = pipe._entidades_modificadas(res, "doc-7")
    assert set(ents) == {"doc-7", "e1", "e2"}

    # Sin entidades extra, al menos el documento.
    assert pipe._entidades_modificadas(SimpleNamespace(), "doc-9") == ["doc-9"]


def test_invalidar_cache_purga_el_tenant_y_aisla_otros(monkeypatch):
    backend = InMemoryCacheBackend()
    cache = PCLCache(backend=backend, embedder=FakeEmbedder(),
                     state_hasher=lambda t, e: "v1")
    # Tres respuestas cacheadas del tenant t1: una atada al doc que se reingiere, otra
    # a otra entidad, y una respuesta VACÍA (sin entidad — el caso que la invalidación
    # por-entidad NO capturaba y dejaba servir "fantasma"). Más un tenant distinto t2.
    cache.write("t1", "q sobre doc-7", {"entidad_id": "doc-7"}, RESP, "retrieval_first", 0)
    cache.write("t1", "q sobre otro", {"entidad_id": "doc-otro"}, RESP, "retrieval_first", 0)
    cache.write("t1", "q sin match", {}, {"payload": {"kind": "info_card", "citas": []}}, "retrieval_first", 0)
    cache.write("t2", "q de otro tenant", {"entidad_id": "x"}, RESP, "retrieval_first", 0)

    # El worker construye PCLCache() sin args; lo apuntamos a nuestra instancia.
    monkeypatch.setattr("app.pcl.pcl_cache.PCLCache", lambda: cache)

    pipe = IngestPipeline()
    n = pipe._invalidar_cache("t1", SimpleNamespace(entity_ids=[]), "doc-7")
    # §5: TODAS las entradas de t1 mueren —incluida la VACÍA—, no solo la del doc.
    assert n == 3
    assert cache.lookup("t1", "q sobre doc-7", {"entidad_id": "doc-7"}) is None
    assert cache.lookup("t1", "q sobre otro", {"entidad_id": "doc-otro"}) is None
    assert cache.lookup("t1", "q sin match", {}) is None
    # Aislamiento multi-tenant: t2 intacto.
    assert cache.lookup("t2", "q de otro tenant", {"entidad_id": "x"}) is not None


def test_invalidar_cache_best_effort_no_rompe(monkeypatch):
    def _explota():
        raise RuntimeError("redis caído")

    monkeypatch.setattr("app.pcl.pcl_cache.PCLCache", _explota)
    pipe = IngestPipeline()
    # No debe propagar: la ingesta no falla por el caché.
    assert pipe._invalidar_cache("t1", SimpleNamespace(), "doc-7") == 0
