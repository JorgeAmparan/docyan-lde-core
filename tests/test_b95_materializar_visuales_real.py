"""
B9.5 — Materialización de auto-extracción (T3/T5) + video (T4) contra FalkorDB REAL.

Verifica que la estructura auto-extraída, al materializarse al grafo, hace que los
pipelines de lectura (B8, sin tocar) devuelvan el payload POBLADO. Para video
(decisión B): adjuntar un recurso y que el Tipo 4 lo sirva. (Sin editor de curación
manual — se retiró del alcance de B9.5.)
"""
from __future__ import annotations

import os

import pytest

from app.pipelines import tipo3_graficos_diagramas, tipo4_video, tipo5_troubleshooting
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader
from app.recursos.video import adjuntar_video
from worker.extraction.materializar import materializar_arbol, materializar_diagrama
from worker.extraction.models import (
    DraftArbol,
    DraftDiagrama,
    EtiquetaBorrador,
    LeyendaBorrador,
    NodoBorrador,
    OpcionBorrador,
)

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "b95test_materializar"


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


def test_materializar_diagrama_tipo3(client):
    draft = DraftDiagrama(
        titulo="Rotor y cabezal",
        recurso_url="https://assets.docyan/rotor.png",
        etiquetas=[
            EtiquetaBorrador(texto="Tapa del rotor", x=0.33, y=0.26, w=0.1, h=0.06),
            EtiquetaBorrador(texto="Acople motor-eje", x=0.44, y=0.72),
        ],
        leyenda_simbolica=[LeyendaBorrador(simbolo="⚠", significado="Punto caliente")],
    )
    materializar_diagrama(client, TENANT, draft)

    reader = DKGReader(client)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="diagrama del rotor",
                           params={"termino": "rotor"})
    pay = tipo3_graficos_diagramas.resolver(ctx, reader).payload
    assert pay.recurso_url == "https://assets.docyan/rotor.png"
    assert len(pay.etiquetas) == 2
    tapa = next(e for e in pay.etiquetas if e.texto == "Tapa del rotor")
    assert tapa.w == 0.1 and tapa.h == 0.06
    assert len(pay.leyenda_simbolica) == 1


def test_materializar_arbol_tipo5(client):
    draft = DraftArbol(
        titulo="La centrífuga no arranca",
        nodos=[
            NodoBorrador(id="n1", pregunta="¿Enciende el panel?", orden=0,
                         opciones=[OpcionBorrador(etiqueta="Sí", siguiente_nodo_id="n2"),
                                   OpcionBorrador(etiqueta="No", siguiente_nodo_id="n3")]),
            NodoBorrador(id="n2", pregunta="¿La tapa cierra?", orden=1,
                         opciones=[OpcionBorrador(etiqueta="No", siguiente_nodo_id="n4")]),
            NodoBorrador(id="n3", orden=2, causa_probable="Sin alimentación eléctrica",
                         accion_resolutoria="Verificar conexión y breaker"),
            NodoBorrador(id="n4", orden=3, causa_probable="Interlock de tapa abierto",
                         accion_resolutoria="Cerrar y asegurar la tapa"),
        ],
    )
    assert draft.validar_conectividad() == [], "el árbol de test debe estar bien conectado"
    materializar_arbol(client, TENANT, draft)

    reader = DKGReader(client)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="no arranca",
                           params={"termino": "arranca"})
    pay = tipo5_troubleshooting.resolver(ctx, reader).payload
    assert pay.nodo_actual_id == "n1"
    assert pay.pregunta == "¿Enciende el panel?"
    etiquetas = {o.etiqueta for o in pay.opciones}
    assert {"Sí", "No"} <= etiquetas, f"opciones esperadas, got {etiquetas}"


def test_video_tipo4(client):
    adjuntar_video(
        client, TENANT,
        titulo="Cambio de filtro — demostración",
        video_url="https://assets.docyan/filtro.mp4",
        capitulos=[{"titulo": "Despresurizar", "inicio_seg": 0},
                   {"titulo": "Sustituir cartucho", "inicio_seg": 45}],
    )
    reader = DKGReader(client)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="video del filtro",
                           params={"termino": "filtro"})
    pay = tipo4_video.resolver(ctx, reader).payload
    assert pay.video_url == "https://assets.docyan/filtro.mp4"
    assert len(pay.capitulos) == 2
    # Bandera honesta: no se generan subtítulos por traducción.
    assert pay.subtitulos_disponibles_en_par_activo is False


def test_arbol_detecta_conectividad_rota():
    draft = DraftArbol(titulo="roto", nodos=[
        NodoBorrador(id="n1", orden=0, opciones=[OpcionBorrador(etiqueta="x", siguiente_nodo_id="nX")]),
    ])
    warns = draft.validar_conectividad()
    assert any("nX" in w for w in warns)
