"""
Cotizador pre-ingesta (B2 §7 — CRÍTICO, Adenda §8).

DOCYAN LDE™ by XCID.

GATE financiero inviolable: antes de invocar a GraphRAG-SDK, este módulo

  1. mide los tokens del documento con tiktoken,
  2. estima costo (extracción Gemini 2.5 Flash + QA gpt-4o-mini + embeddings BGE-M3),
  3. estima tiempo de procesamiento,
  4. resuelve el cupo del plan (dentro de cupo → setup $0; sobre cupo → fórmula),
  5. decide: siempre APROBADO_REQUIERE_CONFIRMACION (con el precio a la vista),
  6. nunca ingiere por su cuenta: la ingesta solo procede con confirmación explícita.

Modelo comercial v2.1 (cotizador.md): **NO hay saldo prepagado ni hard caps**. El
gate es cupo + cotización + confirmación; no se rechaza por saldo. El cobro del
excedente es al método de pago al confirmar (manual hasta B9.1), sin prepago.

No hay bypass (CLAUDE.md §14): toda ingesta pasa por la cotización y la
confirmación explícita del usuario. Justificación operativa: incidente PoC
28-may-2026 ($5,000 en Gemini por una ingesta sin cotización ni confirmación).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum

from app.ingesta import pricing_table as pt
from app.ingesta.quota_manager import QuotaManager

# Encoding de tiktoken para medir. o200k_base es el de gpt-4o/gpt-4o-mini; se usa
# como referencia única para todo el documento (aproximación documentada para la
# parte Gemini — ver pricing_table). Carga perezosa: tiktoken es dep del worker
# y del backend (B0) pero la importación se hace al medir, no al importar módulo.
TIKTOKEN_ENCODING = "o200k_base"


class DecisionCotizacion(str, Enum):
    aprobado_requiere_confirmacion = "aprobado_requiere_confirmacion"
    rechazado_presupuesto = "rechazado_presupuesto"
    rechazado_hard_cap = "rechazado_hard_cap"


@dataclass
class DesgloseCosto:
    """Desglose por fase del pipeline, en USD."""

    extraccion_usd: float
    qa_usd: float
    embeddings_usd: float
    # Costo de VISIÓN de las figuras (Pieza 3): entra al GATE igual que el texto.
    vision_usd: float = 0.0

    @property
    def total_usd(self) -> float:
        return round(
            self.extraccion_usd + self.qa_usd + self.embeddings_usd + self.vision_usd, 6
        )


@dataclass
class Cotizacion:
    """Resultado de cotizar un documento. Es el objeto que el endpoint devuelve."""

    tenant_id: str
    tipo_documento: str | None
    tokens_documento: int
    costo_estimado_usd: float
    desglose: DesgloseCosto
    tiempo_estimado_seg: float
    decision: DecisionCotizacion
    motivo: str
    saldo_disponible_usd: float
    falta_usd: float = 0.0
    # Precio de setup por ingesta (Modelo Comercial §2.3, F1.5): el cobro comercial
    # = MAX($25, costo_base×25) × factor_complejidad. Es el número que el cliente
    # ve facturado por la ingesta; el SALDO retiene/liquida el costo de cómputo
    # (costo_estimado_usd), no este precio (la relación cuota-de-plan vs recarga se
    # cierra en F4/Stripe — ver contrato A.5).
    precio_setup_usd: float = 0.0
    factor_complejidad: float = 1.0
    pricing_as_of: str = pt.PRICING_AS_OF
    # Detalle de tokens facturables estimados por fase (transparencia para el PM).
    detalle_tokens: dict = field(default_factory=dict)
    # Cupo de ingestas (F3 §C). `dentro_de_cupo`=True → esta ingesta va incluida en el
    # plan y `precio_setup_usd`=0. `cupo_restante`=None → el plan no lleva cupo
    # (freemium / org sin cupo) y rige la fórmula de setup como siempre.
    dentro_de_cupo: bool = False
    cupo_restante: int | None = None
    # Figuras (Pieza 3): `num_figuras` = detectadas (estimación ligera pre-ingesta);
    # `figuras_cotizadas` = las que entran al costo de visión (capadas al tope por
    # documento); `figuras_excedidas` = cuántas se omitirán (aviso honesto). El costo
    # de visión vive en `desglose.vision_usd` y ya está sumado al total/gate.
    num_figuras: int = 0
    figuras_cotizadas: int = 0
    figuras_excedidas: int = 0

    @property
    def aprobado(self) -> bool:
        return self.decision == DecisionCotizacion.aprobado_requiere_confirmacion

    def to_dict(self) -> dict:
        d = asdict(self)
        d["decision"] = self.decision.value
        d["costo_total_usd"] = self.desglose.total_usd
        d["aprobado"] = self.aprobado
        return d


def contar_tokens(texto: str) -> int:
    """Cuenta tokens con tiktoken (Adenda §8). Fallback robusto si no carga."""
    try:
        import tiktoken

        enc = tiktoken.get_encoding(TIKTOKEN_ENCODING)
        return len(enc.encode(texto))
    except Exception:
        # Fallback conservador (sobreestima): ~4 chars por token para texto latino.
        # Nunca subestima el costo, que es el riesgo a evitar.
        return max(1, len(texto) // 4)


def estimar_costo(
    tokens_documento: int, figuras_cotizadas: int = 0
) -> tuple[DesgloseCosto, dict]:
    """
    Traduce tokens del documento (+ figuras) a costo USD usando el modelo de uso
    calibrado (pricing_table). Devuelve el desglose y el detalle de tokens facturables.

    `figuras_cotizadas` ya viene CAPADO al tope por documento (lo aplica `cotizar`):
    aquí solo se cuantifica su costo de visión. El costo de visión entra al total y,
    por tanto, al gate del presupuesto — exactamente como el texto.
    """
    gemini = pt.model_pricing("gemini/gemini-2.5-flash")
    mini = pt.model_pricing("gpt-4o-mini")

    extr_in = tokens_documento * pt.EXTRACTION_INPUT_RATIO
    extr_out = tokens_documento * pt.EXTRACTION_OUTPUT_RATIO
    qa_in = tokens_documento * pt.QA_INPUT_RATIO
    qa_out = tokens_documento * pt.QA_OUTPUT_RATIO

    extraccion_usd = gemini.cost(extr_in, extr_out)
    qa_usd = mini.cost(qa_in, qa_out)
    # Embeddings BGE-M3: se embeben los tokens del documento (cómputo propio).
    embeddings_usd = tokens_documento / 1_000_000 * pt.BGE_M3_COMPUTE_USD_PER_1M
    # Visión de figuras (Pieza 3): costo estimado ANTES de ingerir.
    vision_usd = pt.costo_vision_figuras(figuras_cotizadas)

    desglose = DesgloseCosto(
        extraccion_usd=round(extraccion_usd, 6),
        qa_usd=round(qa_usd, 6),
        embeddings_usd=round(embeddings_usd, 6),
        vision_usd=vision_usd,
    )
    detalle = {
        "extraccion_input_tokens": int(extr_in),
        "extraccion_output_tokens": int(extr_out),
        "qa_input_tokens": int(qa_in),
        "qa_output_tokens": int(qa_out),
        "embeddings_tokens": int(tokens_documento),
        "figuras_cotizadas": int(figuras_cotizadas),
        "vision_input_tokens": int(figuras_cotizadas * pt.VISION_INPUT_TOKENS_POR_FIGURA),
        "vision_output_tokens": int(figuras_cotizadas * pt.VISION_OUTPUT_TOKENS_POR_FIGURA),
    }
    return desglose, detalle


def estimar_tiempo_seg(tokens_documento: int) -> float:
    """Estima tiempo de procesamiento (Adenda §8: PoC NOM 32pp ≈ 642s)."""
    return round(tokens_documento / 1000 * pt.SECONDS_PER_1K_DOC_TOKENS, 1)


class Cotizador:
    """Cotizador pre-ingesta. Punto único de decisión de gasto de ingesta."""

    def __init__(
        self,
        quota_manager: QuotaManager | None = None,
    ):
        # Cupo de ingestas (F3 §C). Opcional: si no se inyecta, NO se aplica cupo y
        # el setup se cobra con la fórmula como antes (comportamiento previo intacto).
        self.quota = quota_manager

    def cotizar(
        self,
        tenant_id: str,
        texto_documento: str,
        tipo_documento: str | None = None,
        costo_sesion_acumulado_usd: float = 0.0,
        num_figuras: int = 0,
    ) -> Cotizacion:
        """
        Cotiza un documento y decide si la ingesta puede proceder. NO ingiere.

        `num_figuras` es el conteo (ligero, pre-ingesta) de figuras del documento; su
        costo de VISIÓN entra al gate (Pieza 3), capado al tope por documento. El worker
        re-mide las figuras reales (Docling) y aplica el MISMO tope al extraer.

        Devuelve una Cotizacion con la decisión:
          - rechazado_hard_cap   → excede cap por documento o por sesión.
          - rechazado_presupuesto → saldo prepagado insuficiente.
          - aprobado_requiere_confirmacion → procede SOLO con confirmación explícita.
        """
        tokens = contar_tokens(texto_documento)
        # Cap de figuras por documento: solo se cotiza (y se extraerá) hasta el tope.
        num_figuras = max(0, int(num_figuras or 0))
        figuras_cotizadas = min(num_figuras, pt.MAX_FIGURAS_POR_DOCUMENTO)
        figuras_excedidas = num_figuras - figuras_cotizadas
        desglose, detalle = estimar_costo(tokens, figuras_cotizadas)
        costo = desglose.total_usd
        tiempo = estimar_tiempo_seg(tokens)
        # Precio de setup comercial (Modelo Comercial §2.3 v1.1): MAX($15, costo×25)×factor.
        precio_setup = pt.precio_setup(costo)

        # Cupo de ingestas (F3 §C). Si la org tiene cupo disponible, esta ingesta va
        # INCLUIDA: setup $0 ("incluido en tu plan"). Agotado el cupo, rige la fórmula.
        # Sin cupo (freemium / org sin fila): None → comportamiento previo (fórmula).
        dentro_de_cupo = False
        cupo_restante: int | None = None
        if self.quota is not None:
            estado = self.quota.estado(tenant_id)
            if estado.aplica:
                cupo_restante = estado.cupo_restante
                if estado.dentro_de_cupo:
                    dentro_de_cupo = True
                    precio_setup = 0.0

        # Modelo comercial v2.1 (cotizador.md): NO hay saldo prepagado ni hard caps.
        # El gate es cupo + cotización + confirmación explícita. La cotización SIEMPRE
        # procede a confirmación (el usuario decide con el precio a la vista); dentro de
        # cupo el setup es $0, sobre cupo rige la fórmula. Sin rechazo por saldo.
        decision = DecisionCotizacion.aprobado_requiere_confirmacion
        if dentro_de_cupo:
            motivo = (
                f"Estimación ${costo:.4f} USD de cómputo (~{tiempo:.0f}s). "
                f"Setup incluido en tu plan ({cupo_restante} ingesta(s) restantes). "
                "Requiere confirmación explícita para ingerir."
            )
        else:
            motivo = (
                f"Estimación ${costo:.4f} USD de cómputo (~{tiempo:.0f}s); "
                f"setup ${precio_setup:.2f} USD. "
                "Requiere confirmación explícita para ingerir."
            )

        return Cotizacion(
            tenant_id=tenant_id,
            tipo_documento=tipo_documento,
            tokens_documento=tokens,
            costo_estimado_usd=costo,
            desglose=desglose,
            tiempo_estimado_seg=tiempo,
            decision=decision,
            motivo=motivo,
            saldo_disponible_usd=0.0,  # deprecado (v2.1 sin saldo prepagado)
            falta_usd=0.0,
            precio_setup_usd=precio_setup,
            factor_complejidad=pt.FACTOR_COMPLEJIDAD,
            detalle_tokens=detalle,
            dentro_de_cupo=dentro_de_cupo,
            cupo_restante=cupo_restante,
            num_figuras=num_figuras,
            figuras_cotizadas=figuras_cotizadas,
            figuras_excedidas=figuras_excedidas,
        )
