"""
Router de onboarding (B13): registro Freemium/Piloto (Fase 1) y activación de plan
+ criticidad (Fase 2). El signup REEMPLAZA al de 4 pasos: credenciales primero,
plan después.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import requiere_rol, verificar_credenciales
from app.onboarding import providers, service
from app.onboarding.models import (
    ActivarPlanRequest,
    OrgOut,
    SignupRequest,
    SignupResponse,
    TokenBundle,
)
from app.onboarding.service import OnboardingError

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _org_out(org: dict) -> OrgOut:
    return OrgOut(
        org_id=org.get("id") or org.get("org_id"),
        nombre=org.get("nombre"),
        banda_mercado=org.get("banda_mercado") or "A",
        idioma=org.get("idioma") or "es",
        plan=org.get("plan") or "freemium",
        lifecycle_status=org.get("lifecycle_status") or "active",
        doc_limit=org.get("doc_limit"),
        criticidad_segmento=org.get("criticidad_segmento"),
        fase2_completada=bool(org.get("fase2_completada", False)),
        freemium_inicio=org.get("freemium_inicio"),
        freemium_expira=org.get("freemium_expira"),
    )


@router.post("/signup", response_model=SignupResponse)
async def signup(req: SignupRequest) -> SignupResponse:
    """Fase 1: crea la cuenta (Freemium o, con `codigo_acceso`, Piloto) y entra."""
    try:
        out = service.signup(
            providers.get_store(), providers.get_audit(),
            providers.get_token_issuer(), req,
        )
    except OnboardingError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return SignupResponse(
        org_id=out["org_id"], user_id=out["user_id"], email=out["email"],
        role=out["role"], plan=out["plan"], doc_limit=out["doc_limit"],
        freemium_expira=out["freemium_expira"], fase2_completada=out["fase2_completada"],
        tokens=TokenBundle(**out["tokens"]),
    )


@router.post("/plan", response_model=OrgOut)
async def activar_plan(
    req: ActivarPlanRequest,
    ctx: dict = Depends(requiere_rol("admin")),
) -> OrgOut:
    """Fase 2: el admin de la org activa/elige plan + fija criticidad (decisión #15)."""
    actor = ctx.get("email") or ctx.get("user_id") or ctx["org_id"]
    try:
        org = service.activar_plan(
            providers.get_store(), providers.get_audit(),
            org_id=ctx["org_id"], actor=actor, req=req,
        )
    except OnboardingError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return _org_out(org)


@router.get("/org", response_model=OrgOut)
async def mi_org(ctx: dict = Depends(verificar_credenciales)) -> OrgOut:
    """Devuelve la org del usuario autenticado (estado de onboarding/plan/cupo)."""
    org = providers.get_store().get_org(ctx["org_id"])
    if org is None:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    return _org_out(org)
