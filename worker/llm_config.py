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

import contextlib
import contextvars
import logging
import os

_log = logging.getLogger("docyan.worker.llm")

# ── Tope de reintentos de LiteLLM (Pieza 4a) ──────────────────────────────────
# Sin esto, el reintento por-chunk del GraphRAG-SDK / litellm bajo rate-limit NO
# tiene tope de NUESTRO lado (incidente PoC: 1,506 reintentos amplificarían el
# gasto sin gate). Fijamos un tope EXPLÍCITO y global de litellm. Configurable.
LLM_NUM_RETRIES = max(0, int(os.getenv("INGEST_LLM_NUM_RETRIES", "2")))

# ── Timeout de red de TODA llamada LLM del worker (ED-0b §2) ───────────────────
# El default de litellm era insuficiente para PDFs reales: la extracción de un
# chunk grande (Docling + tablas + visión) puede tardar minutos y expiraba con
# `timed out` en las 3 capas (incidente de siembra demo-maxi). Se fija un timeout
# GENEROSO y explícito, global a litellm (lo respetan también las llamadas
# internas del GraphRAG-SDK). 600s = 10 min: holgado para el chunk más pesado sin
# ser infinito. Configurable por env.
LLM_TIMEOUT_SECONDS = float(os.getenv("INGEST_LLM_TIMEOUT_SECONDS", "600"))

# ── Modelos que RECHAZAN el parámetro `temperature` (ED-0b §3) ─────────────────
# `claude-opus-4-8` deprecó `temperature`: pasarlo da
# `BadRequestError: 'temperature' is deprecated for this model` y tumba la capa
# verify+rels. Se omite `temperature` para estos modelos (y `litellm.drop_params`
# lo descarta también en las llamadas internas del SDK). Configurable por env (CSV).
_MODELS_SIN_TEMPERATURE = {
    m.strip().lower()
    for m in os.getenv("INGEST_MODELOS_SIN_TEMPERATURE", "claude-opus-4-8").split(",")
    if m.strip()
}


def acepta_temperature(model: str) -> bool:
    """False si el modelo deprecó `temperature` (no se debe pasar). ED-0b §3."""
    return (model or "").strip().lower() not in _MODELS_SIN_TEMPERATURE

# Acumulador de USO REAL por job (Pieza 4b): un contextvar guarda los tokens/costo
# reales que litellm reporta (`response.usage`) durante una corrida, para comparar
# el gasto REAL vs el estimado — no solo el tier del modelo. Scoped por corrida con
# `medir_uso()`; el callback de litellm suma sobre el acumulador activo (o nada si
# no hay corrida midiendo). Best-effort: si no se captura, el pipeline cae al
# comparador por tier (comportamiento previo), nunca rompe la ingesta.
_usage_var: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
    "docyan_litellm_usage", default=None
)
_litellm_configured = False


class _UsageLogger:
    """CustomLogger de litellm: suma `response.usage` + costo al acumulador activo."""

    def log_success_event(self, kwargs, response_obj, start_time, end_time) -> None:  # noqa: D401
        acc = _usage_var.get()
        if acc is None:
            return
        try:
            usage = getattr(response_obj, "usage", None)
            if usage is None and isinstance(response_obj, dict):
                usage = response_obj.get("usage")
            pt = getattr(usage, "prompt_tokens", None)
            ct = getattr(usage, "completion_tokens", None)
            if pt is None and isinstance(usage, dict):
                pt, ct = usage.get("prompt_tokens"), usage.get("completion_tokens")
            acc["prompt_tokens"] += int(pt or 0)
            acc["completion_tokens"] += int(ct or 0)
            acc["calls"] += 1
            try:
                import litellm

                acc["cost_usd"] += float(
                    litellm.completion_cost(completion_response=response_obj) or 0.0
                )
            except Exception:  # noqa: BLE001 — costo por-call best-effort
                pass
        except Exception:  # noqa: BLE001 — la medición jamás rompe la ingesta
            pass

    # litellm puede invocar también el evento async; delega al mismo acumulador.
    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time) -> None:
        self.log_success_event(kwargs, response_obj, start_time, end_time)


