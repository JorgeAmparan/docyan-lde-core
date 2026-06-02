"""
Generación de tokens QR persistentes (B4 §6).

DOCYAN LDE™ by XCID.

Vincula una :EntidadOperativa del DKG (B1) a un token firmado (HMAC-SHA256) y lo
registra en `qr_tokens` (migración 012). Produce la URL pública que el QR
codifica y, si hay un renderizador disponible (segno, pure-python), también la
imagen SVG del código. El QR es PERSISTENTE por default (no expira); el tenant
puede fijar caducidad explícita.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.qr import tokens
from app.qr.store import QrTokenRecord, QrTokenStore, SupabaseQrTokenStore

# Base pública del backend (donde vive GET /qr/<token>). Default = la Fly app.
QR_PUBLIC_BASE_URL = os.getenv("QR_PUBLIC_BASE_URL", "https://docyan-lde-api.fly.dev")


@dataclass
class GeneratedQr:
    """Resultado de generar un token QR para una entidad."""

    token: str
    url: str
    tenant_id: str
    entidad_id: str
    nonce: str
    expires_at: str | None
    svg: str | None = None  # imagen SVG del QR si hay renderizador; None si no.

    def to_dict(self) -> dict:
        d = {
            "token": self.token,
            "url": self.url,
            "tenant_id": self.tenant_id,
            "entidad_id": self.entidad_id,
            "expires_at": self.expires_at,
            "tiene_imagen": self.svg is not None,
        }
        if self.svg is not None:
            d["svg"] = self.svg
        return d


def _render_svg(url: str) -> str | None:
    """
    Renderiza el QR como SVG con segno (pure-python, sin PIL). Si segno no está
    instalado, devuelve None y el caller usa solo el token/URL — no es un stub:
    la URL es plenamente funcional, la imagen es una conveniencia de presentación.
    """
    try:
        import io

        import segno
    except Exception:
        return None
    buf = io.BytesIO()
    segno.make(url, error="m").save(buf, kind="svg", scale=6)
    return buf.getvalue().decode("utf-8")


class QrGenerator:
    """Genera y registra tokens QR vinculados a entidades del DKG."""

    def __init__(
        self,
        store: QrTokenStore | None = None,
        base_url: str | None = None,
    ):
        self.store = store or SupabaseQrTokenStore()
        self.base_url = (base_url or QR_PUBLIC_BASE_URL).rstrip("/")

    def generar(
        self,
        tenant_id: str,
        entidad_id: str,
        created_by: str | None = None,
        ttl_dias: int | None = None,
        render: bool = True,
    ) -> GeneratedQr:
        """
        Genera un token QR para una :EntidadOperativa. Registra el token en el
        almacén (para revocación/caducidad) y devuelve URL + (opcional) SVG.

        ttl_dias=None → persistente (default). ttl_dias>0 → caduca.
        """
        if not tenant_id or not entidad_id:
            raise ValueError("tenant_id y entidad_id son obligatorios para generar un QR.")

        nonce = tokens.generate_nonce()
        token = tokens.sign(tenant_id, entidad_id, nonce)
        url = f"{self.base_url}/qr/{token}"

        expires_at: str | None = None
        if ttl_dias is not None and ttl_dias > 0:
            expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_dias)).isoformat()

        self.store.save(
            QrTokenRecord(
                tenant_id=tenant_id,
                entidad_id_dkg=entidad_id,
                nonce=nonce,
                created_by=created_by,
                expires_at=expires_at,
                revoked_at=None,
            )
        )

        svg = _render_svg(url) if render else None
        return GeneratedQr(
            token=token,
            url=url,
            tenant_id=tenant_id,
            entidad_id=entidad_id,
            nonce=nonce,
            expires_at=expires_at,
            svg=svg,
        )

    def revocar(self, tenant_id: str, nonce: str) -> bool:
        """Revoca un token (por nonce). Tras esto, el resolver lo rechaza."""
        return self.store.revoke(tenant_id, nonce)
