"""
Test del job de agregación diaria de métricas PCL en el scheduler (B8.5 §6).

DOCYAN LDE™ by XCID.
"""
from datetime import datetime, timedelta, timezone

from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.orchestrator import providers
from app.orchestrator.scheduler import DEFAULT_JOBS, DocyanScheduler
from app.pcl.pcl_metrics import EVENTO_CONSULTA, InMemoryPCLMetricsStore, PCLMetrics
from app.playbooks.models import InMemoryPlaybookStore


def test_job_pcl_metrics_registrado():
    sched = DocyanScheduler(jobstore="memory")
    ids = sched.register_default_jobs()
    assert "pcl_metrics_aggregation" in ids
    assert "pcl_metrics_aggregation" in {s.job_id for s in DEFAULT_JOBS}
    sched.shutdown()


def test_trigger_agrega_metricas_del_dia_anterior(monkeypatch):
    ayer = datetime.now(timezone.utc).date() - timedelta(days=1)
    # FAT en memoria con un evento de consulta de AYER (timestamp inyectado).
    fat = FATExtendido(InMemoryFATStore())
    fat.registrar(
        tipo_evento=EVENTO_CONSULTA, familia=FamiliaFAT.F4_CONSULTA, tenant_id="t1",
        payload={"modo_respuesta": "cache_hit", "costo_estimado_centavos": 0.0,
                 "latencia_ms": 15, "entidad_id": "e1"},
        timestamp=f"{ayer.isoformat()}T10:00:00+00:00",
    )
    metrics = PCLMetrics(store=InMemoryPCLMetricsStore(), fat=fat)

    monkeypatch.setattr(providers, "get_pcl_metrics", lambda: metrics)
    monkeypatch.setattr(providers, "get_playbook_store", lambda: InMemoryPlaybookStore())
    monkeypatch.setattr(providers, "tenants_vivos", lambda: ["t1"])

    sched = DocyanScheduler(jobstore="memory")
    sched.register_default_jobs()
    out = sched.trigger("pcl_metrics_aggregation")
    sched.shutdown()

    assert out["evaluado"] is True
    assert out["procesados"] == 1
    assert out["fecha"] == ayer.isoformat()
    # La fila quedó materializada en el store.
    filas = metrics.store.consultar("t1", ayer, ayer)
    assert len(filas) == 1
    assert filas[0]["consultas_totales"] == 1
    assert filas[0]["consultas_cache_hit"] == 1


def test_trigger_sin_tenants_no_falla(monkeypatch):
    monkeypatch.setattr(providers, "tenants_vivos", lambda: [])
    sched = DocyanScheduler(jobstore="memory")
    sched.register_default_jobs()
    out = sched.trigger("pcl_metrics_aggregation")
    sched.shutdown()
    assert out["procesados"] == 0
