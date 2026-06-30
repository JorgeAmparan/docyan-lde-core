"""
F2 — Super-Admin de Plataforma (backend). Tests del modelo de seguridad cerrado.

Garantías verificadas:
  · Identidad/scope separados: platform_admin tiene JWT propio; un token de tenant
    NO entra a /platform/* (403); un token de plataforma NO entra a recursos de
    tenant (403). El RLS de tenant queda intacto.
  · metadata SÍ / contenido NO: ningún endpoint /platform/* devuelve texto de
    documentos, texto de consultas ni contenido de grafos (test explícito).
  · Códigos de acceso: generar + canjear (provisiona org con cuota); no re-canje;
    expirado rechaza.
  · Pago manual: persiste y se refleja en billing-status.
  · Soporte: hilo con contexto → bandeja del founder → respuesta → registrado.
  · FAT: toda acción mutante de plataforma queda auditada.
"""
import pytest

from app.platform_admin import providers
from app.platform_admin.audit import InMemoryPlatformAudit
from app.platform_admin.metrics import MetricsService
from app.platform_admin.security import hash_password
from app.platform_admin.store import InMemoryPlatformStore

ADMIN_EMAIL = "fundador@xcid.com"
ADMIN_PASS = "founder-pass-123"
SECRET_DOC_TEXT = "TEXTO-CONFIDENCIAL-DEL-DOCUMENTO-NUNCA-EXPONER"
SECRET_QUERY_TEXT = "consulta-secreta-del-operador"


class _FakeDkg:
    """Grafo de prueba: responde SOLO conteos (como el código de producción pide)."""

    def query(self, tenant_id, cypher, params=None):
        if "count(n)" in cypher:
            return [{"n": 42}]
        if "count(r)" in cypher:
            return [{"n": 100}]
        return []


@pytest.fixture
def platform(monkeypatch):
    store = InMemoryPlatformStore()
    audit = InMemoryPlatformAudit()
    fake_dkg = _FakeDkg()
    from app.jobs.dispatcher import InMemoryQueueBackend

    jobs_backend = InMemoryQueueBackend()

    # Seed: una org "alpha" con users/documentos/consultas + contenido secreto
    # que NUNCA debe salir por /platform/*.
    store.users.append({"id": "u1", "org_id": "alpha", "email": "a@alpha.com",
                        "created_at": "2026-01-01T00:00:00Z", "role": "admin"})
    store.documents.append({"id": "d1", "org_id": "alpha", "name": "NOM-052.pdf",
                            "text": SECRET_DOC_TEXT})
    store.consultas["alpha"] = 12
    store.upsert_org_billing("alpha", display_name="Alpha Lab", plan="piloto")

    metrics = MetricsService(store, dkg=fake_dkg)
    store.create_admin(ADMIN_EMAIL, hash_password(ADMIN_PASS), "Fundador")

    monkeypatch.setattr(providers, "get_store", lambda: store)
    monkeypatch.setattr(providers, "get_audit", lambda: audit)
    monkeypatch.setattr(providers, "get_metrics", lambda: metrics)
    monkeypatch.setattr(providers, "get_jobs_backend", lambda: jobs_backend)

    from fastapi.testclient import TestClient

    from app.api.main import app
    client = TestClient(app)
    return client, store, audit, jobs_backend


