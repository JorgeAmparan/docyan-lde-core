"""
Firma y verificación de tokens QR (B4 §6).

DOCYAN LDE™ by XCID.

Un token QR es la credencial física de "consulta donde se necesita": vincula a
una :EntidadOperativa del DKG y se codifica en una URL pública. El token mismo es
la credencial, así que su integridad NO puede depender de un lookup: se firma con
HMAC-SHA256 usando un secret de la app. El resolver valida la firma ANTES de
tocar la base — un token manipulado se rechaza sin consultar nada.

Formato compacto (URL-safe, sin padding):

    <body>.<sig>

  body = base64url( tenant_id | entidad_id | nonce )
  sig  = base64url( HMAC_SHA256(secret, body) )

El `|` no puede aparecer en los componentes (tenant_id/entidad_id son ids hex o
slugs; el nonce es base64url). Se valida al firmar.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass

_SEPARATOR = "|"


class InvalidQrToken(Exception):
    """El token QR es estructuralmente inválido o su firma no verifica."""


@dataclass(frozen=True)
class QrPayload:
    """Contenido verificado de un token QR."""

    tenant_id: str
    entidad_id: str
    nonce: str


def _signing_secret() -> bytes:
    """
    Secret de firma. Usa QR_SIGNING_SECRET si está; si no, cae a JWT_SECRET
    (siempre presente — auth.py falla loud sin él). Nunca queda sin secret.
    """
    secret = os.getenv("QR_SIGNING_SECRET") or os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "QR_SIGNING_SECRET (o JWT_SECRET como fallback) es requerido para "
            "firmar tokens QR y no está configurado."
        )
    return secret.encode("utf-8")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def generate_nonce() -> str:
    """Nonce aleatorio URL-safe (entra en la firma y en el registro qr_tokens)."""
    return secrets.token_urlsafe(12)


def sign(tenant_id: str, entidad_id: str, nonce: str) -> str:
    """Firma un payload y devuelve el token compacto `<body>.<sig>`."""
    for nombre, valor in (("tenant_id", tenant_id), ("entidad_id", entidad_id), ("nonce", nonce)):
        if not valor:
            raise ValueError(f"{nombre} no puede ser vacío al firmar un token QR.")
        if _SEPARATOR in valor:
            raise ValueError(f"{nombre} no puede contener '{_SEPARATOR}'.")

    body_raw = _SEPARATOR.join((tenant_id, entidad_id, nonce)).encode("utf-8")
    body = _b64url_encode(body_raw)
    sig = _b64url_encode(hmac.new(_signing_secret(), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify(token: str) -> QrPayload:
    """
    Verifica la firma y devuelve el payload. Lanza InvalidQrToken si el token es
    inválido o fue manipulado. NO consulta la base: la firma es autosuficiente.
    """
    if not token or token.count(".") != 1:
        raise InvalidQrToken("Estructura de token inválida.")
    body, sig = token.split(".", 1)
    esperado = _b64url_encode(
        hmac.new(_signing_secret(), body.encode("ascii"), hashlib.sha256).digest()
    )
    # Comparación en tiempo constante: no filtra cuántos bytes coincidieron.
    if not hmac.compare_digest(sig, esperado):
        raise InvalidQrToken("Firma del token QR inválida.")
    try:
        tenant_id, entidad_id, nonce = _b64url_decode(body).decode("utf-8").split(_SEPARATOR)
    except (ValueError, UnicodeDecodeError) as exc:
        raise InvalidQrToken("Payload del token QR corrupto.") from exc
    return QrPayload(tenant_id=tenant_id, entidad_id=entidad_id, nonce=nonce)
