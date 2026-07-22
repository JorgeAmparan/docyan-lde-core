"""
Sprint ED-0f — acota el pico de memoria de la conversión Docling SIN cambiar el output.

LS-400 (88pp, 244 figuras) escalaba a 9.7 GB en convert() → OOM hasta en 16 GB.
Medición en prod: NO eran los rásters de figura (con generate_picture_images=False
el pico apenas bajó, 9.63 vs 9.70 GB; los crops pesan ~70 MB). El driver real es la
COLA de páginas de Docling (`queue_max_size`, default 100): un doc de 88pp entra
completo y sus rásters de página se acumulan. Fix: bajar `queue_max_size` →
backpressure, ~N páginas en vuelo, con OUTPUT BYTE-IDÉNTICO (profundidad de pipeline,
no contenido). UNA sola convert(), sin page_range, sin bordes de lote.

Estos tests NO requieren docling: verifican el env-wiring de `DOCLING_QUEUE_MAX_SIZE`
y que `_pdf_pipeline_options` FIJA `queue_max_size` en las opciones (con un docling
falso inyectado). El pico <4 GB y el diff byte-idéntico se validan en el worker real.
"""
from __future__ import annotations

import importlib
import sys
import types

pipeline = importlib.import_module("worker.ingest_pipeline")


def test_queue_max_size_default_acotado_y_por_env(monkeypatch):
    # default acotado (≠ 100 de Docling): un valor pequeño = pocas páginas en vuelo.
    assert pipeline.DOCLING_QUEUE_MAX_SIZE <= 16
    # configurable por env (se re-evalúa al recargar el módulo).
    monkeypatch.setenv("DOCLING_QUEUE_MAX_SIZE", "6")
    importlib.reload(pipeline)
    assert pipeline.DOCLING_QUEUE_MAX_SIZE == 6
    monkeypatch.delenv("DOCLING_QUEUE_MAX_SIZE", raising=False)
    importlib.reload(pipeline)  # restaura el default para el resto de la suite


def _inyectar_docling_falso(monkeypatch):
    """Inyecta un docling mínimo en sys.modules para probar `_pdf_pipeline_options`
    sin el stack real (worker-only)."""
    class _Opts:
        pass

    class _Tess:
        def __init__(self, lang=None):
            self.lang = lang

    mod = types.ModuleType("docling.datamodel.pipeline_options")
    mod.PdfPipelineOptions = _Opts
    mod.TesseractCliOcrOptions = _Tess
    # los paquetes padre deben existir para resolver el import
    for name in ("docling", "docling.datamodel"):
        monkeypatch.setitem(sys.modules, name, types.ModuleType(name))
    monkeypatch.setitem(sys.modules, "docling.datamodel.pipeline_options", mod)


def test_pdf_options_fija_queue_max_size_e_imagenes(monkeypatch):
    _inyectar_docling_falso(monkeypatch)
    monkeypatch.setattr(pipeline, "DOCLING_QUEUE_MAX_SIZE", 3)

    opts = pipeline._pdf_pipeline_options({"do_ocr": False})

    # el acote de memoria: queue_max_size llega a las opciones (una sola pasada)
    assert opts.queue_max_size == 3
    # figuras con raster en la MISMA pasada (T3), sin degradar
    assert opts.generate_picture_images is True
    assert opts.do_table_structure is True
    # gate de OCR (ED-0e) respetado
    assert opts.do_ocr is False


def test_pdf_options_respeta_do_ocr_true(monkeypatch):
    _inyectar_docling_falso(monkeypatch)
    opts = pipeline._pdf_pipeline_options({"do_ocr": True})
    assert opts.do_ocr is True
    assert opts.queue_max_size == pipeline.DOCLING_QUEUE_MAX_SIZE
