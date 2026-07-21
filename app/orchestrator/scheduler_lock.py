"""
Lock de liderazgo del scheduler (ED-1 §2.2.1).

DOCYAN LDE™ by XCID.

Guard para no duplicar la ejecución de jobs si corren 2+ máquinas de
`docyan-lde-api`: un lock Redis (`SET NX EX`, TTL renovable). Solo la instancia que
adquiere el lock ejecuta los jobs del scheduler; las demás quedan en standby y
reintentan adquirirlo (si el líder muere, el TTL expira y un standby toma el
relevo). Sin este guard, `evaluate_vencimientos` correría N veces y notificaría
por duplicado.

El objeto `redis` inyectado solo necesita `set(key, val, nx=, ex=)`, `get(key)` y
`delete(key)` — el cliente `redis-py` los cumple; los tests inyectan un fake.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

logger = logging.getLogger("docyan.scheduler.lock")

DEFAULT_LOCK_KEY = "docyan:scheduler:leader"
DEFAULT_TTL_SECONDS = 90


class SchedulerLock:
    def __init__(
        self,
        redis: Any,
        *,
        key: str = DEFAULT_LOCK_KEY,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        instance_id: str | None = None,
    ) -> None:
        self.redis = redis
        self.key = key
        self.ttl_seconds = ttl_seconds
        self.instance_id = instance_id or uuid.uuid4().hex
        self._held = False

    @property
    def held(self) -> bool:
        return self._held

    def acquire(self) -> bool:
        """Intenta tomar el liderazgo (atómico `SET NX EX`). True si lo obtuvo."""
        try:
            ok = bool(self.redis.set(self.key, self.instance_id, nx=True, ex=self.ttl_seconds))
        except Exception as exc:  # noqa: BLE001 — sin Redis, no hay liderazgo (standby).
            logger.warning("SchedulerLock.acquire falló: %s", type(exc).__name__)
            return False
        self._held = ok
        return ok

    def renew(self) -> bool:
        """Refresca el TTL solo si seguimos siendo el dueño. False si lo perdimos."""
        try:
            actual = self.redis.get(self.key)
            if actual == self.instance_id:
                self.redis.set(self.key, self.instance_id, ex=self.ttl_seconds)
                self._held = True
                return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("SchedulerLock.renew falló: %s", type(exc).__name__)
            return False
        self._held = False
        return False

    def release(self) -> None:
        """Libera el lock si somos el dueño (limpieza al shutdown)."""
        try:
            if self.redis.get(self.key) == self.instance_id:
                self.redis.delete(self.key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("SchedulerLock.release falló: %s", type(exc).__name__)
        finally:
            self._held = False
