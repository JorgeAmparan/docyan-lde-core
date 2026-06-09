"""
Endpoints lado-tenant que tocan superficies de plataforma (F2): canje de código
de acceso y chat de soporte. NO requieren scope platform — son del usuario/tenant.

El canje es alta CONTROLADA (provisiona una org nueva), NO acceso cross-tenant.
"""
from __future__ import annotations

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

router = APIRouter(tags=["platform-tenant"])


# ── (B) Canje de código de acceso (provisiona org) ───────────────────────────


@router.post("/access-codes/{code}/redeem", response_model=RedeemAccessCodeResponse)
async def redeem_access_code(
    code: str,
    body: RedeemAccessCodeRequest,
) -> RedeemAccessCodeResponse:
    # Reusa el canje compartido (B13): provisiona user+budget+billing+fila `orgs`
    # formalizada y marca el código usado. Misma lógica que el signup con código.
    from app.onboarding.service import OnboardingError, canjear_codigo

    store = providers.get_store()
    audit = providers.get_audit()
    try:
        prov = canjear_codigo(
            store, audit, code=code, email=body.email, password=body.password,
            name=body.name, org_name=body.org_name,
        )
    except OnboardingError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return RedeemAccessCodeResponse(
        org_id=prov["org_id"], user_id=str(prov["user"]["id"]), plan=prov["plan"],
        cuota_documentos=prov["cuota_documentos"], cuota_saldo_usd=prov["cuota_saldo_usd"],
        expires_at=prov["expires_at"],
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
