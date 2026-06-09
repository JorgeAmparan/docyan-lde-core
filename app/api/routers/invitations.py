"""
Router de invitaciones de usuario (B13 §1.6/§1.7).

Un admin de org invita a otros usuarios por correo. El invitado abre el enlace,
establece su contraseña y queda como usuario de la org con su rol (aislamiento
multi-tenant intacto: solo verá lo de su org).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import requiere_rol
from app.onboarding import providers, service
from app.onboarding.models import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    CreateInvitationRequest,
    InvitationList,
    InvitationOut,
    TokenBundle,
)
from app.onboarding.service import OnboardingError

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _inv_out(inv: dict, *, invite_url: str | None = None,
            email_enviado: bool | None = None) -> InvitationOut:
    return InvitationOut(
        id=str(inv["id"]), org_id=inv["org_id"], email=inv["email"], role=inv["role"],
        status=inv["status"], expires_at=inv.get("expires_at"),
        created_at=inv.get("created_at"), accepted_at=inv.get("accepted_at"),
        invite_url=invite_url, email_enviado=email_enviado,
    )


@router.post("", response_model=InvitationOut)
async def crear_invitacion(
    req: CreateInvitationRequest,
    ctx: dict = Depends(requiere_rol("admin")),
) -> InvitationOut:
    """Crea + envía una invitación. Solo el admin de la org puede invitar."""
    invited_by = ctx.get("email") or ctx.get("user_id") or ctx["org_id"]
    try:
        inv = service.crear_invitacion(
            providers.get_store(), providers.get_audit(), providers.get_email_sender(),
            org_id=ctx["org_id"], invited_by=invited_by,
            email=str(req.email), role=req.role,
        )
    except OnboardingError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return _inv_out(inv, invite_url=inv.get("invite_url"), email_enviado=inv.get("email_enviado"))


@router.get("", response_model=InvitationList)
async def listar_invitaciones(
    status: str | None = Query(default=None),
    ctx: dict = Depends(requiere_rol("admin")),
) -> InvitationList:
    """Lista las invitaciones de la org (pendientes / aceptadas / etc.)."""
    rows = service.listar_invitaciones(providers.get_store(), ctx["org_id"], status)
    return InvitationList(items=[_inv_out(r) for r in rows], total=len(rows))


@router.post("/accept", response_model=AcceptInvitationResponse)
async def aceptar_invitacion(req: AcceptInvitationRequest) -> AcceptInvitationResponse:
    """El invitado acepta: establece contraseña → entra como usuario de la org (público)."""
    try:
        out = service.aceptar_invitacion(
            providers.get_store(), providers.get_audit(), providers.get_token_issuer(),
            token=req.token, password=req.password, name=req.name,
        )
    except OnboardingError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return AcceptInvitationResponse(
        org_id=out["org_id"], user_id=out["user_id"], email=out["email"],
        role=out["role"], tokens=TokenBundle(**out["tokens"]),
    )
