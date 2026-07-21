"""
Scheduler proactivo del MO (B4 §1 responsabilidad 8 / §4, decisión #3).

DOCYAN LDE™ by XCID.

APScheduler con backend Redis (JobStore) es el ÚNICO punto de programación
temporal del sistema: ningún componente debe usar `cron` directo, threads con
sleep, ni `time.sleep` en loops. El scheduler corre en el backend
`docyan-lde-api` (no en el worker).

Las FUNCIONES de las tareas son de nivel de módulo (serializables por
RedisJobStore) y resuelven sus dependencias vía `app.orchestrator.providers`, que
los tests sobreescriben con backends en memoria. Para ejecución determinista en
tests, `DocyanScheduler.trigger(job_id)` corre la tarea sincrónicamente ("tiempo
simulado") sin esperar el reloj real.

APScheduler se importa de forma perezosa: importar este módulo NO requiere tener
apscheduler salvo que se construya un DocyanScheduler.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("docyan.scheduler")


# ── Funciones de las tareas (nivel de módulo → serializables) ─────────────────


def cleanup_expired_sessions_job() -> int:
    """Barre sesiones expiradas (cada hora). Devuelve cuántas se eliminaron."""
    from app.orchestrator import providers

    eliminadas = providers.get_session_manager().cleanup_expired()
    logger.info("cleanup_expired_sessions: %d sesiones expiradas eliminadas", eliminadas)
    return eliminadas


def evaluate_vencimientos_job() -> dict:
    """
    Evalúa vencimientos administrativos (Tipo 7 — SOLO administrativos, línea
    ABSOLUTA CLAUDE.md §11.1). Diario (cron 6am). ED-1: barrido REAL sobre el grafo
    de cada tenant (`:CertificadoVigencia`/`:CertificadoCalibracion`/
    `:FechaVencimiento`) evaluando los thresholds de su `ReglaAlerta` y creando/
    notificando `:Alerta` al cruzar una banda (idempotente por threshold). Incluye la
    escalación automática. Registra FAT de la corrida (familia F10).
    """
    from app.alerts.barrido import evaluar_vencimientos_todos

    return evaluar_vencimientos_todos()


def mantenimiento_indices_job() -> dict:
    """Mantenimiento de índices vectoriales del DKG (semanal). Placeholder B14."""
    logger.info("mantenimiento_indices: placeholder (lógica completa en B14)")
    return {"evaluado": True, "tipo": "mantenimiento_indices"}


def reportes_pms_job() -> dict:
    """Reportes periódicos a PMs (semanal). Interfaz; contenido en B13."""
    logger.info("reportes_pms: interfaz lista (contenido en B13)")
    return {"evaluado": True, "tipo": "reportes_pms"}


def patrones_edb_job() -> dict:
    """
    `evaluacion_patrones_edb_para_n3` (diaria) — Nivel C de Playbooks (B8 §B3).

    Recorre los tenants vivos y, por usuario, evalúa la COMPUERTA DE TRES SEÑALES
    (estructural + conductual + permiso) sobre sus consultas guardadas + disparos,
    emitiendo `sugerencias_playbook` cuando se cumple. La interfaz la dejó B4; B8
    le pone contenido real (no stub). Los tenants sin patrones no generan nada.
    """
    from app.orchestrator import providers

    servicios = providers.get_playbook_services()
    sugerencias = servicios["sugerencias"]
    tenants = providers.tenants_vivos()
    total = 0
    for tenant_id in tenants:
        try:
            total += len(sugerencias.evaluar_tenant(tenant_id))
        except Exception as exc:  # noqa: BLE001 — un tenant no debe tumbar el barrido.
            logger.warning("patrones_edb: tenant %s falló: %s", tenant_id, type(exc).__name__)
    logger.info(
        "patrones_edb: %d tenant(s) evaluados, %d sugerencia(s) generadas", len(tenants), total
    )
    return {
        "evaluado": True,
        "tipo": "patrones_edb",
        "tarea": "evaluacion_patrones_edb_para_n3",
        "tenants": len(tenants),
        "sugerencias_generadas": total,
    }


def pcl_metrics_aggregation_job() -> dict:
    """
    `pcl_metrics_aggregation` (diaria, 03:00h) — agrega las métricas CCP/PCL del
    día anterior por DoCo (B8.5 §6, doc §7.2). Lee eventos FAT F4 `consulta_servida`
    y materializa `pcl_metrics_daily`. Un DoCo que falla no tumba el barrido.
    """
    from datetime import datetime, timedelta, timezone

    from app.orchestrator import providers

    metrics = providers.get_pcl_metrics()
    playbooks = providers.get_playbook_store()
    tenants = providers.tenants_vivos()
    # UTC: los timestamps del FAT son UTC; el "día anterior" debe medirse en UTC
    # para no perder/duplicar eventos en el cruce de medianoche local.
    fecha_ayer = datetime.now(timezone.utc).date() - timedelta(days=1)
    procesados = 0
    for tenant_id in tenants:
        try:
            metrics.agregar_diario(tenant_id, fecha_ayer, sugerencias_store=playbooks)
            procesados += 1
        except Exception as exc:  # noqa: BLE001 — un DoCo no debe tumbar el barrido.
            logger.warning(
                "pcl_metrics_aggregation: tenant %s falló: %s", tenant_id, type(exc).__name__
            )
    logger.info(
        "pcl_metrics_aggregation: %d/%d DoCo(s) agregados para %s",
        procesados, len(tenants), fecha_ayer,
    )
    return {
        "evaluado": True,
        "tipo": "pcl_metrics_aggregation",
        "fecha": fecha_ayer.isoformat(),
        "tenants": len(tenants),
        "procesados": procesados,
    }


def cupo_reposicion_mensual_job() -> dict:
    """
    Reposición mensual del cupo de ingestas recurrente (F3 §C — día 1 de cada mes).

    Suma el `cupo_recurrente_mensual` al `cupo_restante` de cada org con cupo, sin
    pasar del techo (`cupo_inicial`). Lo ejecuta la RPC `cupo_reponer_mensual` de la
    migración 021 (atómica). Las orgs sin cupo recurrente (freemium / enterprise sin
    configurar) no se tocan.
    """
    from app.ingesta.quota_manager import QuotaManager

    repuestas = QuotaManager().reponer_mensual()
    logger.info("cupo_reposicion_mensual: %d org(s) repuestas", repuestas)
    return {"evaluado": True, "tipo": "cupo_reposicion_mensual", "orgs_repuestas": repuestas}


def fat_retention_job() -> dict:
    """
    Rutina de retención del FAT por familia (decisión #12 / doc 08, B7).

    Punto de EJECUCIÓN programada (semanal). La lógica de retención es real y
    está en `app/audit/retention.py` (backup verificado ANTES de eliminar). Los
    tenants a barrer y el destino de backup los provee
    `providers.get_retention_plan()` — seam de integración con la infraestructura
    (igual que `evaluate_vencimientos` obtiene sus reglas de EDB/AIM). Sin tenants
    configurados, no elimina nada.
    """
    from app.audit.retention import aplicar_retencion
    from app.orchestrator import providers

    fat, backup, tenants = providers.get_retention_plan()
    resultados = []
    for tenant_id in tenants:
        res = aplicar_retencion(fat, tenant_id, backup=backup)
        resultados.append(res.to_dict())
    logger.info("fat_retention: %d tenant(s) barridos", len(resultados))
    return {"evaluado": True, "tipo": "fat_retention", "resultados": resultados}


@dataclass(frozen=True)
class JobSpec:
    job_id: str
    func: object
    trigger: str
    trigger_kwargs: dict


# Tareas iniciales (configurables por tenant en B7+). Triggers conservadores.
DEFAULT_JOBS: tuple[JobSpec, ...] = (
    JobSpec("cleanup_expired_sessions", cleanup_expired_sessions_job, "interval", {"hours": 1}),
    JobSpec("evaluate_vencimientos", evaluate_vencimientos_job, "cron", {"hour": 6}),
    JobSpec("mantenimiento_indices", mantenimiento_indices_job, "cron", {"day_of_week": "sun", "hour": 3}),
    JobSpec("reportes_pms", reportes_pms_job, "cron", {"day_of_week": "mon", "hour": 7}),
    JobSpec("patrones_edb", patrones_edb_job, "cron", {"hour": 5}),
    JobSpec("fat_retention", fat_retention_job, "cron", {"day_of_week": "sun", "hour": 4}),
    JobSpec("pcl_metrics_aggregation", pcl_metrics_aggregation_job, "cron", {"hour": 3}),
    # F3 §C: reposición del cupo de ingestas el día 1 de cada mes a las 00:00.
    JobSpec("cupo_reposicion_mensual", cupo_reposicion_mensual_job, "cron", {"day": 1, "hour": 0}),
)


class DocyanScheduler:
    """Ciclo de vida de APScheduler + registro de las tareas del MO."""

    def __init__(self, jobstore: str = "redis", redis_url: str | None = None, scheduler=None):
        """
        jobstore: "redis" (producción, decisión #3) o "memory" (tests/dev).
        """
        self.jobstore_kind = jobstore
        self.redis_url = redis_url or os.getenv("REDIS_URL") or "redis://localhost:6379/0"
        self._scheduler = scheduler
        self._funcs: dict[str, object] = {}

    def _build_scheduler(self):
        from apscheduler.schedulers.background import BackgroundScheduler

        if self.jobstore_kind == "redis":
            from urllib.parse import urlparse

            from apscheduler.jobstores.redis import RedisJobStore

            parsed = urlparse(self.redis_url)
            store = RedisJobStore(
                host=parsed.hostname or "localhost",
                port=parsed.port or 6379,
                db=int((parsed.path or "/0").lstrip("/") or 0),
            )
        else:
            from apscheduler.jobstores.memory import MemoryJobStore

            store = MemoryJobStore()

        return BackgroundScheduler(jobstores={"default": store})

    @property
    def scheduler(self):
        if self._scheduler is None:
            self._scheduler = self._build_scheduler()
        return self._scheduler

    def register_default_jobs(self) -> list[str]:
        """Registra las tareas iniciales. Idempotente (replace_existing)."""
        registrados: list[str] = []
        for spec in DEFAULT_JOBS:
            self._funcs[spec.job_id] = spec.func
            self.scheduler.add_job(
                spec.func,
                trigger=spec.trigger,
                id=spec.job_id,
                replace_existing=True,
                **spec.trigger_kwargs,
            )
            registrados.append(spec.job_id)
        return registrados

    def trigger(self, job_id: str):
        """
        Ejecuta una tarea SINCRÓNICAMENTE (tiempo simulado para tests/operación
        manual). Usa la función registrada; no espera al trigger temporal.
        """
        func = self._funcs.get(job_id)
        if func is None:
            job = self.scheduler.get_job(job_id)
            func = job.func if job is not None else None
        if func is None:
            raise KeyError(f"Tarea desconocida: {job_id}")
        return func()

    def job_ids(self) -> list[str]:
        return [j.id for j in self.scheduler.get_jobs()]

    def start(self) -> None:
        self.scheduler.start()

    def shutdown(self, wait: bool = False) -> None:
        if self._scheduler is not None and self._scheduler.running:
            self._scheduler.shutdown(wait=wait)
