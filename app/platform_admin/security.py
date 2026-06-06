"""
Identidad y scope de `platform_admin` (F2).

JWT PROPIO con claim `scope="platform"`, SEPARADO del JWT de tenant. Un token de
plataforma NO concede acceso a recursos de tenant (lo bloquea `auth.py`), y un
token de tenant NO pasa `requiere_platform_admin` (403). El secreto de firma se
comparte (JWT_SECRET) pero el `scope` discrimina el dominio — la separación es de
identidad y autorización, no de algoritmo.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
PLATFORM_TOKEN_EXPIRE_MINUTES = int(os.getenv("PLATFORM_TOKEN_EXPIRE_MINUTES", "60"))

# Claim que marca el dominio del token. Sin este valor un token NO es de plataforma.
PLATFORM_SCOPE = "platform"

_BEARER = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def create_platform_token(admin: dict) -> str:
    payload = {
        "sub": admin["id"],
        "email": admin["email"],
        "scope": PLATFORM_SCOPE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=PLATFORM_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def is_platform_token(payload: dict) -> bool:
    return payload.get("scope") == PLATFORM_SCOPE


async def requiere_platform_admin(
    bearer: HTTPAuthorizationCredentials = Security(_BEARER),
) -> dict:
    """
    Exige un JWT de plataforma válido (`scope="platform"`). Un token de tenant
    (sin ese scope) → 403. Devuelve el contexto del platform_admin (id + email).
    NO concede acceso a contenido de tenant: este ctx no lleva `org_id` ni `role`.
    """
    if not bearer or not bearer.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación de plataforma requerida (Authorization: Bearer).",
        )
    try:
        payload = jwt.decode(bearer.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token de plataforma expirado.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")

    if not is_platform_token(payload):
        raise HTTPException(
            status_code=403,
            detail="Este token no tiene scope de plataforma. Acceso denegado.",
        )
    return {"padmin_id": payload["sub"], "email": payload.get("email")}


def actor_de(ctx: dict) -> str:
    """Actor estable para el FAT: email del platform_admin, o su id."""
    return ctx.get("email") or ctx.get("padmin_id") or "platform_admin"