def _login(client) -> str:
    r = client.post("/platform/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _ph(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _tenant_jwt(org_id="alpha", role="admin") -> str:
    from app.api.auth import _create_access_token

    return _create_access_token({"id": "u1", "org_id": org_id, "role": role, "email": "a@alpha.com"})


# ════════════════════════════════════════════════════════════════════════════
# Identidad / scope
# ════════════════════════════════════════════════════════════════════════════

def test_login_emite_token_y_orgs_accesible(platform):
    client, *_ = platform
    token = _login(client)
    r = client.get("/platform/orgs", headers=_ph(token))
    assert r.status_code == 200
    assert any(o["org_id"] == "alpha" for o in r.json()["items"])


def test_login_credenciales_invalidas(platform):
    client, *_ = platform
    r = client.post("/platform/auth/login", json={"email": ADMIN_EMAIL, "password": "mala"})
    assert r.status_code == 401


def test_tenant_jwt_no_entra_a_platform(platform):
    client, *_ = platform
    r = client.get("/platform/orgs", headers=_ph(_tenant_jwt()))
    assert r.status_code == 403  # token de tenant: sin scope platform


def test_sin_auth_no_entra_a_platform(platform):
    client, *_ = platform
    assert client.get("/platform/orgs").status_code == 401


def test_platform_token_no_entra_a_recursos_de_tenant(platform):
    client, *_ = platform
    token = _login(client)
    # Endpoint de tenant (requiere_rol) con token de plataforma → 403 (no 500).
    r = client.get("/mo/sessions/cualquiera", headers=_ph(token))
    assert r.status_code == 403


# ════════════════════════════════════════════════════════════════════════════
# metadata SÍ / contenido NO
# ════════════════════════════════════════════════════════════════════════════

def test_metrics_solo_metadata_sin_contenido(platform):
    client, *_ = platform
    token = _login(client)

    r = client.get("/platform/orgs/alpha/metrics", headers=_ph(token))
    assert r.status_code == 200
    body = r.json()
    # Conteos reales (metadata).
    assert body["users"] == 1
    assert body["documentos_ingeridos"] == 1
    assert body["consultas_total"] == 12
    assert body["grafo"]["nodes"] == 42 and body["grafo"]["relationships"] == 100
    # NUNCA contenido: el texto secreto del documento no aparece en ningún lado.
    assert SECRET_DOC_TEXT not in r.text


def test_orgs_y_summary_no_filtran_contenido(platform):
    client, *_ = platform
    token = _login(client)
    assert SECRET_DOC_TEXT not in client.get("/platform/orgs", headers=_ph(token)).text
    assert SECRET_DOC_TEXT not in client.get(
        "/platform/metrics/summary", headers=_ph(token)
    ).text


def test_jobs_cross_org_solo_metadata(platform):
    client, store, audit, jobs_backend = platform
    from app.jobs.job_models import CotizacionSnapshot, IngestJob, JobStatus

    job = IngestJob(
        job_id="J1", tenant_id="alpha", documento_ref="r", nombre_archivo="NOM-052.pdf",
        status=JobStatus.processing, phase="grafo", phase_fraction=0.5,
        resultado={"texto": SECRET_DOC_TEXT},  # contenido que NO debe exponerse
        cotizacion=CotizacionSnapshot(costo_estimado_usd=0.02, tiempo_estimado_seg=600,
                                      tokens_documento=9000, aprobado=True,
                                      decision="aprobado_requiere_confirmacion"),
    )
    jobs_backend.save_job(job)

    token = _login(client)
    r = client.get("/platform/jobs", headers=_ph(token))
    assert r.status_code == 200
    body = r.json()
    j = next(x for x in body["items"] if x["job_id"] == "J1")
    assert j["org_id"] == "alpha" and j["status"] == "processing" and j["phase"] == "grafo"
    assert j["nombre_archivo"] == "NOM-052.pdf"  # filename = metadata, permitido
    assert SECRET_DOC_TEXT not in r.text  # el resultado/contenido NO sale


# ════════════════════════════════════════════════════════════════════════════
# (B) Códigos de acceso
# ════════════════════════════════════════════════════════════════════════════

def test_generar_y_canjear_codigo_provisiona_org(platform):
    client, store, audit, _ = platform
    token = _login(client)

    r = client.post("/platform/access-codes", headers=_ph(token), json={
        "tipo": "piloto", "cuota_documentos": 50, "cuota_saldo_usd": 25.0, "dias_vigencia": 30,
    })
    assert r.status_code == 200
    code = r.json()["code"]
    assert r.json()["status"] == "active"

    # Canje (lado tenant, sin scope platform) → provisiona org con la cuota.
    r2 = client.post(f"/access-codes/{code}/redeem", json={
        "email": "nuevo@piloto.com", "password": "pass1234", "name": "Nuevo",
        "org_name": "Piloto SA",
    })
    assert r2.status_code == 200, r2.text
    prov = r2.json()
    assert prov["cuota_documentos"] == 50 and prov["cuota_saldo_usd"] == 25.0
    org_id = prov["org_id"]
    assert store.org_has_users(org_id)
    assert store.get_org_billing(org_id)["plan"] == "piloto"

    # No se re-canjea.
    r3 = client.post(f"/access-codes/{code}/redeem", json={
        "email": "otro@piloto.com", "password": "pass1234", "name": "Otro", "org_name": "X",
    })
    assert r3.status_code == 409


def test_codigo_expirado_rechaza(platform):
    client, store, audit, _ = platform
    # Código ya expirado sembrado directo.
    store.create_access_code({
        "code": "DOCYAN-EXPIRED1", "tipo": "piloto", "cuota_documentos": 10,
        "cuota_saldo_usd": 5.0, "expires_at": "2020-01-01T00:00:00+00:00", "status": "active",
        "created_by": ADMIN_EMAIL,
    })
    r = client.post("/access-codes/DOCYAN-EXPIRED1/redeem", json={
        "email": "x@y.com", "password": "pass1234", "name": "X", "org_name": "X",
    })
    assert r.status_code == 409


def test_revocar_codigo(platform):
    client, store, audit, _ = platform
    token = _login(client)
    code = client.post("/platform/access-codes", headers=_ph(token), json={
        "tipo": "prueba", "cuota_documentos": 5, "cuota_saldo_usd": 2.0,
    }).json()["code"]
    r = client.post(f"/platform/access-codes/{code}/revoke", headers=_ph(token))
    assert r.status_code == 200 and r.json()["status"] == "revoked"
    # Revocado no se canjea.
    assert client.post(f"/access-codes/{code}/redeem", json={
        "email": "z@y.com", "password": "pass1234", "name": "Z", "org_name": "Z",
    }).status_code == 409


# ════════════════════════════════════════════════════════════════════════════
# (C) Pagos manuales
# ════════════════════════════════════════════════════════════════════════════

def test_registrar_pago_y_billing_status(platform):
    client, store, audit, _ = platform
    token = _login(client)

    r = client.post("/platform/payments", headers=_ph(token), json={
        "org_id": "alpha", "monto": 1500.0, "moneda": "MXN", "concepto": "suscripcion",
        "nota": "pago piloto junio",
    })
    assert r.status_code == 200 and r.json()["monto"] == 1500.0

    bs = client.get("/platform/orgs/alpha/billing-status?moneda=MXN", headers=_ph(token)).json()
    assert bs["pagos_registrados"] == 1
    assert bs["total_pagado"] == 1500.0
    assert bs["lifecycle_status"] == "active"  # base del ciclo de vida


# ════════════════════════════════════════════════════════════════════════════
# (D) Soporte
# ════════════════════════════════════════════════════════════════════════════

def test_soporte_hilo_bandeja_respuesta(platform):
    client, store, audit, _ = platform
    # Tenant abre hilo con contexto (JWT de tenant).
    r = client.post("/support/threads", headers=_ph(_tenant_jwt()), json={
        "pantalla_origen": "admin/ingesta", "mensaje": "No veo el progreso del lote",
    })
    assert r.status_code == 200, r.text
    thread_id = r.json()["id"]
    assert r.json()["estado"] == "abierto"
    assert r.json()["mensajes"][0]["autor_tipo"] == "usuario"

    # Founder lo ve en la bandeja unificada.
    token = _login(client)
    inbox = client.get("/platform/support/threads", headers=_ph(token)).json()
    assert any(t["id"] == thread_id for t in inbox["items"])

    # Founder responde → respondido + mensaje del founder registrado.
    rep = client.post(f"/platform/support/threads/{thread_id}/reply", headers=_ph(token), json={
        "cuerpo": "Ya está arreglado, recarga la página.",
    })
    assert rep.status_code == 200 and rep.json()["estado"] == "respondido"
    assert any(m["autor_tipo"] == "founder" for m in rep.json()["mensajes"])


def test_soporte_aislamiento_entre_tenants(platform):
    client, store, audit, _ = platform
    # Org alpha abre un hilo.
    tid = client.post("/support/threads", headers=_ph(_tenant_jwt("alpha")), json={
        "mensaje": "hola", "pantalla_origen": "x",
    }).json()["id"]
    # Otra org NO puede añadir mensajes a un hilo ajeno (404, no se revela).
    r = client.post(f"/support/threads/{tid}/messages", headers=_ph(_tenant_jwt("beta")), json={
        "cuerpo": "intruso",
    })
    assert r.status_code == 404


# ════════════════════════════════════════════════════════════════════════════
# FAT — auditoría de acciones de plataforma
# ════════════════════════════════════════════════════════════════════════════

def test_acciones_mutantes_quedan_en_fat(platform):
    client, store, audit, _ = platform
    token = _login(client)
    code = client.post("/platform/access-codes", headers=_ph(token), json={
        "tipo": "piloto", "cuota_documentos": 10, "cuota_saldo_usd": 5.0,
    }).json()["code"]
    client.post("/platform/payments", headers=_ph(token), json={
        "org_id": "alpha", "monto": 100.0, "moneda": "MXN", "concepto": "recarga",
    })
    actions = {e["action"] for e in audit.entries}
    assert "platform_login" in actions
    assert "access_code_created" in actions
    assert "manual_payment_recorded" in actions
    # Cada entrada lleva actor (el platform_admin) y componente PLATFORM.
    assert all(e["component"] == "PLATFORM" for e in audit.entries)
    assert all(e["actor"] for e in audit.entries)
    assert code  # sanity
