"""
Moneda Multimercado §3 (decisión Jorge 12-jun-2026) — cotización de ingesta en MXN.

DOCYAN LDE™ by XCID.

ÚNICO punto del modelo comercial con FX en vivo: Banxico FIX + 3 % de margen,
redondeo hacia ARRIBA a múltiplo de $10 MXN, congelado al cotizar. Aquí se ejercita
la conversión pura y la degradación honesta a fallback (sin token / API caída).
"""
from __future__ import annotations

from app.ingesta.fx_banxico import (
    FixQuote,
    _ceil_a_multiplo,
    convertir_usd_a_mxn,
    obtener_fix,
)


def _fix(valor: float) -> FixQuote:
    return FixQuote(fix=valor, fecha="12/06/2026", fuente="banxico")


# ── Redondeo hacia arriba a múltiplo de $10 ─────────────────────────────────


def test_redondeo_ceil_a_10():
    assert _ceil_a_multiplo(300.0, 10) == 300   # exacto se queda
    assert _ceil_a_multiplo(300.01, 10) == 310  # cualquier exceso sube
    assert _ceil_a_multiplo(301.0, 10) == 310
    assert _ceil_a_multiplo(309.99, 10) == 310
    assert _ceil_a_multiplo(0.1, 10) == 10


# ── Conversión USD→MXN: FIX × (1+margen), ceil $10, congelada ────────────────


def test_setup_15usd_a_mxn_con_margen_y_ceil():
    # $15 × 19.50 × 1.03 = 301.275 → ceil $10 → 310 MXN.
    c = convertir_usd_a_mxn(15.0, fix=_fix(19.50))
    assert c.mxn == 310
    assert c.fix == 19.50
    assert c.margen == 0.03
    assert c.fuente == "banxico"
    assert c.fecha == "12/06/2026"


def test_ejemplo_fx_20():
    # $15 × 20 × 1.03 = 309.0 → 309 no es múltiplo de 10 → ceil $10 = 310 MXN.
    c = convertir_usd_a_mxn(15.0, fix=_fix(20.0))
    assert c.mxn == 310


def test_setup_alto_redondea_arriba():
    # $37.50 (costo×25 de un doc grande) × 19.5 × 1.03 ≈ 753.19 → 760 MXN.
    c = convertir_usd_a_mxn(37.50, fix=_fix(19.5))
    assert c.mxn == 760
    assert c.mxn % 10 == 0


def test_congelado_usa_el_fix_inyectado_no_el_vivo():
    # Inyectar un FIX (congelado al cotizar) NO debe tocar la red.
    c1 = convertir_usd_a_mxn(15.0, fix=_fix(18.0))
    c2 = convertir_usd_a_mxn(15.0, fix=_fix(22.0))
    assert c1.mxn != c2.mxn  # distinto FIX → distinto MXN (se respeta el congelado)


# ── Degradación honesta: sin token / API caída → fallback marcado ───────────


def test_fallback_sin_token(monkeypatch):
    monkeypatch.delenv("BANXICO_TOKEN", raising=False)
    monkeypatch.setenv("BANXICO_FIX_FALLBACK", "19.0")
    # Limpia la caché del día para forzar la resolución.
    import app.ingesta.fx_banxico as fx

    fx._cache.clear()
    q = obtener_fix()
    assert q.fuente == "fallback"
    assert q.fix == 19.0
    fx._cache.clear()
