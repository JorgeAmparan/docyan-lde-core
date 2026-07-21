"""
Router `/notificaciones` — centro de notificaciones in-app (ED-1 §2.4.2).

DOCYAN LDE™ by XCID.

Backend del centro de notificaciones por usuario (la campana UI es ED-4): listar
no leídas/todas paginado, marcar leída, marcar todas. Vista admin de fallos de
entrega (email marcado `fallida`, §2.4.4).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import requiere_rol, verificar_credenciales
from app.api.blocking import run_blocking
from app.api.routers._eventos_deps import dep_inapp_store
from app.schemas.eventos_dirigidos import (
    NotificacionesListado,
    NotificacionOut,
)

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


def _out(n) -> NotificacionOut:
    d = n.to_dict()
    return NotificacionOut(**{k: v for k, v in d.items() if k in NotificacionOut.model_fields})


@router.get("", response_model=NotificacionesListado)
async def listar(
    solo_no_leidas: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: dict = Depends(verificar_credenciales),
    store=Depends(dep_inapp_store),
):
    org_id = ctx["org_id"]
    usuario_id = ctx.get("user_id")

    def _work():
        items = store.listar(org_id, usuario_id, solo_no_leidas=solo_no_leidas, limit=limit, offset=offset)
        no_leidas = store.contar_no_leidas(org_id, usuario_id)
        return items, no_leidas

    items, no_leidas = await run_blocking(_work, endpoint="/notificaciones")
    return NotificacionesListado(notificaciones=[_out(n) for n in items], no_leidas=no_leidas)


@router.post("/{notif_id}/leer", response_model=NotificacionOut)
async def marcar_leida(
    notif_id: str,
    ctx: dict = Depends(verificar_credenciales),
    store=Depends(dep_inapp_store),
):
    org_id = ctx["org_id"]
    n = await run_blocking(store.marcar_leida, org_id, notif_id, endpoint="/notificaciones/leer")
    if n is None:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")
    return _out(n)


@router.post("/leer-todas")
async def marcar_todas(
    ctx: dict = Depends(verificar_credenciales),
    store=Depends(dep_inapp_store),
):
    org_id = ctx["org_id"]
    usuario_id = ctx.get("user_id")
    n = await run_blocking(store.marcar_todas, org_id, usuario_id, endpoint="/notificaciones/leer-todas")
    return {"marcadas": n}


@router.get("/admin", response_model=list[NotificacionOut])
async def listar_admin(
    estado: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    ctx: dict = Depends(requiere_rol("admin")),
    store=Depends(dep_inapp_store),
):
    """Vista admin: todas las notificaciones del tenant (incl. `fallida`)."""
    org_id = ctx["org_id"]
    items = await run_blocking(store.listar_admin, org_id, endpoint="/notificaciones/admin", estado=estado, limit=limit)
    return [_out(n) for n in items]
