"""
Session Manager del Master Orchestrator (B4 §3 / §4, decisión #6).

DOCYAN LDE™ by XCID.

Sesiones vivas en Redis con TTL DIFERENCIADO por tipo y ventana DESLIZANTE (cada
update/transfer refresca el TTL). Al cerrarse, la sesión hace SPILLOVER a Supabase
(`sessions_completed`, migración 011) para análisis histórico y FAT.

TTLs exactos (doc 14):
  - consulta operativa:  30 minutos
  - troubleshooting:      2 horas
  - revisión:             8 horas
  - onboarding:          30 días

Testabilidad (patrón budget_manager/dispatcher): el almacén de sesiones y el
spillover son Protocols con backend en memoria (tests) y backend real (Redis /
Supabase) en producción. El reloj se inyecta para verificar TTL y expiración de
forma determinista, sin `time.sleep`.
"""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from app.orchestrator.models import Canal, SessionType

# ── TTLs por tipo de sesión (segundos) ────────────────────────────────────────

SESSION_TTLS: dict[SessionType, int] = {
    SessionType.consulta: 30 * 60,
    SessionType.troubleshooting: 2 * 60 * 60,
    SessionType.revision: 8 * 60 * 60,
    SessionType.onboarding: 30 * 24 * 60 * 60,
}


def ttl_for(session_type: SessionType) -> int:
    """TTL en segundos para un tipo de sesión."""
    return SESSION_TTLS[session_type]


# ── Estado de sesión ──────────────────────────────────────────────────────────


@dataclass
class SessionState:
    session_id: str
    tenant_id: str
    user_id: str | None
    session_type: str  # SessionType value
    canal: str  # Canal value
    started_at: str
    updated_at: str
    state: dict = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, raw: str) -> "SessionState":
        return cls(**json.loads(raw))


# ── Almacén de sesiones (Protocol + backends) ─────────────────────────────────


class SessionStore(Protocol):
    def put(self, session_id: str, raw: str, ttl: int) -> None: ...
    def get(self, session_id: str) -> str | None: ...
    def refresh(self, session_id: str, ttl: int) -> bool: ...
    def ttl(self, session_id: str) -> int | None: ...
    def delete(self, session_id: str) -> None: ...
    def active_ids(self) -> list[str]: ...
    def purge_expired(self) -> list[str]: ...


@dataclass
class InMemorySessionStore:
    """
    Almacén volátil con expiración simulada por reloj inyectable. NO producción.
    Cada entrada guarda (raw, expires_at_epoch, applied_ttl).
    """

    clock: Callable[[], float] = field(default_factory=lambda: _default_epoch)
    _rows: dict[str, tuple[str, float, int]] = field(default_factory=dict)

    def _now(self) -> float:
        return self.clock()

    def _is_expired(self, expires_at: float) -> bool:
        return self._now() >= expires_at

    def put(self, session_id: str, raw: str, ttl: int) -> None:
        self._rows[session_id] = (raw, self._now() + ttl, ttl)

    def get(self, session_id: str) -> str | None:
        row = self._rows.get(session_id)
        if row is None:
            return None
        raw, expires_at, _ttl = row
        if self._is_expired(expires_at):
            del self._rows[session_id]
            return None
        return raw

    def refresh(self, session_id: str, ttl: int) -> bool:
        row = self._rows.get(session_id)
        if row is None:
            return False
        raw, expires_at, _ttl = row
        if self._is_expired(expires_at):
            del self._rows[session_id]
            return False
        self._rows[session_id] = (raw, self._now() + ttl, ttl)
        return True

    def ttl(self, session_id: str) -> int | None:
        row = self._rows.get(session_id)
        if row is None:
            return None
        raw, expires_at, _ttl = row
        if self._is_expired(expires_at):
            del self._rows[session_id]
            return None
        return int(round(expires_at - self._now()))

    def delete(self, session_id: str) -> None:
        self._rows.pop(session_id, None)

    def active_ids(self) -> list[str]:
        # Excluye expiradas (sin borrarlas; purge_expired las elimina).
        return [sid for sid, (_r, exp, _t) in self._rows.items() if not self._is_expired(exp)]

    def purge_expired(self) -> list[str]:
        expiradas = [sid for sid, (_r, exp, _t) in self._rows.items() if self._is_expired(exp)]
        for sid in expiradas:
            del self._rows[sid]
        return expiradas


def _default_epoch() -> float:
    import time

    return time.time()


