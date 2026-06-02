"""
Tests del Session Manager del MO (B4 §3, decisión #6).

TTLs exactos, ventana deslizante, spillover a Supabase y limpieza de expiradas,
todo con almacén en memoria y reloj inyectable (sin time.sleep, determinista).
"""
from datetime import datetime, timezone

from app.orchestrator.models import Canal, SessionType
from app.orchestrator.session_manager import (
    SESSION_TTLS,
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
    ttl_for,
)


class Clock:
    """Reloj controlable para tests deterministas."""

    def __init__(self, t0: float = 1_000_000.0):
        self.t = t0

    def epoch(self) -> float:
        return self.t

    def dt(self) -> datetime:
        return datetime.fromtimestamp(self.t, tz=timezone.utc)

    def advance(self, segundos: float):
        self.t += segundos


def _mgr(clock: Clock):
    store = InMemorySessionStore(clock=clock.epoch)
    spill = InMemorySessionSpillover()
    mgr = SessionManager(store=store, spillover=spill, clock=clock.dt)
    return mgr, store, spill


def test_ttls_exactos_por_tipo():
    assert ttl_for(SessionType.consulta) == 30 * 60
    assert ttl_for(SessionType.troubleshooting) == 2 * 60 * 60
    assert ttl_for(SessionType.revision) == 8 * 60 * 60
    assert ttl_for(SessionType.onboarding) == 30 * 24 * 60 * 60
    assert set(SESSION_TTLS.keys()) == set(SessionType)


def test_create_aplica_ttl_del_tipo():
    clock = Clock()
    mgr, store, _ = _mgr(clock)
    sid = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa)
    assert store.ttl(sid) == 30 * 60
    sid2 = mgr.create_session("t1", "u1", SessionType.revision, Canal.pwa)
    assert store.ttl(sid2) == 8 * 60 * 60


def test_sliding_window_refresca_ttl_en_update():
    clock = Clock()
    mgr, store, _ = _mgr(clock)
    sid = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa)
    # Avanza 20 min (TTL restante = 10 min).
    clock.advance(20 * 60)
    assert store.ttl(sid) == 10 * 60
    # update refresca a TTL completo (sliding window).
    mgr.update_session(sid, {"paso": 2})
    assert store.ttl(sid) == 30 * 60
    assert mgr.get_session(sid).state["paso"] == 2


def test_expira_tras_ttl_sin_actividad():
    clock = Clock()
    mgr, store, _ = _mgr(clock)
    sid = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa)
    clock.advance(30 * 60 + 1)  # pasa el TTL
    assert mgr.get_session(sid) is None


def test_transfer_preserva_estado_y_cambia_canal():
    clock = Clock()
    mgr, _, _ = _mgr(clock)
    sid = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa,
                             initial_state={"contexto": "extintor-5"})
    state = mgr.transfer_session(sid, Canal.whatsapp)
    assert state.canal == Canal.whatsapp.value
    assert state.state["contexto"] == "extintor-5"  # estado preservado


def test_close_hace_spillover_y_borra_de_redis():
    clock = Clock()
    mgr, store, spill = _mgr(clock)
    sid = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa,
                             initial_state={"k": "v"})
    completed = mgr.close_session(sid, reason="finalizada")
    assert completed is not None
    assert completed["closed_reason"] == "finalizada"
    assert completed["state"] == {"k": "v"}
    assert completed["tenant_id"] == "t1"
    # Ya no está viva en Redis.
    assert mgr.get_session(sid) is None
    # Está en el spillover.
    assert spill.get_completed(sid)["session_type"] == "consulta"


def test_cleanup_elimina_expiradas():
    clock = Clock()
    mgr, store, _ = _mgr(clock)
    viva = mgr.create_session("t1", "u1", SessionType.revision, Canal.pwa)  # 8h
    expira = mgr.create_session("t1", "u1", SessionType.consulta, Canal.pwa)  # 30m
    clock.advance(31 * 60)  # expira la de consulta, no la de revisión
    eliminadas = mgr.cleanup_expired()
    assert eliminadas == 1
    assert mgr.get_session(expira) is None
    assert mgr.get_session(viva) is not None
