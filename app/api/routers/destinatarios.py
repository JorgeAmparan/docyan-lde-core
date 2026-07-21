"""
Router `/destinatarios` — Directorio de Destinatarios del tenant (ED-1 §2.5).

DOCYAN LDE™ by XCID.

CRUD del admin sobre el Directorio. Scope multi-tenant estricto (`org_id` de la
sesión). Guardrail canónico: **el admin da de alta, el operador solo selecciona.**
Ningún endpoint de envío del sistema acepta un email libre — solo `destinatario_id`
que resuelve contra este directorio.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import requiere_rol
from app.api.blocking import run_blocking
from app.api.routers._eventos_deps import dep_directorio_store
from app.eventos_dirigidos.directorio import Destinatario, DirectorioError
from app.schemas.eventos_dirigidos import (
    DestinatarioCreate,
    DestinatarioOut,
    DestinatarioUpdate,
)

router = APIRouter(prefix="/destinatarios", tags=["destinatarios"])


def _out(d: Destinatario) -> DestinatarioOut:
    return DestinatarioOut(**{k: v for k, v in d.to_dict().items() if k in DestinatarioOut.model_fields})


@router.get("", response_model=list[DestinatarioOut])
async def listar(
    solo_activos: bool = False,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_directorio_store),
):
    org_id = ctx["org_id"]
    items = await run_blocking(store.listar, org_id, endpoint="/destinatarios", solo_activos=solo_activos)
    return [_out(d) for d in items]


@router.post("", response_model=DestinatarioOut, status_code=201)
async def crear(
    req: DestinatarioCreate,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_directorio_store),
):
    org_id = ctx["org_id"]
    d = Destinatario(org_id=org_id, **req.model_dump())
    try:
        creado = await run_blocking(store.crear, d, endpoint="/destinatarios")
    except DirectorioError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _out(creado)


@router.patch("/{destinatario_id}", response_model=DestinatarioOut)
async def actualizar(
    destinatario_id: str,
    req: DestinatarioUpdate,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_directorio_store),
):
    org_id = ctx["org_id"]
    cambios = {k: v for k, v in req.model_dump().items() if v is not None}
    try:
        actualizado = await run_blocking(
            store.actualizar, org_id, destinatario_id, cambios, endpoint="/destinatarios"
        )
    except DirectorioError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if actualizado is None:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado.")
    return _out(actualizado)


@router.delete("/{destinatario_id}", status_code=204)
async def borrar(
    destinatario_id: str,
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_directorio_store),
):
    org_id = ctx["org_id"]
    ok = await run_blocking(store.borrar, org_id, destinatario_id, endpoint="/destinatarios")
    if not ok:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado.")
    return None
