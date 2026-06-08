"""
Store de borradores de curación (B9.5 §1.2).

DOCYAN LDE™ by XCID.

Un borrador extraído (Tipo 3/5) se persiste mientras el humano lo corrige, y se
elimina al confirmar (ya vive en el grafo) o al descartar. La interfaz permite un
backend Supabase en producción; en tests se usa `InMemoryDraftStore` (se mockea el
almacén, NUNCA la decisión — mismo principio que el cotizador, CLAUDE.md §14).
"""
from __future__ import annotations

from typing import Protocol


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