class RedisSessionStore:
    """
    Almacén real sobre Redis (decisión #6). El TTL nativo de Redis expira las
    sesiones automáticamente; mantenemos además un índice SET de sesiones activas
    para que el barrido de limpieza pueda detectar y descartar entradas colgadas.
    """

    KEY_PREFIX = "docyan:session:"
    INDEX_KEY = "docyan:sessions:active"

    def __init__(self, url: str | None = None, client: Any = None):
        self.url = url or os.getenv("REDIS_URL") or "redis://localhost:6379/0"
        self._client = client

    def _r(self):
        if self._client is None:
            import redis
            from app.cache.redis_client import (
                REDIS_SOCKET_CONNECT_TIMEOUT,
                REDIS_SOCKET_TIMEOUT,
            )

            # Socket timeouts (ED-0 §3.2): un recv estancado a Redis no puede
            # congelar el thread de sesiones/scheduler indefinidamente.
            self._client = redis.from_url(
                self.url,
                decode_responses=True,
                socket_timeout=REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=REDIS_SOCKET_CONNECT_TIMEOUT,
            )
        return self._client

    def _k(self, session_id: str) -> str:
        return self.KEY_PREFIX + session_id

    def put(self, session_id: str, raw: str, ttl: int) -> None:
        r = self._r()
        r.setex(self._k(session_id), ttl, raw)
        r.sadd(self.INDEX_KEY, session_id)

    def get(self, session_id: str) -> str | None:
        return self._r().get(self._k(session_id))

    def refresh(self, session_id: str, ttl: int) -> bool:
        return bool(self._r().expire(self._k(session_id), ttl))

    def ttl(self, session_id: str) -> int | None:
        t = self._r().ttl(self._k(session_id))
        # redis-py: -2 = no existe, -1 = sin expiración.
        return None if t is None or t < 0 else int(t)

    def delete(self, session_id: str) -> None:
        r = self._r()
        r.delete(self._k(session_id))
        r.srem(self.INDEX_KEY, session_id)

    def active_ids(self) -> list[str]:
        return list(self._r().smembers(self.INDEX_KEY))

    def purge_expired(self) -> list[str]:
        r = self._r()
        removed: list[str] = []
        for sid in list(r.smembers(self.INDEX_KEY)):
            if not r.exists(self._k(sid)):
                r.srem(self.INDEX_KEY, sid)
                removed.append(sid)
        return removed


# ── Spillover a Supabase (sesiones cerradas) ──────────────────────────────────


class SessionSpillover(Protocol):
    def save_completed(self, state: SessionState, closed_reason: str) -> None: ...
    def get_completed(self, session_id: str) -> dict | None: ...


@dataclass
class InMemorySessionSpillover:
    _rows: dict[str, dict] = field(default_factory=dict)

    def save_completed(self, state: SessionState, closed_reason: str) -> None:
        self._rows[state.session_id] = {
            "id": state.session_id,
            "tenant_id": state.tenant_id,
            "user_id": state.user_id,
            "session_type": state.session_type,
            "canal": state.canal,
            "started_at": state.started_at,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "state": state.state,
            "closed_reason": closed_reason,
        }

    def get_completed(self, session_id: str) -> dict | None:
        return self._rows.get(session_id)


class SupabaseSessionSpillover:
    """Persiste sesiones cerradas en `sessions_completed`. Usa SUPABASE_SERVICE_KEY."""

    TABLE = "sessions_completed"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            _url, _key = require_supabase_config("session_spillover", service=True)
            self._client = create_client(_url, _key)
        return self._client

    def save_completed(self, state: SessionState, closed_reason: str) -> None:
        self._sb().table(self.TABLE).upsert(
            {
                "id": state.session_id,
                "tenant_id": state.tenant_id,
                "user_id": state.user_id,
                "session_type": state.session_type,
                "canal": state.canal,
                "started_at": state.started_at,
                "closed_at": datetime.now(timezone.utc).isoformat(),
                "state": state.state,
                "closed_reason": closed_reason,
            },
            on_conflict="id",
        ).execute()

    def get_completed(self, session_id: str) -> dict | None:
        res = (
            self._sb()
            .table(self.TABLE)
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None


# ── Session Manager ───────────────────────────────────────────────────────────


class SessionManager:
    """Crea, lee, actualiza, transfiere y cierra sesiones (responsabilidad 4)."""

    def __init__(
        self,
        store: SessionStore | None = None,
        spillover: SessionSpillover | None = None,
        clock: Callable[[], datetime] | None = None,
    ):
        self.store = store or RedisSessionStore()
        self.spillover = spillover or SupabaseSessionSpillover()
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def _now_iso(self) -> str:
        return self._clock().isoformat()

    def create_session(
        self,
        tenant_id: str,
        user_id: str | None,
        session_type: SessionType,
        canal: Canal,
        initial_state: dict | None = None,
    ) -> str:
        session_id = uuid.uuid4().hex
        now = self._now_iso()
        state = SessionState(
            session_id=session_id,
            tenant_id=tenant_id,
            user_id=user_id,
            session_type=session_type.value,
            canal=canal.value,
            started_at=now,
            updated_at=now,
            state=dict(initial_state or {}),
        )
        self.store.put(session_id, state.to_json(), ttl_for(session_type))
        return session_id

    def get_session(self, session_id: str) -> SessionState | None:
        raw = self.store.get(session_id)
        return SessionState.from_json(raw) if raw else None

    def update_session(self, session_id: str, partial_state: dict) -> SessionState | None:
        """Mezcla `partial_state` en el estado y REFRESCA el TTL (sliding window)."""
        state = self.get_session(session_id)
        if state is None:
            return None
        state.state.update(partial_state or {})
        state.updated_at = self._now_iso()
        self.store.put(session_id, state.to_json(), ttl_for(SessionType(state.session_type)))
        return state

    def transfer_session(self, session_id: str, new_canal: Canal) -> SessionState | None:
        """Cambia el canal preservando el estado (WhatsApp ↔ PWA). Refresca TTL."""
        state = self.get_session(session_id)
        if state is None:
            return None
        state.canal = new_canal.value
        state.updated_at = self._now_iso()
        self.store.put(session_id, state.to_json(), ttl_for(SessionType(state.session_type)))
        return state

    def close_session(self, session_id: str, reason: str = "completed") -> dict | None:
        """Cierra la sesión: spillover a Supabase y borra de Redis."""
        state = self.get_session(session_id)
        if state is None:
            return None
        self.spillover.save_completed(state, reason)
        self.store.delete(session_id)
        return self.spillover.get_completed(session_id)

    def cleanup_expired(self) -> int:
        """Barre sesiones expiradas (tarea programada horaria). Devuelve cuántas."""
        return len(self.store.purge_expired())
