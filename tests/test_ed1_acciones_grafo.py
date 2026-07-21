"""
ED-1 §4.6 — AccionSobreAlerta contra FalkorDB REAL.

Cada acción transiciona + registra FAT + deja un nodo `:AccionSobreAlerta`;
transición inválida y `postponer` sin justificación son errores explícitos.
"""
from __future__ import annotations

import os

import pytest

from app.alerts import acciones as _acc
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.eventos_dirigidos import ciclo_vida as cv

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "ed1_acciones"


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


def _crear_alerta(client, estado="notificado"):
    client._graph(TENANT).query(
        "CREATE (a:Alerta {id:'al-1', descripcion:'Cert vence el 2026-08-01', "
        f"estado:'{estado}', administrativa:true, urgencia:'media'}})"
    )


def test_reconocer_transiciona_y_registra_fat_y_accion(client):
    _crear_alerta(client, "notificado")
    fat = FATExtendido(InMemoryFATStore())
    res = _acc.aplicar_accion(client, TENANT, "al-1", "reconocer", actor_id="u-1", fat=fat)

    assert res["estado"] == "reconocido"
    assert res["estado_anterior"] == "notificado"
    # Estado persistido.
    rows = client.query(TENANT, "MATCH (a:Alerta {id:'al-1'}) RETURN a.estado AS e", {})
    assert rows[0]["e"] == "reconocido"
    # Nodo AccionSobreAlerta creado y enlazado.
    acc = client.query(
        TENANT, "MATCH (a:Alerta {id:'al-1'})-[:TIENE_ACCION]->(ac) "
        "RETURN ac.accion AS accion, ac.actor_id AS actor", {}
    )
    assert acc[0]["accion"] == "reconocer" and acc[0]["actor"] == "u-1"
    # FAT familia F10.
    assert len(fat.eventos(TENANT)) == 1


def test_cadena_completa_de_acciones(client):
    _crear_alerta(client, "notificado")
    fat = FATExtendido(InMemoryFATStore())
    for accion, esperado in [
        ("reconocer", "reconocido"),
        ("iniciar_proceso", "en_proceso"),
        ("comentar", "en_proceso"),  # self, no cambia
        ("resolver", "resuelto"),
    ]:
        res = _acc.aplicar_accion(client, TENANT, "al-1", accion, actor_id="u-1",
                                  justificacion=None, comentario="ok", fat=fat)
        assert res["estado"] == esperado


def test_postponer_sin_justificacion_es_error(client):
    _crear_alerta(client, "notificado")
    with pytest.raises(cv.JustificacionRequerida):
        _acc.aplicar_accion(client, TENANT, "al-1", "postponer", actor_id="u-1")
    # Con justificación es válida (self).
    res = _acc.aplicar_accion(client, TENANT, "al-1", "postponer", actor_id="u-1",
                              justificacion="espera insumo")
    assert res["estado"] == "notificado"


def test_transicion_invalida_es_error(client):
    _crear_alerta(client, "resuelto")  # terminal
    with pytest.raises(cv.TransicionInvalida):
        _acc.aplicar_accion(client, TENANT, "al-1", "reconocer", actor_id="u-1")


def test_alerta_inexistente(client):
    with pytest.raises(_acc.AlertaNoEncontrada):
        _acc.aplicar_accion(client, TENANT, "no-existe", "reconocer", actor_id="u-1")
