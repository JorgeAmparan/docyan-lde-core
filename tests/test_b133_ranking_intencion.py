"""
B13.3 §ranking — relevancia por intención del query (cierre acceptance #2).

DOCYAN LDE™ by XCID.

El bug real (diagnosticado sobre el grafo de prod): un :Riesgo cuyo texto contiene
"QUIMICOS", o cuyo embedding cae cerca de cualquier consulta de seguridad, encabezaba
preguntas que NO son de riesgo — sepultando la :Sustancia ("¿cómo se llama el químico?")
o la :Especificacion de inflamabilidad ("LEL?"→"IRRITACION").

Regla (directiva de Jorge): pregunta de IDENTIDAD prioriza :Sustancia/:Producto/
:Instrumento sobre :Riesgo; los labels de seguridad no encabezan salvo query de riesgo.
El sesgo es de ORDEN, no de relevancia: el score/banda mostrado NO cambia.

Tests PUROS (sin FalkorDB): ejercitan el detector de intención del reader y el
reordenamiento del scorer. La verificación contra el grafo real es la suite de
paráfrasis + el recorrido de Jorge.
"""
from __future__ import annotations

from app.pipelines.dkg_reader import (
    _LABELS_SEGURIDAD,
    _sesgo_intencion,
)
from app.pipelines.retrieval_hibrido import Candidato, rankear


# ── Detector de intención ───────────────────────────────────────────────────


def test_identidad_bonifica_sustancia_y_demota_riesgo():
    for q in ["¿Cómo se llama el químico?", "nombre del químico",
              "what is it called", "chemical name", "nombre de la sustancia"]:
        s = _sesgo_intencion(q)
        assert s["Sustancia"] > 0, q
        assert s["Producto"] > 0 and s["Instrumento"] > 0, q
        assert s["Riesgo"] < 0, q


def test_seguridad_no_demota_nada_aunque_mencione_quimico():
    # "riesgos del químico" es de SEGURIDAD: los :Riesgo deben poder encabezar.
    for q in ["¿qué riesgos tiene?", "peligros del producto", "hazard classification",
              "riesgos del químico", "es tóxico?"]:
        assert _sesgo_intencion(q) == {}, q


def test_general_demota_seguridad_levemente_sin_tocar_identidad():
    # Ni identidad ni seguridad: democión leve a seguridad (caso "LEL").
    s = _sesgo_intencion("LEL?")
    assert s["Riesgo"] < 0
    assert "Sustancia" not in s  # no bonifica identidad en query genérico
    # Más leve que la democión por identidad (que es decisiva).
    assert abs(s["Riesgo"]) < abs(_sesgo_intencion("¿cómo se llama?")["Riesgo"])


def test_what_is_pelado_no_es_identidad():
    # "what is the OSHA PEL" busca un VALOR, no la identidad de la sustancia.
    s = _sesgo_intencion("what is the OSHA PEL")
    assert "Sustancia" not in s  # no boost de identidad
    assert s.get("Riesgo", 0) <= 0


# ── Reordenamiento en rankear (prioridad reordena, no admite ni altera score) ──


def _cand(label, texto, *, emb, prioridad):
    return Candidato(texto_match=texto, embedding=emb, data={"_label": label}, prioridad=prioridad)


