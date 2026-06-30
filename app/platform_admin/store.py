"""
Capa de datos del Super-Admin de Plataforma (F2).

`PlatformStore` abstrae TODO el acceso a datos de plataforma para que los tests
inyecten `InMemoryPlatformStore` (sin Supabase) y producción use
`SupabasePlatformStore` (service_role, bypassa RLS; el aislamiento metadata/contenido
lo garantiza que estas consultas SOLO leen conteos/estados, NUNCA contenido).

Las orgs se DERIVAN de `users.org_id` (no hay tabla `orgs`), enriquecidas con la
fila de `org_billing` (registro de plataforma) cuando existe.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Protocol


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return uuid.uuid4().hex


class PlatformStore(Protocol):
    # ── platform_admins ───────────────────────────────────────────────────────
    def get_admin_by_email(self, email: str) -> dict | None: ...
    def create_admin(self, email: str, password_hash: str, name: str | None) -> dict: ...

    # ── orgs (derivadas) + org_billing ────────────────────────────────────────
    def list_orgs(self) -> list[dict]: ...
    def count_users(self, org_id: str) -> int: ...
    def count_documents(self, org_id: str) -> int: ...
    def sum_storage_bytes(self, org_id: str) -> int: ...
    def total_storage_bytes(self) -> int: ...
    def sum_consultas(self, org_id: str) -> int: ...
    def list_consultas_daily(self) -> list[dict]: ...  # {fecha, consultas_totales} cross-org
    def get_org_billing(self, org_id: str) -> dict | None: ...
    def upsert_org_billing(self, org_id: str, **fields: Any) -> dict: ...
    def total_orgs(self) -> int: ...
    def total_users(self) -> int: ...

    # ── provisión de org (canje) ──────────────────────────────────────────────
    def email_exists(self, email: str) -> bool: ...
    def org_has_users(self, org_id: str) -> bool: ...
    def create_user(self, org_id: str, email: str, password_hash: str, name: str, role: str) -> dict: ...
    def get_user_by_email(self, email: str) -> dict | None: ...
    def list_org_users(self, org_id: str) -> list[dict]: ...

    # ── orgs (entidad de primer nivel, B13) ───────────────────────────────────
    def create_org(self, org_id: str, **fields: Any) -> dict: ...
    def get_org(self, org_id: str) -> dict | None: ...
    def update_org(self, org_id: str, **fields: Any) -> dict: ...

    # ── invitations (B13) ─────────────────────────────────────────────────────
    def create_invitation(self, row: dict) -> dict: ...
    def get_invitation(self, invitation_id: str) -> dict | None: ...
    def get_invitation_by_token_hash(self, token_hash: str) -> dict | None: ...
    def list_invitations(self, org_id: str, status: str | None = None) -> list[dict]: ...
    def update_invitation(self, invitation_id: str, **fields: Any) -> dict: ...

    # ── access_codes ──────────────────────────────────────────────────────────
    def create_access_code(self, row: dict) -> dict: ...
    def list_access_codes(self) -> list[dict]: ...
    def get_access_code(self, code: str) -> dict | None: ...
    def update_access_code(self, code: str, **fields: Any) -> dict: ...

    # ── manual_payments ───────────────────────────────────────────────────────
    def create_payment(self, row: dict) -> dict: ...
    def list_payments(self, org_id: str | None = None, desde: str | None = None) -> list[dict]: ...

    # ── support ───────────────────────────────────────────────────────────────
    def create_thread(self, row: dict) -> dict: ...
    def get_thread(self, thread_id: str) -> dict | None: ...
    def update_thread(self, thread_id: str, **fields: Any) -> dict: ...
    def list_threads(self, org_id: str | None = None) -> list[dict]: ...
    def add_message(self, row: dict) -> dict: ...
    def list_messages(self, thread_id: str) -> list[dict]: ...


# ════════════════════════════════════════════════════════════════════════════
# Backend EN MEMORIA (tests / dev)
# ════════════════════════════════════════════════════════════════════════════


class InMemoryPlatformStore:
    """
    Almacén en memoria para tests. Se puede sembrar con users/documents/budget/
    consultas de varias orgs para ejercitar las métricas sin Supabase ni FalkorDB.
    """

    def __init__(self) -> None:
        self.admins: list[dict] = []
        self.org_billing: dict[str, dict] = {}
        self.access_codes: list[dict] = []
        self.payments: list[dict] = []
        self.threads: dict[str, dict] = {}
        self.messages: list[dict] = []
        # Datos de tenant para derivar métricas (sembrados por el test).
        self.users: list[dict] = []        # {id, org_id, email, created_at, role}
        self.documents: list[dict] = []    # {id, org_id}
        self.consultas: dict[str, int] = {}  # org_id -> total consultas
        self.pcl_daily: list[dict] = []  # {tenant_id, fecha, consultas_totales} (series)
        self.orgs: dict[str, dict] = {}      # org_id -> org dict (B13)
        self.invitations: list[dict] = []    # invitaciones (B13)

    # admins
    def get_admin_by_email(self, email: str) -> dict | None:
        return next((a for a in self.admins if a["email"] == email), None)

    def create_admin(self, email: str, password_hash: str, name: str | None) -> dict:
        a = {"id": _uid(), "email": email, "password_hash": password_hash,
             "name": name, "is_active": True, "created_at": _now()}
        self.admins.append(a)
        return a

    # orgs
    def _org_ids(self) -> list[str]:
        return sorted({u["org_id"] for u in self.users} | set(self.org_billing))

    def list_orgs(self) -> list[dict]:
        out = []
        for org_id in self._org_ids():
            users = [u for u in self.users if u["org_id"] == org_id]
            created = min((u.get("created_at") for u in users), default=None)
            b = self.org_billing.get(org_id, {})
            out.append({
                "org_id": org_id,
                "users": len(users),
                "created_at": created or b.get("created_at"),
                "display_name": b.get("display_name"),
                "plan": b.get("plan", "piloto"),
                "lifecycle_status": b.get("lifecycle_status", "active"),
            })
        return out

    def count_users(self, org_id: str) -> int:
        return sum(1 for u in self.users if u["org_id"] == org_id)

    def count_documents(self, org_id: str) -> int:
        return sum(1 for d in self.documents if d["org_id"] == org_id)

    def sum_storage_bytes(self, org_id: str) -> int:
        return sum(
            int(d.get("size_bytes") or 0)
            for d in self.documents
            if d["org_id"] == org_id
        )

    def total_storage_bytes(self) -> int:
        return sum(int(d.get("size_bytes") or 0) for d in self.documents)

    def sum_consultas(self, org_id: str) -> int:
        return int(self.consultas.get(org_id, 0))

    def list_consultas_daily(self) -> list[dict]:
        return [
            {"fecha": r.get("fecha"), "consultas_totales": int(r.get("consultas_totales", 0))}
            for r in self.pcl_daily
        ]

    def get_org_billing(self, org_id: str) -> dict | None:
        return self.org_billing.get(org_id)

    def upsert_org_billing(self, org_id: str, **fields: Any) -> dict:
        row = self.org_billing.get(org_id, {
            "org_id": org_id, "display_name": None, "plan": "piloto",
            "lifecycle_status": "active", "next_billing_date": None,
            "created_at": _now(),
        })
        row.update({k: v for k, v in fields.items() if v is not None})
        row["updated_at"] = _now()
        self.org_billing[org_id] = row
        return row

    def total_orgs(self) -> int:
        return len(self._org_ids())

    def total_users(self) -> int:
        return len(self.users)

    # provisión
    def email_exists(self, email: str) -> bool:
        return any(u["email"] == email for u in self.users)

    def org_has_users(self, org_id: str) -> bool:
        return any(u["org_id"] == org_id for u in self.users)

    def create_user(self, org_id, email, password_hash, name, role) -> dict:
        u = {"id": _uid(), "org_id": org_id, "email": email,
             "password_hash": password_hash, "name": name, "role": role,
             "is_active": True, "created_at": _now()}
        self.users.append(u)
        return u

    def get_user_by_email(self, email: str) -> dict | None:
        return next((u for u in self.users if u["email"] == email), None)

    def list_org_users(self, org_id: str) -> list[dict]:
        return [u for u in self.users if u["org_id"] == org_id]

    # orgs (B13)
    def create_org(self, org_id: str, **fields: Any) -> dict:
        row = {
            "id": org_id, "nombre": None, "banda_mercado": "A", "idioma": "es",
            "lifecycle_status": "active", "plan": "freemium", "doc_limit": None,
            "freemium_inicio": None, "freemium_expira": None,
            "criticidad_segmento": None, "fase2_completada": False,
            "created_at": _now(), "updated_at": _now(),
        }
        row.update({k: v for k, v in fields.items() if v is not None})
        self.orgs[org_id] = row
        return row

    def get_org(self, org_id: str) -> dict | None:
        return self.orgs.get(org_id)

    def update_org(self, org_id: str, **fields: Any) -> dict:
        row = self.orgs.get(org_id)
        if row is None:
            raise KeyError(org_id)
        # None es un valor válido al actualizar (p.ej. limpiar ventana freemium):
        # aquí sí se aplican (a diferencia de create, que ignora None para defaults).
        row.update(fields)
        row["updated_at"] = _now()
        return row

    # invitations (B13)
    def create_invitation(self, row: dict) -> dict:
        row = {"id": _uid(), "status": "pending", "created_at": _now(),
               "accepted_at": None, "accepted_user_id": None, **row}
        self.invitations.append(row)
        return row

    def get_invitation(self, invitation_id: str) -> dict | None:
        return next((i for i in self.invitations if i["id"] == invitation_id), None)

    def get_invitation_by_token_hash(self, token_hash: str) -> dict | None:
        return next((i for i in self.invitations if i["token_hash"] == token_hash), None)

    def list_invitations(self, org_id: str, status: str | None = None) -> list[dict]:
        rows = [i for i in self.invitations if i["org_id"] == org_id]
        if status:
            rows = [i for i in rows if i["status"] == status]
        return list(reversed(rows))

    def update_invitation(self, invitation_id: str, **fields: Any) -> dict:
        inv = self.get_invitation(invitation_id)
        if inv is None:
            raise KeyError(invitation_id)
        inv.update(fields)
        return inv

    # access codes
    def create_access_code(self, row: dict) -> dict:
        row = {"id": _uid(), "created_at": _now(), "redeemed_at": None,
               "org_generada": None, **row}
        self.access_codes.append(row)
        return row

    def list_access_codes(self) -> list[dict]:
        return list(reversed(self.access_codes))

    def get_access_code(self, code: str) -> dict | None:
        return next((c for c in self.access_codes if c["code"] == code), None)

    def update_access_code(self, code: str, **fields: Any) -> dict:
        c = self.get_access_code(code)
        if c is None:
            raise KeyError(code)
        c.update(fields)
        return c

    # payments
    def create_payment(self, row: dict) -> dict:
        row = {"id": _uid(), "created_at": _now(), "fecha": row.get("fecha") or _now(), **row}
        self.payments.append(row)
        return row

    def list_payments(self, org_id: str | None = None, desde: str | None = None) -> list[dict]:
        rows = self.payments
        if org_id:
            rows = [p for p in rows if p["org_id"] == org_id]
        if desde:
            rows = [p for p in rows if (p.get("fecha") or "") >= desde]
        return list(reversed(rows))

    # support
    def create_thread(self, row: dict) -> dict:
        row = {"id": _uid(), "estado": "abierto", "auto_respondible": False,
               "created_at": _now(), "updated_at": _now(), **row}
        self.threads[row["id"]] = row
        return row

    def get_thread(self, thread_id: str) -> dict | None:
        return self.threads.get(thread_id)

    def update_thread(self, thread_id: str, **fields: Any) -> dict:
        t = self.threads.get(thread_id)
        if t is None:
            raise KeyError(thread_id)
        t.update(fields)
        t["updated_at"] = _now()
        return t

    def list_threads(self, org_id: str | None = None) -> list[dict]:
        rows = list(self.threads.values())
        if org_id:
            rows = [t for t in rows if t["org_id"] == org_id]
        return sorted(rows, key=lambda t: t["created_at"], reverse=True)

    def add_message(self, row: dict) -> dict:
        row = {"id": _uid(), "created_at": _now(), **row}
        self.messages.append(row)
        return row

    def list_messages(self, thread_id: str) -> list[dict]:
        return [m for m in self.messages if m["thread_id"] == thread_id]


# ════════════════════════════════════════════════════════════════════════════
# Backend Supabase (producción) — service_role
# ════════════════════════════════════════════════════════════════════════════


class SupabasePlatformStore:
    """Producción: consultas service_role que leen SOLO metadata (sin contenido)."""

    def __init__(self, client: Any = None) -> None:
        self._sb = client

    def sb(self) -> Any:
        if self._sb is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("platform_admin", service=True)
            self._sb = create_client(url, key)
        return self._sb

    # admins
    def get_admin_by_email(self, email: str) -> dict | None:
        r = self.sb().table("platform_admins").select("*").eq("email", email).execute()
        return r.data[0] if r.data else None

    def create_admin(self, email: str, password_hash: str, name: str | None) -> dict:
        r = self.sb().table("platform_admins").insert(
            {"email": email, "password_hash": password_hash, "name": name}
        ).execute()
        return r.data[0]

    # orgs
    def list_orgs(self) -> list[dict]:
        users = self.sb().table("users").select("org_id, created_at").execute().data or []
        billing = {b["org_id"]: b for b in (
            self.sb().table("org_billing").select("*").execute().data or []
        )}
        agg: dict[str, dict] = {}
        for u in users:
            a = agg.setdefault(u["org_id"], {"users": 0, "created_at": u.get("created_at")})
            a["users"] += 1
            if u.get("created_at") and (not a["created_at"] or u["created_at"] < a["created_at"]):
                a["created_at"] = u["created_at"]
        for org_id in set(billing) - set(agg):
            agg[org_id] = {"users": 0, "created_at": billing[org_id].get("created_at")}
        out = []
        for org_id, a in agg.items():
            b = billing.get(org_id, {})
            out.append({
                "org_id": org_id, "users": a["users"], "created_at": a["created_at"],
                "display_name": b.get("display_name"), "plan": b.get("plan", "piloto"),
                "lifecycle_status": b.get("lifecycle_status", "active"),
            })
        return sorted(out, key=lambda o: o["org_id"])

    def count_users(self, org_id: str) -> int:
        r = self.sb().table("users").select("id", count="exact").eq("org_id", org_id).execute()
        return r.count or 0

    def count_documents(self, org_id: str) -> int:
        r = self.sb().table("documents").select("id", count="exact").eq("org_id", org_id).execute()
        return r.count or 0

    def sum_storage_bytes(self, org_id: str) -> int:
        r = self.sb().table("documents").select("size_bytes").eq("org_id", org_id).execute()
        return sum(int(x.get("size_bytes") or 0) for x in (r.data or []))

    def total_storage_bytes(self) -> int:
        r = self.sb().table("documents").select("size_bytes").execute()
        return sum(int(x.get("size_bytes") or 0) for x in (r.data or []))

    def sum_consultas(self, org_id: str) -> int:
        r = self.sb().table("pcl_metrics_daily").select(
            "consultas_totales"
        ).eq("tenant_id", org_id).execute()
        return sum(int(x.get("consultas_totales", 0)) for x in (r.data or []))

    def list_consultas_daily(self) -> list[dict]:
        r = self.sb().table("pcl_metrics_daily").select("fecha, consultas_totales").execute()
        return [
            {"fecha": x.get("fecha"), "consultas_totales": int(x.get("consultas_totales", 0))}
            for x in (r.data or [])
        ]

    def get_org_billing(self, org_id: str) -> dict | None:
        r = self.sb().table("org_billing").select("*").eq("org_id", org_id).execute()
        return r.data[0] if r.data else None

    def upsert_org_billing(self, org_id: str, **fields: Any) -> dict:
        payload = {"org_id": org_id, **{k: v for k, v in fields.items() if v is not None}}
        r = self.sb().table("org_billing").upsert(payload, on_conflict="org_id").execute()
        return r.data[0] if r.data else payload

    def total_orgs(self) -> int:
        return len(self.list_orgs())

    def total_users(self) -> int:
        r = self.sb().table("users").select("id", count="exact").execute()
        return r.count or 0

    # provisión
    def email_exists(self, email: str) -> bool:
        r = self.sb().table("users").select("id").eq("email", email).limit(1).execute()
        return bool(r.data)

    def org_has_users(self, org_id: str) -> bool:
        r = self.sb().table("users").select("id").eq("org_id", org_id).limit(1).execute()
        return bool(r.data)

    def create_user(self, org_id, email, password_hash, name, role) -> dict:
        r = self.sb().table("users").insert({
            "org_id": org_id, "email": email, "password_hash": password_hash,
            "name": name, "role": role,
        }).execute()
        return r.data[0]

    def get_user_by_email(self, email: str) -> dict | None:
        r = self.sb().table("users").select(
            "id, org_id, email, name, role, is_active"
        ).eq("email", email).limit(1).execute()
        return r.data[0] if r.data else None

    def list_org_users(self, org_id: str) -> list[dict]:
        r = self.sb().table("users").select(
            "id, email, name, role, is_active, created_at"
        ).eq("org_id", org_id).order("created_at").execute()
        return r.data or []

    # orgs (B13)
    def create_org(self, org_id: str, **fields: Any) -> dict:
        payload = {"id": org_id, **{k: v for k, v in fields.items() if v is not None}}
        r = self.sb().table("orgs").insert(payload).execute()
        return r.data[0] if r.data else payload

    def get_org(self, org_id: str) -> dict | None:
        r = self.sb().table("orgs").select("*").eq("id", org_id).limit(1).execute()
        return r.data[0] if r.data else None

    def update_org(self, org_id: str, **fields: Any) -> dict:
        # None es válido al actualizar (limpiar ventana freemium, etc.).
        payload = {**fields, "updated_at": _now()}
        r = self.sb().table("orgs").update(payload).eq("id", org_id).execute()
        return r.data[0] if r.data else {"id": org_id, **payload}

    # invitations (B13)
    def create_invitation(self, row: dict) -> dict:
        r = self.sb().table("invitations").insert(row).execute()
        return r.data[0]

    def get_invitation(self, invitation_id: str) -> dict | None:
        r = self.sb().table("invitations").select("*").eq("id", invitation_id).execute()
        return r.data[0] if r.data else None

    def get_invitation_by_token_hash(self, token_hash: str) -> dict | None:
        r = self.sb().table("invitations").select("*").eq(
            "token_hash", token_hash
        ).limit(1).execute()
        return r.data[0] if r.data else None

    def list_invitations(self, org_id: str, status: str | None = None) -> list[dict]:
        q = self.sb().table("invitations").select("*").eq("org_id", org_id)
        if status:
            q = q.eq("status", status)
        return q.order("created_at", desc=True).execute().data or []

    def update_invitation(self, invitation_id: str, **fields: Any) -> dict:
        r = self.sb().table("invitations").update(fields).eq("id", invitation_id).execute()
        return r.data[0] if r.data else {}

    # access codes
    def create_access_code(self, row: dict) -> dict:
        r = self.sb().table("access_codes").insert(row).execute()
        return r.data[0]

    def list_access_codes(self) -> list[dict]:
        r = self.sb().table("access_codes").select("*").order("created_at", desc=True).execute()
        return r.data or []

    def get_access_code(self, code: str) -> dict | None:
        r = self.sb().table("access_codes").select("*").eq("code", code).execute()
        return r.data[0] if r.data else None

    def update_access_code(self, code: str, **fields: Any) -> dict:
        r = self.sb().table("access_codes").update(fields).eq("code", code).execute()
        return r.data[0] if r.data else {}

    # payments
    def create_payment(self, row: dict) -> dict:
        r = self.sb().table("manual_payments").insert(row).execute()
        return r.data[0]

    def list_payments(self, org_id: str | None = None, desde: str | None = None) -> list[dict]:
        q = self.sb().table("manual_payments").select("*")
        if org_id:
            q = q.eq("org_id", org_id)
        if desde:
            q = q.gte("fecha", desde)
        return q.order("fecha", desc=True).execute().data or []

    # support
    def create_thread(self, row: dict) -> dict:
        r = self.sb().table("support_threads").insert(row).execute()
        return r.data[0]

    def get_thread(self, thread_id: str) -> dict | None:
        r = self.sb().table("support_threads").select("*").eq("id", thread_id).execute()
        return r.data[0] if r.data else None

    def update_thread(self, thread_id: str, **fields: Any) -> dict:
        r = self.sb().table("support_threads").update(fields).eq("id", thread_id).execute()
        return r.data[0] if r.data else {}

    def list_threads(self, org_id: str | None = None) -> list[dict]:
        q = self.sb().table("support_threads").select("*")
        if org_id:
            q = q.eq("org_id", org_id)
        return q.order("created_at", desc=True).execute().data or []

    def add_message(self, row: dict) -> dict:
        r = self.sb().table("support_messages").insert(row).execute()
        return r.data[0]

    def list_messages(self, thread_id: str) -> list[dict]:
        r = self.sb().table("support_messages").select("*").eq(
            "thread_id", thread_id
        ).order("created_at").execute()
        return r.data or []
