"""
Providers de dependencias del Super-Admin de Plataforma (F2).

Centralizan las instancias de producción para que los tests las sustituyan con
una sola sobreescritura (monkeypatch) por backend en memoria — mismo patrón que
`app/ingesta/providers.py`. Los handlers piden estas funciones vía Depends.
"""
from __future__ import annotations

from app.platform_admin.audit import SupabasePlatformAudit
from app.platform_admin.metrics import MetricsService
from app.platform_admin.store import SupabasePlatformStore


def get_store():
    return SupabasePlatformStore()


def get_audit():
    return SupabasePlatformAudit()


def get_jobs_backend():
    from app.jobs.dispatcher import RedisQueueBackend

    return RedisQueueBackend()


def get_metrics():
    # F1.5: el agregado de peso/tiempo de ingesta se calcula desde los IngestJob
    # (jobs_backend), por eso el MetricsService de producción lo lleva inyectado.
    return MetricsService(get_store(), jobs_backend=get_jobs_backend())
