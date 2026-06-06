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
    def get_budget(self, org_id: str) -> dict | None: ...
    def sum_consultas(self, org_id: str) -> int: ...
    def get_org_billing(self, org_id: str) -> dict | None: ...
    def upsert_org_billing(self, org_id: str, **fields: Any) -> dict: ...
    def total_orgs(self) -> int: ...
    def total_users(self) -> int: ...

    # ── provisión de org (canje) ──────────────────────────────────────────────
    def email_exists(self, email: str) -> bool: ...
    def org_has_users(self, org_id: str) -> bool: ...
    def create_user(self, org_id: str, email: str, password_hash: str, name: str, role: str) -> dict: ...
    def ensure_budget(self, org_id: str, saldo_usd: float) -> dict: ...

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
        self.budgets: dict[str, dict] = {}  # org_id -> budget dict
        self.consultas: dict[str, int] = {}  # org_id -> total consultas

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

    def get_budget(self, org_id: str) -> dict | None:
        return self.budgets.get(org_id)

    def sum_consultas(self, org_id: str) -> int:
        return int(self.consultas.get(org_id, 0))

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

    def ensure_budget(self, org_id: str, saldo_usd: float) -> dict:
        b = {"tenant_id": org_id, "saldo_actual_usd": float(saldo_usd),
             "hard_cap_por_documento": 5.0, "hard_cap_por_sesion": 20.0, "moneda": "USD"}
        self.budgets[org_id] = b
        return b

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

    def get_budget(self, org_id: str) -> dict | None:
        r = self.sb().table("tenant_budget").select(
            "saldo_actual_usd, retenido_usd, hard_cap_por_documento, hard_cap_por_sesion, moneda"
        ).eq("tenant_id", org_id).execute()
        return r.data[0] if r.data else None

    def sum_consultas(self, org_id: str) -> int:
        r = self.sb().table("pcl_metrics_daily").select(
            "consultas_totales"
        ).eq("tenant_id", org_id).execute()
        return sum(int(x.get("consultas_totales", 0)) for x in (r.data or []))

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

    def ensure_budget(self, org_id: str, saldo_usd: float) -> dict:
        r = self.sb().table("tenant_budget").upsert(
            {"tenant_id": org_id, "saldo_actual_usd": saldo_usd}, on_conflict="tenant_id"
        ).execute()
        return r.data[0] if r.data else {"tenant_id": org_id, "saldo_actual_usd": saldo_usd}

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
