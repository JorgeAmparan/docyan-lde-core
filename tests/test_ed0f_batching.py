"""
Sprint ED-0f — batching de conversión por páginas para acotar el pico de memoria.

Regresión: LS-400 (88pp, 244 figuras) en UNA sola convert() con
`generate_picture_images=True` escalaba monótono a 9.7 GB (los rásters PIL no se
liberan por página) → OOM hasta en 16 GB. Fix: DOS pasadas —
  P1 markdown sin imágenes (idéntico al golden), P2 figuras por `page_range` en
  lotes, liberando entre lotes.

Estos tests NO requieren docling: ejercitan la lógica de lotes (pura) y el wiring
de `extraer_figuras_batched` con un DocumentConverter mockeado que registra los
`page_range` recibidos. El diff byte-idéntico contra el golden lo cubre el Paso 3
sobre el worker real.
"""
from __future__ import annotations

import importlib

pipeline = importlib.import_module("worker.ingest_pipeline")


# ── Lógica de lotes (pura) ────────────────────────────────────────────────────
def test_rangos_de_lote_particiona_inclusivo():
    assert pipeline._rangos_de_lote(10, 4) == [(1, 4), (5, 8), (9, 10)]
    assert pipeline._rangos_de_lote(8, 8) == [(1, 8)]
    assert pipeline._rangos_de_lote(88, 8) == [
        (1, 8), (9, 16), (17, 24), (25, 32), (33, 40), (41, 48),
        (49, 56), (57, 64), (65, 72), (73, 80), (81, 88),
    ]


def test_rangos_de_lote_bordes():
    assert pipeline._rangos_de_lote(1, 8) == [(1, 1)]      # 1 página
    assert pipeline._rangos_de_lote(0, 8) == [(1, 1)]      # degrada seguro
    assert pipeline._rangos_de_lote(9, 100) == [(1, 9)]    # lote > documento
    # batch<1 se satura a 1 (una convert por página)
    assert pipeline._rangos_de_lote(3, 0) == [(1, 1), (2, 2), (3, 3)]


# ── Wiring: extraer_figuras_batched invoca convert() UNA vez por lote, con page_range
def test_extraer_figuras_batched_llama_por_lote(monkeypatch):
    llamadas = []

    class _FakeDoc:
        pass

    class _FakeResult:
        document = _FakeDoc()

    class _FakeConverter:
        def convert(self, path, page_range=None):
            llamadas.append(page_range)
            return _FakeResult()

    # el converter se crea por lote (para poder liberar entre lotes)
    monkeypatch.setattr(pipeline, "_nuevo_converter", lambda *_a, **_k: _FakeConverter())
    # cada lote "extrae" 2 figuras (rótulo = su page_range para verificar cobertura)
    import worker.extraction.docling_figures as df
    monkeypatch.setattr(df, "extraer_figuras",
                        lambda _doc: ["figA", "figB"])
    monkeypatch.setattr(pipeline, "DOCLING_PAGE_BATCH", 8)
    # PDF por magic bytes (no toca disco real): forzamos _es_pdf=True
    monkeypatch.setattr(pipeline, "_es_pdf", lambda _p: True)

    figs = pipeline.extraer_figuras_batched("x.pdf", {"do_ocr": False}, total_paginas=20)

    # 20 páginas / 8 → 3 lotes con page_range 1-indexado inclusivo
    assert llamadas == [(1, 8), (9, 16), (17, 20)]
    # todas las figuras de todos los lotes se acumulan (3 lotes × 2 = 6)
    assert figs == ["figA", "figB", "figA", "figB", "figA", "figB"]


def test_extraer_figuras_batched_un_lote_fallido_no_tumba(monkeypatch):
    class _FakeConverter:
        def __init__(self, boom):
            self.boom = boom

        def convert(self, path, page_range=None):
            if self.boom:
                raise RuntimeError("lote reventó")
            class R:
                document = object()
            return R()

    estado = {"n": 0}

    def _mk(*_a, **_k):
        estado["n"] += 1
        return _FakeConverter(boom=(estado["n"] == 2))  # el 2º lote falla

    monkeypatch.setattr(pipeline, "_nuevo_converter", _mk)
    import worker.extraction.docling_figures as df
    monkeypatch.setattr(df, "extraer_figuras", lambda _doc: ["f"])
    monkeypatch.setattr(pipeline, "DOCLING_PAGE_BATCH", 8)
    monkeypatch.setattr(pipeline, "_es_pdf", lambda _p: True)

    figs = pipeline.extraer_figuras_batched("x.pdf", {"do_ocr": False}, total_paginas=24)
    # 3 lotes; el 2º falla → se conservan las figuras de los otros 2 (best-effort)
    assert figs == ["f", "f"]


def test_extraer_figuras_batched_no_pdf_una_sola_pasada(monkeypatch):
    llamadas = []

    class _FakeConverter:
        def convert(self, path, page_range=None):
            llamadas.append(page_range)
            class R:
                document = object()
            return R()

    monkeypatch.setattr(pipeline, "_nuevo_converter", lambda *_a, **_k: _FakeConverter())
    import worker.extraction.docling_figures as df
    monkeypatch.setattr(df, "extraer_figuras", lambda _doc: ["f"])
    monkeypatch.setattr(pipeline, "_es_pdf", lambda _p: False)  # docx/xlsx

    figs = pipeline.extraer_figuras_batched("x.docx", {"do_ocr": False}, total_paginas=None)
    # no-PDF → UNA convert() sin page_range (el driver de rásters masivos es de PDF)
    assert llamadas == [None]
    assert figs == ["f"]
