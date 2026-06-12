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

# CADENA CANÓNICA DE TRES CAPAS (decisión de Jorge, jun 2026). Cada capa es
# overrideable por env, pero el DEFAULT es la decisión canónica:
#   Capa 1 — Primaria:        gemini/gemini-2.5-flash (prefijo `gemini/` OBLIGATORIO;
#            sin él LiteLLM defaultea a Vertex AI y falla pidiendo credenciales GCP).
#   Capa 2 — Retry de calidad: gemini/gemini-2.5-pro — se invoca cuando la corrida
#            PRIMARIA rinde 0 entidades de ontología o timeout. MISMA FAMILIA = mismo
#            estilo de extracción, sin varianza entre documentos del tenant (escalera
#            determinista Flash→Pro; NO re-tirar la lotería con Flash).
#   Capa 3 — Fallback de PROVEEDOR: claude-opus-4-8 — SOLO ante falla de proveedor
#            (key inválida, cuota, outage de Google). Ya NO Sonnet.
# Un tenant se ingiere con la primaria salvo escalada puntual registrada; jamás se
# alterna modelo por conveniencia. Toda corrida registra `modelo_usado` (visible).
_DEFAULT_EXTRACTION_MODEL = "gemini/gemini-2.5-flash"
_DEFAULT_QUALITY_RETRY_MODEL = "gemini/gemini-2.5-pro"
_DEFAULT_PROVIDER_FALLBACK_MODELS = "claude-opus-4-8"

LLM_CONFIG = {
    "qa_model": "gpt-4o-mini",
    "deduplicate_fuzzy": True,
    "force_spanish_in_extraction_prompt": True,
    "retry_with_tenacity": True,
}


def extraction_model() -> str:
    """Capa 1 — modelo PRIMARIO de extracción (Gemini 2.5 Flash)."""
    return os.getenv("INGEST_EXTRACTION_MODEL", _DEFAULT_EXTRACTION_MODEL)


def quality_retry_model() -> str | None:
    """Capa 2 — retry de CALIDAD (Gemini 2.5 Pro) ante 0 ontología/timeout del
    primario. Misma familia que la primaria. `""` lo desactiva."""
    v = os.getenv("INGEST_QUALITY_RETRY_MODEL", _DEFAULT_QUALITY_RETRY_MODEL).strip()
    return v or None


def provider_fallback_models() -> list[str]:
    """Capa 3 — fallback de PROVEEDOR (Claude Opus 4.8) ante falla de proveedor.
    CSV en INGEST_PROVIDER_FALLBACK_MODELS. Es la red de seguridad cuando Google
    cae; si opera en >5% de ingestas es incidente de key/cuota, no costo a absorber."""
    raw = os.getenv("INGEST_PROVIDER_FALLBACK_MODELS", _DEFAULT_PROVIDER_FALLBACK_MODELS)
    return [m.strip() for m in raw.split(",") if m.strip()]


# Compat retro: algunos llamadores leían la "cadena" plana [primario, *fallbacks].
# Se mantiene como [primario, *fallbacks de proveedor] (la capa 2 de calidad tiene
# su propio disparador por 0-ontología, no es un eslabón de la cadena de proveedor).
def extraction_fallback_models() -> list[str]:
    return provider_fallback_models()


def extraction_model_chain() -> list[str]:
    chain = [extraction_model()]
    for m in provider_fallback_models():
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


def complete_text(prompt: str, *, model: str | None = None, temperature: float = 0.0) -> str:
    """
    Completion de texto directa vía LiteLLM (B9.5 — auto-extracción de borradores
    T5). Devuelve el contenido del mensaje. Usa el modelo de extracción por default
    (Gemini 2.5 Flash, prefijo `gemini/` obligatorio). Import perezoso de litellm.
    """
    import litellm

    model = model or extraction_model()
    _require_key_for_model(model)
    resp = litellm.completion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return resp["choices"][0]["message"]["content"] or ""


def complete_vision(prompt: str, image_b64: str, *, model: str | None = None) -> str:
    """
    Completion multimodal (texto + imagen) vía LiteLLM (B9.5 — auto-extracción de
    etiquetas+coordenadas de figuras, T3). `image_b64` es PNG en base64. Gemini 2.5
    Flash es multimodal; el prefijo `gemini/` es obligatorio. Import perezoso.
    """
    import litellm

    model = model or extraction_model()
    _require_key_for_model(model)
    resp = litellm.completion(
        model=model,
        temperature=0.0,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                ],
            }
        ],
    )
    return resp["choices"][0]["message"]["content"] or ""


def build_extractor_and_resolver(embedder=None, model: str | None = None):
    """
    Construye (extractor, resolver) para `GraphRAG.ingest()`, con el wiring exacto
    validado en el PoC (poc_v111_gemini_flash.py) — extracción LLM-only (estado B2):
      extractor = GraphExtraction(llm = modelo de extracción,
                                  entity_extractor = LLMExtractor(mismo LLM))
      resolver  = LLMVerifiedResolution(llm = mismo LLM, embedder = BGE-M3)
    Pasarlos explícitamente a ingest() evita que el SDK use estrategias por defecto.

    IMPORTANTE (B3.6): `GraphExtraction` usa `GLiNERExtractor()` por DEFAULT como
    step-1 NER (NER local híbrido). Pasamos `entity_extractor=LLMExtractor(llm)`
    EXPLÍCITO para forzar LLM-only y NO entrar al híbrido GLiNER: en español
    técnico el híbrido sub-extrae (8 nodos / 0 relaciones vs 12 / 19 de B2),
    porque `gliner_medium-v2.1` es anglocéntrico y GLiNER no infiere sujetos
    implícitos en voz pasiva regulatoria — la capacidad clave del motor de
    extracción (decisión #1 Paso C; PoC 28 mayo 2026). El cache de GLiNER en la
    imagen queda inerte. Ver docs/decisiones_extraccion.md.

    `model` permite forzar un modelo concreto del chain (para el fallback del
    worker); si es None usa el primario (`extraction_model()`).
    """
    from graphrag_sdk import (
        GraphExtraction,
        LiteLLM,
        LLMExtractor,
        LLMVerifiedResolution,
    )

    model = model or extraction_model()
    _require_key_for_model(model)
    llm_extraction = LiteLLM(model=model, temperature=0.0)
    extractor = GraphExtraction(
        llm=llm_extraction,
        entity_extractor=LLMExtractor(llm_extraction),  # LLM-only (no GLiNER)
    )
    resolver = LLMVerifiedResolution(llm=llm_extraction, embedder=embedder)
    return extractor, resolver
