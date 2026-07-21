"""
Centro de notificaciones in-app (ED-1 §2.4.2).

DOCYAN LDE™ by XCID.

Canal in-app del motor de notificación. Persiste una fila por notificación al
destinatario interno (usuario del tenant). Endpoints (router `/notificaciones`):
listar no leídas/todas paginado, marcar leída, marcar todas. La campana UI es ED-4.

Tabla Supabase `notificaciones` (migración 024). Tests inyectan
`InMemoryNotificacionInAppStore`.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class NotificacionInApp:
    org_id: str
    tipo_evento: str
    titulo: str
    cuerpo: str
    usuario_id: str | None = None
    evento_ref: str | None = None
    destinatario_id: str | None = None
    canal: str = "in_app"
    leida: bool = False
    estado: str = "enviada"  # enviada | leida | fallida
    error: str | None = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    created_at: str = field(default_factory=_now_iso)
    leida_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "org_id": self.org_id,
            "usuario_id": self.usuario_id,
            "tipo_evento": self.tipo_evento,
            "evento_ref": self.evento_ref,
            "destinatario_id": self.destinatario_id,
            "canal": self.canal,
            "titulo": self.titulo,
            "cuerpo": self.cuerpo,
            "leida": self.leida,
            "estado": self.estado,
            "error": self.error,
            "created_at": self.created_at,
            "leida_at": self.leida_at,
        }


class NotificacionInAppStore(Protocol):
    def crear(self, n: NotificacionInApp) -> NotificacionInApp: ...
    def listar(self, org_id: str, usuario_id: str | None, *, solo_no_leidas: bool = False,
               limit: int = 50, offset: int = 0) -> list[NotificacionInApp]: ...
    def contar_no_leidas(self, org_id: str, usuario_id: str | None) -> int: ...
    def marcar_leida(self, org_id: str, notif_id: str) -> NotificacionInApp | None: ...
    def marcar_todas(self, org_id: str, usuario_id: str | None) -> int: ...
    def marcar_estado(self, org_id: str, notif_id: str, estado: str, error: str | None = None) -> None: ...
    def listar_admin(self, org_id: str, *, estado: str | None = None,
                     limit: int = 100) -> list[NotificacionInApp]: ...


@dataclass
class InMemoryNotificacionInAppStore:
    _items: dict[str, NotificacionInApp] = field(default_factory=dict)

    def crear(self, n: NotificacionInApp) -> NotificacionInApp:
        self._items[n.id] = n
        return n

    def _scope(self, org_id: str, usuario_id: str | None) -> list[NotificacionInApp]:
        out = [n for n in self._items.values() if n.org_id == org_id]
        if usuario_id is not None:
            out = [n for n in out if n.usuario_id == usuario_id]
        return sorted(out, key=lambda n: n.created_at, reverse=True)

    def listar(self, org_id, usuario_id, *, solo_no_leidas=False, limit=50, offset=0):
        out = self._scope(org_id, usuario_id)
        if solo_no_leidas:
            out = [n for n in out if not n.leida]
        return out[offset: offset + limit]

    def contar_no_leidas(self, org_id, usuario_id) -> int:
        return sum(1 for n in self._scope(org_id, usuario_id) if not n.leida)

    def marcar_leida(self, org_id, notif_id) -> NotificacionInApp | None:
        n = self._items.get(notif_id)
        if n is None or n.org_id != org_id:
            return None
        n.leida = True
        if n.estado != "fallida":
            n.estado = "leida"
        n.leida_at = _now_iso()
        return n

    def marcar_todas(self, org_id, usuario_id) -> int:
        count = 0
        for n in self._scope(org_id, usuario_id):
            if not n.leida:
                n.leida = True
                if n.estado != "fallida":
                    n.estado = "leida"
                n.leida_at = _now_iso()
                count += 1
        return count

    def marcar_estado(self, org_id, notif_id, estado, error=None) -> None:
        n = self._items.get(notif_id)
        if n is None or n.org_id != org_id:
            return
        n.estado = estado
        if error is not None:
            n.error = error

    def listar_admin(self, org_id, *, estado=None, limit=100) -> list[NotificacionInApp]:
        out = self._scope(org_id, None)
        if estado is not None:
            out = [n for n in out if n.estado == estado]
        return out[:limit]


class SupabaseNotificacionInAppStore:
    """Almacén de producción sobre la tabla `notificaciones` (service_role)."""

    def __init__(self, client: Any = None) -> None:
        self._sb = client

    def sb(self) -> Any:
        if self._sb is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("notificaciones", service=True)
            self._sb = create_client(url, key)
        return self._sb

    @staticmethod
    def _row(r: dict) -> NotificacionInApp:
        return NotificacionInApp(
            id=r["id"],
            org_id=r["org_id"],
            usuario_id=r.get("usuario_id"),
            tipo_evento=r["tipo_evento"],
            evento_ref=r.get("evento_ref"),
            destinatario_id=r.get("destinatario_id"),
            canal=r.get("canal") or "in_app",
            titulo=r["titulo"],
            cuerpo=r["cuerpo"],
            leida=bool(r.get("leida", False)),
            estado=r.get("estado") or "enviada",
            error=r.get("error"),
            created_at=r.get("created_at") or _now_iso(),
            leida_at=r.get("leida_at"),
        )

    def crear(self, n: NotificacionInApp) -> NotificacionInApp:
        payload = n.to_dict()
        payload.pop("id", None)
        res = self.sb().table("notificaciones").insert(payload).execute()
        return self._row(res.data[0])

    def listar(self, org_id, usuario_id, *, solo_no_leidas=False, limit=50, offset=0):
        q = self.sb().table("notificaciones").select("*").eq("org_id", org_id)
        if usuario_id is not None:
            q = q.eq("usuario_id", usuario_id)
        if solo_no_leidas:
            q = q.eq("leida", False)
        res = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return [self._row(r) for r in (res.data or [])]

    def contar_no_leidas(self, org_id, usuario_id) -> int:
        q = (
            self.sb()
            .table("notificaciones")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .eq("leida", False)
        )
        if usuario_id is not None:
            q = q.eq("usuario_id", usuario_id)
        res = q.execute()
        return int(res.count or 0)

    def marcar_leida(self, org_id, notif_id) -> NotificacionInApp | None:
        res = (
            self.sb()
            .table("notificaciones")
            .update({"leida": True, "estado": "leida", "leida_at": _now_iso()})
            .eq("org_id", org_id)
            .eq("id", notif_id)
            .neq("estado", "fallida")
            .execute()
        )
        return self._row(res.data[0]) if res.data else None

    def marcar_todas(self, org_id, usuario_id) -> int:
        q = (
            self.sb()
            .table("notificaciones")
            .update({"leida": True, "estado": "leida", "leida_at": _now_iso()})
            .eq("org_id", org_id)
            .eq("leida", False)
            .neq("estado", "fallida")
        )
        if usuario_id is not None:
            q = q.eq("usuario_id", usuario_id)
        res = q.execute()
        return len(res.data or [])

    def marcar_estado(self, org_id, notif_id, estado, error=None) -> None:
        payload: dict[str, Any] = {"estado": estado, "updated_at": _now_iso()}
        if error is not None:
            payload["error"] = error
        (
            self.sb()
            .table("notificaciones")
            .update(payload)
            .eq("org_id", org_id)
            .eq("id", notif_id)
            .execute()
        )

    def listar_admin(self, org_id, *, estado=None, limit=100) -> list[NotificacionInApp]:
        q = self.sb().table("notificaciones").select("*").eq("org_id", org_id)
        if estado is not None:
            q = q.eq("estado", estado)
        res = q.order("created_at", desc=True).limit(limit).execute()
        return [self._row(r) for r in (res.data or [])]
