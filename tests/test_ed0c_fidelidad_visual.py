"""
Sprint ED-0c — sin tope de figuras + porta TODA figura + fidelidad visual (QA).

El tope `MAX_FIGURAS_POR_DOCUMENTO=30` descartaba dibujos en silencio (un manual de
88 pág con 85 figuras perdía 55) y las figuras SIN callouts se perdían por completo
(ni se guardaban como imagen). ED-0c: sin tope por default, se porta la imagen de
CADA figura (renderable), la visión solo enriquece con callouts, y se reporta la
fidelidad detectadas-vs-portadas para que la degradación NO sea silenciosa.
"""
from __future__ import annotations

import importlib
import json

from worker.extraction.diagram_extractor import extraer_diagramas
from worker.extraction.docling_figures import FiguraExtraida

_CON_CALLOUTS = json.dumps({
    "titulo": "Rotor", "etiquetas": [{"texto": "Tapa", "x": 0.3, "y": 0.2, "w": 0.1, "h": 0.05}],
    "leyenda_simbolica": [],
})
_SIN_CALLOUTS = json.dumps({"titulo": "", "etiquetas": [], "leyenda_simbolica": []})


def _figs(n: int) -> list[FiguraExtraida]:
    return [FiguraExtraida(titulo=f"F{i}", png_bytes=b"PNG" + bytes([i % 256])) for i in range(n)]


# ── Sin tope por default ──────────────────────────────────────────────────────


def test_figuras_a_procesar_sin_tope_por_default(monkeypatch):
    monkeypatch.delenv("MAX_FIGURAS_POR_DOCUMENTO", raising=False)
    import app.ingesta.pricing_table as pt
    pt = importlib.reload(pt)
    assert pt.MAX_FIGURAS_POR_DOCUMENTO == 0          # 0 = sin tope
    assert pt.figuras_a_procesar(85) == 85            # se procesan TODAS
    assert pt.figuras_a_procesar(500) == 500


def test_tope_de_emergencia_configurable_por_env(monkeypatch):
    monkeypatch.setenv("MAX_FIGURAS_POR_DOCUMENTO", "5")
    import app.ingesta.pricing_table as pt
    pt = importlib.reload(pt)
    assert pt.figuras_a_procesar(85) == 5             # tope de emergencia respetado
    # limpieza: recargar sin el env para no contaminar otros tests
    monkeypatch.delenv("MAX_FIGURAS_POR_DOCUMENTO", raising=False)
    importlib.reload(pt)


def test_porta_todas_las_figuras_sin_tope(monkeypatch):
    monkeypatch.delenv("MAX_FIGURAS_POR_DOCUMENTO", raising=False)
    import app.ingesta.pricing_table as pt
    importlib.reload(pt)
    drafts, fid = extraer_diagramas(
        "t", _figs(85),
        complete_vision=lambda _p, _i: _SIN_CALLOUTS,   # ninguna con callouts
        put_asset=lambda *_: "https://assets/x.png",
    )
    assert len(drafts) == 85                            # ¡las 85 portadas!
    assert fid["portadas"] == 85
    assert fid["omitidas_por_tope"] == 0
    assert fid["con_callouts"] == 0


# ── Porta la imagen aunque falte callout / falle la visión ───────────────────


def test_vision_falla_pero_la_imagen_se_porta():
    def vision_boom(_p, _i):
        raise RuntimeError("timeout de visión")

    drafts, fid = extraer_diagramas(
        "t", _figs(2), complete_vision=vision_boom, put_asset=lambda *_: "u",
    )
    assert len(drafts) == 2                    # el dibujo se conserva pese al fallo de visión
    assert all(d.recurso_url == "u" and d.etiquetas == [] for d in drafts)
    assert fid["portadas"] == 2 and fid["vision_fallo"] == 2


def test_mezcla_con_y_sin_callouts_cuenta_fidelidad():
    salidas = iter([_CON_CALLOUTS, _SIN_CALLOUTS, _CON_CALLOUTS])
    drafts, fid = extraer_diagramas(
        "t", _figs(3),
        complete_vision=lambda _p, _i: next(salidas),
        put_asset=lambda *_: "u",
    )
    assert fid["portadas"] == 3                # todas renderables
    assert fid["con_callouts"] == 2            # solo 2 traían rótulos


