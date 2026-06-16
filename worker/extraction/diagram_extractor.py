"""
Auto-extracción de diagramas: figuras + etiquetas con coordenadas (B9.5 §1.1 T3).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.

DOCYAN extrae automáticamente el diagrama: cada figura del documento se almacena
como asset servible y se le piden al LLM de VISIÓN las etiquetas/callouts con su
caja normalizada `{x,y,w,h}` (0..1) y la leyenda simbólica. El resultado se
materializa directo al grafo (sin revisión manual; el editor se retiró de B9.5).

Inyectables para test sin claves/stack:
  - `complete_vision(prompt, image_b64) -> str` (prod: worker.llm_config.complete_vision)
  - `put_asset(tenant_id, nombre, png_bytes) -> url` (prod: app.recursos.asset_store)
"""
from __future__ import annotations

import base64
import logging
from typing import Callable

from worker.extraction._json import parse_llm_json
from worker.extraction.docling_figures import FiguraExtraida
from worker.extraction.models import DraftDiagrama, EtiquetaBorrador, LeyendaBorrador

logger = logging.getLogger("docyan.worker.extraccion.diagrama")

_PROMPT = """Eres un extractor de diagramas técnicos. Observa la figura y detecta \
las ETIQUETAS/callouts que rotulan sus partes (números o textos con líneas guía) y \
la LEYENDA simbólica si existe.

Devuelve EXCLUSIVAMENTE un JSON (sin texto adicional):
{
  "titulo": "string — título del diagrama",
  "etiquetas": [
    {"texto": "Tapa del rotor", "x": 0.33, "y": 0.26, "w": 0.10, "h": 0.06}
  ],
  "leyenda_simbolica": [{"simbolo": "⚠", "significado": "Punto caliente"}]
}

Reglas:
- Las coordenadas x,y,w,h están NORMALIZADAS (0..1): x,y = esquina superior \
izquierda de la caja del rótulo; w,h = ancho y alto. Sé preciso con la posición.
- "texto" es el rótulo legible de la parte señalada.
- Si la figura NO es un diagrama con rótulos (p. ej. una foto sin callouts), \
devuelve {"titulo": "", "etiquetas": [], "leyenda_simbolica": []}.
- Responde en español, conservando términos técnicos."""


def extraer_diagramas(
    tenant_id: str,
    figuras: list[FiguraExtraida],
    *,
    complete_vision: Callable[[str, str], str] | None = None,
    put_asset: Callable[[str, str, bytes], str] | None = None,
    storage_ok: Callable[[], bool] | None = None,
) -> list[DraftDiagrama]:
    """
    Extrae un `DraftDiagrama` por figura con rótulos. Best-effort: figuras sin
    etiquetas se omiten; nunca lanza (la auto-extracción no es gate).

    CORTO-CIRCUITO DE COSTO (decisión Jorge 15-jun-2026): si el almacén de assets
    NO está disponible (p. ej. el bucket `docyan-assets` no existe), se OMITE la
    extracción entera — NO se llama a la visión de Gemini por figura, porque el
    resultado (DiagramViewer servible) no se podría guardar. No se paga lo que no se
    puede usar. El gate COMPLETO de figuras (estimar el costo de visión ANTES, en el
    cotizador, + tope por documento) es el sprint de costo siguiente.
    """
    if not figuras:
        return []

    # Cap de figuras por documento (Pieza 3): el cotizador solo cotizó el costo de
    # visión hasta este tope; el worker extrae el MISMO tope para que el gasto real no
    # exceda lo cotizado. Top-N por TAMAÑO de imagen (proxy de "figura informativa":
    # un diagrama rotulado pesa más que un ícono/logo). Aviso honesto si se excede.
    from app.ingesta.pricing_table import MAX_FIGURAS_POR_DOCUMENTO

    if len(figuras) > MAX_FIGURAS_POR_DOCUMENTO:
        excedidas = len(figuras) - MAX_FIGURAS_POR_DOCUMENTO
        logger.warning(
            "documento con %d figuras excede el tope de %d; se extraen las %d mayores "
            "y se OMITEN %d (aviso honesto, gasto de visión acotado a lo cotizado)",
            len(figuras), MAX_FIGURAS_POR_DOCUMENTO, MAX_FIGURAS_POR_DOCUMENTO, excedidas,
        )
        figuras = sorted(figuras, key=lambda f: len(f.png_bytes or b""), reverse=True)[
            :MAX_FIGURAS_POR_DOCUMENTO
        ]

    # Corto-circuito de costo: se prueba el MISMO almacén que se va a usar. Con
    # `put_asset` inyectado (test/custom), el caller garantiza el store → no se
    # prueba. En prod (store por defecto), se prueba el bucket: si no está, se omite
    # la extracción ENTERA antes de pagar visión por figura.
    usa_store_default = put_asset is None
    if storage_ok is None:
        if usa_store_default:
            from app.recursos.asset_store import almacenamiento_disponible as storage_ok
        else:
            storage_ok = lambda: True  # noqa: E731 — store inyectado ⇒ disponible
    if not storage_ok():
        logger.warning(
            "almacenamiento de assets no disponible (bucket %s); se OMITE la "
            "extracción de %d figura(s) para no gastar visión sin poder guardar el resultado",
            "docyan-assets", len(figuras),
        )
        return []

    if complete_vision is None:
        from worker import llm_config

        complete_vision = llm_config.complete_vision
    if put_asset is None:
        from app.recursos.asset_store import put_asset as _put

        put_asset = _put

    drafts: list[DraftDiagrama] = []
    for i, fig in enumerate(figuras):
        try:
            b64 = base64.b64encode(fig.png_bytes).decode("ascii")
            raw = complete_vision(_PROMPT, b64)
        except Exception as exc:  # noqa: BLE001 — la extracción no tumba la ingesta
            logger.warning("visión falló en figura %d: %s", i, type(exc).__name__)
            continue

        data = parse_llm_json(raw)
        if not isinstance(data, dict):
            continue
        etiquetas_raw = data.get("etiquetas") or []
        if not etiquetas_raw:
            continue  # figura sin rótulos → no es un diagrama señalable

        # Almacena el asset servible (solo si hay etiquetas que valga la pena curar).
        try:
            url = put_asset(tenant_id, f"figura_{i}.png", fig.png_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.warning("no se pudo almacenar el asset de la figura %d: %s", i, type(exc).__name__)
            url = None

        etiquetas = [
            EtiquetaBorrador(
                texto=str(e.get("texto", "")),
                x=float(e.get("x") or 0.0),
                y=float(e.get("y") or 0.0),
                w=_opt_float(e.get("w")),
                h=_opt_float(e.get("h")),
            )
            for e in etiquetas_raw
            if isinstance(e, dict) and e.get("texto")
        ]
        leyenda = [
            LeyendaBorrador(simbolo=str(s.get("simbolo", "")), significado=str(s.get("significado", "")))
            for s in (data.get("leyenda_simbolica") or [])
            if isinstance(s, dict) and s.get("simbolo")
        ]
        if not etiquetas:
            continue
        drafts.append(
            DraftDiagrama(
                titulo=data.get("titulo") or fig.titulo or f"Diagrama {i + 1}",
                recurso_url=url,
                etiquetas=etiquetas,
                leyenda_simbolica=leyenda,
            )
        )
    return drafts


def _opt_float(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None
