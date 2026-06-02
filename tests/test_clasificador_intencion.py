"""
Tests del Clasificador de Intención híbrido (B8 §A1).

Heurística para los 8 tipos (≥3 ejemplos cada uno), escalamiento al LLM bajo
umbral, y resolución de ambigüedad por LLM (mockeado: en CI no se llama API).
"""
import json

import pytest

from app.orchestrator.clasificacion import heuristicos
from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.orchestrator.clasificacion.umbrales import InMemoryUmbralStore
from app.orchestrator.clasificador_intencion import ClasificadorIntencion

EJEMPLOS = {
    TipoIntencion.INFORMATIVA: [
        "cuál es el valor de presión nominal",
        "qué es el par de apriete",
        "especificación del seccionador",
    ],
    TipoIntencion.GUIA_PASO_A_PASO: [
        "cómo se instala la bomba",
        "procedimiento de montaje",
        "pasos para cambiar el filtro",
    ],
    TipoIntencion.GRAFICOS_DIAGRAMAS: [
        "muéstrame el diagrama eléctrico",
        "necesito el esquema del tablero",
        "dónde está la figura del plano",
    ],
    TipoIntencion.VIDEO: [
        "hay un video del montaje",
        "muéstrame el video",
        "tienes un videotutorial",
    ],
    TipoIntencion.TROUBLESHOOTING: [
        "la máquina no enciende",
        "falla el arranque del equipo",
        "cómo resuelvo el error del variador",
    ],
    TipoIntencion.HISTORIAL: [
        "dame el historial de calibraciones",
        "cuándo se calibró por última vez",
        "bitácora de mantenimientos del equipo",
    ],
    TipoIntencion.ALERTAS: [
        "qué certificados están por vencer",
        "documentos por vencer este mes",
        "qué calibraciones caducan pronto",
    ],
    TipoIntencion.COMPARATIVA: [
        "compara la versión 1 contra la versión 2",
        "diferencias entre dos equipos",
        "qué cambió entre versiones del manual",
    ],
}


@pytest.mark.parametrize(
    "tipo,pregunta",
    [(t, q) for t, qs in EJEMPLOS.items() for q in qs],
)
def test_heuristica_clasifica_los_8_tipos(tipo, pregunta):
    """La heurística clasifica correctamente ≥3 ejemplos representativos por tipo."""
    ganador, score, _ = heuristicos.clasificar(pregunta, {})
    assert ganador == tipo, f"'{pregunta}' → {ganador.value}, esperado {tipo.value}"
    assert score > 0


def test_casos_obvios_resueltos_por_heuristica_sin_llm():
    """Un patrón específico se resuelve por heurística (≥ umbral) sin invocar LLM."""
    llamadas = []

    def _llm(prompt):
        llamadas.append(prompt)
        return json.dumps({"tipo": "INFORMATIVA", "score": 0.5})

    clf = ClasificadorIntencion(llm_caller=_llm)
    r = clf.clasificar("muéstrame el diagrama eléctrico", {})
    assert r.tipo == TipoIntencion.GRAFICOS_DIAGRAMAS
    assert r.metodo == "heuristico"
    assert llamadas == []  # el LLM NO se invocó


def test_confianza_bajo_umbral_invoca_llm():
    """Confianza heurística < umbral → escala al LLM (mockeado)."""
    llamadas = []

    def _llm(prompt):
        llamadas.append(prompt)
        return json.dumps({"tipo": "TROUBLESHOOTING", "score": 0.88, "razon": "ruido anómalo"})

    # Umbral artificialmente alto fuerza el escalamiento incluso en casos claros.
    umbrales = InMemoryUmbralStore(default=0.99)
    clf = ClasificadorIntencion(umbral_store=umbrales, llm_caller=_llm)
    r = clf.clasificar("dame información sobre la bomba", {"tenant_id": "t1"})
    assert len(llamadas) == 1
    assert r.metodo == "llm"
    assert r.tipo == TipoIntencion.TROUBLESHOOTING
    assert r.score == pytest.approx(0.88)


def test_pregunta_ambigua_resuelta_por_llm_con_razon():
    """Pregunta sin señales léxicas → LLM resuelve con razón."""
    def _llm(prompt):
        return json.dumps({"tipo": "HISTORIAL", "score": 0.7, "razon": "pide eventos pasados"})

    clf = ClasificadorIntencion(llm_caller=_llm)
    r = clf.clasificar("¿y lo de antes con eso?", {})
    assert r.tipo == TipoIntencion.HISTORIAL
    assert r.metodo == "llm"
    assert "pide eventos" in r.razon


def test_llm_falla_cae_a_fallback_honesto():
    """Si el LLM falla, se cae a INFORMATIVA con score bajo (no se finge éxito)."""
    def _llm(prompt):
        raise RuntimeError("API caída")

    clf = ClasificadorIntencion(llm_caller=_llm)
    r = clf.clasificar("texto totalmente ambiguo zzz", {})
    assert r.tipo == TipoIntencion.INFORMATIVA
    assert r.metodo == "fallback"
    assert r.score < 0.5


def test_ruta_corresponde_al_tipo():
    clf = ClasificadorIntencion()
    r = clf.clasificar("procedimiento de montaje", {})
    assert r.ruta == "tipo2_guia_paso_a_paso"
