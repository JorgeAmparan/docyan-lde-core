"""
Tests del store Supabase del FAT extendido con un doble de cliente (B7).

Se inyecta un FakeSupabase que reproduce el contrato fluido de supabase-py
(select/eq/order/limit/insert/delete/execute). NO se mockea la lógica del store
ni el hash chain: se ejercita el camino productivo real contra un cliente fake.
"""
from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import FATExtendido
from app.audit.integrity_checker import verificar_tenant
from app.audit.stores import SupabaseFATStore


class _Query:
    def __init__(self, table: "_Table"):
        self._t = table
        self._filtros: dict[str, object] = {}
        self._order: str | None = None
        self._desc = False
        self._limit: int | None = None
        self._op = "select"
        self._insert_row: dict | None = None
        self._in: tuple[str, list] | None = None

    # operaciones
    def insert(self, row):
        self._op = "insert"
        self._insert_row = row
        return self

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def delete(self):
        self._op = "delete"
        return self

    # filtros / modificadores
    def eq(self, col, val):
        self._filtros[col] = val
        return self

    def in_(self, col, vals):
        self._in = (col, list(vals))
        return self

    def order(self, col, desc=False):
        self._order = col
        self._desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        if self._op == "insert":
            self._t.rows.append(dict(self._insert_row))
            return _Res([dict(self._insert_row)])
        if self._op == "delete":
            col, vals = self._in
            borrados = [r for r in self._t.rows if r.get(col) in vals]
            self._t.rows = [r for r in self._t.rows if r.get(col) not in vals]
            return _Res(borrados)
        # select
        rows = [
            r for r in self._t.rows
            if all(r.get(k) == v for k, v in self._filtros.items())
        ]
        if self._order:
            rows = sorted(rows, key=lambda r: r.get(self._order) or "", reverse=self._desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return _Res(rows)


class _Res:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self):
        self.rows: list[dict] = []


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, _Table] = {}

    def table(self, name):
        self.tables.setdefault(name, _Table())
        return _Query(self.tables[name])


def test_supabase_fat_store_cadena_integra():
    store = SupabaseFATStore(supabase=FakeSupabase())
    fat = FATExtendido(store)
    for i in range(5):
        fat.registrar(
            tipo_evento=f"F4.e{i}", familia=FamiliaFAT.F4_CONSULTA, tenant_id="t1",
            evento_id=f"e-{i}", timestamp=f"2026-06-02T10:0{i}:00+00:00",
            payload={"i": i},
        )
    eventos = store.list_for_tenant("t1")
    assert len(eventos) == 5
    # last_hash refleja el último de la cadena (encadenamiento real).
    assert store.last_hash("t1") == eventos[-1].hash_evento
    assert verificar_tenant(fat, "t1").integra


def test_supabase_fat_store_aisla_por_tenant():
    sb = FakeSupabase()
    fat = FATExtendido(SupabaseFATStore(supabase=sb))
    fat.registrar(tipo_evento="F4.a", familia=FamiliaFAT.F4_CONSULTA, tenant_id="t1",
                  evento_id="a", timestamp="2026-06-02T10:00:00+00:00")
    fat.registrar(tipo_evento="F4.b", familia=FamiliaFAT.F4_CONSULTA, tenant_id="t2",
                  evento_id="b", timestamp="2026-06-02T10:00:00+00:00")
    s = SupabaseFATStore(supabase=sb)
    assert [e.evento_id for e in s.list_for_tenant("t1")] == ["a"]
    assert [e.evento_id for e in s.list_for_tenant("t2")] == ["b"]


def test_supabase_fat_store_delete():
    sb = FakeSupabase()
    store = SupabaseFATStore(supabase=sb)
    fat = FATExtendido(store)
    fat.registrar(tipo_evento="F4.x", familia=FamiliaFAT.F4_CONSULTA, tenant_id="t1",
                  evento_id="e1", timestamp="2026-06-02T10:00:00+00:00")
    assert store.delete_eventos(["e1"]) == 1
    assert store.list_for_tenant("t1") == []
