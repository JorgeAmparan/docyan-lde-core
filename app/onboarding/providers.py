"""
Providers de dependencias del onboarding (B13).

Centralizan las instancias de producción para que los tests las sustituyan con una
sola sobreescritura (monkeypatch) — mismo patrón que `app/platform_admin/providers.py`.
La capa de datos se REUSA del store de plataforma (orgs/users/invitations).
"""
from __future__ import annotations

from typing import Any

from app.platform_admin import providers as _platform


def get_store():
    return _platform.get_store()


def get_audit():
    return _platform.get_audit()


def get_email_sender():
    from app.notifications.email import get_email_sender as _factory

    return _factory()


def get_dkg():
    from app.graph.dkg_client import dkg_client

    return dkg_client


def get_token_issuer():
    return ProductionTokenIssuer()


def get_quota_manager():
    """Cupo de ingestas (F3 §C). Reusa el provider de ingesta."""
    from app.ingesta.providers import get_quota_manager as _factory

    return _factory()


class ProductionTokenIssuer:
    """Emite el par access/refresh reusando los helpers de `app/api/auth.py`."""

    def emit(self, user: dict[str, Any]) -> dict[str, Any]:
        from app.api.auth import (
            ACCESS_TOKEN_EXPIRE_MINUTES,
            _create_access_token,
            _create_refresh_token,
        )

        access = _create_access_token(user)
        refresh, _ = _create_refresh_token(user["id"])
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
