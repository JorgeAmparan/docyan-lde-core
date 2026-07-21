"""
Router `/tipos-solicitud` — catálogo :TipoSolicitud por tenant (ED-2 §2.1).

DOCYAN LDE™ by XCID.

CRUD del admin sobre el catálogo (tipado abierto §3.1.1) + propuestas de promoción
de etiquetas libres repetidas. El listado siembra los 5 tipos base de forma
idempotente (onboarding + backfill de tenants existentes). Scope multi-tenant
estricto por `org_id` de la sesión.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import requiere_rol, verificar_credenciales
from app.api.blocking import run_blocking
from app.api.routers._eventos_deps import dep_solicitud_store, dep_tipo_solicitud_store
from app.schemas.solicitudes import (
    PropuestaPromocion,
    PropuestasListado,
    TipoSolicitudCreate,
    TipoSolicitudOut,
    TipoSolicitudUpdate,
)
from app.solicitudes import tipos as _tipos

router = APIRouter(prefix="/tipos-solicitud", tags=["solicitudes"])


def _out(t: _tipos.TipoSolicitud) -> TipoSolicitudOut:
    return TipoSolicitudOut(
        **{k: v for k, v in t.to_dict().items() if k in TipoSolicitudOut.model_fields}
    )


@router.get("", response_model=list[TipoSolicitudOut])
async def listar(
    solo_activos: bool = True,
    ctx: dict = Depends(verificar_credenciales),
    store=Depends(dep_tipo_solicitud_store),
):
    org_id = ctx["org_id"]

    def _work():
        _tipos.asegurar_semilla(store, org_id)  # onboarding + backfill idempotente
        return store.listar(org_id, solo_activos=solo_activos)

    items = await run_blocking(_work, endpoint="/tipos-solicitud")
    return [_out(t) for t in items]


@router.post("", response_model=TipoSolicitudOut, status_code=201)
async def crear(
    req: TipoSolicitudCreate,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_tipo_solicitud_store),
):
    org_id = ctx["org_id"]
    t = _tipos.TipoSolicitud(
        org_id=org_id,
        nombre=req.nombre,
        campos=[c.model_dump() for c in req.campos],
        destinatarios_sugeridos=list(req.destinatarios_sugeridos),
        activo=req.activo,
    )
    try:
        creado = await run_blocking(store.crear, t, endpoint="/tipos-solicitud")
    except _tipos.TipoSolicitudError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _out(creado)


@router.get("/propuestas", response_model=PropuestasListado)
async def propuestas(
    ctx: dict = Depends(requiere_rol("admin")),
    solicitud_store=Depends(dep_solicitud_store),
):
    """
    Etiquetas libres repetidas (>= umbral) que el sistema PROPONE promover a tipo.
    Aceptar = crear el tipo con POST /tipos-solicitud (el sistema propone, no actúa).
    """
    org_id = ctx["org_id"]
    items = await run_blocking(
        solicitud_store.propuestas_promocion,
        org_id,
        _tipos.UMBRAL_PROMOCION,
        endpoint="/tipos-solicitud/propuestas",
    )
    return PropuestasListado(
        propuestas=[PropuestaPromocion(**p) for p in items],
        umbral=_tipos.UMBRAL_PROMOCION,
    )


@router.patch("/{tipo_id}", response_model=TipoSolicitudOut)
async def actualizar(
    tipo_id: str,
    req: TipoSolicitudUpdate,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_tipo_solicitud_store),
):
    org_id = ctx["org_id"]
    cambios: dict = {}
    if req.nombre is not None:
        cambios["nombre"] = req.nombre
    if req.campos is not None:
        cambios["campos"] = [c.model_dump() for c in req.campos]
    if req.destinatarios_sugeridos is not None:
        cambios["destinatarios_sugeridos"] = list(req.destinatarios_sugeridos)
    if req.activo is not None:
        cambios["activo"] = req.activo
    try:
        actualizado = await run_blocking(
            store.actualizar, org_id, tipo_id, cambios, endpoint="/tipos-solicitud"
        )
    except _tipos.TipoSolicitudError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if actualizado is None:
        raise HTTPException(status_code=404, detail="Tipo de solicitud no encontrado.")
    return _out(actualizado)


@router.delete("/{tipo_id}", status_code=204)
async def borrar(
    tipo_id: str,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_tipo_solicitud_store),
):
    org_id = ctx["org_id"]
    ok = await run_blocking(store.borrar, org_id, tipo_id, endpoint="/tipos-solicitud")
    if not ok:
        raise HTTPException(status_code=404, detail="Tipo de solicitud no encontrado.")
    return None
