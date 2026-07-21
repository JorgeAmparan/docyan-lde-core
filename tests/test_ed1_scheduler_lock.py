"""
ED-1 §4.3 — Lock de liderazgo del scheduler: dos instancias, solo una ejecuta.
"""
from __future__ import annotations

from app.orchestrator.scheduler_lock import SchedulerLock


class FakeRedis:
    """Redis mínimo: `set(nx=,ex=)`, `get`, `delete` con semántica SET NX real."""

    def __init__(self):
        self.store: dict[str, str] = {}

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    def get(self, key):
        return self.store.get(key)

    def delete(self, key):
        self.store.pop(key, None)


def test_solo_una_instancia_adquiere():
    redis = FakeRedis()
    a = SchedulerLock(redis, instance_id="A")
    b = SchedulerLock(redis, instance_id="B")

    assert a.acquire() is True
    assert b.acquire() is False  # el líder ya tomó el lock
    assert a.held is True
    assert b.held is False


def test_renovacion_solo_del_dueno():
    redis = FakeRedis()
    a = SchedulerLock(redis, instance_id="A")
    b = SchedulerLock(redis, instance_id="B")
    a.acquire()
    assert a.renew() is True
    # B no es dueño → no puede renovar.
    assert b.renew() is False


def test_release_libera_y_permite_relevo():
    redis = FakeRedis()
    a = SchedulerLock(redis, instance_id="A")
    b = SchedulerLock(redis, instance_id="B")
    a.acquire()
    a.release()
    assert a.held is False
    # Con el lock liberado, el standby toma el relevo.
    assert b.acquire() is True


def test_release_no_borra_lock_ajeno():
    redis = FakeRedis()
    a = SchedulerLock(redis, instance_id="A")
    b = SchedulerLock(redis, instance_id="B")
    a.acquire()
    b.release()  # B no es dueño; no debe borrar el lock de A
    assert redis.get(a.key) == "A"
