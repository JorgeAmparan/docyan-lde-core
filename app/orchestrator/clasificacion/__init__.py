"""
Clasificación de intención de consulta (B8 §A1).

DOCYAN LDE™ by XCID.

Submódulos del clasificador HÍBRIDO (heurística rápida + LLM fallback):
  - `tipos`       — enum `TipoIntencion` (8) + `ResultadoClasificacion`.
  - `heuristicos` — patrones léxicos + entidades + tipo de documento.
  - `llm_classifier` — gpt-4o-mini con prompt de 8 opciones (vía LiteLLM).
  - `umbrales`    — umbral de confianza por tenant (default 0.80).

El punto de entrada público es `app.orchestrator.clasificador_intencion`.
"""
from app.orchestrator.clasificacion.tipos import (
    RUTA_POR_TIPO,
    ResultadoClasificacion,
    TipoIntencion,
)

__all__ = ["TipoIntencion", "ResultadoClasificacion", "RUTA_POR_TIPO"]
