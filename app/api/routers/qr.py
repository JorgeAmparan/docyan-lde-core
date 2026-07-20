"""
Router de Tokens QR (B4 §6).

DOCYAN LDE™ by XCID.

  GET  /qr/{token}            → PÚBLICO (el QR es la credencial). Resuelve a
                               contexto y redirige al frontend; `?format=json`
                               devuelve el contexto resuelto (smoke/programático).
                               Cualquier fallo → 404 (no filtra existencia).
  POST /qr/generate          → AUTENTICADO. Genera un QR para una :EntidadOperativa.
  POST /qr/revoke            → AUTENTICADO. Revoca un token por nonce.

Las dependencias (generator/resolver) se inyectan vía Depends para que los tests
sustituyan los almacenes (Supabase/DKG) por dobles en memoria.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.api.auth import requiere_rol
from app.api.blocking import run_blocking
from app.orchestrator import providers
from app.qr.qr_generator import QrGenerator
from app.qr.qr_resolver import QrResolutionError, QrResolver

router = APIRouter(prefix="/qr", tags=["qr"])


# ── Dependencias inyectables (override en tests) ──────────────────────────────


def get_qr_generator() -> QrGenerator:
    return providers.get_qr_generator()


def get_qr_resolver() -> QrResolver:
    return providers.get_qr_resolver()


# ── Modelos ───────────────────────────────────────────────────────────────────


class GenerarQrRequest(BaseModel):
    entidad_id: str
    ttl_dias: int | None = None
    render: bool = True


class RevocarQrRequest(BaseModel):
    nonce: str


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("/generate")
async def generar_qr(
    body: GenerarQrRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    generator: QrGenerator = Depends(get_qr_generator),
):
    """Genera y registra un QR para una entidad del tenant autenticado."""
    qr = await run_blocking(
        generator.generar, endpoint="/qr/generate",
        tenant_id=ctx["org_id"],
        entidad_id=body.entidad_id,
        created_by=ctx.get("user_id"),
        ttl_dias=body.ttl_dias,
        render=body.render,
    )
    return qr.to_dict()


@router.post("/revoke")
async def revocar_qr(
    body: RevocarQrRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    generator: QrGenerator = Depends(get_qr_generator),
):
    """Revoca un token QR del tenant (por nonce). Tras esto, no resuelve."""
    ok = await run_blocking(
        generator.revocar, ctx["org_id"], body.nonce, endpoint="/qr/revoke"
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Token no encontrado o ya revocado.")
    return {"revocado": True, "nonce": body.nonce}


@router.get("/{token}")
async def resolver_qr(
    token: str,
    format: str = Query(default="redirect", pattern="^(redirect|json)$"),
    resolver: QrResolver = Depends(get_qr_resolver),
):
    """
    PÚBLICO. Resuelve el token a contexto. `redirect` (default) → 307 al frontend;
    `json` → contexto resuelto. Cualquier fallo → 404 sin detalle (no filtra
    existencia: aislamiento multi-tenant absoluto).
    """
    try:
        resuelto = await run_blocking(resolver.resolve, token, endpoint="/qr/{token}")
    except QrResolutionError:
        raise HTTPException(status_code=404, detail="Recurso no encontrado.")

    if format == "json":
        return resuelto.to_dict()
    return RedirectResponse(url=resuelto.frontend_url, status_code=307)
