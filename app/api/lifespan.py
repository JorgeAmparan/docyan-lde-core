"""
Lifespan de la app FastAPI — arranque del scheduler bajo lock de liderazgo (ED-1 §2.2).

DOCYAN LDE™ by XCID.

Al startup: si `DOCYAN_ENABLE_SCHEDULER=1`, intenta tomar el lock Redis de líder
(`SchedulerLock`). Si lo obtiene, instancia `DocyanScheduler`, registra las tareas
y arranca; además lanza un hilo daemon que renueva el lock periódicamente. Si NO lo
obtiene, queda en standby y un hilo daemon reintenta adquirirlo (si el líder muere,
el TTL expira y el standby toma el relevo). Al shutdown: detiene el scheduler limpio
y libera el lock.

El flag está APAGADO por defecto para que los tests (TestClient dispara el lifespan)
y los procesos que no deben programar (worker, CI) no arranquen APScheduler. En Fly,
`docyan-lde-api` lo enciende (`DOCYAN_ENABLE_SCHEDULER=1`). Todo el arranque está
envuelto en try/except: un fallo del scheduler NUNCA impide servir `/health`.
"""
from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager

from app.orchestrator.scheduler_lock import DEFAULT_TTL_SECONDS, SchedulerLock

logger = logging.getLogger("docyan.api.lifespan")


def _scheduler_habilitado() -> bool:
    return os.getenv("DOCYAN_ENABLE_SCHEDULER", "0").lower() in ("1", "true", "yes")


class SchedulerSupervisor:
    """Coordina lock de líder + ciclo de vida de `DocyanScheduler` en un hilo daemon."""

    def __init__(self, *, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        self.ttl_seconds = ttl_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._scheduler = None
        self._lock: SchedulerLock | None = None

    # ── Arranque / parada ─────────────────────────────────────────────────────
    def start(self) -> None:
        try:
            from app.cache.redis_client import redis_client

            self._lock = SchedulerLock(redis_client.raw(), ttl_seconds=self.ttl_seconds)
        except Exception as exc:  # noqa: BLE001 — sin Redis no hay scheduler, pero la app sirve.
            logger.warning("scheduler no arrancado (sin lock Redis): %s", type(exc).__name__)
            return
        self._thread = threading.Thread(target=self._run, name="docyan-scheduler-supervisor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self._detener_scheduler()
        if self._lock is not None:
            self._lock.release()

    # ── Bucle del supervisor ──────────────────────────────────────────────────
    def _run(self) -> None:
        # Periodo de sondeo/renovación: mitad del TTL (renueva antes de expirar).
        periodo = max(5, self.ttl_seconds // 2)
        while not self._stop.is_set():
            try:
                if self._scheduler is None:
                    if self._lock and self._lock.acquire():
                        self._iniciar_scheduler()
                        logger.info("scheduler: liderazgo adquirido, tareas registradas y arrancadas.")
                    else:
                        logger.debug("scheduler: en standby (otra instancia es líder).")
                else:
                    if self._lock and not self._lock.renew():
                        logger.warning("scheduler: liderazgo perdido; deteniendo tareas (standby).")
                        self._detener_scheduler()
            except Exception as exc:  # noqa: BLE001 — el supervisor nunca tumba el proceso.
                logger.warning("scheduler supervisor: %s", type(exc).__name__)
            self._stop.wait(periodo)

    def _iniciar_scheduler(self) -> None:
        from app.orchestrator.scheduler import DocyanScheduler

        sched = DocyanScheduler(jobstore="redis")
        sched.register_default_jobs()
        sched.start()
        self._scheduler = sched

    def _detener_scheduler(self) -> None:
        if self._scheduler is not None:
            try:
                self._scheduler.shutdown(wait=False)
            except Exception:  # noqa: BLE001
                pass
            self._scheduler = None


_supervisor: SchedulerSupervisor | None = None


@asynccontextmanager
async def lifespan(app):
    """Lifespan de FastAPI: arranca/detiene el supervisor del scheduler."""
    global _supervisor
    if _scheduler_habilitado():
        _supervisor = SchedulerSupervisor()
        try:
            _supervisor.start()
        except Exception as exc:  # noqa: BLE001 — nunca bloquea el arranque de la API.
            logger.warning("no se pudo arrancar el supervisor del scheduler: %s", type(exc).__name__)
    else:
        logger.info("scheduler deshabilitado (DOCYAN_ENABLE_SCHEDULER != 1).")
    try:
        yield
    finally:
        if _supervisor is not None:
            _supervisor.stop()
            _supervisor = None
