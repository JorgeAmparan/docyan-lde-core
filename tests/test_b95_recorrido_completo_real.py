"""
B9.5 — Recorrido COMPLETO contra FalkorDB real:
  documento → AUTO-EXTRACCIÓN → materializar al grafo → consulta (sin revisión manual).

El LLM/visión se mockea (sin claves); todo lo demás es real: el borrador que el
extractor produce se materializa al grafo y el pipeline de lectura (B8) lo sirve.
Probado de punta a punta: la auto-extracción cierra el recorrido sin curación manual.
"""
from __future__ import annotations

import json
import os

import pytest

from worker.extraction.materializar import materializar_arbol, materializar_diagrama
from app.pipelines import tipo3_graficos_diagramas, tipo5_troubleshooting
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader
from worker.extraction.diagram_extractor import extraer_diagramas
from worker.extraction.docling_figures import FiguraExtraida
from worker.extraction.tree_extractor import extraer_arbol_diagnostico

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "b95test_recorrido"


@pytest.fixture()
def client():
    from app.graph.dkg_client import DKGClient

    c = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
    try:
        ok = c.health()
    except Exception:  # noqa: BLE001
        ok = False
    if not ok:
        pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    c.drop_tenant_graph(TENANT)
    yield c
    c.drop_tenant_graph(TENANT)


def test_recorrido_t5_autoextrae_confirma_consulta(client):
    # 1) AUTO-EXTRACCIÓN del árbol desde el "documento" (LLM mockeado).
    llm_out = json.dumps({
        "titulo": "Centrífuga no arranca",
        "nodos": [
            {"id": "n1", "pregunta": "¿Enciende el panel?", "orden": 0,
             "opciones": [{"etiqueta": "Sí", "siguiente_nodo_id": "n2"},
                          {"etiqueta": "No", "siguiente_nodo_id": "n3"}]},
            {"id": "n2", "orden": 1, "causa_probable": "Interlock de tapa",
             "accion_resolutoria": "Cerrar la tapa"},
            {"id": "n3", "orden": 2, "causa_probable": "Sin energía",
             "accion_resolutoria": "Revisar breaker"},
        ],
    })
    draft = extraer_arbol_diagnostico("…manual de troubleshooting…", complete=lambda _p: llm_out)
    assert draft is not None  # el sistema PRODUJO la estructura automáticamente

    # 2) Materializar DIRECTO al grafo (sin revisión manual).
    materializar_arbol(client, TENANT, draft, doc_id="docA")

    # 4) CONSULTA: el pipeline T5 sirve el árbol navegable.
    pay = tipo5_troubleshooting.resolver(
        ContextoPipeline(tenant_id=TENANT, pregunta="no arranca", params={"termino": "arranca"}),
        DKGReader(client),
    ).payload
    assert pay.pregunta == "¿Enciende el panel?"
    assert {o.etiqueta for o in pay.opciones} == {"Sí", "No"}


def test_recorrido_t3_autoextrae_confirma_consulta_con_coordenadas(client):
    # 1) AUTO-EXTRACCIÓN del diagrama desde una figura (visión mockeada).
    vision_out = json.dumps({
        "titulo": "Rotor y cabezal",
        "etiquetas": [{"texto": "Tapa del rotor", "x": 0.33, "y": 0.26, "w": 0.10, "h": 0.06}],
        "leyenda_simbolica": [{"simbolo": "⚠", "significado": "Punto caliente"}],
    })
    figuras = [FiguraExtraida(titulo="Fig 1", png_bytes=b"\x89PNG-fake")]
    drafts = extraer_diagramas(
        TENANT, figuras,
        complete_vision=lambda _p, _img: vision_out,
        put_asset=lambda t, n, b: f"https://assets/{t}/{n}",
    )
    assert len(drafts) == 1

    # 2) Materializar DIRECTO al grafo.
    materializar_diagrama(client, TENANT, drafts[0], doc_id="docB")

    # 4) CONSULTA: el pipeline T3 sirve el diagrama con etiquetas y COORDENADAS {x,y,w,h}.
    pay = tipo3_graficos_diagramas.resolver(
        ContextoPipeline(tenant_id=TENANT, pregunta="rotor", params={"termino": "rotor"}),
        DKGReader(client),
    ).payload
    assert pay.recurso_url == f"https://assets/{TENANT}/figura_0.png"
    et = next(e for e in pay.etiquetas if e.texto == "Tapa del rotor")
    assert et.x == 0.33 and et.y == 0.26 and et.w == 0.10 and et.h == 0.06