# ── Store caído: no se porta (no se puede servir) y se reporta ───────────────


def test_store_falla_por_figura_cuenta_store_fallo():
    def put_boom(*_):
        raise RuntimeError("StorageApiError")

    drafts, fid = extraer_diagramas(
        "t", _figs(3), complete_vision=lambda _p, _i: _CON_CALLOUTS, put_asset=put_boom,
    )
    assert drafts == []                        # sin url no se puede renderizar
    assert fid["store_fallo"] == 3 and fid["portadas"] == 0


def test_almacen_no_disponible_no_porta_nada():
    called = {"vision": 0}
    drafts, fid = extraer_diagramas(
        "t", _figs(10),
        complete_vision=lambda _p, _i: called.__setitem__("vision", called["vision"] + 1) or _CON_CALLOUTS,
        put_asset=lambda *_: "u",
        storage_ok=lambda: False,              # bucket ausente
    )
    assert drafts == []
    assert fid["store_fallo"] == 10
    assert called["vision"] == 0               # no se paga visión sin poder guardar


# ── §5bis — deduplicación por hash de imagen ─────────────────────────────────


def test_dedup_mismo_binario_N_paginas_una_sola_vez():
    # El MISMO PNG (membrete/logo) en N "páginas": 1 almacenamiento, 1 visión, N refs.
    N = 6
    figuras = [FiguraExtraida(titulo="membrete", png_bytes=b"LOGO-BYTES-IDENTICOS") for _ in range(N)]
    stores = {"n": 0}
    visiones = {"n": 0}

    def put_asset(_t, _n, _b):
        stores["n"] += 1
        return "https://assets/logo.png"

    def vision(_p, _i):
        visiones["n"] += 1
        return _CON_CALLOUTS

    drafts, fid = extraer_diagramas("t", figuras, complete_vision=vision, put_asset=put_asset)

    assert len(drafts) == N                     # N referencias (aparece en N posiciones)
    assert stores["n"] == 1                     # 1 solo almacenamiento
    assert visiones["n"] == 1                   # 1 sola llamada de visión
    assert fid["figuras_deduplicadas"] == N - 1
    assert fid["portadas"] == N
    # Todas apuntan al MISMO recurso (misma url + mismo hash).
    assert len({d.recurso_url for d in drafts}) == 1
    assert len({d.hash_imagen for d in drafts}) == 1
    assert all(d.hash_imagen for d in drafts)


def test_dedup_cross_documento_via_hashes_previos():
    # Una figura cuyo hash ya existe en el tenant (otra ingesta) NO se re-almacena.
    from worker.extraction.models import DraftDiagrama

    fig = FiguraExtraida(titulo="x", png_bytes=b"YA-VISTO")
    import hashlib
    h = hashlib.sha256(b"YA-VISTO").hexdigest()
    previos = {h: DraftDiagrama(titulo="prev", recurso_url="https://assets/prev.png", hash_imagen=h)}
    stores = {"n": 0}
    visiones = {"n": 0}

    drafts, fid = extraer_diagramas(
        "t", [fig],
        complete_vision=lambda _p, _i: visiones.__setitem__("n", visiones["n"] + 1) or _CON_CALLOUTS,
        put_asset=lambda *_: stores.__setitem__("n", stores["n"] + 1) or "u",
        hashes_previos=previos,
    )
    assert stores["n"] == 0 and visiones["n"] == 0     # ni store ni visión (ya existía)
    assert fid["figuras_deduplicadas"] == 1
    assert drafts[0].recurso_url == "https://assets/prev.png"


# ── El cotizador cotiza TODAS las figuras (sin tope) ─────────────────────────


def test_cotizador_cotiza_todas_las_figuras_sin_tope(monkeypatch):
    monkeypatch.delenv("MAX_FIGURAS_POR_DOCUMENTO", raising=False)
    import app.ingesta.pricing_table as pt
    importlib.reload(pt)
    from app.ingesta.cotizador import Cotizador, estimar_costo

    cot = Cotizador().cotizar(tenant_id="t", texto_documento="texto de prueba", num_figuras=85)
    # El costo debe reflejar la visión de las 85 figuras (no de 30).
    esperado, _ = estimar_costo(cot.tokens_documento, 85)
    assert abs(cot.costo_estimado_usd - esperado.total_usd) < 1e-6
