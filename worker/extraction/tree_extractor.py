"""
Auto-extracción del árbol de diagnóstico (B9.5 §1.1 Tipo 5 / decisión C).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.

DOCYAN extrae automáticamente el árbol (nodos, opciones, causas, acciones) desde el
documento de troubleshooting y lo materializa directo al grafo. La extracción del
stack es de calidad suficiente; no hay revisión manual (el editor de curación se
retiró del alcance de B9.5).

Extracción por LLM de texto (Gemini 2.5 Flash vía LiteLLM, igual que el resto de
la ingesta). El LLM se inyecta (`complete`) para test sin claves; en producción y
en CI (autoridad de ingesta real) usa `worker.llm_config.complete_text`.
"""
from __future__ import annotations

import logging
from typing import Callable

from worker.extraction.models import DraftArbol, NodoBorrador, OpcionBorrador
from worker.extraction._json import parse_llm_json

logger = logging.getLogger("docyan.worker.extraccion.arbol")

_PROMPT = """Eres un extractor de árboles de diagnóstico de manuales técnicos de \
troubleshooting industrial. A partir del documento, identifica el árbol de \
decisión que guía la resolución de fallas: nodos de pregunta (síntoma/chequeo), \
sus opciones de respuesta (que llevan a otro nodo), y los nodos hoja con CAUSA \
PROBABLE y ACCIÓN RESOLUTORIA.

Devuelve EXCLUSIVAMENTE un JSON con esta forma (sin texto adicional):
{{
  "titulo": "string — el problema/falla que resuelve el árbol",
  "nodos": [
    {{
      "id": "n1",
      "pregunta": "string o null si es hoja",
      "orden": 0,
      "opciones": [{{"etiqueta": "Sí", "siguiente_nodo_id": "n2"}}],
      "causa_probable": "string o null",
      "accion_resolutoria": "string o null"
    }}
  ]
}}

Reglas:
- El nodo raíz tiene orden 0.
- Cada opción enlaza a un nodo existente por su id en "siguiente_nodo_id".
- Los nodos hoja no tienen opciones; llevan causa_probable y accion_resolutoria.
- NO inventes nodos que el documento no sustente. Si el documento NO contiene un \
árbol de diagnóstico, devuelve {{"titulo": "", "nodos": []}}.
- Responde en español, conservando términos técnicos.

DOCUMENTO:
---
{markdown}
---"""


def extraer_arbol_diagnostico(
    markdown: str,
    *,
    complete: Callable[[str], str] | None = None,
    max_chars: int = 24000,
) -> DraftArbol | None:
    """
    Extrae un `DraftArbol` borrador desde el markdown del documento. Devuelve None
    si el documento no contiene un árbol de diagnóstico (o si la extracción falla).
    Best-effort: nunca lanza (la auto-extracción no es gate de la ingesta).
    """
    if complete is None:
        from worker import llm_config

        complete = llm_config.complete_text

    prompt = _PROMPT.format(markdown=markdown[:max_chars])
    try:
        raw = complete(prompt)
    except Exception as exc:  # noqa: BLE001 — la extracción no tumba la ingesta
        logger.warning("extracción de árbol falló (LLM): %s", type(exc).__name__)
        return None

    data = parse_llm_json(raw)
    if not isinstance(data, dict):
        return None
    nodos_raw = data.get("nodos") or []
    if not nodos_raw:
        return None

    nodos: list[NodoBorrador] = []
    for i, n in enumerate(nodos_raw):
        if not isinstance(n, dict) or not n.get("id"):
            continue
        opciones = [
            OpcionBorrador(
                etiqueta=str(o.get("etiqueta", "")),
                siguiente_nodo_id=o.get("siguiente_nodo_id"),
            )
            for o in (n.get("opciones") or [])
            if isinstance(o, dict) and o.get("etiqueta")
        ]
        nodos.append(
            NodoBorrador(
                id=str(n["id"]),
                pregunta=n.get("pregunta"),
                orden=int(n.get("orden") or i),
                opciones=opciones,
                causa_probable=n.get("causa_probable"),
                accion_resolutoria=n.get("accion_resolutoria"),
            )
        )
    if not nodos:
        return None

    draft = DraftArbol(titulo=data.get("titulo") or "Árbol de diagnóstico", nodos=nodos)
    warns = draft.validar_conectividad()
    if warns:
        logger.info("árbol auto-extraído con %d advertencia(s) de conectividad: %s", len(warns), warns)
    return draft
