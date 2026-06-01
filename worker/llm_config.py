"""
Configuración de modelos del pipeline de ingesta (B2 §5.3).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.

Config validada con el PoC sobre NOM-052 (Adenda §3), DISTINTA del Model Router
de traducción (Pista A). Reglas inviolables:

  - Extracción + Resolution: Gemini 2.5 Flash con prefijo `gemini/` OBLIGATORIO
    (sin el prefijo, LiteLLM defaultea a Vertex AI y falla pidiendo credenciales GCP).
  - QA / consulta: gpt-4o-mini.
  - deduplicate_entities(fuzzy=True) — con await correcto (bug PoC #1).
  - Forzar respuesta en español en el prompt de extracción.
  - Retry con tenacity ante rate limiting de Gemini (PoC: 1,506 retries en multi-doc).

Variables: GEMINI_API_KEY (NO GOOGLE_API_KEY), OPENAI_API_KEY.
"""
from __future__ import annotations

import os

# Default validado con el PoC sobre NOM-052 (Adenda §3): Gemini 2.5 Flash con
# prefijo `gemini/` OBLIGATORIO. El modelo de extracción/resolution es
# OVERRIDEABLE por env (INGEST_EXTRACTION_MODEL / INGEST_RESOLUTION_MODEL) para
# pruebas o por presupuesto (p. ej. `anthropic/claude-sonnet-4-6` si Gemini no
# tiene saldo). El default NO cambia; el override es explícito y por proveedor.
_DEFAULT_EXTRACTION_MODEL = "gemini/gemini-2.5-flash"

LLM_CONFIG = {
    "qa_model": "gpt-4o-mini",
    "deduplicate_fuzzy": True,
    "force_spanish_in_extraction_prompt": True,
    "retry_with_tenacity": True,
}


def extraction_model() -> str:
    return os.getenv("INGEST_EXTRACTION_MODEL", _DEFAULT_EXTRACTION_MODEL)


def extraction_fallback_models() -> list[str]:
    """
    Modelos de respaldo (CSV en INGEST_EXTRACTION_FALLBACK_MODELS). Si el modelo
    primario falla (presupuesto/quota/rate-limit/API error), el worker reintenta
    la ingesta del documento con el siguiente del chain. Resiliencia multi-modelo
    (análoga a los tiers del Model Router de traducción).
    """
    raw = os.getenv("INGEST_EXTRACTION_FALLBACK_MODELS", "")
    return [m.strip() for m in raw.split(",") if m.strip()]


def extraction_model_chain() -> list[str]:
    """Cadena ordenada [primario, *fallbacks] que el worker prueba en orden."""
    chain = [extraction_model()]
    for m in extraction_fallback_models():
        if m not in chain:
            chain.append(m)
    return chain


def resolution_model() -> str:
    # Por defecto sigue al de extracción (mismo LLM, como el PoC).
    return os.getenv("INGEST_RESOLUTION_MODEL", extraction_model())


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(
            f"{name} es requerida por el worker de ingesta. "
            "Configúrala como Fly secret en docyan-lde-ingest."
        )
    return val


def _require_key_for_model(model: str) -> None:
    """Exige la API key del proveedor según el prefijo del modelo LiteLLM."""
    m = model.lower()
    if m.startswith("gemini/"):
        _require_env("GEMINI_API_KEY")
    elif m.startswith("anthropic/") or "claude" in m:
        _require_env("ANTHROPIC_API_KEY")
    elif m.startswith("openai/") or m.startswith("gpt"):
        _require_env("OPENAI_API_KEY")
    # Otros proveedores: dejar que LiteLLM emita su propio error de credenciales.


def build_extraction_llm():
    """LiteLLM para extracción. Import perezoso del SDK."""
    from graphrag_sdk import LiteLLM

    model = extraction_model()
    _require_key_for_model(model)
    return LiteLLM(model=model, temperature=0.0)


def build_qa_llm():
    """LiteLLM para QA/consulta (gpt-4o-mini)."""
    from graphrag_sdk import LiteLLM

    _require_env("OPENAI_API_KEY")
    return LiteLLM(model=LLM_CONFIG["qa_model"], temperature=0.0)


def build_resolution(embedder=None):
    """
    Estrategia de resolución de entidades (LLMVerifiedResolution). Si se pasa el
    embedder BGE-M3, lo usa para el matching vectorial.
    """
    from graphrag_sdk import LiteLLM, LLMVerifiedResolution

    model = resolution_model()
    _require_key_for_model(model)
    llm = LiteLLM(model=model, temperature=0.0)
    return LLMVerifiedResolution(llm=llm, embedder=embedder)


def build_extractor_and_resolver(embedder=None, model: str | None = None):
    """
    Construye (extractor, resolver) para `GraphRAG.ingest()`, con el wiring exacto
    validado en el PoC (poc_v111_gemini_flash.py):
      extractor = GraphExtraction(llm = modelo de extracción)
      resolver  = LLMVerifiedResolution(llm = mismo LLM, embedder = BGE-M3)
    Pasarlos explícitamente a ingest() evita que el SDK use estrategias por defecto.

    `model` permite forzar un modelo concreto del chain (para el fallback del
    worker); si es None usa el primario (`extraction_model()`).
    """
    from graphrag_sdk import GraphExtraction, LiteLLM, LLMVerifiedResolution

    model = model or extraction_model()
    _require_key_for_model(model)
    llm_extraction = LiteLLM(model=model, temperature=0.0)
    extractor = GraphExtraction(llm=llm_extraction)
    resolver = LLMVerifiedResolution(llm=llm_extraction, embedder=embedder)
    return extractor, resolver
