"""
B9.5 — Router de curación: borrador → confirmar → grafo (FalkorDB REAL).

Ejercita las funciones del router directamente con un ctx de tenant (sin montar
auth HTTP) y verifica el recorrido completo: guardar borrador → confirmar →
materializar en el grafo → el pipeline de lectura lo sirve.
"""
from __future__ import annotations

import os

import pytest

from app.api.routers import curacion as router
from app.api.routers.curacion import (
    GuardarArbolRequest,
    GuardarDiagramaRequest,
    confirmar_borrador,
    guardar_borrador_arbol,
    guardar_borrador_diagrama,
    listar_borradores,
)
from app.curacion.models import DraftArbol, DraftDiagrama, NodoBorrador, OpcionBorrador
from app.pipelines import tipo3_graficos_diagramas, tipo5_troubleshooting
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "b95test_curacion_router"
CTX = {"org_id": TENANT, "user_id": "u1", "role": "admin"}


@pytest.fixture()
def dkg(monkeypatch):
    from app.graph.dkg_client import DKGClient

    c = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
    try:
        ok = c.health()
    except Exception:  # noqa: BLE001
        ok = False
    if not ok:
        pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    # El router usa _dkg() singleton; lo apuntamos al cliente de test.
    monkeypatch.setattr(router, "_dkg", lambda: c)
    # Aísla el store de borradores en memoria (se mockea el ALMACÉN, no la decisión).
    from app.curacion.store import InMemoryDraftStore

    monkeypatch.setattr(router, "_store", InMemoryDraftStore())
    c.drop_tenant_graph(TENANT)
    yield c
    c.drop_tenant_graph(TENANT)


async def test_router_diagrama_draft_confirm_materializa(dkg):
    req = GuardarDiagramaRequest(
        draft=DraftDiagrama(
            titulo="Esquema eléctrico",
            recurso_url="https://x/esquema.png",
            etiquetas=[{"texto": "Breaker principal", "x": 0.5, "y": 0.4}],
        )
    )
    saved = await guardar_borrador_diagrama(req, ctx=CTX)
    draft_id = saved["draft_id"]

    listado = await listar_borradores(ctx=CTX)
    assert any(b["draft_id"] == draft_id for b in listado["borradores"])

    res = await confirmar_borrador(draft_id, ctx=CTX)
    assert res["status"] == "confirmed"

    # El borrador se eliminó del store al confirmar.
    listado2 = await listar_borradores(ctx=CTX)
    assert all(b["draft_id"] != draft_id for b in listado2["borradores"])

    # Y el pipeline de lectura ya lo sirve.
    pay = tipo3_graficos_diagramas.resolver(
        ContextoPipeline(tenant_id=TENANT, pregunta="esquema", params={"termino": "esquema"}),
        DKGReader(dkg),
    ).payload
    assert pay.recurso_url == "https://x/esquema.png"
    assert any(e.texto == "Breaker principal" for e in pay.etiquetas)


async def test_router_arbol_draft_confirm_materializa(dkg):
    req = GuardarArbolRequest(
        draft=DraftArbol(
            titulo="No enfría",
            nodos=[
                NodoBorrador(id="a", pregunta="¿Hay flujo de refrigerante?", orden=0,
                             opciones=[OpcionBorrador(etiqueta="No", siguiente_nodo_id="b")]),
                NodoBorrador(id="b", orden=1, causa_probable="Bomba detenida",
                             accion_resolutoria="Revisar bomba"),
            ],
        )
    )
    saved = await guardar_borrador_arbol(req, ctx=CTX)
    assert "advertencias_conectividad" in saved
    res = await confirmar_borrador(saved["draft_id"], ctx=CTX)
    assert res["status"] == "confirmed"

    pay = tipo5_troubleshooting.resolver(
        ContextoPipeline(tenant_id=TENANT, pregunta="no enfría", params={"termino": "enfr"}),
        DKGReader(dkg),
    ).payload
    assert pay.pregunta == "¿Hay flujo de refrigerante?"
