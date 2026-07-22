"""
Tests del caché semántico PCL — lookup/write, invalidación viva, multi-tenant,
TTL (B8.5 §1.3, doc §5).

DOCYAN LDE™ by XCID.
"""
import json
import time

from app.pcl.pcl_cache import (
    CacheConfig,
    InMemoryCacheBackend,
    PCLCache,
    contexto_fingerprint,
    coseno,
)
from tests.conftest import FakeEmbedder

RESP = {"payload": {"kind": "info_card", "titulo": "Par 40 Nm", "citas": []}}


def _cache(backend=None, state="v1", ttl=None):
    cfg = None
    if ttl is not None:
        cfg = type("C", (), {"get": lambda self, t: CacheConfig(ttl_segundos=ttl)})()
    return PCLCache(
        backend=backend or InMemoryCacheBackend(),
        embedder=FakeEmbedder(),
        config_provider=cfg,
        state_hasher=lambda tenant_id, ents: state,
    )


def test_miss_luego_write_luego_hit():
    c = _cache()
    ctx = {"entidad_id": "e1"}
    assert c.lookup("t1", "par de apriete", ctx) is None  # miss
    c.write("t1", "par de apriete", ctx, RESP, "synthesis_first", 0.04)
    hit = c.lookup("t1", "par de apriete", ctx)  # hit
    assert hit is not None
    assert hit.similitud >= 0.92
    assert hit.entry["respuesta"] == RESP
    assert hit.entry["modo"] == "synthesis_first"


def test_hit_invalido_vivo_por_state_hash_desactualizado():
    backend = InMemoryCacheBackend()
    ctx = {"entidad_id": "e1"}
    escritor = _cache(backend, state="v1")
    escritor.write("t1", "par de apriete", ctx, RESP, "retrieval_first", 0.0)

    # Otro lector con el DKG cambiado (state v2): el hit es inválido y se elimina.
    lector = _cache(backend, state="v2")
    assert lector.lookup("t1", "par de apriete", ctx) is None
    # La entrada quedó eliminada: ni con el state original re-aparece.
    assert escritor.lookup("t1", "par de apriete", ctx) is None


def test_invalidacion_viva_por_entidades_solo_afectadas():
    c = _cache()
    c.write("t1", "q sobre A", {"entidad_id": "eA"}, RESP, "retrieval_first", 0.0)
    c.write("t1", "q sobre B", {"entidad_id": "eB"}, RESP, "retrieval_first", 0.0)

    n = c.invalidate_by_entities("t1", ["eA"])
    assert n == 1
    assert c.lookup("t1", "q sobre A", {"entidad_id": "eA"}) is None  # invalidada
    assert c.lookup("t1", "q sobre B", {"entidad_id": "eB"}) is not None  # intacta


def test_invalidacion_por_documento_citado():
    c = _cache()
    resp_con_cita = {"payload": {"kind": "info_card", "titulo": "x",
                                 "citas": [{"documento_id": "doc-42"}]}}
    c.write("t1", "pregunta", {"entidad_id": "e1"}, resp_con_cita, "synthesis_first", 0.04)
    # Re-ingerir doc-42 invalida la respuesta que lo citaba.
    assert c.invalidate_by_entities("t1", ["doc-42"]) == 1
    assert c.lookup("t1", "pregunta", {"entidad_id": "e1"}) is None


def test_multi_tenant_no_contamina():
    backend = InMemoryCacheBackend()
    ca = _cache(backend)
    rA = {"payload": {"kind": "info_card", "titulo": "A", "citas": []}}
    rB = {"payload": {"kind": "info_card", "titulo": "B", "citas": []}}
    ca.write("tenant-A", "misma pregunta", {"entidad_id": "e1"}, rA, "retrieval_first", 0)
    ca.write("tenant-B", "misma pregunta", {"entidad_id": "e1"}, rB, "retrieval_first", 0)

    ha = ca.lookup("tenant-A", "misma pregunta", {"entidad_id": "e1"})
    hb = ca.lookup("tenant-B", "misma pregunta", {"entidad_id": "e1"})
    assert ha.entry["respuesta"]["payload"]["titulo"] == "A"
    assert hb.entry["respuesta"]["payload"]["titulo"] == "B"


