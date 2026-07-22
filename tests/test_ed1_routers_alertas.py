"""
ED-1 — Router /alertas (reglas + alerta manual + acciones) contra FalkorDB REAL.

Verifica el desmockeo de la vista admin: la regla se persiste y se relee; la alerta
manual se crea (origen=manual) y sus acciones transicionan; `postponer` sin
justificación = 422.
"""
from __future__ import annotations

import os

import pytest

from tests.conftest import requires_falkordb

ADMIN_KEY = {"X-API-Key": os.environ.get("API_KEY", "test-api-key-for-pytest")}
TENANT = "test-org"  # org del dev-key


@pytest.fixture()
def alertas_env(test_client):
    from app.api.main import app
    from app.api.routers._eventos_deps import dep_fat, dep_notificador
    from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
    from app.eventos_dirigidos.directorio import InMemoryDirectorioStore
    from app.eventos_dirigidos.notificaciones_inapp import InMemoryNotificacionInAppStore
    from app.eventos_dirigidos.notificador import Notificador
    from app.graph.dkg_client import dkg_client

    notif = Notificador(
        directorio_store=InMemoryDirectorioStore(),
        inapp_store=InMemoryNotificacionInAppStore(),
        email_sender=None, sleep=lambda s: None,
    )
    fat = FATExtendido(InMemoryFATStore())
    app.dependency_overrides[dep_notificador] = lambda: notif
    app.dependency_overrides[dep_fat] = lambda: fat

    dkg_client.drop_tenant_graph(TENANT)
    yield
    dkg_client.drop_tenant_graph(TENANT)
    app.dependency_overrides.pop(dep_notificador, None)
    app.dependency_overrides.pop(dep_fat, None)


@requires_falkordb
def test_reglas_get_put_persisten(test_client, alertas_env):
    # Default (sin persistir) al GET inicial.
    r = test_client.get("/alertas/reglas", headers=ADMIN_KEY)
    assert r.status_code == 200, r.text
    assert r.json()[0]["thresholds"]  # trae el default

    # PUT persiste.
    r = test_client.put("/alertas/reglas", headers=ADMIN_KEY, json={
        "tipo": "*", "thresholds": [45, 20, 5], "destinatarios": [], "canales": ["email", "in_app"],
        "escalacion_dias": 10,
    })
    assert r.status_code == 200, r.text

    # GET relee lo persistido.
    r = test_client.get("/alertas/reglas", headers=ADMIN_KEY)
    regla = r.json()[0]
    assert sorted(regla["thresholds"]) == [5, 20, 45]
    assert set(regla["canales"]) == {"email", "in_app"}
    assert regla["escalacion_dias"] == 10


@requires_falkordb
def test_alerta_manual_y_acciones(test_client, alertas_env):
    # Crear alerta manual administrativa.
    r = test_client.post("/alertas", headers=ADMIN_KEY, json={
        "descripcion": "Certificado del operador vence el 2026-09-01.",
        "fecha_vencimiento": "2026-09-01",
    })
    assert r.status_code == 201, r.text
    alerta = r.json()
    aid = alerta["alerta_id"]
    assert alerta["origen"] == "manual"

    # Listado la incluye.
    r = test_client.get("/alertas", headers=ADMIN_KEY)
    assert r.status_code == 200
    assert any(a["alerta_id"] == aid for a in r.json()["alertas"])

    # Acción reconocer transiciona.
    r = test_client.post(f"/alertas/{aid}/accion", headers=ADMIN_KEY, json={"accion": "reconocer"})
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "reconocido"

    # postponer sin justificación = 422.
    r = test_client.post(f"/alertas/{aid}/accion", headers=ADMIN_KEY, json={"accion": "postponer"})
    assert r.status_code == 422


@requires_falkordb
def test_alerta_manual_no_administrativa_es_422(test_client, alertas_env):
    r = test_client.post("/alertas", headers=ADMIN_KEY, json={
        "descripcion": "Suspenda el tratamiento y administre la dosis al paciente.",
    })
    assert r.status_code == 422
