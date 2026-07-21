"""
ED-1 — Routers /destinatarios y /notificaciones (backends en memoria, sin red).

CRUD del Directorio (solo admin, scope de tenant) y centro de notificaciones in-app.
"""
from __future__ import annotations

import os

import pytest

from app.api.routers._eventos_deps import dep_directorio_store, dep_inapp_store
from app.eventos_dirigidos.directorio import InMemoryDirectorioStore
from app.eventos_dirigidos.notificaciones_inapp import (
    InMemoryNotificacionInAppStore,
    NotificacionInApp,
)

ADMIN_KEY = {"X-API-Key": os.environ.get("API_KEY", "test-api-key-for-pytest")}


@pytest.fixture()
def stores(test_client):
    from app.api.main import app

    directorio = InMemoryDirectorioStore()
    inapp = InMemoryNotificacionInAppStore()
    app.dependency_overrides[dep_directorio_store] = lambda: directorio
    app.dependency_overrides[dep_inapp_store] = lambda: inapp
    yield directorio, inapp
    app.dependency_overrides.pop(dep_directorio_store, None)
    app.dependency_overrides.pop(dep_inapp_store, None)


# ── /destinatarios ────────────────────────────────────────────────────────────
def test_destinatarios_requiere_auth(test_client):
    assert test_client.get("/destinatarios").status_code == 401


def test_destinatarios_crud(test_client, stores):
    directorio, _ = stores
    # Alta de un proveedor externo.
    r = test_client.post("/destinatarios", headers=ADMIN_KEY, json={
        "tipo": "proveedor_externo", "nombre": "Calibra SA", "email": "ventas@calibra.mx",
        "categorias": ["calibracion"],
    })
    assert r.status_code == 201, r.text
    did = r.json()["id"]

    # Listado.
    r = test_client.get("/destinatarios", headers=ADMIN_KEY)
    assert r.status_code == 200
    assert any(d["id"] == did for d in r.json())

    # Update.
    r = test_client.patch(f"/destinatarios/{did}", headers=ADMIN_KEY, json={"nombre": "Calibra SA de CV"})
    assert r.status_code == 200 and r.json()["nombre"] == "Calibra SA de CV"

    # Delete.
    assert test_client.delete(f"/destinatarios/{did}", headers=ADMIN_KEY).status_code == 204
    assert test_client.delete(f"/destinatarios/{did}", headers=ADMIN_KEY).status_code == 404


def test_destinatario_proveedor_sin_email_es_422(test_client, stores):
    r = test_client.post("/destinatarios", headers=ADMIN_KEY, json={
        "tipo": "proveedor_externo", "nombre": "Sin correo",
    })
    assert r.status_code == 422


# ── /notificaciones ───────────────────────────────────────────────────────────
def test_notificaciones_listar_y_marcar(test_client, stores):
    _, inapp = stores
    n = inapp.crear(NotificacionInApp(
        org_id="test-org", usuario_id=None, tipo_evento="alerta_vencimiento",
        titulo="Vencimiento", cuerpo="Cert vence el 2026-08-01.",
    ))

    r = test_client.get("/notificaciones", headers=ADMIN_KEY)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["no_leidas"] == 1
    assert any(x["id"] == n.id for x in body["notificaciones"])

    # Marcar leída.
    r = test_client.post(f"/notificaciones/{n.id}/leer", headers=ADMIN_KEY)
    assert r.status_code == 200 and r.json()["leida"] is True

    # Ya no hay no leídas.
    r = test_client.get("/notificaciones", headers=ADMIN_KEY, params={"solo_no_leidas": True})
    assert r.json()["no_leidas"] == 0


def test_notificaciones_marcar_todas(test_client, stores):
    _, inapp = stores
    for i in range(3):
        inapp.crear(NotificacionInApp(
            org_id="test-org", usuario_id=None, tipo_evento="alerta_vencimiento",
            titulo=f"n{i}", cuerpo="x",
        ))
    r = test_client.post("/notificaciones/leer-todas", headers=ADMIN_KEY)
    assert r.status_code == 200 and r.json()["marcadas"] == 3
