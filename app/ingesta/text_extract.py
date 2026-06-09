"""
Extracción ligera de texto para el COTIZADOR (B2 §7).

DOCYAN LDE™ by XCID.

El cotizador necesita el texto del documento para medir tokens (tiktoken) ANTES
de ingerir. Esa medición ocurre en el BACKEND (`docyan-lde-api`), que NO carga el
stack pesado (Docling/torch vive en el worker). Por eso aquí se usa un extractor
ligero: pdfminer.six para PDF (sin torch), decode directo para texto plano.

El parseo RICO y multi-formato (tablas complejas, OCR, docx/xlsx/imágenes) lo
hace Docling en el worker durante la ingesta real. La estimación del cotizador es
una cota previa: si el extractor ligero subestima el texto (PDF escaneado sin
capa de texto), el cotizador lo reporta como advertencia y el worker re-mide.
"""
from __future__ import annotations

import math
import pathlib

# Cota densa de caracteres por página para ESTIMAR páginas cuando no hay conteo
# físico (formatos no-PDF en el backend ligero). Es el mismo orden del conteo que
# ya deriva el cotizador del texto. El conteo físico exacto (PDF) tiene prioridad.
CHARS_POR_PAGINA = 3000


def extraer_texto(data: bytes, nombre_archivo: str) -> tuple[str, bool]:
    """
    Extrae texto para cotización. Devuelve (texto, confiable).

    `confiable=False` indica que el extractor ligero probablemente subestimó
    (p.ej. PDF escaneado sin capa de texto): el cotizador lo señala y la medición
    fina queda al worker con Docling+OCR.
    """
    ext = pathlib.Path(nombre_archivo).suffix.lower()

    if ext == ".pdf":
        return _extraer_pdf(data)
    if ext in {".txt", ".md", ".csv", ".json", ".xml"}:
        try:
            return data.decode("utf-8", errors="ignore"), True
        except Exception:
            return "", False
    # Otros formatos (docx/xlsx/pptx/imágenes): el parseo lo hace el worker.
    # Para cotización se intenta un decode best-effort; si no, se marca no confiable.
    texto = data.decode("utf-8", errors="ignore")
    confiable = len(texto.strip()) > 200
    return texto, confiable


def _extraer_pdf(data: bytes) -> tuple[str, bool]:
    import io

    try:
        from pdfminer.high_level import extract_text

        texto = extract_text(io.BytesIO(data)) or ""
    except Exception:
        return "", False
    # PDF sin capa de texto (escaneado): poco texto → no confiable, requiere OCR.
    confiable = len(texto.strip()) > 100
    return texto, confiable


def contar_paginas(data: bytes, nombre_archivo: str, texto: str | None = None) -> int:
    """
    Cuenta (o estima) las páginas del documento para el gate de tamaño freemium.

    PDF → conteo físico exacto (pdfminer, sin torch). Otros formatos → estimación
    por longitud de texto (~CHARS_POR_PAGINA por página); el parseo rico con Docling
    vive en el worker, pero esta cota previa basta para el tope de páginas freemium.
    Nunca devuelve < 1.
    """
    ext = pathlib.Path(nombre_archivo).suffix.lower()
    if ext == ".pdf":
        n = _contar_paginas_pdf(data)
        if n is not None:
            return max(1, n)
    if texto is None:
        texto, _ = extraer_texto(data, nombre_archivo)
    return max(1, math.ceil(len(texto) / CHARS_POR_PAGINA))


def _contar_paginas_pdf(data: bytes) -> int | None:
    import io

    try:
        from pdfminer.pdfpage import PDFPage

        return sum(1 for _ in PDFPage.get_pages(io.BytesIO(data)))
    except Exception:
        return None
