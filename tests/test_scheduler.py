"""
Tests del scheduler proactivo del MO (B4 §4, decisión #3).

Usa MemoryJobStore (no Redis) y ejecuta las tareas en "tiempo simulado" vía
trigger() — sin esperar el reloj real. La tarea de limpieza se verifica
sobreescribiendo el provider del SessionManager por uno en memoria.
"""
import pytest

from app.orchestrator import providers
from app.orchestrator.models import Canal, SessionType
from app.orchestrator.scheduler import DEFAULT_JOBS, DocyanScheduler
from app.orchestrator.session_manager import (
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
)


def test_registra_tareas_iniciales():
    sched = DocyanScheduler(jobstore="memory")
    ids = sched.register_default_jobs()
    esperados = {spec.job_id for spec in DEFAULT_JOBS}
    assert set(ids) == esperados
    assert set(sched.job_ids()) == esperados
    assert "cleanup_expired_sessions" in ids
    sched.shutdown()


def test_cleanup_job_elimina_sesiones_expiradas(monkeypatch):
    # Reloj controlable compartido por el store del SessionManager.
    estado = {"t": 1_000_000.0}
    store = InMemorySessionStore(clock=lambda: estado["t"])
    mgr = SessionManager(store=store, spillover=InMemorySessionSpillover())

    # El provider que usa la tarea de módulo devuelve ESTE manager en memoria.
    monkeypatch.setattr(providers, "get_session_manager", lambda: mgr)

    sid = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa)  # TTL 30m
    estado["t"] += 31 * 60  # la sesión expira

    sched = DocyanScheduler(jobstore="memory")
    sched.register_default_jobs()
    eliminadas = sched.trigger("cleanup_expired_sessions")  # ejecuta en tiempo simulado
    assert eliminadas == 1
    assert mgr.get_session(sid) is None
    sched.shutdown()


def test_tareas_interfaz_ejecutan_sin_error():
    sched = DocyanScheduler(jobstore="memory")
    sched.register_default_jobs()
    for jid in ("evaluate_vencimientos", "mantenimiento_indices", "reportes_pms", "patrones_edb"):
        out = sched.trigger(jid)
        assert out["evaluado"] is True
    sched.shutdown()


def test_trigger_tarea_desconocida():
    sched = DocyanScheduler(jobstore="memory")
    sched.register_default_jobs()
    with pytest.raises(KeyError):
        sched.trigger("no_existe")
    sched.shutdown()
