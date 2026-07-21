"""
Sprint ED-0e — Gate de OCR POR PÁGINA en el worker de ingesta.

Regresión: correr Tesseract OCR de página completa en 4 idiomas (fra+deu+spa+eng)
sobre un PDF que YA trae capa de texto nativa reventó los 4 GB del worker (OOM) al
ingerir el manual LS-400 (88 pp de texto nativo + 85 imágenes). Fix: OCR SOLO en
páginas sin texto extraíble suficiente (gate por página, cubre docs mixtos) y en
idiomas acotados (default spa+eng).

Contrato Jorge (decisión cerrada):
  1. Gate POR PÁGINA (umbral de caracteres configurable por env).
  2. Idiomas de OCR configurables por env (default spa+eng).
  3. Extracción de figuras/callouts NO se toca (corre por visión, aparte).
  4. Contadores de QA: paginas_totales, paginas_ocr, paginas_texto_nativo.
  5. Test: PDF con texto nativo → 0 páginas OCR; PDF sin capa de texto → OCR corre.

Estos tests NO requieren docling ni FalkorDB: ejercitan el clasificador puro y el
escáner pypdf (disponible en el entorno liviano). El wiring de `convertir()` con
docling lo cubre la ingesta real (requires_ingestion) — aquí se valida la DECISIÓN.
"""
from __future__ import annotations

import importlib

import pytest

pipeline = importlib.import_module("worker.ingest_pipeline")


# ── §5 — PDF con texto nativo → 0 páginas OCR ────────────────────────────────
def test_texto_nativo_cero_paginas_ocr():
    textos = ["Modelo LS-400N Manual de Operación " * 20 for _ in range(88)]
    g = pipeline._clasificar_paginas(textos)
    assert g["paginas_totales"] == 88
    assert g["paginas_texto_nativo"] == 88
    assert g["paginas_ocr"] == 0
    assert g["do_ocr"] is False  # NINGUNA página lo necesita ⇒ OCR OFF (no OOM)


# ── §5 — PDF sin capa de texto → OCR corre ───────────────────────────────────
def test_sin_texto_ocr_corre():
    textos = ["", "", "", ""]  # escaneado: 0 texto extraíble
    g = pipeline._clasificar_paginas(textos)
    assert g["paginas_totales"] == 4
    assert g["paginas_texto_nativo"] == 0
    assert g["paginas_ocr"] == 4
    assert g["do_ocr"] is True  # todas sin texto ⇒ OCR corre


# ── §1 — gate POR PÁGINA: doc MIXTO (texto nativo + anexos escaneados) ────────
def test_mixto_cuenta_por_pagina():
    textos = [
        "Sección con mucho texto nativo legible " * 10,  # nativa
        "",                                              # escaneada → OCR
        "Otra página con su capa de texto propia " * 10,  # nativa
        "   ",                                           # en blanco → OCR
    ]
    g = pipeline._clasificar_paginas(textos)
    assert g["paginas_totales"] == 4
    assert g["paginas_texto_nativo"] == 2
    assert g["paginas_ocr"] == 2
    assert g["do_ocr"] is True  # alguna página lo necesita ⇒ OCR corre (para esas)


# ── §1 — el umbral de caracteres es el que decide "suficiente" ────────────────
def test_umbral_marca_pagina_escasa_como_ocr(monkeypatch):
    monkeypatch.setattr(pipeline, "OCR_MIN_CHARS_POR_PAGINA", 100)
    textos = ["hola", "x" * 250]  # 4 chars < 100 (OCR); 250 ≥ 100 (nativa)
    g = pipeline._clasificar_paginas(textos)
    assert g["paginas_texto_nativo"] == 1
    assert g["paginas_ocr"] == 1
    assert g["do_ocr"] is True


