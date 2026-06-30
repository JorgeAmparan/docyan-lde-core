"""
Clasificador LLM de intención — fallback del híbrido (B8 §A1).

DOCYAN LDE™ by XCID.

Cuando la heurística no alcanza el umbral del tenant, se invoca gpt-4o-mini (el
modelo de QA/consulta de la Adenda) con un prompt cerrado de 8 opciones +
ejemplos. Modelo barato: la consulta es de bajo costo (la Adenda lo confirma:
consultas ~gpt-4o-mini, ingesta cara única).

Diseño testeable (idéntico a `schemas_documentales/generador.py`): el LLM se
inyecta como `llm_caller(prompt) -> str(JSON)`. El default usa LiteLLM con la
cadena de fallback ya configurada (import perezoso). Los tests inyectan un caller
determinista — no se llama a la API en CI; el smoke prod usa el real.
"""
from __future__ import annotations

import json
from typing import Callable

from app.orchestrator.clasificacion.tipos import RUTA_POR_TIPO, TipoIntencion

LlmCaller = Callable[[str], str]

# Modelo de QA/consulta (Adenda): barato, suficiente para clasificar intención.
CLASIFICADOR_MODEL = "gpt-4o-mini"

_DESCRIPCIONES = {
    TipoIntencion.INFORMATIVA: "pide un dato, valor, especificación, definición o parámetro puntual",
    TipoIntencion.GUIA_PASO_A_PASO: "pide cómo hacer algo: un procedimiento o instrucciones en orden",
    TipoIntencion.GRAFICOS_DIAGRAMAS: "pide ver un diagrama, esquema, plano, figura o símbolo",
    TipoIntencion.VIDEO: "pide un video, grabación o videotutorial",
    TipoIntencion.TROUBLESHOOTING: "reporta una falla/error y pide diagnóstico o solución",
    TipoIntencion.HISTORIAL: "pide el historial, registro, bitácora o eventos pasados de algo",
    TipoIntencion.ALERTAS: "pregunta por vencimientos, caducidades o alertas administrativas",
    TipoIntencion.COMPARATIVA: "pide comparar dos versiones o entidades / detectar diferencias",
    TipoIntencion.BILINGUE: (
        "pide la versión bilingüe / la equivalencia o traducción de un texto entre "
        "idiomas (p. ej. inglés↔español), el segmento original en otro idioma, o el "
        "término fijado del glosario (memoria de traducción)"
    ),
}


def _build_prompt(pregunta: str, contexto: dict | None) -> str:
    opciones = "\n".join(
        f'  - "{t.value}": {desc}' for t, desc in _DESCRIPCIONES.items()
    )
    ctx = contexto or {}
    ctx_str = json.dumps(
        {
            "tipo_documento": ctx.get("tipo_documento"),
            "historial_resumen": ctx.get("historial_resumen"),
        },
        ensure_ascii=False,
    )
    n_tipos = len(_DESCRIPCIONES)
    return (
        "Eres un clasificador de intención de consultas sobre documentos técnicos "
        "industriales. Clasifica la PREGUNTA del operador en EXACTAMENTE UNO de "
        f"estos {n_tipos} tipos:\n"
        f"{opciones}\n\n"
        "Devuelve EXCLUSIVAMENTE un objeto JSON con la forma:\n"
        '{"tipo": "<UNO_DE_LOS_TIPOS>", "score": <0.0-1.0>, "razon": "<breve>"}\n'
        "El 'score' es tu confianza. Si la pregunta es ambigua, elige el tipo más "
        "probable y baja el score en consecuencia.\n\n"
        f"CONTEXTO: {ctx_str}\n\n"
        f"PREGUNTA: {pregunta}\n"
    )


def _default_llm_caller(prompt: str) -> str:
    """Caller real: gpt-4o-mini vía LiteLLM (import perezoso)."""
    from litellm import completion

    resp = completion(
        model=CLASIFICADOR_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    return str(resp["choices"][0]["message"]["content"])


def _parse(raw: str) -> tuple[TipoIntencion, float, str]:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"): text.rfind("}") + 1]
    data = json.loads(text)
    tipo = TipoIntencion(str(data["tipo"]).strip().upper())
    score = float(data.get("score", 0.7))
    score = max(0.0, min(1.0, score))
    return tipo, score, str(data.get("razon", ""))


def clasificar_con_llm(
    pregunta: str,
    contexto: dict | None = None,
    llm_caller: LlmCaller | None = None,
) -> tuple[TipoIntencion, float, str]:
    """
    Clasifica vía LLM. Si el LLM falla o devuelve algo inválido, cae a INFORMATIVA
    con score bajo (default conservador: el Governance Gate del MO frenará el
    output si la confianza no alcanza). Devuelve (tipo, score, razon).
    """
    caller = llm_caller or _default_llm_caller
    try:
        raw = caller(_build_prompt(pregunta, contexto))
        return _parse(raw)
    except Exception as exc:  # noqa: BLE001 — fallback honesto, no se finge éxito.
        return TipoIntencion.INFORMATIVA, 0.3, f"fallback: {type(exc).__name__}"


# Reexport para conveniencia del orquestador.
__all__ = ["clasificar_con_llm", "LlmCaller", "RUTA_POR_TIPO"]
