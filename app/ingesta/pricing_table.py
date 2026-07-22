"""
Tabla de precios y modelo de uso de tokens del pipeline de ingesta (B2 §7).

DOCYAN LDE™ by XCID.

Dos piezas:

  1. PRECIOS por modelo (USD por 1M de tokens, input/output). Son los precios
     públicos vigentes de los modelos validados en el PoC (Adenda §3). Se aíslan
     aquí para que actualizarlos sea un cambio de un solo archivo, fechado.

  2. MODELO DE USO — cómo se traducen los tokens *del documento* (medidos con
     tiktoken) a tokens *facturables* del pipeline GraphRAG-SDK. El pipeline NO
     manda el documento crudo una sola vez: lo trocea y por cada chunk envía el
     prompt de extracción (instrucciones + schema) y recibe triples; luego una
     pasada de QA (gpt-4o-mini) y una de resolución. Los multiplicadores capturan
     ese patrón. Están CALIBRADOS contra los baselines reales del PoC (ver
     test_cotizador_baselines.py): NOM 32 pp ≈ $0.036, Ley 61 pp ≈ $0.046.

Importante: la estimación es eso, una estimación previa. tiktoken no es el
tokenizador exacto de Gemini, pero es la referencia que la Adenda §8 fija para el
cotizador y es conservador (cl100k/o200k tienden a contar igual o más que el
tokenizador de Gemini para texto técnico latino). Se documenta como aproximación.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

# Fecha de la tabla de precios. Actualizar junto con los valores.
PRICING_AS_OF = "2026-05-28"


def _env_float(name: str, default: float) -> float:
    """Lee un float de env var (precio configurable, F1.5). Default = valor vigente."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class ModelPricing:
    """Precio de un modelo en USD por 1M de tokens."""

    model: str
    input_usd_per_1m: float
    output_usd_per_1m: float

    def cost(self, input_tokens: float, output_tokens: float) -> float:
        return (
            input_tokens / 1_000_000 * self.input_usd_per_1m
            + output_tokens / 1_000_000 * self.output_usd_per_1m
        )


# ── Precios vigentes (Adenda §3 — modelos validados con el PoC NOM-052) ───────
# Gemini 2.5 Flash: extracción + resolution (prefijo gemini/ vía LiteLLM).
# gpt-4o-mini: QA / consulta.
# F1.5: configurables por env var (el founder confirma los valores al desplegar,
# ver PENDIENTE DE JORGE del contrato). Sin env var → el valor vigente del PoC.
PRICING: dict[str, ModelPricing] = {
    "gemini/gemini-2.5-flash": ModelPricing(
        model="gemini/gemini-2.5-flash",
        input_usd_per_1m=_env_float("PRICE_GEMINI_FLASH_IN_USD_PER_1M", 0.30),
        output_usd_per_1m=_env_float("PRICE_GEMINI_FLASH_OUT_USD_PER_1M", 2.50),
    ),
    "gpt-4o-mini": ModelPricing(
        model="gpt-4o-mini",
        input_usd_per_1m=_env_float("PRICE_GPT4O_MINI_IN_USD_PER_1M", 0.15),
        output_usd_per_1m=_env_float("PRICE_GPT4O_MINI_OUT_USD_PER_1M", 0.60),
    ),
    # Capas 2 y 3 de la cadena de extracción (decisión Jorge). El cotizador SIGUE
    # estimando contra la primaria (Flash); estos precios existen para CUANTIFICAR la
    # discrepancia cuando opera una capa superior (no se traslada al cliente).
    "gemini/gemini-2.5-pro": ModelPricing(
        model="gemini/gemini-2.5-pro",
        input_usd_per_1m=_env_float("PRICE_GEMINI_PRO_IN_USD_PER_1M", 1.25),
        output_usd_per_1m=_env_float("PRICE_GEMINI_PRO_OUT_USD_PER_1M", 10.0),
    ),
    "claude-opus-4-8": ModelPricing(
        model="claude-opus-4-8",
        input_usd_per_1m=_env_float("PRICE_OPUS_IN_USD_PER_1M", 5.0),
        output_usd_per_1m=_env_float("PRICE_OPUS_OUT_USD_PER_1M", 25.0),
    ),
}


# ── Modelo de uso del pipeline (calibrado contra baselines PoC) ───────────────
# Por cada token de documento medido con tiktoken, cuántos tokens factura cada
# fase. Derivados para reproducir NOM 32pp ≈ $0.036 (ver test de baselines):
#   extracción Gemini: input ≈ doc×1.0 (chunk + prompt overhead ~ se compensan),
#                       output ≈ doc×0.5 (triples extraídos),
#   QA gpt-4o-mini:     input ≈ doc×0.3, output ≈ doc×0.1.
# Estos factores son la perilla de calibración; si cambian los precios o el
# comportamiento del SDK, se re-calibran contra baselines y se ajusta el test.
EXTRACTION_INPUT_RATIO = 1.0
EXTRACTION_OUTPUT_RATIO = 0.5
QA_INPUT_RATIO = 0.3
QA_OUTPUT_RATIO = 0.1

# Costo computacional de embeddings BGE-M3 self-hosted. No es un costo de API
# (el embedder es propio), pero es reportable como costo marginal de cómputo.
# Estimación conservadora en USD por 1M de tokens embebidos (electricidad+amort.).
# F1.5: configurable por env var (BGE-M3 es cómputo propio, parametrizable).
BGE_M3_COMPUTE_USD_PER_1M = _env_float("PRICE_BGE_M3_USD_PER_1M", 0.01)