# ── §2 — idiomas de OCR configurables por env ────────────────────────────────
def test_idiomas_ocr_desde_env(monkeypatch):
    monkeypatch.setattr(pipeline, "OCR_LANGS", "spa+eng")
    assert pipeline._ocr_langs_list() == ["spa", "eng"]
    monkeypatch.setattr(pipeline, "OCR_LANGS", "spa, eng, fra")
    assert pipeline._ocr_langs_list() == ["spa", "eng", "fra"]
    # default acotado (no fra+deu+spa+eng): parte del gasto que se elimina.
    monkeypatch.setattr(pipeline, "OCR_LANGS", "spa")
    assert pipeline._ocr_langs_list() == ["spa"]


# ── regresión prod: el temporal del worker es `.bin`, no `.pdf` ───────────────
def test_es_pdf_por_magic_bytes_no_por_extension(tmp_path):
    # El worker descarga a un temporal con sufijo del nombre_archivo del job, que
    # a veces NO trae .pdf ("Manual … LS-400" → .bin). Debe detectarse por contenido.
    binpdf = tmp_path / "descarga.bin"
    binpdf.write_bytes(b"%PDF-1.7\n1 0 obj<<>>endobj\n")
    assert pipeline._es_pdf(str(binpdf)) is True  # .bin PERO contenido PDF ⇒ SÍ

    nopdf = tmp_path / "otro.bin"
    nopdf.write_bytes(b"PK\x03\x04 esto es un zip/docx")
    assert pipeline._es_pdf(str(nopdf)) is False  # .bin no-PDF ⇒ NO

    assert pipeline._es_pdf("/no/existe/doc.pdf") is True  # .pdf por extensión (barato)


# ── no-PDF / escaneo imposible → aplica=False, OCR por default (seguro) ───────
def test_no_pdf_deja_ocr_por_default():
    g = pipeline.analizar_ocr_paginas("/tmp/algo.docx")
    assert g["aplica"] is False
    assert g["paginas_totales"] is None
    assert g["do_ocr"] is True  # sin duda no se suprime OCR


def test_pdf_ilegible_no_tumba_el_gate(monkeypatch):
    pypdf = pytest.importorskip("pypdf")  # pypdf vive en el worker, no en el backend CI

    def _boom(*_a, **_k):
        raise ValueError("PDF corrupto")

    monkeypatch.setattr(pypdf, "PdfReader", _boom)
    g = pipeline.analizar_ocr_paginas("/tmp/roto.pdf")
    assert g["aplica"] is False and g["do_ocr"] is True  # degrada seguro, no rompe


# ── §5 (escáner real pypdf): PDF con capa de texto → 0 OCR ────────────────────
def test_analizar_pdf_con_texto_nativo_via_pypdf(monkeypatch):
    pypdf = pytest.importorskip("pypdf")  # pypdf vive en el worker, no en el backend CI

    class _Pg:
        def __init__(self, t):
            self._t = t

        def extract_text(self):
            return self._t

    class _Reader:
        def __init__(self, _path):
            self.pages = [_Pg("Texto nativo suficiente " * 20) for _ in range(3)]

    monkeypatch.setattr(pypdf, "PdfReader", _Reader)
    g = pipeline.analizar_ocr_paginas("/tmp/nativo.pdf")
    assert g["aplica"] is True
    assert g["paginas_totales"] == 3
    assert g["paginas_ocr"] == 0
    assert g["do_ocr"] is False


def test_analizar_pdf_escaneado_via_pypdf(monkeypatch):
    pypdf = pytest.importorskip("pypdf")  # pypdf vive en el worker, no en el backend CI

    class _Pg:
        def extract_text(self):
            return ""  # sin capa de texto

    class _Reader:
        def __init__(self, _path):
            self.pages = [_Pg() for _ in range(5)]

    monkeypatch.setattr(pypdf, "PdfReader", _Reader)
    g = pipeline.analizar_ocr_paginas("/tmp/escaneado.pdf")
    assert g["paginas_ocr"] == 5
    assert g["do_ocr"] is True


# ── §4 — la señal de QA lleva los tres contadores que Jorge pidió ─────────────
def test_contadores_qa_presentes():
    g = pipeline._clasificar_paginas(["texto " * 30, ""])
    for k in ("paginas_totales", "paginas_ocr", "paginas_texto_nativo"):
        assert k in g, f"falta el contador de QA {k}"
