"""
Corto-circuito de costo (decisión Jorge 15-jun-2026): si el almacén de assets NO
está disponible, NO se llama a la visión de Gemini por figura — no se paga un
resultado que no se puede guardar (bucket `docyan-assets` ausente = StorageApiError).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.
"""
from __future__ import annotations

from worker.extraction.diagram_extractor import extraer_diagramas
from worker.extraction.docling_figures import FiguraExtraida

_SALIDA = '{"titulo":"X","etiquetas":[{"texto":"Tapa","x":0.3,"y":0.2}],"leyenda_simbolica":[]}'


def _figuras(n: int) -> list[FiguraExtraida]:
    return [FiguraExtraida(titulo=f"F{i}", png_bytes=b"PNG" + bytes([i % 256])) for i in range(n)]


def test_almacen_caido_no_llama_vision_ni_una_vez():
    calls = {"n": 0}

    def vision(_prompt, _img):  # debe NO invocarse
        calls["n"] += 1
        return _SALIDA

    drafts, _fid = extraer_diagramas(
        "t", _figuras(30),
        complete_vision=vision,
        put_asset=lambda *_: "u",
        storage_ok=lambda: False,  # bucket no disponible
    )
    assert drafts == []          # se omite la extracción entera
    assert calls["n"] == 0       # CERO llamadas a Gemini visión (no se paga lo intirable)


def test_almacen_ok_si_procesa():
    calls = {"n": 0}

    def vision(_prompt, _img):
        calls["n"] += 1
        return _SALIDA

    drafts, _fid = extraer_diagramas(
        "t", _figuras(3),
        complete_vision=vision,
        put_asset=lambda *_: "https://assets/x.png",
        storage_ok=lambda: True,
    )
    assert calls["n"] == 3       # con almacén disponible sí se extrae
    assert len(drafts) == 3


def test_put_asset_inyectado_no_exige_storage_ok():
    # Compat: los tests/llamadores que inyectan put_asset (store propio) NO se
    # cortocircuitan aunque no pasen storage_ok (el store inyectado = disponible).
    drafts, _fid = extraer_diagramas(
        "t", _figuras(1),
        complete_vision=lambda _p, _i: _SALIDA,
        put_asset=lambda *_: "u",
    )
    assert len(drafts) == 1