# ── Modelo de costo de VISIÓN por figura (gate de figuras, Pieza 3) ───────────
# La extracción de diagramas envía CADA figura a Gemini 2.5 Flash multimodal: la
# imagen (Gemini la factura como un bloque ~fijo de tokens) + el prompt de etiquetas
# (input) y recibe el JSON de rótulos/leyenda (output). Estos tokens facturables por
# figura, multiplicados por el precio de Flash, dan el costo de visión que entra al
# GATE del cotizador ANTES de ingerir — igual que el texto. Conservador (sobreestima
# antes que subestimar). Configurable por env var.
VISION_INPUT_TOKENS_POR_FIGURA = _env_float("VISION_INPUT_TOKENS_POR_FIGURA", 1300.0)
VISION_OUTPUT_TOKENS_POR_FIGURA = _env_float("VISION_OUTPUT_TOKENS_POR_FIGURA", 320.0)

# Tope de figuras por documento. ED-0c: default 0 = **SIN TOPE**. Un tope ciego
# descartaba dibujos en silencio (un manual técnico con 85 figuras perdía 55),
# rompiendo la promesa del producto para documentos con ayudas visuales. El control
# de costo REAL es el cotizador + confirmación explícita (cotiza TODAS las figuras y
# el usuario aprueba con el precio a la vista), NO un tope que tira dibujos. Un valor
# >0 por env reintroduce un tope de emergencia (top-N por tamaño); 0 = todas.
MAX_FIGURAS_POR_DOCUMENTO = int(_env_float("MAX_FIGURAS_POR_DOCUMENTO", 0.0))


def figuras_a_procesar(num_figuras: int) -> int:
    """Nº de figuras a cotizar/extraer. Con `MAX_FIGURAS_POR_DOCUMENTO<=0` (default
    ED-0c) NO hay tope: se procesan TODAS. Un valor >0 aplica el tope de emergencia."""
    n = max(0, int(num_figuras or 0))
    if MAX_FIGURAS_POR_DOCUMENTO <= 0:
        return n
    return min(n, MAX_FIGURAS_POR_DOCUMENTO)


def costo_vision_figuras(num_figuras: int) -> float:
    """Costo USD estimado de la extracción de visión de `num_figuras` figuras, contra
    Gemini 2.5 Flash (la primaria). El tope `MAX_FIGURAS_POR_DOCUMENTO` lo aplica el
    cotizador antes de llamar aquí; esta función no recapa (cuantifica lo que reciba)."""
    if num_figuras <= 0:
        return 0.0
    flash = model_pricing("gemini/gemini-2.5-flash")
    return round(
        flash.cost(
            num_figuras * VISION_INPUT_TOKENS_POR_FIGURA,
            num_figuras * VISION_OUTPUT_TOKENS_POR_FIGURA,
        ),
        6,
    )


# ── Modelo de tiempo (Adenda §8 — PoC: Gemini Flash 642s para una NOM 32pp) ───
# Throughput efectivo observado incluyendo latencia de red y rate limiting.
SECONDS_PER_1K_DOC_TOKENS = 642.0 / 22.4  # ≈ 28.7 s por 1k tokens (NOM 32pp≈22.4k)

# ── Fórmula de cobro de setup (Modelo Comercial §2.3 v1.1, cableada en F1.5) ───
#   precio_setup = MAX( PISO , costo_base_real × MULTIPLICADOR ) × factor_complejidad
# El piso ($15, definición vigente v1.1 confirmada en F3) protege márgenes en
# documentos chicos; el múltiplo (×25) cubre documentos caros. `factor_complejidad`
# arranca en 1.0 (perilla futura por tipo documental). Los tres son configurables
# por env var sin tocar código. (El piso histórico $25 de v1.0 quedó desactualizado.)
SETUP_PRICE_FLOOR_USD = _env_float("SETUP_PRICE_FLOOR_USD", 15.0)
SETUP_COST_MULTIPLIER = _env_float("SETUP_COST_MULTIPLIER", 25.0)
FACTOR_COMPLEJIDAD = _env_float("FACTOR_COMPLEJIDAD", 1.0)


def precio_setup(costo_base_real: float, factor_complejidad: float | None = None) -> float:
    """
    Precio de setup por ingesta (Modelo Comercial §2.3):

        MAX( SETUP_PRICE_FLOOR_USD , costo_base_real × SETUP_COST_MULTIPLIER )
            × factor_complejidad

    `costo_base_real` es el costo de cómputo estimado/real (extracción + QA +
    embeddings). Documento chico → gana el piso; documento caro → gana costo×múltiplo.
    """
    factor = FACTOR_COMPLEJIDAD if factor_complejidad is None else factor_complejidad
    base = max(SETUP_PRICE_FLOOR_USD, costo_base_real * SETUP_COST_MULTIPLIER)
    return round(base * factor, 4)


def model_pricing(model: str) -> ModelPricing:
    """Devuelve el pricing de un modelo o lanza KeyError explícito."""
    if model not in PRICING:
        raise KeyError(
            f"Modelo sin precio en pricing_table: '{model}'. "
            f"Modelos conocidos: {sorted(PRICING)}. Actualizar pricing_table.py."
        )
    return PRICING[model]
