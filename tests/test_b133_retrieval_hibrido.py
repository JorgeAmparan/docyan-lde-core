"""
B13.3 · DEF-2 — Retrieval híbrido léxico + semántico (Decisión #2 del Paso C).

DOCYAN LDE™ by XCID.

Unit del scorer PURO (`app/pipelines/retrieval_hibrido.py`): Levenshtein, coseno,
tabulador, banding 70/30 ↔ 30/70, umbral léxico ≥30% para invocar la vectorial,
admisión por match estricto vs. relevancia semántica, y degradación honesta a
léxico cuando el embedder no responde. Sin FalkorDB, sin red.
"""
from __future__ import annotations

import hashlib

from app.pipelines.retrieval_hibrido import (
    PISO_RELEVANCIA_SEMANTICA,
    UMBRAL_BANDA_ALTA,
    UMBRAL_LEXICO_VECTORIAL,
    Candidato,
    combinar,
    coseno,
    es_match_estricto,
    levenshtein,
    nivel_tabulador,
    rankear,
    ratio_levenshtein,
    score_lexico,
)


class FakeEmbedder:
    """Embedder determinista (16-dim): mismo texto → mismo vector. NO imita la
    semántica de BGE-M3; sirve para verificar el CABLEADO de la pasada vectorial."""

    def embed(self, text: str) -> list[float]:
        h = hashlib.sha256((text or "").encode("utf-8")).digest()
        return [b / 255.0 for b in h[:16]]


class EmbedderCaido:
    def embed(self, text: str):  # noqa: ANN201
        raise ConnectionError("embedder no alcanzable")


# ── Primitivas léxicas ──────────────────────────────────────────────────────


def test_levenshtein_basico():
    assert levenshtein("kitten", "sitting") == 3
    assert levenshtein("", "abc") == 3
    assert levenshtein("igual", "igual") == 0


def test_ratio_insensible_a_acentos_y_caja():
    assert ratio_levenshtein("Manómetro", "manometro") == 1.0
    assert ratio_levenshtein("OSHA", "osha") == 1.0


def test_score_lexico_substring_y_fuzzy():
    # "OSHA PEL" casa fuerte contra el nombre de la spec (ambas palabras presentes).
    assert score_lexico("OSHA PEL", "Límite de exposición OSHA PEL (total)") == 1.0
    # Errata/plural tolerado por Levenshtein.
    assert score_lexico("manometros", "Rango del manómetro") > 0.7
    # Sin relación → bajo.
    assert score_lexico("chemical name", "Aluminum oxide") < 0.5


def test_match_estricto_es_paridad_contains():
    assert es_match_estricto("OSHA", "Límite OSHA PEL") is True
    assert es_match_estricto("inflamación", "punto de inflamacion") is True  # sin acento
    assert es_match_estricto("chemical", "Aluminum oxide") is False


# ── Coseno ────────────────────────────────────────────────────────────────────


def test_coseno_identico_vs_ortogonal():
    assert coseno([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert coseno([1.0, 0.0], [-1.0, 0.0]) == 0.0  # opuesto → 0 tras reescalar
    assert coseno(None, [1.0]) == 0.0
    assert coseno([1.0], [1.0, 2.0]) == 0.0  # dims distintas


# ── Tabulador + banding ─────────────────────────────────────────────────────


def test_tabulador_bandas_industria():
    assert nivel_tabulador(1.0) == "100%"
    assert nivel_tabulador(0.97) == "95-99%"
    assert nivel_tabulador(0.90) == "85-94%"
    assert nivel_tabulador(0.80) == "75-84%"
    assert nivel_tabulador(0.60) == "50-74%"
    assert nivel_tabulador(0.10) == "0-49%"


def test_combinar_banda_alta_70_30():
    # léxico fuerte (≥85%) → 70/30 a favor del léxico.
    assert combinar(0.90, 0.10) == round(0.70 * 0.90 + 0.30 * 0.10, 10) or True
    val = combinar(0.90, 0.10)
    assert abs(val - (0.70 * 0.90 + 0.30 * 0.10)) < 1e-9


def test_combinar_banda_baja_30_70():
    # léxico débil pero ≥umbral → 30/70 a favor de la semántica.
    val = combinar(0.40, 0.90)
    assert abs(val - (0.30 * 0.40 + 0.70 * 0.90)) < 1e-9


def test_combinar_bajo_umbral_decide_semantica():
    # léxico < 30% (sin reclamo léxico propio) → decide la semántica (puente PEL↔TLV).
    assert combinar(0.20, 0.99) == 0.99
    # …pero sin vector (pasada no invocada) cae a léxico: degradación honesta.
    assert combinar(0.20, None) == 0.20


def test_combinar_sin_vector_es_lexico():
    assert combinar(0.77, None) == 0.77


# ── rankear: admisión, orden, degradación ───────────────────────────────────


def _cand(texto, data=None, emb=None):
    return Candidato(texto_match=texto, embedding=emb, data=data or {"t": texto})


def test_rankear_sin_embedder_solo_admite_estrictos():
    # Paridad con el recall léxico histórico: sin embedder, un candidato que NO casa
    # por substring NO entra (aunque Levenshtein le dé crédito parcial).
    cands = [
        _cand("Límite de exposición OSHA PEL (total)"),
        _cand("Límite de exposición ACGIH TLV (total)"),
    ]
    res = rankear("OSHA", cands, embedder=None)
    assert len(res) == 1
    assert "OSHA" in res[0].texto_match


def test_rankear_semantico_admite_no_lexico_via_puente():
    # PEL↔TLV: el query casa léxico contra la spec PEL (dispara la vectorial) y la
    # spec TLV —sin token compartido— entra por cercanía semántica simulada.
    emb = FakeEmbedder()
    q = "exposure limit"
    pel = _cand("OSHA PEL exposure limit", data={"k": "pel"}, emb=emb.embed("otra cosa"))
    tlv = _cand("ACGIH TLV", data={"k": "tlv"}, emb=emb.embed(q))  # ≡ query → coseno 1.0
    res = rankear(q, [pel, tlv], embedder=emb)
    claves = {c.data["k"] for c in res}
    assert "pel" in claves and "tlv" in claves  # ambos admitidos (léxico + semántico)


def test_rankear_degrada_a_lexico_si_embedder_cae():
    emb = EmbedderCaido()
    pel = _cand("OSHA PEL exposure limit", data={"k": "pel"}, emb=[0.1] * 16)
    tlv = _cand("ACGIH TLV", data={"k": "tlv"}, emb=[0.1] * 16)
    res = rankear("exposure limit", [pel, tlv], embedder=emb)
    # Embedder caído → vec None → solo el estricto (PEL) entra; nada se rompe.
    assert [c.data["k"] for c in res] == ["pel"]


def test_rankear_ordena_por_score_desc():
    cands = [_cand("rango parcial"), _cand("rango de medición exacto rango")]
    res = rankear("rango de medición", cands, embedder=None)
    assert res[0].score >= res[-1].score


def test_constantes_decision_2():
    # Las constantes reflejan la Decisión #2 (no se redefine la decisión).
    assert UMBRAL_LEXICO_VECTORIAL == 0.30
    assert UMBRAL_BANDA_ALTA == 0.85
    assert 0.0 < PISO_RELEVANCIA_SEMANTICA < 1.0
