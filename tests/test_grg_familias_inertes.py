"""
Tests de las familias GRG MODELADAS pero INERTES en MVP (B7, doc 07).

F1 lock terminológico, F4 fidelidad no-traducibles, F5 validación segmento,
F6 consistencia cross-segmento. Lógica pura, testada AISLADAMENTE — NO enchufada
al pipeline activo (ver docs/grg_familias_inertes_mvp.md).
"""
from app.governance.familias_grg import AccionGRG, FamiliaGRG
from app.governance.familias_inertes import (
    CPS_MAX_SUBTITULO,
    f1_lock_terminologico,
    f4_fidelidad_no_traducibles,
    f5_validar_segmento,
    f6_consistencia_cross_segmento,
)

# ── F1 — lock terminológico ───────────────────────────────────────────────────


def test_f1_lock_respetado():
    res = f1_lock_terminologico(
        "El generador debe identificarse.",
        "The generator must be identified.",
        {"generador": "generator"},
    )
    assert res.aprobada
    assert res.familia == FamiliaGRG.F1_LOCK_TERMINOLOGICO


def test_f1_lock_violado_bloquea():
    res = f1_lock_terminologico(
        "El generador debe identificarse.",
        "The producer must be identified.",  # 'generator' no aparece
        {"generador": "generator"},
    )
    assert not res.aprobada
    assert res.accion == AccionGRG.BLOQUEAR
    assert res.detalle["violaciones"][0]["esperado"] == "generator"


# ── F4 — fidelidad de no-traducibles ──────────────────────────────────────────


def test_f4_preserva_formula_unidad_y_marcador():
    res = f4_fidelidad_no_traducibles(
        "Agregue 250 mg de CaCO3 al recipiente {tanque}.",
        "Add 250 mg of CaCO3 to the {tanque} container.",
    )
    assert res.aprobada


def test_f4_pierde_no_traducible_bloquea():
    res = f4_fidelidad_no_traducibles(
        "Mantener a 250 mg y registrar {lote}.",
        "Keep at 250 mg and record the batch.",  # se perdió {lote}
    )
    assert not res.aprobada
    assert "{lote}" in res.detalle["perdidos"]


# ── F5 — validación por tipo de segmento traducido ────────────────────────────


def test_f5_subtitulo_cps_excedido_falla():
    texto = "x" * 100
    res = f5_validar_segmento("subtitulo", texto, duracion_seg=1.0)
    assert not res.aprobada
    assert len(texto) / 1.0 > CPS_MAX_SUBTITULO


def test_f5_subtitulo_legible_ok():
    res = f5_validar_segmento("subtitulo", "Hola mundo", duracion_seg=5.0)
    assert res.aprobada


def test_f5_etiqueta_diagrama_larga_falla():
    res = f5_validar_segmento("etiqueta_diagrama", "x" * 50, longitud_max=20)
    assert not res.aprobada


def test_f5_advertencia_sin_palabra_ansi_falla():
    res = f5_validar_segmento("advertencia", "Tenga cuidado con esto.")
    assert not res.aprobada


def test_f5_advertencia_con_palabra_ansi_ok():
    res = f5_validar_segmento("advertencia", "ADVERTENCIA: superficie caliente.")
    assert res.aprobada


def test_f5_paso_sin_imperativo_falla():
    res = f5_validar_segmento("paso", "El proceso es general.")
    assert not res.aprobada


# ── F6 — consistencia cross-segmento ──────────────────────────────────────────


def test_f6_termino_inconsistente_falla():
    res = f6_consistencia_cross_segmento(
        {"valve": ["válvula", "valvula", "llave"]}
    )
    assert not res.aprobada
    assert "valve" in res.detalle["inconsistencias"]


def test_f6_consistente_ok():
    res = f6_consistencia_cross_segmento(
        {"valve": ["válvula", "válvula"], "tank": ["tanque"]}
    )
    assert res.aprobada
