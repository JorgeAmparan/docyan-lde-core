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


# ── regresión LS-400: páginas de diagrama con texto ESCASO pero nativo ────────
def test_paginas_escasas_pero_nativas_no_disparan_ocr():
    # LS-400: 19/88 pp con <100 chars pero MÍN 59 → TODAS traen capa de texto (son
    # láminas con pie de figura, no escaneos). Con el umbral default (16) ninguna
    # dispara OCR ⇒ do_ocr=False ⇒ sin OCR ⇒ sin OOM. (Umbral 100 las marcaba mal.)
    textos = ["Figura 12. Conjunto de bomba " + "x" * (59 - 30) for _ in range(19)]
    textos += ["Sección con texto nativo abundante " * 10 for _ in range(69)]
    g = pipeline._clasificar_paginas(textos)
    assert g["paginas_totales"] == 88
    assert g["paginas_ocr"] == 0, "una lámina con pie de figura NO es página a OCR"
    assert g["do_ocr"] is False


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


# ════════════════════════════════════════════════════════════════════════════
# DEMO-READY (jul 2026) — refuerzo del gate: "¿hay CONTENIDO?", no solo "¿capa?"
#
# Diagnóstico: el manual LS-400 (88pp) trae ~115 chars/pág que son SOLO encabezados
# corridos ("BOMBA LS-400 / MANTENIMIENTO / PAG 36 / MANUAL DE OPERACIÓN"). El gate
# por-página (≥16 chars) lo contó texto-nativo → do_ocr=False → el cuerpo real (en las
# 244 figuras) nunca se extrajo → retrieval VACÍO en prod. Fix: densidad de CONTENIDO
# (descontando boilerplate corto repetido) + override explícito OCR_FORCE.
# ════════════════════════════════════════════════════════════════════════════


def test_densidad_descuenta_boilerplate_header_only():
    """Un doc header-only (mismos encabezados corridos por página, sin cuerpo) da
    densidad de contenido ~0 aunque cada página pase el gate por-página (≥16)."""
    headers = [
        "BOMBA LS-400 / 500N --- MANTENIMIENTO (BOMBA)\n"
        f"PAG {i} ---- BOMBA LS-400 / 500N --- MANUAL DE OPERACIÓN"
        for i in range(1, 89)
    ]
    # cada página SÍ pasa el gate por-página (headers > 16 chars)
    assert pipeline._clasificar_paginas(headers)["do_ocr"] is False
    # pero la densidad de contenido es baja: casi todo es boilerplate repetido
    dens = pipeline._contenido_por_pagina(headers)
    assert dens < 120, f"header-only debería dar densidad baja, dio {dens}"


def test_densidad_no_descuenta_cuerpo_real():
    """Un doc con cuerpo real (líneas largas o variadas) NO cae como header-only,
    aunque comparta un encabezado corrido — protege el baseline ED-0e."""
    header = "BOMBA LS-400 / 500N --- MANUAL DE OPERACIÓN --- PAG 1"
    paginas = [
        header.replace("PAG 1", f"PAG {i}") + "\n"
        + f"Sección {i}: procedimiento detallado con instrucciones específicas de "
        "operación segura, valores de par de apriete, secuencia de arranque y "
        "parámetros de presión hidráulica del sistema para esta página en concreto."
        for i in range(1, 20)
    ]
    dens = pipeline._contenido_por_pagina(paginas)
    assert dens > 120, f"cuerpo real no debe caer como header-only, dio {dens}"


def test_ocr_force_fuerza_do_ocr(monkeypatch):
    """OCR_FORCE=1 fuerza do_ocr=True aunque el gate diga que hay texto nativo
    (palanca del pase de reingesta del LS-400)."""
    monkeypatch.setattr(pipeline, "OCR_FORCE", True)
    g = pipeline._aplicar_overrides_ocr(
        {"do_ocr": False, "paginas_totales": 88, "contenido_por_pagina": 59.0}
    )
    assert g["do_ocr"] is True
    assert g["motivo_ocr"] == "forzado"


def test_densidad_baja_dispara_ocr_cuando_se_activa(monkeypatch):
    """Con OCR_MIN_CONTENIDO_POR_PAGINA activo, densidad baja (LS-400=59) → OCR;
    densidad de texto real (maxi_op=210) → NO OCR."""
    monkeypatch.setattr(pipeline, "OCR_FORCE", False)
    monkeypatch.setattr(pipeline, "OCR_MIN_CONTENIDO_POR_PAGINA", 120)
    header_only = pipeline._aplicar_overrides_ocr(
        {"do_ocr": False, "paginas_totales": 88, "contenido_por_pagina": 59.0}
    )
    assert header_only["do_ocr"] is True and header_only["motivo_ocr"] == "baja_densidad"
    texto_real = pipeline._aplicar_overrides_ocr(
        {"do_ocr": False, "paginas_totales": 12, "contenido_por_pagina": 210.0}
    )
    assert texto_real["do_ocr"] is False and texto_real["motivo_ocr"] == "texto_nativo"


def test_densidad_default_off_preserva_baseline(monkeypatch):
    """Default (OCR_FORCE off, densidad_min=0): la decisión es idéntica a ED-0e —
    un doc header-only con capa de texto sigue dando do_ocr=False. Cero regresión."""
    monkeypatch.setattr(pipeline, "OCR_FORCE", False)
    monkeypatch.setattr(pipeline, "OCR_MIN_CONTENIDO_POR_PAGINA", 0)
    g = pipeline._aplicar_overrides_ocr(
        {"do_ocr": False, "paginas_totales": 88, "contenido_por_pagina": 59.0}
    )
    assert g["do_ocr"] is False and g["motivo_ocr"] == "texto_nativo"


def test_analizar_ls400_real_es_header_only():
    """El PDF REAL del LS-400 (si está presente) debe medir densidad de header-only.
    Es la evidencia dura del diagnóstico DEMO-READY (retrieval VACÍO en prod)."""
    import os

    pytest.importorskip("pypdf")
    ruta = "docs/demo/ls400_operacion.pdf"
    if not os.path.exists(ruta):
        pytest.skip("PDF del LS-400 no presente en el entorno")
    g = pipeline.analizar_ocr_paginas(ruta)
    assert g["paginas_totales"] == 88
    assert g["paginas_texto_nativo"] == 88  # pasa el gate por-página (headers ≥16)
    assert g["contenido_por_pagina"] is not None and g["contenido_por_pagina"] < 120, (
        f"LS-400 debería medir header-only, midió {g['contenido_por_pagina']}"
    )