def configure_litellm() -> None:
    """Fija el tope de reintentos global de litellm + registra el medidor de uso.
    Idempotente (se puede llamar en cada build/startup sin reinstalar callbacks)."""
    global _litellm_configured
    if _litellm_configured:
        return
    try:
        import litellm

        litellm.num_retries = LLM_NUM_RETRIES
        # ED-0b §2: timeout de red global (lo respetan las llamadas internas del SDK).
        litellm.request_timeout = LLM_TIMEOUT_SECONDS
        # ED-0b §3: descarta params no soportados por el modelo (p. ej. `temperature`
        # en claude-opus-4-8) en vez de romper con BadRequestError. Defensa en
        # profundidad además de omitirlo explícitamente al construir el LLM.
        litellm.drop_params = True
        cbs = list(getattr(litellm, "callbacks", None) or [])
        if not any(isinstance(c, _UsageLogger) for c in cbs):
            cbs.append(_UsageLogger())
            litellm.callbacks = cbs
        _litellm_configured = True
        _log.info(
            "litellm configurado: num_retries=%d, request_timeout=%.0fs, "
            "drop_params=True, medidor de uso activo",
            LLM_NUM_RETRIES, LLM_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001 — sin litellm (tests) no es fatal
        _log.debug("no se pudo configurar litellm: %s", type(exc).__name__)


@contextlib.contextmanager
def medir_uso():
    """Contexto que mide el USO REAL de litellm de su bloque (Pieza 4b). Devuelve un
    dict {prompt_tokens, completion_tokens, cost_usd, calls} que se llena conforme
    litellm completa llamadas dentro del bloque."""
    configure_litellm()
    acc = {"prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0, "calls": 0}
    tok = _usage_var.set(acc)
    try:
        yield acc
    finally:
        _usage_var.reset(tok)

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


def _build_sdk_litellm(model: str):
    """
    Construye un `graphrag_sdk.LiteLLM` para `model`, omitiendo `temperature`
    cuando el modelo lo deprecó (ED-0b §3: claude-opus-4-8). El timeout de red lo
    fija `litellm.request_timeout` en `configure_litellm()` (ED-0b §2), global a
    todas las llamadas — incluidas las internas del SDK.
    """
    from graphrag_sdk import LiteLLM

    configure_litellm()  # tope de reintentos + timeout + drop_params globales
    if acepta_temperature(model):
        return LiteLLM(model=model, temperature=0.0)
    return LiteLLM(model=model)  # sin temperature (deprecado para este modelo)


def build_extraction_llm():
    """LiteLLM para extracción. Import perezoso del SDK."""
    model = extraction_model()
    _require_key_for_model(model)
    return _build_sdk_litellm(model)


def build_qa_llm():
    """LiteLLM para QA/consulta (gpt-4o-mini)."""
    _require_env("OPENAI_API_KEY")
    return _build_sdk_litellm(LLM_CONFIG["qa_model"])


def build_resolution(embedder=None):
    """
    Estrategia de resolución de entidades (LLMVerifiedResolution). Si se pasa el
    embedder BGE-M3, lo usa para el matching vectorial.
    """
    from graphrag_sdk import LLMVerifiedResolution

    model = resolution_model()
    _require_key_for_model(model)
    return LLMVerifiedResolution(llm=_build_sdk_litellm(model), embedder=embedder)


def complete_text(prompt: str, *, model: str | None = None, temperature: float = 0.0) -> str:
    """
    Completion de texto directa vía LiteLLM (B9.5 — auto-extracción de borradores
    T5). Devuelve el contenido del mensaje. Usa el modelo de extracción por default
    (Gemini 2.5 Flash, prefijo `gemini/` obligatorio). Import perezoso de litellm.
    """
    import litellm

    model = model or extraction_model()
    _require_key_for_model(model)
    configure_litellm()
    kwargs = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "num_retries": LLM_NUM_RETRIES,
        "timeout": LLM_TIMEOUT_SECONDS,  # ED-0b §2: timeout explícito por-llamada
    }
    if acepta_temperature(model):  # ED-0b §3: omitir si el modelo lo deprecó
        kwargs["temperature"] = temperature
    resp = litellm.completion(**kwargs)
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
    configure_litellm()
    kwargs = {
        "model": model,
        "num_retries": LLM_NUM_RETRIES,
        "timeout": LLM_TIMEOUT_SECONDS,  # ED-0b §2: timeout explícito por-llamada
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                ],
            }
        ],
    }
    if acepta_temperature(model):  # ED-0b §3
        kwargs["temperature"] = 0.0
    resp = litellm.completion(**kwargs)
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
        LLMExtractor,
        LLMVerifiedResolution,
    )

    model = model or extraction_model()
    _require_key_for_model(model)
    # ED-0b §3: verify+rels usa este LLM; con claude-opus-4-8 (capa 3) NO se pasa
    # `temperature` (deprecado → BadRequestError que tumbaba el paso).
    llm_extraction = _build_sdk_litellm(model)
    extractor = GraphExtraction(
        llm=llm_extraction,
        entity_extractor=LLMExtractor(llm_extraction),  # LLM-only (no GLiNER)
    )
    resolver = LLMVerifiedResolution(llm=llm_extraction, embedder=embedder)
    return extractor, resolver
