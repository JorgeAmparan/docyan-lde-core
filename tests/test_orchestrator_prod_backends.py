"""
Tests de los backends de PRODUCCIÓN del MO (B4): RedisSessionStore (decisión #6),
SupabaseSessionSpillover, SupabaseQrTokenStore y SupabaseAuditSink.

Se inyectan dobles de cliente (FakeRedis / FakeSupabase) que reproducen el
contrato real de redis-py / supabase-py. NO se mockea la lógica del store, solo el
cliente de red — así se ejecuta y verifica el camino productivo real.
"""
from app.orchestrator.audit_logger import SupabaseAuditSink
from app.orchestrator.session_manager import (
    RedisSessionStore,
    SessionState,
    SupabaseSessionSpillover,
)
from app.qr.store import QrTokenRecord, SupabaseQrTokenStore

# ── FakeRedis (subconjunto usado por RedisSessionStore) ───────────────────────


class FakeRedis:
    def __init__(self):
        self.kv: dict[str, str] = {}
        self.ttls: dict[str, int] = {}
        self.sets: dict[str, set] = {}

    def setex(self, key, ttl, value):
        self.kv[key] = value
        self.ttls[key] = int(ttl)

    def get(self, key):
        return self.kv.get(key)

    def expire(self, key, ttl):
        if key in self.kv:
            self.ttls[key] = int(ttl)
            return 1
        return 0

    def ttl(self, key):
        if key not in self.kv:
            return -2
        return self.ttls.get(key, -1)

    def delete(self, key):
        self.kv.pop(key, None)
        self.ttls.pop(key, None)

    def exists(self, key):
        return 1 if key in self.kv else 0

    def sadd(self, key, *vals):
        self.sets.setdefault(key, set()).update(vals)

    def srem(self, key, *vals):
        self.sets.setdefault(key, set()).difference_update(vals)

    def smembers(self, key):
        return set(self.sets.get(key, set()))


def test_redis_session_store_ciclo_completo():
    store = RedisSessionStore(client=FakeRedis())
    store.put("s1", '{"x":1}', 1800)
    assert store.get("s1") == '{"x":1}'
    assert store.ttl("s1") == 1800
    assert "s1" in store.active_ids()
    # refresh aplica nuevo TTL.
    assert store.refresh("s1", 3600) is True
    assert store.ttl("s1") == 3600
    # delete saca de kv e índice.
    store.delete("s1")
    assert store.get("s1") is None
    assert store.ttl("s1") is None
    assert "s1" not in store.active_ids()


def test_redis_session_store_purge_expired():
    r = FakeRedis()
    store = RedisSessionStore(client=r)
    store.put("s1", "{}", 1800)
    store.put("s2", "{}", 1800)
    # Simula expiración de s1 (Redis ya borró la clave pero el índice quedó).
    r.delete("docyan:session:s1")
    removed = store.purge_expired()
    assert removed == ["s1"]
    assert "s1" not in store.active_ids()
    assert "s2" in store.active_ids()


# ── FakeSupabase (contrato fluido de supabase-py) ─────────────────────────────


class _FakeQuery:
    def __init__(self, table):
        self.table = table
        self._filters = {}
        self._op = None
        self._payload = None

    def insert(self, payload):
        self._op = "insert"
        self.table.rows.append(dict(payload))
        return self

    def upsert(self, payload, on_conflict=None):
        self._op = "upsert"
        # Reemplaza por id si existe.
        rid = payload.get("id")
        self.table.rows = [r for r in self.table.rows if r.get("id") != rid]
        self.table.rows.append(dict(payload))
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def select(self, *_a):
        self._op = "select"
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def is_(self, col, _val):
        self._filters[col] = None
        return self

    def limit(self, _n):
        return self

    def _matches(self, row):
        for col, val in self._filters.items():
            if row.get(col) != val:
                return False
        return True

    def execute(self):
        if self._op == "update":
            afectadas = [r for r in self.table.rows if self._matches(r)]
            for r in afectadas:
                r.update(self._payload)
            return _Result(afectadas)
        if self._op == "select":
            return _Result([r for r in self.table.rows if self._matches(r)])
        return _Result(list(self.table.rows))


class _Result:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self):
        self.rows: list[dict] = []


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, _FakeTable] = {}

    def table(self, name):
        self.tables.setdefault(name, _FakeTable())
        return _FakeQuery(self.tables[name])


def test_supabase_qr_token_store():
    store = SupabaseQrTokenStore(client=FakeSupabase())
    store.save(QrTokenRecord(tenant_id="t1", entidad_id_dkg="e1", nonce="n1"))
    rec = store.get("t1", "n1")
    assert rec is not None and rec.entidad_id_dkg == "e1"
    assert store.get("t1", "noexiste") is None
    # Revoca (update con filtro revoked_at is null).
    assert store.revoke("t1", "n1") is True
    assert store.get("t1", "n1").is_revoked()
    # Segunda revocación: ya no hay filas con revoked_at null → False.
    assert store.revoke("t1", "n1") is False


def test_supabase_session_spillover():
    spill = SupabaseSessionSpillover(client=FakeSupabase())
    state = SessionState(
        session_id="s1", tenant_id="t1", user_id="u1", session_type="consulta",
        canal="pwa", started_at="2026-06-02T00:00:00+00:00",
        updated_at="2026-06-02T00:00:00+00:00", state={"k": "v"},
    )
    spill.save_completed(state, "fin")
    got = spill.get_completed("s1")
    assert got["closed_reason"] == "fin"
    assert got["state"] == {"k": "v"}


def test_providers_construyen_sin_conexion():
    """Los providers de producción construyen sin tocar red (backends lazy)."""
    from app.orchestrator import providers
    from app.orchestrator.master_orchestrator import MasterOrchestrator

    assert providers.get_session_manager() is not None
    assert providers.get_audit_logger() is not None
    assert providers.get_pipeline_coordinator() is not None
    assert providers.get_qr_generator() is not None
    assert providers.get_qr_resolver() is not None
    assert isinstance(providers.get_master_orchestrator(), MasterOrchestrator)


def test_supabase_audit_sink():
    from app.core.matrix import TraceabilityMatrix

    # TraceabilityMatrix con cliente Supabase falso (no toca red).
    fake = FakeSupabase()
    matrix = TraceabilityMatrix.__new__(TraceabilityMatrix)
    matrix.org_id = "t1"
    matrix.supabase = fake
    sink = SupabaseAuditSink(matrix=matrix)
    sink.record("t1", "request_received", "u1", {"canal": "pwa"})
    rows = fake.tables["audit_trail"].rows
    assert len(rows) == 1
    assert rows[0]["component"] == "MO"
    assert rows[0]["org_id"] == "t1"
