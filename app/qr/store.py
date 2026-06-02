"""
Almacén de registro de tokens QR (B4 §6).

DOCYAN LDE™ by XCID.

Persiste el registro de cada token emitido (tabla `qr_tokens`, migración 012)
para permitir REVOCACIÓN y caducidad opcional. La firma del token es
autosuficiente para autenticidad; este almacén añade el control de ciclo de vida
(revocado / expirado) que la firma sola no puede dar.

Patrón de testabilidad idéntico a budget_manager / dispatcher: un Protocol con
un backend en memoria (tests) y uno Supabase (producción). NUNCA se mockea la
DECISIÓN de revocación, solo el ALMACÉN.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol


@dataclass
class QrTokenRecord:
    """Vista de dominio de una fila de `qr_tokens`."""

    tenant_id: str
    entidad_id_dkg: str
    nonce: str
    created_by: str | None = None
    expires_at: str | None = None  # ISO-8601 o None (persistente)
    revoked_at: str | None = None  # ISO-8601 o None (activo)

    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def is_expired(self, *, now: datetime | None = None) -> bool:
        if not self.expires_at:
            return False
        ahora = now or datetime.now(timezone.utc)
        try:
            exp = datetime.fromisoformat(self.expires_at)
        except ValueError:
            return False
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return ahora >= exp

    def is_active(self, *, now: datetime | None = None) -> bool:
        return not self.is_revoked() and not self.is_expired(now=now)


class QrTokenStore(Protocol):
    """Contrato del registro de tokens QR (Supabase o memoria)."""

    def save(self, record: QrTokenRecord) -> QrTokenRecord: ...

    def get(self, tenant_id: str, nonce: str) -> QrTokenRecord | None: ...

    def revoke(self, tenant_id: str, nonce: str) -> bool: ...


# ── Almacén en memoria (tests / dev) ──────────────────────────────────────────


@dataclass
class InMemoryQrTokenStore:
    """Almacén volátil para tests. NO usar en producción."""

    _rows: dict[tuple[str, str], QrTokenRecord] = field(default_factory=dict)

    def save(self, record: QrTokenRecord) -> QrTokenRecord:
        self._rows[(record.tenant_id, record.nonce)] = record
        return record

    def get(self, tenant_id: str, nonce: str) -> QrTokenRecord | None:
        return self._rows.get((tenant_id, nonce))

    def revoke(self, tenant_id: str, nonce: str) -> bool:
        rec = self._rows.get((tenant_id, nonce))
        if rec is None or rec.is_revoked():
            return False
        rec.revoked_at = datetime.now(timezone.utc).isoformat()
        return True


# ── Almacén Supabase (producción) ─────────────────────────────────────────────


class SupabaseQrTokenStore:
    """Almacén real sobre la tabla `qr_tokens`. Usa SUPABASE_SERVICE_KEY."""

    TABLE = "qr_tokens"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            _url, _key = require_supabase_config("qr_token_store", service=True)
            self._client = create_client(_url, _key)
        return self._client

    @staticmethod
    def _row_to_record(row: dict) -> QrTokenRecord:
        return QrTokenRecord(
            tenant_id=row["tenant_id"],
            entidad_id_dkg=row["entidad_id_dkg"],
            nonce=row["nonce"],
            created_by=row.get("created_by"),
            expires_at=row.get("expires_at"),
            revoked_at=row.get("revoked_at"),
        )

    def save(self, record: QrTokenRecord) -> QrTokenRecord:
        self._sb().table(self.TABLE).insert(
            {
                "tenant_id": record.tenant_id,
                "entidad_id_dkg": record.entidad_id_dkg,
                "nonce": record.nonce,
                "created_by": record.created_by,
                "expires_at": record.expires_at,
                "revoked_at": record.revoked_at,
            }
        ).execute()
        return record

    def get(self, tenant_id: str, nonce: str) -> QrTokenRecord | None:
        res = (
            self._sb()
            .table(self.TABLE)
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("nonce", nonce)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._row_to_record(res.data[0])

    def revoke(self, tenant_id: str, nonce: str) -> bool:
        ahora = datetime.now(timezone.utc).isoformat()
        res = (
            self._sb()
            .table(self.TABLE)
            .update({"revoked_at": ahora})
            .eq("tenant_id", tenant_id)
            .eq("nonce", nonce)
            .is_("revoked_at", "null")
            .execute()
        )
        return bool(res.data)
