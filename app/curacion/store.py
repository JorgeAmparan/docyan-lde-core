"""
Store de borradores de curación (B9.5 §1.2).

DOCYAN LDE™ by XCID.

Un borrador extraído (Tipo 3/5) se persiste mientras el humano lo corrige, y se
elimina al confirmar (ya vive en el grafo) o al descartar. La interfaz permite un
backend Supabase en producción; en tests se usa `InMemoryDraftStore` (se mockea el
almacén, NUNCA la decisión — mismo principio que el cotizador, CLAUDE.md §14).
"""
from __future__ import annotations

import os
from typing import Any, Protocol


class DraftStore(Protocol):
    def save(self, tenant_id: str, draft_id: str, data: dict) -> None: ...
    def get(self, tenant_id: str, draft_id: str) -> dict | None: ...
    def delete(self, tenant_id: str, draft_id: str) -> None: ...
    def list(self, tenant_id: str) -> list[dict]: ...


class InMemoryDraftStore:
    """Almacén en memoria (tests / dev). Aislado por tenant."""

    def __init__(self) -> None:
        self._data: dict[tuple[str, str], dict] = {}

    def save(self, tenant_id: str, draft_id: str, data: dict) -> None:
        self._data[(tenant_id, draft_id)] = dict(data)

    def get(self, tenant_id: str, draft_id: str) -> dict | None:
        d = self._data.get((tenant_id, draft_id))
        return dict(d) if d is not None else None

    def delete(self, tenant_id: str, draft_id: str) -> None:
        self._data.pop((tenant_id, draft_id), None)

    def list(self, tenant_id: str) -> list[dict]:
        return [dict(v) for (t, _), v in self._data.items() if t == tenant_id]


class SupabaseDraftStore:
    """
    Almacén COMPARTIDO de borradores (migración 020 `curacion_drafts`). Crítico para
    el recorrido real: el WORKER auto-extrae el borrador y lo persiste aquí; el
    BACKEND (editor) lo lee — son procesos Fly separados, así que el store en
    memoria no sirve en producción. Aislado por `tenant_id` (multi-tenant strict).
    """

    TABLE = "curacion_drafts"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("curacion_store", service=True)
            self._client = create_client(url, key)
        return self._client

    def save(self, tenant_id: str, draft_id: str, data: dict) -> None:
        self._sb().table(self.TABLE).upsert(
            {"tenant_id": tenant_id, "draft_id": draft_id, "data": data},
            on_conflict="tenant_id,draft_id",
        ).execute()

    def get(self, tenant_id: str, draft_id: str) -> dict | None:
        res = (
            self._sb().table(self.TABLE).select("data")
            .eq("tenant_id", tenant_id).eq("draft_id", draft_id).limit(1).execute()
        )
        return res.data[0]["data"] if res.data else None

    def delete(self, tenant_id: str, draft_id: str) -> None:
        self._sb().table(self.TABLE).delete().eq("tenant_id", tenant_id).eq(
            "draft_id", draft_id
        ).execute()

    def list(self, tenant_id: str) -> list[dict]:
        res = self._sb().table(self.TABLE).select("data").eq("tenant_id", tenant_id).execute()
        return [r["data"] for r in (res.data or [])]


# Singleton de proceso del store en memoria (worker y backend del MISMO proceso en
# dev/tests comparten esta instancia).
_inmemory_singleton = InMemoryDraftStore()


def build_draft_store() -> DraftStore:
    """
    Selecciona el store por entorno: Supabase si hay credenciales (producción —
    worker y backend comparten la tabla), en memoria en dev/tests. El override
    `DOCYAN_DRAFTS_INMEMORY=1` fuerza memoria aun con Supabase configurado.
    """
    if os.getenv("DOCYAN_DRAFTS_INMEMORY") == "1":
        return _inmemory_singleton
    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"):
        return SupabaseDraftStore()
    return _inmemory_singleton
