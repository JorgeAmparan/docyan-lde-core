"""
Sprint UI-2 §1.4 — filtro de nombres GENÉRICOS de extracción en el ranking.

DOCYAN LDE™ by XCID.

Placeholders que el extractor materializó como sustancias ("El Material",
"COMPONENTES DE ESTE PRODUCTO", "SUSTANCIA DEL PRODUCTO") rankeaban junto a
sustancias reales (ALUMINA) en respuestas de identidad. La corrección es un sesgo
de ORDEN por lista corta (como el de intención): demota, NO elimina, y NO cambia el
score/banda honesto. Tests PUROS (sin FalkorDB): el detector + el reordenamiento.
"""
from __future__ import annotations

from app.pipelines.dkg_reader import _PENA_GENERICO, _es_nombre_generico
from app.pipelines.retrieval_hibrido import Candidato, rankear

# ── Detector de nombre genérico ─────────────────────────────────────────────


def test_detecta_los_placeholders_reportados_por_jorge():
    for n in [
        "El Material",
        "COMPONENTES DE ESTE PRODUCTO",
        "SUSTANCIA DEL PRODUCTO",
        "  Sustancia.  ",          # con espacios y puntuación de borde
        "la mezcla",
        "EL PRODUCTO",
    ]:
        assert _es_nombre_generico(n), n


def test_no_demota_nombres_reales():
    for n in ["ALUMINA", "Óxido de aluminio", "Ácido sulfúrico 98%",
              "Hidróxido de sodio", "NaOH"]:
        assert not _es_nombre_generico(n), n


def test_coincidencia_exacta_no_substring():
    # Un nombre real que CONTIENE una palabra genérica NO se demota.
    assert not _es_nombre_generico("Material compuesto de alúmina")
    assert not _es_nombre_generico("Mezcla azeotrópica de etanol")


# ── Reordenamiento (demota, no elimina, no toca score) ──────────────────────


def _cand(nombre, *, generico, score_emb):
    prioridad = -_PENA_GENERICO if generico else 0.0
    return Candidato(
        texto_match=f"Sustancia quimico {nombre}",
        embedding=score_emb,
        data={"_label": "Sustancia", "nombre": nombre},
        prioridad=prioridad,
    )


def test_real_encabeza_al_generico_con_mismo_score():
    generico = _cand("SUSTANCIA DEL PRODUCTO", generico=True, score_emb=[1.0, 0.0])
    real = _cand("ALUMINA", generico=False, score_emb=[1.0, 0.0])
    emb = type("E", (), {"embed": staticmethod(lambda q: [1.0, 0.0])})()
    elegidos = rankear("sustancia", [generico, real], embedder=emb, limite=8)
    assert elegidos[0].data["nombre"] == "ALUMINA"
    # Reorder-only: el genérico sigue presente y su score honesto no se tocó.
    nombres = [c.data["nombre"] for c in elegidos]
    assert "SUSTANCIA DEL PRODUCTO" in nombres
    g = next(c for c in elegidos if c.data["nombre"] == "SUSTANCIA DEL PRODUCTO")
    r = next(c for c in elegidos if c.data["nombre"] == "ALUMINA")
    assert g.score == r.score  # misma confianza mostrada; sólo cambió el orden
