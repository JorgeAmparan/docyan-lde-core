"""
Extracción de figuras del documento vía Docling (B9.5 §1.1 Tipo 3).

DOCYAN LDE™ by XCID — worker.

Docling expone las figuras/imágenes del documento (`DoclingDocument.pictures`).
Esta función las materializa como PNG en memoria + su caption (si existe), para que
el extractor de diagramas pida al LLM de visión las etiquetas y coordenadas.

Import perezoso de Docling (el stack pesado solo vive en el worker).
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger("docyan.worker.extraccion.figuras")


@dataclass
class FiguraExtraida:
    titulo: str
    png_bytes: bytes


def extraer_figuras(docling_document) -> list[FiguraExtraida]:
    """
    Devuelve las figuras del documento como PNG + caption. Best-effort: si una
    figura no expone imagen, se omite (no rompe). Requiere que la conversión Docling
    se haya hecho con `generate_picture_images=True`.
    """
    figuras: list[FiguraExtraida] = []
    pictures = getattr(docling_document, "pictures", None) or []
    for i, pic in enumerate(pictures):
        png = _png_de_figura(pic, docling_document)
        if png is None:
            continue
        caption = ""
        try:
            caption = pic.caption_text(docling_document) or ""
        except Exception:  # noqa: BLE001 — caption opcional
            caption = ""
        figuras.append(FiguraExtraida(titulo=caption or f"Figura {i + 1}", png_bytes=png))
    return figuras


def _png_de_figura(pic, doc) -> bytes | None:
    """Obtiene los bytes PNG de una figura Docling (PIL Image → PNG)."""
    try:
        img = pic.get_image(doc)  # PIL.Image | None
        if img is None:
            return None
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:  # noqa: BLE001 — figura sin imagen utilizable
        logger.debug("figura sin imagen utilizable: %s", type(exc).__name__)
        return None
