"""
Seed de la cuenta inicial de `platform_admin` (F2).

Credenciales por VARIABLE DE ENTORNO (el fundador las setea), NUNCA hardcodeadas:
  PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD, PLATFORM_ADMIN_NAME (opcional).

Idempotente: si ya existe un admin con ese email, no lo recrea.
"""
from __future__ import annotations

import os

from app.platform_admin.security import hash_password


def seed_platform_admin(store) -> dict | None:
    email = os.getenv("PLATFORM_ADMIN_EMAIL")
    password = os.getenv("PLATFORM_ADMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError(
            "PLATFORM_ADMIN_EMAIL y PLATFORM_ADMIN_PASSWORD son requeridas para "
            "sembrar la cuenta de platform_admin (no se hardcodean)."
        )
    if store.get_admin_by_email(email):
        return None  # ya existe; idempotente
    return store.create_admin(
        email=email,
        password_hash=hash_password(password),
        name=os.getenv("PLATFORM_ADMIN_NAME", "Fundador XCID"),
    )


if __name__ == "__main__":  # pragma: no cover — runner operativo
    from app.platform_admin.store import SupabasePlatformStore

    created = seed_platform_admin(SupabasePlatformStore())
    print("platform_admin creado" if created else "platform_admin ya existía (no-op)")
