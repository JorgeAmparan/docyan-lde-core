"""
B3 §2 — Segregación por par lingüístico: nombres canónicos y normalización.

Tests de lógica pura (no requieren FalkorDB).
"""
import pytest

from app.graph.dtm_segregation import (
    INITIAL_PAIRS,
    InvalidLanguagePairError,
    graph_name_for_pair,
    initial_graph_names,
    is_initial_pair,
    normalize_lang,
    pair_id,
    par_linguistico_label,
)


def test_cinco_pares_iniciales():
    assert len(INITIAL_PAIRS) == 5
    assert ("en-US", "es-MX") in INITIAL_PAIRS
    assert ("en-UK", "es-ES") in INITIAL_PAIRS


@pytest.mark.parametrize(
    "tenant,src,tgt,expected",
    [
        ("acme", "en-US", "es-MX", "docyan_dtm_acme_en-US_es-MX"),
        ("acme", "en-US", "es-US", "docyan_dtm_acme_en-US_es-US"),
        ("acme", "en-US", "es-ES", "docyan_dtm_acme_en-US_es-ES"),
        ("acme", "en-UK", "es-MX", "docyan_dtm_acme_en-UK_es-MX"),
        ("acme", "en-UK", "es-ES", "docyan_dtm_acme_en-UK_es-ES"),
    ],
)
def test_graph_name_canonico_para_los_5_pares(tenant, src, tgt, expected):
    assert graph_name_for_pair(tenant, src, tgt) == expected


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("EN-us", "en-US"),
        ("es-mx", "es-MX"),
        ("EN", "en"),
        ("en_US", "en-US"),  # separador '_' aceptado
        ("  es-ES  ", "es-ES"),  # espacios
    ],
)
def test_normalize_lang(raw, expected):
    assert normalize_lang(raw) == expected


def test_normaliza_variantes_de_casing_y_separador():
    # Distintas grafías del MISMO par producen el MISMO graph_name.
    a = graph_name_for_pair("t1", "EN-us", "ES-mx")
    b = graph_name_for_pair("t1", "en-US", "es-MX")
    c = graph_name_for_pair("t1", "en_us", "es_mx")
    assert a == b == c == "docyan_dtm_t1_en-US_es-MX"


def test_pair_id_direccional_no_simetrico():
    # El par es DIRECCIONAL: invertir origen/destino cambia el id.
    assert pair_id("en-US", "es-MX") != pair_id("es-MX", "en-US")


def test_par_origen_igual_destino_falla():
    with pytest.raises(InvalidLanguagePairError):
        pair_id("en-US", "en-US")


def test_tenant_vacio_falla():
    with pytest.raises(InvalidLanguagePairError):
        graph_name_for_pair("", "en-US", "es-MX")


def test_idioma_vacio_falla():
    with pytest.raises(InvalidLanguagePairError):
        normalize_lang("")


def test_par_linguistico_label_legible():
    assert par_linguistico_label("en-US", "es-MX") == "en-US↔es-MX"


def test_initial_graph_names_son_cinco_y_unicos():
    names = initial_graph_names("acme")
    assert len(names) == 5
    assert len(set(names)) == 5
    assert all(n.startswith("docyan_dtm_acme_") for n in names)


def test_is_initial_pair():
    assert is_initial_pair("EN-us", "es-mx") is True
    assert is_initial_pair("en-US", "fr-FR") is False
