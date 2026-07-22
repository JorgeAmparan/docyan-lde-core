"""
ED-2 §2.5 — Routers /solicitudes y /tipos-solicitud (sin FalkorDB: DKG stubeado).

Cubre el contrato de API de punta a punta con backends en memoria:
- Guardrail (Test 1): destinatario libre/ajeno → 422.
- Catálogo (§2.1): el listado siembra los 5 tipos base (onboarding/backfill).
- Crear + bandeja + transición (§2.5) con provenance heredado (Test 3).
- Propuestas de promoción (Test 7) vía endpoint.
- Mapeo de inferencia versionado (§2.3) expuesto.
"""

from __future__ import annotations

import os

import pytest

ADMIN_KEY = {"X-API-Key": os.environ.get("API_KEY", "test-api-key-for-pytest")}


@pytest.fixture()
def ed2_env(test_client):
    from app.api.main import app
    from app.api.routers._eventos_deps import (
        dep_directorio_store,
        dep_dkg,
        dep_fat,
        dep_notificador,
        dep_solicitud_store,
        dep_tipo_solicitud_store,
    )
    from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
    from app.eventos_dirigidos.directorio import Destinatario, InMemoryDirectorioStore
    from app.eventos_dirigidos.notificaciones_inapp import InMemoryNotificacionInAppStore
    from app.eventos_dirigidos.notificador import Notificador
    from app.notifications.email import CapturingEmailSender
    from app.solicitudes.modelo import InMemorySolicitudStore
    from app.solicitudes.tipos import InMemoryTipoSolicitudStore

    directorio = InMemoryDirectorioStore()
    prov = directorio.crear(
        Destinatario(
            org_id="test-org",
            tipo="proveedor_externo",
            nombre="Refaccionaria X",
            email="ventas@refax.mx",
        )
    )
    tipo_store = InMemoryTipoSolicitudStore()
    sol_store = InMemorySolicitudStore()
    sender = CapturingEmailSender()
    notif = Notificador(
        directorio_store=directorio,
        inapp_store=InMemoryNotificacionInAppStore(),
        email_sender=sender,
        sleep=lambda s: None,
    )
    fat = FATExtendido(InMemoryFATStore())

    class StubDKG:
        def query(self, tenant, cypher, params=None):
            return []

    app.dependency_overrides[dep_directorio_store] = lambda: directorio
    app.dependency_overrides[dep_tipo_solicitud_store] = lambda: tipo_store
    app.dependency_overrides[dep_solicitud_store] = lambda: sol_store
    app.dependency_overrides[dep_notificador] = lambda: notif
    app.dependency_overrides[dep_fat] = lambda: fat
    app.dependency_overrides[dep_dkg] = lambda: StubDKG()

    yield {"prov": prov, "sender": sender, "tipo_store": tipo_store, "sol_store": sol_store}

    for dep in (
        dep_directorio_store,
        dep_tipo_solicitud_store,
        dep_solicitud_store,
        dep_notificador,
        dep_fat,
        dep_dkg,
    ):
        app.dependency_overrides.pop(dep, None)


def test_catalogo_siembra_cinco_tipos(test_client, ed2_env):
    r = test_client.get("/tipos-solicitud", headers=ADMIN_KEY)
    assert r.status_code == 200, r.text
    claves = {t["clave"] for t in r.json()}
    assert {"cotizacion", "servicio", "mantenimiento", "revision", "tarea"} <= claves


def test_mapeo_inferencia_expuesto(test_client, ed2_env):
    r = test_client.get("/solicitudes/mapeo-inferencia", headers=ADMIN_KEY)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["version"]
    assert any(x["tipo_sugerido"] == "cotizacion" for x in data["reglas"])


def test_guardrail_destinatario_libre_o_ajeno_422(test_client, ed2_env):
    # destinatario_id que no existe en el Directorio del tenant → 422 (no email libre).
    r = test_client.post(
        "/solicitudes",
        headers=ADMIN_KEY,
        json={
            "destinatario_id": "id-inventado",
            "etiqueta_libre": "Otra cosa",
            "mensaje": "Cotización por favor.",
        },
    )
    assert r.status_code == 422, r.text


def test_ciclo_completo_crear_bandeja_transicion(test_client, ed2_env):
    prov = ed2_env["prov"]
    # Tipo cotización (del catálogo sembrado).
    tipos = test_client.get("/tipos-solicitud", headers=ADMIN_KEY).json()
    cot = next(t for t in tipos if t["clave"] == "cotizacion")

    r = test_client.post(
        "/solicitudes",
        headers=ADMIN_KEY,
        json={
            "destinatario_id": prov.id,
            "tipo_id": cot["id"],
            "mensaje": "Necesito cotización de 5 acoples motor-eje.",
            "campos_tipados": {"cantidad": 5, "numero_parte": "MX-4471"},
            "dato_origen": {
                "documento_id": "doc-partes-777",
                "documento_nombre": "Lista de partes MAXI-10ND",
                "span_inicio": 120,
                "span_fin": 168,
                "fragmento": "Acople motor-eje, número de parte MX-4471.",
                "nodo_id": "espec-9",
            },
            "consulta_id": "consulta-abc",
            "entidad_id": "MAXI-10ND",
        },
    )
    assert r.status_code == 201, r.text
    sol = r.json()
    sid = sol["id"]
    # Provenance heredado (Test 3).
    assert sol["documento_id"] == "doc-partes-777"
    assert sol["fragmento"] == "Acople motor-eje, número de parte MX-4471."

    # Email real al proveedor con reply-to + cita (Resend mockeado).
    assert len(ed2_env["sender"].sent) == 1
    assert "MX-4471" in ed2_env["sender"].sent[0].body_text

    # Bandeja de enviadas la incluye.
    r = test_client.get("/solicitudes?buzon=enviadas", headers=ADMIN_KEY)
    assert r.status_code == 200
    assert any(s["id"] == sid for s in r.json()["solicitudes"])

    # Transición a resuelta.
    r = test_client.post(
        f"/solicitudes/{sid}/transicion", headers=ADMIN_KEY, json={"accion": "resolver"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "resuelto"

    # Transición inválida desde terminal → 409.
    r = test_client.post(
        f"/solicitudes/{sid}/transicion", headers=ADMIN_KEY, json={"accion": "iniciar_proceso"}
    )
    assert r.status_code == 409


def test_propuestas_promocion_endpoint(test_client, ed2_env):
    prov = ed2_env["prov"]
    for _ in range(3):
        r = test_client.post(
            "/solicitudes",
            headers=ADMIN_KEY,
            json={
                "destinatario_id": prov.id,
                "etiqueta_libre": "Verificación metrológica",
                "mensaje": "Requiero verificación.",
            },
        )
        assert r.status_code == 201, r.text

    r = test_client.get("/tipos-solicitud/propuestas", headers=ADMIN_KEY)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["umbral"] == 3
    assert any(p["conteo"] >= 3 for p in data["propuestas"])
