"""
F2 (frontend) — adiciones de backend que el diseño de la Consola del Fundador
necesita y F2-backend no calculaba aún. Todo es metadata, nunca contenido (línea
dura). Cubre:
  · /platform/metrics/trends — series temporales REALES (no canned) de orgs,
    ingresos por mes y consultas por mes, agregadas desde datos reales.
  · /platform/jobs — expone el motivo TÉCNICO de fallo (por qué, no qué decía).
  · /platform/access-codes — nota interna del fundador persiste y se devuelve;
    defaults cerrados (50 docs / 60 días).
"""
import pytest

from app.jobs.dispatcher import InMemoryQueueBackend
from app.jobs.job_models import IngestJob, JobStatus
from app.platform_admin import providers
from app.platform_admin.audit import InMemoryPlatformAudit
from app.platform_admin.metrics import MetricsService
from app.platform_admin.security import hash_password
from app.platform_admin.store import InMemoryPlatformStore

ADMIN_EMAIL = "fundador@xcid.com"
ADMIN_PASS = "founder-pass-123"
SECRET = "CONTENIDO-CONFIDENCIAL-NO-EXPONER"


@pytest.fixture
def platform(monkeypatch):
    store = InMemoryPlatformStore()
    audit = InMemoryPlatformAudit()
    backend = InMemoryQueueBackend()

    # Orgs con altas en meses distintos (created_at deriva de users).
    store.users.append({"id": "u1", "org_id": "alpha", "email": "a@alpha.com",
                        "created_at": "2026-04-10T00:00:00Z", "role": "admin"})
    store.users.append({"id": "u2", "org_id": "beta", "email": "b@beta.com",
                        "created_at": "2026-05-02T00:00:00Z", "role": "admin"})
    store.upsert_org_billing("alpha", display_name="Alpha Lab", plan="piloto")
    store.upsert_org_billing("beta", display_name="Beta Maquila", plan="profesional")
    # Pagos reales en dos meses (MXN) + uno en USD que NO debe contar en MXN.
    store.create_payment({"org_id": "alpha", "monto": 1000.0, "moneda": "MXN",
                          "concepto": "suscripcion", "fecha": "2026-04-15T00:00:00Z"})
    store.create_payment({"org_id": "beta", "monto": 1500.0, "moneda": "MXN",
                          "concepto": "suscripcion", "fecha": "2026-05-20T00:00:00Z"})
    store.create_payment({"org_id": "beta", "monto": 500.0, "moneda": "MXN",
                          "concepto": "recarga", "fecha": "2026-05-25T00:00:00Z"})
    store.create_payment({"org_id": "alpha", "monto": 99.0, "moneda": "USD",
                          "concepto": "setup", "fecha": "2026-05-01T00:00:00Z"})
    # Series de consultas reales (pcl_metrics_daily) en dos meses.
    store.pcl_daily = [
        {"tenant_id": "alpha", "fecha": "2026-04-30", "consultas_totales": 40},
        {"tenant_id": "beta", "fecha": "2026-05-10", "consultas_totales": 25},
        {"tenant_id": "alpha", "fecha": "2026-05-12", "consultas_totales": 30},
    ]

    metrics = MetricsService(store, dkg=None, jobs_backend=backend)
    store.create_admin(ADMIN_EMAIL, hash_password(ADMIN_PASS), "Fundador")

    monkeypatch.setattr(providers, "get_store", lambda: store)
    monkeypatch.setattr(providers, "get_audit", lambda: audit)
    monkeypatch.setattr(providers, "get_metrics", lambda: metrics)
    monkeypatch.setattr(providers, "get_jobs_backend", lambda: backend)

    from fastapi.testclient import TestClient

    from app.api.main import app
    return TestClient(app), store, backend


