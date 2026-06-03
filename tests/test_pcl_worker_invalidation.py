"""
Test de la invalidación viva del caché desde el worker de ingesta (B8.5 §3).

DOCYAN LDE™ by XCID.

Al terminar una ingesta exitosa, el worker invalida SOLO las entradas del caché
atadas a las entidades modificadas (incluido el documento recién ingestado),
nunca el caché entero (doc CCP §5.3).
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


def test_invalidar_cache_borra_solo_lo_afectado(monkeypatch):
    backend = InMemoryCacheBackend()
    cache = PCLCache(backend=backend, embedder=FakeEmbedder(),
                     state_hasher=lambda t, e: "v1")
    # Dos respuestas cacheadas: una atada al documento que se reingiere, otra no.
    cache.write("t1", "q sobre doc-7", {"entidad_id": "doc-7"}, RESP, "retrieval_first", 0)
    cache.write("t1", "q sobre otro", {"entidad_id": "doc-otro"}, RESP, "retrieval_first", 0)

    # El worker construye PCLCache() sin args; lo apuntamos a nuestra instancia.
    monkeypatch.setattr("app.pcl.pcl_cache.PCLCache", lambda: cache)

    pipe = IngestPipeline()
    n = pipe._invalidar_cache("t1", SimpleNamespace(entity_ids=[]), "doc-7")
    assert n == 1
    assert cache.lookup("t1", "q sobre doc-7", {"entidad_id": "doc-7"}) is None  # invalidada
    assert cache.lookup("t1", "q sobre otro", {"entidad_id": "doc-otro"}) is not None  # intacta


def test_invalidar_cache_best_effort_no_rompe(monkeypatch):
    def _explota():
        raise RuntimeError("redis caído")

    monkeypatch.setattr("app.pcl.pcl_cache.PCLCache", _explota)
    pipe = IngestPipeline()
    # No debe propagar: la ingesta no falla por el caché.
    assert pipe._invalidar_cache("t1", SimpleNamespace(), "doc-7") == 0
