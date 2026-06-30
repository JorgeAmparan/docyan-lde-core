"""
F1.5 Parte B — Instrumentación de métricas (peso + tiempos de ingesta).

F2 dejó `almacenamiento_bytes` y los tiempos de ingesta en null. Este sprint los
instrumenta sobre los IngestJob (peso del archivo/resultado + duración real por
job) y los expone agregados por org en el super-admin, respetando el aislamiento
de F2: SOLO metadata (peso, tiempo), nunca contenido.
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


def _job(job_id, org, *, status=JobStatus.completed, bytes_orig=None, bytes_res=None,
         started=None, completed=None, dur=None) -> IngestJob:
    return IngestJob(
        job_id=job_id, tenant_id=org, documento_ref="r", nombre_archivo=f"{job_id}.pdf",
        status=status, bytes_originales=bytes_orig, bytes_resultado=bytes_res,
        started_at=started, completed_at=completed, duracion_seg=dur,
        resultado={"texto": SECRET},  # contenido que NUNCA debe salir por /platform/*
    )


# ════════════════════════════════════════════════════════════════════════════
# Unidad — agregación de peso y tiempo por org
# ════════════════════════════════════════════════════════════════════════════

def test_almacenamiento_y_tiempos_agregan_por_org():
    backend = InMemoryQueueBackend()
    backend.save_job(_job("J1", "alpha", bytes_orig=1000, bytes_res=2000, dur=30.0,
                          started="2026-06-06T00:00:00+00:00",
                          completed="2026-06-06T00:00:30+00:00"))
    backend.save_job(_job("J2", "alpha", bytes_orig=500, bytes_res=800, dur=10.0))
    # Otro org: no debe contaminar el agregado de alpha.
    backend.save_job(_job("J3", "beta", bytes_orig=9999, bytes_res=9999, dur=99.0))
    # Job en proceso de alpha: no cuenta (solo completados).
    backend.save_job(_job("J4", "alpha", status=JobStatus.processing, bytes_orig=7777))

    metrics = MetricsService(InMemoryPlatformStore(), jobs_backend=backend)
    m = metrics.org_metrics("alpha", include_graph=False)
    # Peso = bytes_resultado de los completados de alpha (2000 + 800).
    assert m.almacenamiento_bytes == 2800
    # Tiempos: total 40, promedio 20 sobre 2 jobs.
    assert m.ingesta_tiempo_total_seg == pytest.approx(40.0)
    assert m.ingesta_tiempo_promedio_seg == pytest.approx(20.0)


def test_peso_usa_originales_si_no_hay_resultado():
    backend = InMemoryQueueBackend()
    backend.save_job(_job("J1", "alpha", bytes_orig=1500, bytes_res=None, dur=5.0))
    metrics = MetricsService(InMemoryPlatformStore(), jobs_backend=backend)
    m = metrics.org_metrics("alpha", include_graph=False)
    assert m.almacenamiento_bytes == 1500


def test_sin_jobs_ni_documentos_queda_null_honesto():
    metrics = MetricsService(InMemoryPlatformStore(), jobs_backend=InMemoryQueueBackend())
    m = metrics.org_metrics("vacia", include_graph=False)
    assert m.almacenamiento_bytes is None
    assert m.ingesta_tiempo_total_seg is None
    assert m.ingesta_tiempo_promedio_seg is None


def test_documents_size_bytes_suma_aditiva():
    """El camino Postgres (documents.size_bytes) contribuye de forma aditiva."""
    store = InMemoryPlatformStore()
    store.documents.append({"id": "d1", "org_id": "alpha", "size_bytes": 4000})
    backend = InMemoryQueueBackend()
    backend.save_job(_job("J1", "alpha", bytes_res=1000, dur=1.0))
    metrics = MetricsService(store, jobs_backend=backend)
    m = metrics.org_metrics("alpha", include_graph=False)
    assert m.almacenamiento_bytes == 5000  # 1000 (job) + 4000 (documents)


def test_summary_almacenamiento_total_cross_org():
    backend = InMemoryQueueBackend()
    backend.save_job(_job("J1", "alpha", bytes_res=2000, dur=1.0))
    backend.save_job(_job("J2", "beta", bytes_res=3000, dur=1.0))
    metrics = MetricsService(InMemoryPlatformStore(), jobs_backend=backend)
    s = metrics.summary(jobs_activos=0, ingresos_periodo=0.0)
    assert s.almacenamiento_total_bytes == 5000


# ════════════════════════════════════════════════════════════════════════════
# Integración HTTP — /platform/* devuelve valores reales (no null) sin contenido
# ════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def platform(monkeypatch):
    store = InMemoryPlatformStore()
    audit = InMemoryPlatformAudit()
    backend = InMemoryQueueBackend()

    store.users.append({"id": "u1", "org_id": "alpha", "email": "a@alpha.com",
                        "created_at": "2026-01-01T00:00:00Z", "role": "admin"})
    backend.save_job(_job("J1", "alpha", bytes_orig=1000, bytes_res=2000, dur=30.0,
                          started="2026-06-06T00:00:00+00:00",
                          completed="2026-06-06T00:00:30+00:00"))

    metrics = MetricsService(store, dkg=None, jobs_backend=backend)
    store.create_admin(ADMIN_EMAIL, hash_password(ADMIN_PASS), "Fundador")

    monkeypatch.setattr(providers, "get_store", lambda: store)
    monkeypatch.setattr(providers, "get_audit", lambda: audit)
    monkeypatch.setattr(providers, "get_metrics", lambda: metrics)
    monkeypatch.setattr(providers, "get_jobs_backend", lambda: backend)

    from fastapi.testclient import TestClient

    from app.api.main import app
    return TestClient(app)


def _login(client) -> str:
    r = client.post("/platform/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_org_metrics_devuelve_peso_y_tiempos_reales_sin_contenido(platform):
    client = platform
    token = _login(client)
    r = client.get("/platform/orgs/alpha/metrics", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    # Antes null; ahora valores reales instrumentados.
    assert body["almacenamiento_bytes"] == 2000
    assert body["ingesta_tiempo_total_seg"] == pytest.approx(30.0)
    assert body["ingesta_tiempo_promedio_seg"] == pytest.approx(30.0)
    # Aislamiento F2: el contenido del resultado NUNCA sale.
    assert SECRET not in r.text


def test_summary_devuelve_almacenamiento_total_no_null(platform):
    client = platform
    token = _login(client)
    r = client.get("/platform/metrics/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["almacenamiento_total_bytes"] == 2000
    assert SECRET not in r.text
