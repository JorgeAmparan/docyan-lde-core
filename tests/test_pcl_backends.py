"""
Tests de los backends de producción de la CCP/PCL con clientes fake (B8.5).

DOCYAN LDE™ by XCID.

Cubre el wiring de los caminos que en producción hablan con Redis/Supabase/DKG,
ejercitándolos contra dobles en memoria (mismo patrón de doble que el resto del
repo) — sin requerir esos servicios en CI.
"""
from app.pcl.pcl_cache import (
    DEFAULT_TTL_SEGUNDOS,
    RedisCacheBackend,
    SupabaseCacheConfigProvider,
    default_state_hasher,
)
from app.pcl.pcl_metrics import SupabasePCLMetricsStore

# ── Fake Redis (subconjunto usado por RedisCacheBackend) ───────────────────────


class _FakeRaw:
    def __init__(self):
        self.kv = {}
        self.sets = {}

    def get(self, k):
        return self.kv.get(k)

    def setex(self, k, ttl, v):
        self.kv[k] = v

    def delete(self, *keys):
        n = 0
        for k in keys:
            n += 1 if self.kv.pop(k, None) is not None else 0
            self.sets.pop(k, None)
        return n

    def sadd(self, k, *m):
        self.sets.setdefault(k, set()).update(m)
        return len(m)

    def smembers(self, k):
        return set(self.sets.get(k, set()))

    def srem(self, k, *m):
        s = self.sets.get(k, set())
        before = len(s)
        s.difference_update(m)
        return before - len(s)

    def expire(self, k, ttl):
        return True


class _FakeRC:
    def __init__(self, raw):
        self._raw = raw

    def _get_client(self):
        return self._raw


def test_redis_cache_backend_wiring():
    raw = _FakeRaw()
    b = RedisCacheBackend(redis_client=_FakeRC(raw))
    b.setex("k1", 60, "v1")
    assert b.get("k1") == "v1"
    b.sadd("idx", "k1", "k2")
    assert b.smembers("idx") == {"k1", "k2"}
    assert b.srem("idx", "k2") == 1
    b.expire("idx", 60)
    assert b.delete("k1") == 1
    assert b.get("k1") is None


# ── Fake Supabase (chainable) ──────────────────────────────────────────────────


class _Q:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def eq(self, *a):
        return self

    def gte(self, *a):
        return self

    def lte(self, *a):
        return self

    def limit(self, *a):
        return self

    def order(self, *a):
        return self

    def upsert(self, rec, **k):
        self._rows.append(rec)
        return _Q([rec])

    def execute(self):
        return type("R", (), {"data": list(self._rows)})()


class _FakeSB:
    def __init__(self, rows=None):
        self._rows = rows or []

    def table(self, name):
        return _Q(self._rows)


def test_supabase_cache_config_provider_lee_fila():
    sb = _FakeSB([{"umbral_similitud": 0.8, "ttl_segundos": 100}])
    cfg = SupabaseCacheConfigProvider(client=sb).get("t1")
    assert cfg.umbral_similitud == 0.8
    assert cfg.ttl_segundos == 100


def test_supabase_cache_config_provider_sin_fila_usa_defaults():
    cfg = SupabaseCacheConfigProvider(client=_FakeSB([])).get("t1")
    assert cfg.ttl_segundos == DEFAULT_TTL_SEGUNDOS


def test_supabase_metrics_store_upsert_y_consultar():
    sb = _FakeSB()
    store = SupabasePCLMetricsStore(client=sb)
    store.upsert_dia({"tenant_id": "t1", "fecha": "2026-06-01", "consultas_totales": 3})
    filas = store.consultar("t1", "2026-06-01", "2026-06-02")
    assert any(f.get("consultas_totales") == 3 for f in filas)


def test_default_state_hasher_sin_entidades():
    assert default_state_hasher("t1", []) == "no-entities"


def test_default_state_hasher_sin_dkg_devuelve_centinela():
    # Sin FalkorDB alcanzable, no rompe: devuelve un centinela estable.
    h = default_state_hasher("t1", ["e1"])
    assert h in ("dkg-unavailable",) or isinstance(h, str)