def _login(client) -> str:
    r = client.post("/platform/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _ph(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ════════════════════════════════════════════════════════════════════════════
# Trends — series reales (no canned)
# ════════════════════════════════════════════════════════════════════════════

def test_trends_series_reales_por_mes(platform):
    client, store, _ = platform
    token = _login(client)
    body = client.get("/platform/metrics/trends?moneda=MXN", headers=_ph(token)).json()

    # Ingresos MXN por mes: abril 1000, mayo 1500+500=2000 (el USD no cuenta).
    ing = {p["label"]: p["value"] for p in body["ingresos_por_mes"]}
    assert ing == {"2026-04": 1000.0, "2026-05": 2000.0}

    # Orgs acumuladas: 1 en abril (alpha), 2 en mayo (beta).
    orgs = {p["label"]: p["value"] for p in body["orgs_acumuladas"]}
    assert orgs == {"2026-04": 1.0, "2026-05": 2.0}

    # Consultas por mes: abril 40, mayo 25+30=55.
    con = {p["label"]: p["value"] for p in body["consultas_por_mes"]}
    assert con == {"2026-04": 40.0, "2026-05": 55.0}


def test_trends_vacio_si_no_hay_datos(platform, monkeypatch):
    client, store, _ = platform
    store.payments.clear()
    store.pcl_daily = []
    store.users.clear()
    store.org_billing.clear()
    token = _login(client)
    body = client.get("/platform/metrics/trends", headers=_ph(token)).json()
    # Honesto: series vacías, NO inventadas.
    assert body["ingresos_por_mes"] == []
    assert body["orgs_acumuladas"] == []
    assert body["consultas_por_mes"] == []


def test_trends_no_filtra_contenido(platform):
    client, store, _ = platform
    token = _login(client)
    assert SECRET not in client.get("/platform/metrics/trends", headers=_ph(token)).text


# ════════════════════════════════════════════════════════════════════════════
# Jobs — motivo técnico de fallo (metadata, no contenido)
# ════════════════════════════════════════════════════════════════════════════

def test_jobs_expone_motivo_tecnico_de_error(platform):
    client, store, backend = platform
    failed = IngestJob(
        job_id="JF", tenant_id="alpha", documento_ref="r", nombre_archivo="msds.pdf",
        status=JobStatus.failed, error="PDF protegido · OCR rechazado",
        resultado={"texto": SECRET},
    )
    ok = IngestJob(
        job_id="JC", tenant_id="beta", documento_ref="r", nombre_archivo="nom.pdf",
        status=JobStatus.completed, resultado={"texto": SECRET},
    )
    backend.save_job(failed)
    backend.save_job(ok)

    token = _login(client)
    r = client.get("/platform/jobs", headers=_ph(token))
    assert r.status_code == 200
    items = {j["job_id"]: j for j in r.json()["items"]}
    # El job fallido expone el motivo técnico (por qué falló).
    assert items["JF"]["error"] == "PDF protegido · OCR rechazado"
    # El completado no lleva error.
    assert items["JC"]["error"] is None
    # El contenido del documento NUNCA sale.
    assert SECRET not in r.text


# ════════════════════════════════════════════════════════════════════════════
# Códigos de acceso — nota interna + defaults cerrados (50 docs / 60 días)
# ════════════════════════════════════════════════════════════════════════════

def test_generar_codigo_persiste_nota_interna(platform):
    client, store, _ = platform
    token = _login(client)
    r = client.post("/platform/access-codes", headers=_ph(token), json={
        "tipo": "piloto", "cuota_documentos": 50, "dias_vigencia": 60,
        "nota": "piloto Lab Saltillo — referido por Delta Norte",
    })
    assert r.status_code == 200, r.text
    assert r.json()["nota"] == "piloto Lab Saltillo — referido por Delta Norte"
    # Persiste y se devuelve al listar.
    lst = client.get("/platform/access-codes", headers=_ph(token)).json()
    fila = next(c for c in lst["items"] if c["code"] == r.json()["code"])
    assert fila["nota"] == "piloto Lab Saltillo — referido por Delta Norte"
    assert fila["cuota_documentos"] == 50


def test_codigo_defaults_cerrados_50_docs_60_dias(platform):
    client, store, _ = platform
    token = _login(client)
    # Sin especificar cuota/vigencia → defaults cerrados F2.
    r = client.post("/platform/access-codes", headers=_ph(token), json={"tipo": "piloto"})
    assert r.status_code == 200, r.text
    assert r.json()["cuota_documentos"] == 50
