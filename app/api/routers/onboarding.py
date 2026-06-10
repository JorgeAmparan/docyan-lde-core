"""
Router de onboarding (B13): registro Freemium/Piloto (Fase 1) y activación de plan
+ criticidad (Fase 2). El signup REEMPLAZA al de 4 pasos: credenciales primero,
plan después.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import requiere_rol, verificar_credenciales
from app.onboarding import providers, service
from app.onboarding.limites import estado_cupo
from app.onboarding.models import (
    ActivarPlanRequest,
    CuentaResumen,
    OrgOut,
    SignupRequest,
    SignupResponse,
    TokenBundle,
    UsuarioOut,
    UsuariosList,
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
            quota=providers.get_quota_manager(),
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
            quota=providers.get_quota_manager(),
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


_PLAN_NOMBRE = {
    "freemium": "Plan gratuito",
    "piloto": "Plan piloto",
    "esencial": "Plan Esencial",
    "profesional": "Plan Profesional",
    "empresarial": "Plan Empresarial",
}


@router.get("/cuenta", response_model=CuentaResumen)
async def resumen_cuenta(ctx: dict = Depends(verificar_credenciales)) -> CuentaResumen:
    """
    Resumen REAL de la cuenta del tenant: plan, cupo de documentos (contado del grafo)
    y saldo de ingesta (del budget). Sin datos enlatados. Aislado por org_id del JWT.
    """
    org_id = ctx["org_id"]
    store = providers.get_store()
    org = store.get_org(org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")

    cupo = estado_cupo(store, providers.get_dkg(), org_id)
    budget = store.get_budget(org_id) or {}
    plan = org.get("plan") or "freemium"
    return CuentaResumen(
        org_id=org_id,
        nombre=org.get("nombre"),
        plan=plan,
        plan_nombre=_PLAN_NOMBRE.get(plan, plan.capitalize()),
        criticidad_segmento=org.get("criticidad_segmento"),
        fase2_completada=bool(org.get("fase2_completada", False)),
        doc_limit=cupo["limit"],
        docs_usados=cupo["usados"],
        docs_disponibles=cupo["disponibles"],
        saldo_actual_usd=float(budget.get("saldo_actual_usd") or 0.0),
        moneda=budget.get("moneda") or "USD",
        freemium_expira=org.get("freemium_expira"),
    )


@router.get("/usuarios", response_model=UsuariosList)
async def usuarios_de_la_org(
    ctx: dict = Depends(requiere_rol("admin", "editor")),
) -> UsuariosList:
    """Usuarios activos de la org (aislado por org_id del JWT). Solo metadata."""
    rows = providers.get_store().list_org_users(ctx["org_id"])
    items = [
        UsuarioOut(
            id=str(u["id"]), email=u["email"], name=u.get("name"),
            role=u["role"], is_active=bool(u.get("is_active", True)),
            created_at=u.get("created_at"),
        )
        for u in rows
    ]
    return UsuariosList(items=items, total=len(items))
