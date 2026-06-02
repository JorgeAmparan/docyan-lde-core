"""
Tests del FAT extendido — cadena criptográfica SHA-256 (B7, doc 08).

Cubre: determinismo del hash, cadena íntegra, detección de alteración y de hueco,
inmutabilidad por corrección, reconstrucción de estado.
"""
from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import (
    GENESIS_HASH,
    EventoFAT,
    FATExtendido,
    InMemoryFATStore,
    compute_hash_evento,
)
from app.audit.integrity_checker import verificar_cadena, verificar_tenant


def _fat() -> FATExtendido:
    return FATExtendido(InMemoryFATStore())


def _cadena(fat: FATExtendido, tenant: str, n: int) -> None:
    for i in range(n):
        fat.registrar(
            tipo_evento=f"F4.evento_{i}",
            familia=FamiliaFAT.F4_CONSULTA,
            tenant_id=tenant,
            actor_id="u1",
            payload={"i": i, "estado_set": {"contador": i}},
            evento_id=f"evt-{i:02d}",
            timestamp=f"2026-06-02T10:{i:02d}:00+00:00",
        )


# ── Hash determinista ─────────────────────────────────────────────────────────


def test_hash_es_determinista_y_sha256():
    h1 = compute_hash_evento(
        evento_id="e1", timestamp="2026-06-02T10:00:00+00:00",
        tipo_evento="F4.x", payload={"b": 2, "a": 1}, hash_evento_anterior="",
    )
    # Reordenar el payload no cambia el hash (JSON canónico).
    h2 = compute_hash_evento(
        evento_id="e1", timestamp="2026-06-02T10:00:00+00:00",
        tipo_evento="F4.x", payload={"a": 1, "b": 2}, hash_evento_anterior="",
    )
    assert h1 == h2
    assert len(h1) == 64 and all(c in "0123456789abcdef" for c in h1)


def test_genesis_usa_hash_anterior_vacio():
    fat = _fat()
    ev = fat.registrar(
        tipo_evento="F9.boot", familia=FamiliaFAT.F9_SISTEMA, tenant_id="t1",
    )
    assert ev.hash_evento_anterior == GENESIS_HASH
    assert ev.hash_valido()


def test_cada_evento_encadena_al_anterior():
    fat = _fat()
    _cadena(fat, "t1", 5)
    eventos = fat.eventos("t1")
    for i in range(1, len(eventos)):
        assert eventos[i].hash_evento_anterior == eventos[i - 1].hash_evento


# ── Cadena íntegra ────────────────────────────────────────────────────────────


def test_cadena_de_10_eventos_integra():
    fat = _fat()
    _cadena(fat, "t1", 10)
    res = verificar_tenant(fat, "t1")
    assert res.integra
    assert res.total_eventos == 10
    assert res.primer_evento_roto is None


def test_aislamiento_por_tenant_cadenas_independientes():
    fat = _fat()
    _cadena(fat, "t1", 3)
    _cadena(fat, "t2", 3)
    assert verificar_tenant(fat, "t1").integra
    assert verificar_tenant(fat, "t2").integra
    # Primer evento de cada tenant es génesis (cadenas separadas).
    assert fat.eventos("t1")[0].hash_evento_anterior == GENESIS_HASH
    assert fat.eventos("t2")[0].hash_evento_anterior == GENESIS_HASH


# ── Detección de cadena rota ──────────────────────────────────────────────────


def test_alteracion_de_evento_intermedio_se_detecta():
    fat = _fat()
    _cadena(fat, "t1", 10)
    eventos = fat.eventos("t1")
    # Simular intrusión: alterar el payload del evento 5 SIN recalcular su hash.
    alterado = EventoFAT.from_dict({**eventos[5].to_dict(), "payload": {"i": 999}})
    eventos_intrusion = eventos[:5] + [alterado] + eventos[6:]
    res = verificar_cadena("t1", eventos_intrusion)
    assert not res.integra
    assert res.primer_evento_roto == "evt-05"
    assert res.tipo_problema == "alteracion"


def test_eliminacion_de_evento_intermedio_se_detecta_como_hueco():
    fat = _fat()
    _cadena(fat, "t1", 10)
    eventos = fat.eventos("t1")
    # Borrar el evento 4 → el 5 queda con un hash_anterior que ya no existe.
    eventos_con_hueco = eventos[:4] + eventos[5:]
    res = verificar_cadena("t1", eventos_con_hueco)
    assert not res.integra
    assert res.tipo_problema == "hueco"
    assert res.primer_evento_roto == "evt-05"


# ── Inmutabilidad por corrección ──────────────────────────────────────────────


def test_correccion_crea_nuevo_evento_y_no_edita_el_original():
    fat = _fat()
    original = fat.registrar(
        tipo_evento="F7.flag", familia=FamiliaFAT.F7_GOBERNANZA, tenant_id="t1",
        payload={"valor": "malo"}, evento_id="orig-1",
        timestamp="2026-06-02T10:00:00+00:00",
    )
    correccion = fat.corregir(
        evento_original_id=original.evento_id, tipo_evento="F7.flag_corregido",
        familia=FamiliaFAT.F7_GOBERNANZA, tenant_id="t1",
        payload={"valor": "bueno"}, timestamp="2026-06-02T10:05:00+00:00",
    )
    eventos = fat.eventos("t1")
    # El original sigue intacto con su valor y su hash.
    orig = next(e for e in eventos if e.evento_id == "orig-1")
    assert orig.payload == {"valor": "malo"}
    assert orig.hash_valido()
    # La corrección apunta al original y aparece en la cadena.
    assert correccion.corrige_evento_id == "orig-1"
    assert correccion in eventos
    assert verificar_tenant(fat, "t1").integra


# ── Reconstrucción de estado ──────────────────────────────────────────────────


def test_reconstruir_estado_en_dos_puntos_del_tiempo():
    fat = _fat()
    tenant, entidad = "t1", "doc-42"
    for i in range(5):
        fat.registrar(
            tipo_evento=f"F4.upd_{i}", familia=FamiliaFAT.F4_CONSULTA,
            tenant_id=tenant, entidad_afectada_tipo="documento",
            entidad_afectada_id=entidad,
            payload={"estado_set": {"version": i}},
            evento_id=f"e-{i}", timestamp=f"2026-06-02T10:0{i}:00+00:00",
        )
    estado_t1 = fat.reconstruir_estado_en(tenant, entidad, "2026-06-02T10:02:00+00:00")
    estado_t2 = fat.reconstruir_estado_en(tenant, entidad, "2026-06-02T10:09:00+00:00")
    assert estado_t1["estado"]["version"] == 2
    assert estado_t1["total_eventos_aplicados"] == 3
    assert estado_t2["estado"]["version"] == 4
    assert estado_t2["total_eventos_aplicados"] == 5
