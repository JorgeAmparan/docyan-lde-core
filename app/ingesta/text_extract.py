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


def contar_figuras(data: bytes, nombre_archivo: str) -> int:
    """
    Estima cuántas FIGURAS (imágenes) trae el documento, para que el cotizador sume el
    costo de VISIÓN al gate ANTES de ingerir (Pieza 3).

    Como con el texto, es una cota previa LIGERA (sin Docling, que vive en el worker):
    PDF → cuenta los XObjects de subtipo /Image en los recursos de cada página
    (pdfminer, sin torch); otros formatos → 0 (el worker mide las figuras reales con
    Docling y aplica el MISMO tope al extraer). Nunca lanza: ante cualquier duda → 0
    (no se cotiza visión que no se pudo contar; el tope del worker acota el gasto real).
    """
    ext = pathlib.Path(nombre_archivo).suffix.lower()
    if ext != ".pdf":
        return 0
    return _contar_figuras_pdf(data)


def _contar_figuras_pdf(data: bytes) -> int:
    import io

    try:
        from pdfminer.pdfpage import PDFPage
        from pdfminer.pdftypes import resolve1
        from pdfminer.psparser import PSLiteral
    except Exception:
        return 0

    def _name(v: object) -> str:
        if isinstance(v, PSLiteral):
            n = v.name
            return n.decode("latin-1") if isinstance(n, bytes) else str(n)
        return str(v).lstrip("/")

    total = 0
    try:
        for page in PDFPage.get_pages(io.BytesIO(data)):
            res = resolve1(page.resources) or {}
            xobjects = resolve1(res.get("XObject")) or {}
            if not hasattr(xobjects, "items"):
                continue
            for _k, ref in xobjects.items():
                try:
                    obj = resolve1(ref)
                    subtype = _name((obj or {}).get("Subtype"))
                    if subtype == "Image":
                        total += 1
                except Exception:  # noqa: BLE001 — un XObject ilegible no rompe el conteo
                    continue
    except Exception:  # noqa: BLE001 — PDF mal formado → estimación 0 (worker re-mide)
        return 0
    return total
