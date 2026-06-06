"""
Endpoints lado-tenant que tocan superficies de plataforma (F2): canje de código
de acceso y chat de soporte. NO requieren scope platform — son del usuario/tenant.

El canje es alta CONTROLADA (provisiona una org nueva), NO acceso cross-tenant.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import verificar_credenciales
from app.platform_admin import providers
from app.platform_admin.models import (
    AddMessageRequest,
    OpenThreadRequest,
    RedeemAccessCodeRequest,
    RedeemAccessCodeResponse,
    SupportMessageOut,
    SupportThreadOut,
)
from app.platform_admin.security import hash_password

router = APIRouter(tags=["platform-tenant"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _org_id_for(email: str) -> str:
    # Mismo esquema de derivación que auth.register (sha256(email)[:16]).
    return hashlib.sha256(email.encode()).hexdigest()[:16]


# ── (B) Canje de código de acceso (provisiona org) ───────────────────────────


@router.post("/access-codes/{code}/redeem", response_model=RedeemAccessCodeResponse)
async def redeem_access_code(
    code: str,
    body: RedeemAccessCodeRequest,
) -> RedeemAccessCodeResponse:
    store = providers.get_store()
    audit = providers.get_audit()
    row = store.get_access_code(code)
    if row is None:
        raise HTTPException(status_code=404, detail="Código no encontrado.")
    if row["status"] == "used":
        raise HTTPException(status_code=409, detail="Código ya canjeado.")
    if row["status"] in ("revoked", "expired"):
        raise HTTPException(status_code=409, detail=f"Código {row['status']}, no canjeable.")
    expires = row.get("expires_at")
    if expires and str(expires) < _now().isoformat():
        store.update_access_code(code, status="expired")
        raise HTTPException(status_code=409, detail="Código expirado.")
    if store.email_exists(body.email):
        raise HTTPException(status_code=409, detail="Email ya registrado.")

    org_id = _org_id_for(body.email)
    if store.org_has_users(org_id):
        raise HTTPException(status_code=409, detail="La organización ya existe.")

    user = store.create_user(
        org_id=org_id, email=body.email, password_hash=hash_password(body.password),
        name=body.name, role="admin",
    )
    store.ensure_budget(org_id, float(row["cuota_saldo_usd"]))
    store.upsert_org_billing(
        org_id, display_name=body.org_name, plan=row["tipo"], lifecycle_status="active",
    )
    store.update_access_code(
        code, status="used", org_generada=org_id, redeemed_at=_now().isoformat(),
    )
    audit.record("access_code_redeemed", body.email, {
        "code": code, "org_id": org_id, "plan": row["tipo"],
    }, org_id=org_id)

    return RedeemAccessCodeResponse(
        org_id=org_id, user_id=str(user["id"]), plan=row["tipo"],
        cuota_documentos=row["cuota_documentos"], cuota_saldo_usd=float(row["cuota_saldo_usd"]),
        expires_at=row.get("expires_at"),
    )


# ── (D) Soporte — lado tenant ─────────────────────────────────────────────────


def _thread_out(thread: dict, mensajes: list[dict]) -> SupportThreadOut:
    return SupportThreadOut(
        id=str(thread["id"]), org_id=thread["org_id"], user_id=thread.get("user_id"),
        pantalla_origen=thread.get("pantalla_origen"), estado=thread["estado"],
        auto_respondible=bool(thread.get("auto_respondible", False)),
        created_at=thread.get("created_at"), updated_at=thread.get("updated_at"),
        mensajes=[
            SupportMessageOut(
                id=str(m["id"]), thread_id=str(m["thread_id"]), autor_tipo=m["autor_tipo"],
                autor_id=m.get("autor_id"), cuerpo=m["cuerpo"], created_at=m.get("created_at"),
            )
            for m in mensajes
        ],
    )


@router.post("/support/threads", response_model=SupportThreadOut)
async def open_thread(
    body: OpenThreadRequest,
    ctx: dict = Depends(verificar_credenciales),
) -> SupportThreadOut:
    store = providers.get_store()
    thread = store.create_thread({
        "org_id": ctx["org_id"], "user_id": ctx.get("user_id"),
        "pantalla_origen": body.pantalla_origen, "estado": "abierto",
    })
    store.add_message({
        "thread_id": thread["id"], "autor_tipo": "usuario",
        "autor_id": ctx.get("user_id") or ctx["org_id"], "cuerpo": body.mensaje,
    })
    return _thread_out(thread, store.list_messages(thread["id"]))


@router.post("/support/threads/{thread_id}/messages", response_model=SupportThreadOut)
async def add_message(
    thread_id: str,
    body: AddMessageRequest,
    ctx: dict = Depends(verificar_credenciales),
) -> SupportThreadOut:
    store = providers.get_store()
    thread = store.get_thread(thread_id)
    # Aislamiento: un tenant solo toca SUS hilos (no revela los de otra org).
    if thread is None or thread["org_id"] != ctx["org_id"]:
        raise HTTPException(status_code=404, detail="Hilo no encontrado.")
    store.add_message({
        "thread_id": thread_id, "autor_tipo": "usuario",
        "autor_id": ctx.get("user_id") or ctx["org_id"], "cuerpo": body.cuerpo,
    })
    thread = store.update_thread(thread_id, estado="abierto")
    return _thread_out(thread, store.list_messages(thread_id))
