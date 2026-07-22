"""
Router `/solicitudes` — Pilar 3, Data Accionable (ED-2 §2.5).

DOCYAN LDE™ by XCID.

Crear (valida destinatario del Directorio; hereda provenance; dispara notificación
vía el motor ED-1), bandeja (enviadas/recibidas con filtros), detalle y transiciones
de ciclo de vida (cada una con FAT). El destinatario SIEMPRE resuelve contra el
Directorio del tenant — jamás un email libre ni cross-tenant. Multi-tenant estricto.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import verificar_credenciales
from app.api.blocking import run_blocking
from app.api.routers._eventos_deps import (
    dep_directorio_store,
    dep_dkg,
    dep_fat,
    dep_notificador,
    dep_solicitud_store,
    dep_tipo_solicitud_store,
)
from app.eventos_dirigidos import ciclo_vida
from app.schemas.solicitudes import (
    MapeoInferencia,
    MapeoRegla,
    SolicitudCreate,
    SolicitudListado,
    SolicitudOut,
    TransicionRequest,
)
from app.solicitudes import inferencia as _inferencia
from app.solicitudes import servicio as _servicio

logger = logging.getLogger("docyan.api.solicitudes")

router = APIRouter(prefix="/solicitudes", tags=["solicitudes"])


def _out(s) -> SolicitudOut:
    return SolicitudOut(**{k: v for k, v in s.to_dict().items() if k in SolicitudOut.model_fields})


def _destinatario_ids_del_usuario(directorio_store, org_id: str, user_id: str | None) -> list[str]:
    """Destinatarios del Directorio que resuelven al usuario (colaborador o miembro de depto)."""
    if not user_id:
        return []
    ids: list[str] = []
    for d in directorio_store.listar(org_id):
        if d.usuario_id == user_id or (user_id in (d.miembros or [])):
            ids.append(d.id)
    return ids


# ── Mapeo de inferencia (inventario/diagnóstico §2.3) ─────────────────────────
@router.get("/mapeo-inferencia", response_model=MapeoInferencia)
async def mapeo_inferencia(ctx: dict = Depends(verificar_credenciales)):
    return MapeoInferencia(
        version=_inferencia.MAPEO_VERSION,
        reglas=[MapeoRegla(**r) for r in _inferencia.reglas()],
    )


# ── Crear ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=SolicitudOut, status_code=201)
async def crear(
    req: SolicitudCreate,
    ctx: dict = Depends(verificar_credenciales),
    directorio_store=Depends(dep_directorio_store),
    tipo_store=Depends(dep_tipo_solicitud_store),
    solicitud_store=Depends(dep_solicitud_store),
    dkg=Depends(dep_dkg),
    notificador=Depends(dep_notificador),
    fat=Depends(dep_fat),
):
    org_id = ctx["org_id"]
    prov = req.dato_origen.model_dump() if req.dato_origen else None
    if prov:
        prov["dato_origen_nodo_id"] = prov.pop("nodo_id", None)

    def _work():
        return _servicio.crear_solicitud(
            tenant_id=org_id,
            destinatario_id=req.destinatario_id,
            tipo_id=req.tipo_id,
            etiqueta_libre=req.etiqueta_libre,
            mensaje=req.mensaje,
            campos_tipados=req.campos_tipados,
            provenance=prov,
            consulta_id=req.consulta_id,
            solicitante_id=ctx.get("user_id"),
            solicitante_nombre=ctx.get("email") or ctx.get("user_id"),
            solicitante_email=ctx.get("email"),
            entidad_id=req.entidad_id,
            codo_id=req.codo_id,
            directorio_store=directorio_store,
            tipo_store=tipo_store,
            solicitud_store=solicitud_store,
            dkg=dkg,
            notificador=notificador,
            fat=fat,
        )

    try:
        solicitud = await run_blocking(_work, endpoint="/solicitudes")
    except _servicio.DestinatarioInvalido as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except _servicio.TipoInvalido as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _out(solicitud)


# ── Bandeja (enviadas / recibidas) ────────────────────────────────────────────
@router.get("", response_model=SolicitudListado)
async def listar(
    buzon: str = Query("enviadas", pattern="^(enviadas|recibidas)$"),
    estado: str | None = Query(None),
    tipo_id: str | None = Query(None),
    ctx: dict = Depends(verificar_credenciales),
    directorio_store=Depends(dep_directorio_store),
    solicitud_store=Depends(dep_solicitud_store),
):
    org_id = ctx["org_id"]
    user_id = ctx.get("user_id")

    def _work():
        if buzon == "recibidas":
            dids = _destinatario_ids_del_usuario(directorio_store, org_id, user_id)
            return solicitud_store.listar_recibidas(org_id, dids, estado=estado, tipo_id=tipo_id)
        return solicitud_store.listar_enviadas(org_id, user_id, estado=estado, tipo_id=tipo_id)

    items = await run_blocking(_work, endpoint="/solicitudes/listar")
    return SolicitudListado(solicitudes=[_out(s) for s in items], total=len(items))


# ── Detalle ───────────────────────────────────────────────────────────────────
@router.get("/{solicitud_id}", response_model=SolicitudOut)
async def detalle(
    solicitud_id: str,
    ctx: dict = Depends(verificar_credenciales),
    directorio_store=Depends(dep_directorio_store),
    solicitud_store=Depends(dep_solicitud_store),
):
    org_id = ctx["org_id"]
    user_id = ctx.get("user_id")

    def _work():
        s = solicitud_store.obtener(org_id, solicitud_id)
        if s is None:
            return None
        dids = set(_destinatario_ids_del_usuario(directorio_store, org_id, user_id))
        autorizado = (
            ctx.get("role") == "admin" or s.solicitante_id == user_id or s.destinatario_id in dids
        )
        return (s, autorizado)

    res = await run_blocking(_work, endpoint="/solicitudes/detalle")
    if res is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    s, autorizado = res
    if not autorizado:
        raise HTTPException(status_code=403, detail="No tiene acceso a esta solicitud.")
    return _out(s)


# ── Transiciones de ciclo de vida ─────────────────────────────────────────────
@router.post("/{solicitud_id}/transicion", response_model=SolicitudOut)
async def transicionar(
    solicitud_id: str,
    req: TransicionRequest,
    ctx: dict = Depends(verificar_credenciales),
    solicitud_store=Depends(dep_solicitud_store),
    dkg=Depends(dep_dkg),
    fat=Depends(dep_fat),
):
    org_id = ctx["org_id"]
    actor_id = ctx.get("user_id") or "api"

    def _work():
        return _servicio.aplicar_transicion(
            tenant_id=org_id,
            solicitud_id=solicitud_id,
            accion=req.accion,
            actor_id=actor_id,
            solicitud_store=solicitud_store,
            dkg=dkg,
            fat=fat,
        )

    try:
        s = await run_blocking(_work, endpoint="/solicitudes/transicion")
    except _servicio.SolicitudNoEncontrada:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    except (ciclo_vida.TransicionInvalida, ciclo_vida.AccionDesconocida) as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _out(s)