def test_identidad_pone_sustancia_sobre_riesgo_homonimo():
    """Sustancia con score honesto MENOR encabeza a un :Riesgo que casa 'químico',
    gracias al sesgo de identidad — replica el caso real de Jorge."""
    sesgo = _sesgo_intencion("¿cómo se llama el químico?")
    # Riesgo 'QUIMICOS TOXICOS' (vector pegado al query) tiene score honesto MAYOR;
    # Sustancia 'OXIDO DE ALUMINIO' casa por sinónimo pero su vector cae más lejos.
    # Sin sesgo gana el Riesgo (es lo que pasaba en prod); el sesgo de identidad flipa.
    riesgo = _cand("Riesgo", "Riesgo riesgo peligro hazard QUIMICOS TOXICOS",
                   emb=[1.0, 0.0], prioridad=sesgo["Riesgo"])
    sust = _cand("Sustancia", "Sustancia quimico químico chemical OXIDO DE ALUMINIO",
                 emb=[0.5, 0.5], prioridad=sesgo["Sustancia"])
    emb = type("E", (), {"embed": staticmethod(lambda q: [1.0, 0.0])})()
    elegidos = rankear("llama químico", [riesgo, sust], embedder=emb, limite=8)
    assert elegidos[0].data["_label"] == "Sustancia"
    # El score honesto del Riesgo NO se tocó: sigue siendo MAYOR que el de la Sustancia
    # (el sesgo reordenó, no mintió sobre la confianza mostrada/citada).
    r = next(c for c in elegidos if c.data["_label"] == "Riesgo")
    assert r.score > elegidos[0].score


def test_lel_no_encabeza_riesgo_irritacion():
    """Query genérico ('LEL'): un :Riesgo de pura cercanía semántica no debe
    encabezar a la :Especificacion relevante. La compuerta vectorial es GLOBAL —
    en prod siempre la abre algún candidato con token-ruido ≥30% (p. ej. 'del'~'lel');
    el `decoy` lo replica para que la pasada semántica se invoque como en el grafo real."""
    sesgo = _sesgo_intencion("LEL?")
    decoy = _cand("Especificacion", "del producto",  # 'lel'~'del' ⇒ lex≥0.30 abre la compuerta
                  emb=[0.0, 1.0], prioridad=sesgo.get("Especificacion", 0.0))
    irrit = _cand("Riesgo", "Riesgo peligro hazard IRRITACION",
                  emb=[1.0, 0.0], prioridad=sesgo.get("Riesgo", 0.0))
    spec = _cand("Especificacion", "NO INFLAMABLE inflamabilidad",
                 emb=[0.97, 0.05], prioridad=sesgo.get("Especificacion", 0.0))
    emb = type("E", (), {"embed": staticmethod(lambda q: [1.0, 0.0])})()
    elegidos = rankear("lel", [decoy, irrit, spec], embedder=emb, limite=8)
    assert elegidos[0].data["_label"] != "Riesgo"


def test_riesgo_demotado_sigue_presente():
    """El sesgo reordena, NO elimina: un :Riesgo demotado sigue en el resultado."""
    sesgo = _sesgo_intencion("nombre del químico")
    riesgo = _cand("Riesgo", "Riesgo QUIMICOS", emb=[1.0, 0.0], prioridad=sesgo["Riesgo"])
    sust = _cand("Sustancia", "Sustancia químico ALUMINA", emb=[1.0, 0.0], prioridad=sesgo["Sustancia"])
    emb = type("E", (), {"embed": staticmethod(lambda q: [1.0, 0.0])})()
    labels = [c.data["_label"] for c in rankear("nombre químico", [riesgo, sust], embedder=emb, limite=8)]
    assert "Riesgo" in labels and labels[0] == "Sustancia"


def test_sin_embedder_el_sesgo_tambien_reordena():
    """La prioridad reordena incluso en modo léxico-only (sin embedder): no depende
    de la pasada vectorial."""
    sesgo = _sesgo_intencion("nombre del químico")
    riesgo = _cand("Riesgo", "Riesgo químico QUIMICOS", emb=None, prioridad=sesgo["Riesgo"])
    sust = _cand("Sustancia", "Sustancia químico ALUMINA", emb=None, prioridad=sesgo["Sustancia"])
    elegidos = rankear("nombre químico", [riesgo, sust], embedder=None, limite=8)
    assert elegidos[0].data["_label"] == "Sustancia"


def test_labels_seguridad_cubren_proteccion_y_advertencia():
    # La democión por identidad alcanza también medidas/EPP/advertencias (vistas
    # encabezando indebidamente en el diagnóstico real).
    s = _sesgo_intencion("¿cómo se llama?")
    for lbl in _LABELS_SEGURIDAD:
        assert s[lbl] < 0
