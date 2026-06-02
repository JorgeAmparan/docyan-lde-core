"""
Tests de la rutina de retención del FAT por familia (B7, decisión #12 / doc 08).
"""
from datetime import datetime, timezone

from app.audit.familias import RETENCION_ANIOS, FamiliaFAT
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.audit.retention import InMemoryBackupSink, aplicar_retencion

AHORA = datetime(2026, 6, 2, tzinfo=timezone.utc)


def _evento(fat: FATExtendido, familia: FamiliaFAT, anios_atras: float, eid: str) -> None:
    anio = 2026 - int(anios_atras)
    fat.registrar(
        tipo_evento=f"{familia.value}.x", familia=familia, tenant_id="t1",
        evento_id=eid, timestamp=f"{anio}-06-02T10:00:00+00:00",
    )


def test_retencion_elimina_solo_vencidos_con_backup_verificado():
    fat = FATExtendido(InMemoryFATStore())
    # F9 sistema retiene 2 años → un evento de hace 3 años está vencido.
    _evento(fat, FamiliaFAT.F9_SISTEMA, 3, "viejo-f9")
    # F7 gobernanza retiene 7 años → un evento de hace 3 años NO vence.
    _evento(fat, FamiliaFAT.F7_GOBERNANZA, 3, "joven-f7")
    backup = InMemoryBackupSink()

    res = aplicar_retencion(fat, "t1", backup=backup, ahora=AHORA)

    assert res.vencidos == 1
    assert res.eliminados == 1
    assert res.backup_ok
    # El vencido fue respaldado antes de eliminar.
    assert [e.evento_id for e in backup.respaldados] == ["viejo-f9"]
    # El no vencido sigue en el FAT.
    ids = {e.evento_id for e in fat.eventos("t1")}
    assert ids == {"joven-f7"}


def test_backup_fallido_no_elimina_nada():
    fat = FATExtendido(InMemoryFATStore())
    _evento(fat, FamiliaFAT.F9_SISTEMA, 5, "viejo")
    backup = InMemoryBackupSink(debe_fallar=True)

    res = aplicar_retencion(fat, "t1", backup=backup, ahora=AHORA)

    assert res.vencidos == 1
    assert res.eliminados == 0
    assert not res.backup_ok
    # Gate de seguridad: el evento sigue ahí pese a estar vencido.
    assert {e.evento_id for e in fat.eventos("t1")} == {"viejo"}


def test_sin_vencidos_no_toca_backup():
    fat = FATExtendido(InMemoryFATStore())
    _evento(fat, FamiliaFAT.F7_GOBERNANZA, 1, "reciente")
    backup = InMemoryBackupSink()
    res = aplicar_retencion(fat, "t1", backup=backup, ahora=AHORA)
    assert res.vencidos == 0 and res.eliminados == 0
    assert backup.respaldados == []


def test_retencion_por_familia_cubre_las_9():
    # Cada familia tiene una política de retención definida.
    assert set(RETENCION_ANIOS.keys()) == set(FamiliaFAT)
    assert RETENCION_ANIOS[FamiliaFAT.F7_GOBERNANZA] == 7
    assert RETENCION_ANIOS[FamiliaFAT.F9_SISTEMA] == 2
    assert RETENCION_ANIOS[FamiliaFAT.F4_CONSULTA] == 3
    assert RETENCION_ANIOS[FamiliaFAT.F8_ONBOARDING] == 5