def test_ttl_expira_y_limpia_indice():
    c = _cache(ttl=1)
    ctx = {"entidad_id": "e1"}
    c.write("t1", "pregunta", ctx, RESP, "synthesis_first", 0.04)
    # Forzar la expiración de la entrada (TTL vencido) en el backend en memoria.
    key = next(iter(c.backend._kv))
    _, val = c.backend._kv[key]
    c.backend._kv[key] = (time.time() - 1, val)
    assert c.lookup("t1", "pregunta", ctx) is None  # expirada → miss
    # El índice quedó limpio de la clave muerta.
    idx = c._idx_key("t1", contexto_fingerprint(ctx))
    assert key not in c.backend.smembers(idx)


def test_contexto_fingerprint_segrega_por_contexto():
    a = contexto_fingerprint({"entidad_id": "e1", "tipo_documento": "NOM"})
    b = contexto_fingerprint({"entidad_id": "e2", "tipo_documento": "NOM"})
    assert a != b
    assert a == contexto_fingerprint({"entidad_id": "e1", "tipo_documento": "NOM"})


def test_coseno():
    assert coseno([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert coseno([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert coseno([], [1.0]) == 0.0


def test_lookup_degrada_a_miss_si_embedder_falla():
    class EmbedderRoto:
        def embed(self, text):
            raise RuntimeError("BGE-M3 caído")

    c = PCLCache(backend=InMemoryCacheBackend(), embedder=EmbedderRoto(),
                 state_hasher=lambda t, e: "v")
    assert c.lookup("t1", "q", {"entidad_id": "e1"}) is None  # no rompe, degrada


# ── Purga de entradas pre-fix envenenadas (PRIORIDAD 0, paso 2) ───────────────


def _backdate(backend, tenant, pregunta, cached_at):
    """Simula una entrada ANTES del fix de fingerprint: cached_at antiguo."""
    for k in backend.scan(f"pcl:cache:{tenant}:*"):
        entry = json.loads(backend.get(k))
        if entry["pregunta"] == pregunta:
            entry["cached_at"] = cached_at
            backend.setex(k, 999999, json.dumps(entry))


def test_purga_solo_afecta_entradas_anteriores_al_cutoff():
    backend = InMemoryCacheBackend()
    c = _cache(backend)
    ctx_a = {"documento_id": "docA"}
    ctx_b = {"documento_id": "docB"}
    c.write("t1", "pregunta A", ctx_a, RESP, "retrieval_first", 0.0)
    c.write("t1", "pregunta B", ctx_b, RESP, "retrieval_first", 0.0)
    _backdate(backend, "t1", "pregunta A", cached_at=1000.0)  # pre-fix

    # dry-run: cuenta la candidata pero NO borra.
    dry = c.purgar_anteriores_a(2000.0, tenant_id="t1", dry_run=True)
    assert dry == {"escaneadas": 2, "purgadas": 1}
    assert c.lookup("t1", "pregunta A", ctx_a) is not None  # sigue viva tras dry-run

    # purga real: la pre-fix desaparece, la post-fix sobrevive.
    res = c.purgar_anteriores_a(2000.0, tenant_id="t1")
    assert res["purgadas"] == 1
    assert c.lookup("t1", "pregunta A", ctx_a) is None
    assert c.lookup("t1", "pregunta B", ctx_b) is not None


def test_purga_cross_tenant_cuando_tenant_id_es_none():
    backend = InMemoryCacheBackend()
    c = _cache(backend)
    c.write("t1", "q vieja t1", {"documento_id": "d1"}, RESP, "retrieval_first", 0.0)
    c.write("t2", "q vieja t2", {"documento_id": "d2"}, RESP, "retrieval_first", 0.0)
    _backdate(backend, "t1", "q vieja t1", cached_at=1000.0)
    _backdate(backend, "t2", "q vieja t2", cached_at=1000.0)

    res = c.purgar_anteriores_a(2000.0, tenant_id=None)  # todos los tenants
    assert res["purgadas"] == 2
    assert c.lookup("t1", "q vieja t1", {"documento_id": "d1"}) is None
    assert c.lookup("t2", "q vieja t2", {"documento_id": "d2"}) is None
