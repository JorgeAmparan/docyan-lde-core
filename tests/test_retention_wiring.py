"""
Tests del cableado de retención del FAT (B7 cierre prod): enumeración de tenants
vivos + backup VERIFICADO a Supabase Storage antes de eliminar.

Se inyectan dobles de cliente (FakeSupabase con .table y .storage) que reproducen
el contrato de supabase-py. No se mockea la lógica del sink ni de la rutina.
"""
from datetime import datetime, timezone

from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.audit.retention import SupabaseStorageBackupSink, aplicar_retencion
from app.orchestrator.providers import tenants_vivos

AHORA = datetime(2026, 6, 2, tzinfo=timezone.utc)


# ── Fake supabase (.table + .storage) ─────────────────────────────────────────


class _TableQ:
    def __init__(self, rows):
        self._rows = rows
        self._eq = {}

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._eq[col] = val
        return self

    def execute(self):
        rows = [r for r in self._rows if all(r.get(k) == v for k, v in self._eq.items())]
        return type("R", (), {"data": rows})()


class _Bucket:
    def __init__(self, store):
        self._store = store
        self.fail_upload = False

    def upload(self, path, data, *_a, **_k):
        if self.fail_upload:
            raise RuntimeError("upload fail")
        self._store[path] = data

    def download(self, path):
        return self._store.get(path)


class FakeStorage:
    def __init__(self):
        self.objects = {}
        self._bucket = _Bucket(self.objects)

    def from_(self, _bucket):
        return self._bucket


class FakeSupabase:
    def __init__(self, users=None, api_keys=None):
        self._tables = {"users": users or [], "api_keys": api_keys or []}
        self.storage = FakeStorage()

    def table(self, name):
        return _TableQ(self._tables.get(name, []))


# ── tenants_vivos ─────────────────────────────────────────────────────────────


def test_tenants_vivos_une_users_y_api_keys_activos():
    sb = FakeSupabase(
        users=[{"org_id": "t1"}, {"org_id": "t2"}, {"org_id": "t1"}],
        api_keys=[{"org_id": "t3", "is_active": True}, {"org_id": "t4", "is_active": False}],
    )
    assert tenants_vivos(sb) == ["t1", "t2", "t3"]


# ── SupabaseStorageBackupSink ─────────────────────────────────────────────────


def _evento(fat, anios_atras, eid):
    fat.registrar(
        tipo_evento="F9.x", familia=FamiliaFAT.F9_SISTEMA, tenant_id="t1",
        evento_id=eid, timestamp=f"{2026 - anios_atras}-06-02T10:00:00+00:00",
    )


def test_backup_storage_verificado_permite_eliminar():
    sb = FakeSupabase()
    fat = FATExtendido(InMemoryFATStore())
    _evento(fat, 5, "viejo")  # F9 retiene 2 años → vencido
    sink = SupabaseStorageBackupSink(supabase=sb)
    res = aplicar_retencion(fat, "t1", backup=sink, ahora=AHORA)
    assert res.backup_ok and res.eliminados == 1
    # Quedó un objeto en el bucket (backup persistido).
    assert len(sb.storage.objects) == 1


def test_backup_storage_fallido_no_elimina():
    sb = FakeSupabase()
    sb.storage._bucket.fail_upload = True
    fat = FATExtendido(InMemoryFATStore())
    _evento(fat, 5, "viejo")
    sink = SupabaseStorageBackupSink(supabase=sb)
    res = aplicar_retencion(fat, "t1", backup=sink, ahora=AHORA)
    assert not res.backup_ok and res.eliminados == 0
    # El evento vencido sigue ahí (gate de seguridad).
    assert {e.evento_id for e in fat.eventos("t1")} == {"viejo"}
