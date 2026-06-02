"""
Router del Master Orchestrator (B4 §1).

DOCYAN LDE™ by XCID.

Expone el MO por API para que las UIs (B8+) y los smoke tests lo ejerciten:

  POST /mo/sessions                      → crea sesión (TTL por tipo).
  GET  /mo/sessions/{session_id}         → estado (aislado por tenant).
  POST /mo/sessions/{session_id}/transfer→ transfiere de canal (preserva estado).
  POST /mo/sessions/{session_id}/close   → cierra (spillover a Supabase).
  POST /mo/query                         → consulta (router mínimo B4 + gate + canal).
  POST /mo/ingesta                       → cotiza ingesta (gate sin bypass).
  POST /mo/ingesta/{job_id}/confirm      → confirma e encola el job aprobado.

El MO se inyecta vía Depends para que los tests sustituyan sus backends.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth import requiere_rol
from app.orchestrator import providers
from app.orchestrator.master_orchestrator import MasterOrchestrator
from app.orchestrator.models import Canal, MORequest, SessionType

router = APIRouter(prefix="/mo", tags=["master-orchestrator"])


def get_mo() -> MasterOrchestrator:
    return providers.get_master_orchestrator()


# ── Modelos ───────────────────────────────────────────────────────────────────


class CrearSesionRequest(BaseModel):
    session_type: SessionType
    canal: Canal = Canal.pwa
    initial_state: dict = {}


class TransferirSesionRequest(BaseModel):
    canal: Canal


class CerrarSesionRequest(BaseModel):
    reason: str = "completed"


class ConsultaRequest(BaseModel):
    texto: str
    canal: Canal = Canal.pwa
    session_id: str | None = None
    score_confianza: float | None = None
    segmento_critico: bool = False


class IngestaRequest(BaseModel):
    texto_documento: str
    nombre_archivo: str = "documento"
    tipo_documento: str | None = None
    canal: Canal = Canal.api
    session_id: str | None = None


# ── Sesiones ────────────────────────────────────────────────────────────────────


@router.post("/sessions")
async def crear_sesion(
    body: CrearSesionRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    sid = mo.iniciar_sesion(ctx, body.session_type, body.canal, body.initial_state)
    return {"session_id": sid, "session_type": body.session_type.value, "canal": body.canal.value}


@router.get("/sessions/{session_id}")
async def obtener_sesion(
    session_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    state = mo.session_manager.get_session(session_id)
    # Aislamiento multi-tenant: una sesión de otro tenant NO se revela (404).
    if state is None or state.tenant_id != ctx["org_id"]:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    return {
        "session_id": state.session_id,
        "session_type": state.session_type,
        "canal": state.canal,
        "state": state.state,
        "started_at": state.started_at,
        "updated_at": state.updated_at,
    }


@router.post("/sessions/{session_id}/transfer")
async def transferir_sesion(
    session_id: str,
    body: TransferirSesionRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    state = mo.session_manager.get_session(session_id)
    if state is None or state.tenant_id != ctx["org_id"]:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    nuevo = mo.transferir_sesion(session_id, body.canal)
    return {"session_id": session_id, "canal": nuevo.canal, "state": nuevo.state}


@router.post("/sessions/{session_id}/close")
async def cerrar_sesion(
    session_id: str,
    body: CerrarSesionRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    state = mo.session_manager.get_session(session_id)
    if state is None or state.tenant_id != ctx["org_id"]:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    completed = mo.cerrar_sesion(session_id, body.reason)
    return {"session_id": session_id, "cerrada": True, "spillover": completed is not None}


# ── Consulta / Ingesta ──────────────────────────────────────────────────────────


@router.post("/query")
async def consultar(
    body: ConsultaRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    req = MORequest(
        auth=ctx,
        canal=body.canal,
        texto=body.texto,
        accion="consulta",
        payload={
            "score_confianza": body.score_confianza,
            "segmento_critico": body.segmento_critico,
        },
        session_id=body.session_id,
    )
    resp = mo.handle_request(req)
    if not resp.servido:
        raise HTTPException(status_code=403, detail=resp.motivo_bloqueo or "Output retenido.")
    return resp.to_dict()


@router.post("/ingesta")
async def ingesta(
    body: IngestaRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    req = MORequest(
        auth=ctx,
        canal=body.canal,
        accion="ingesta",
        payload={
            "texto_documento": body.texto_documento,
            "nombre_archivo": body.nombre_archivo,
            "tipo_documento": body.tipo_documento,
        },
        session_id=body.session_id,
    )
    resp = mo.handle_request(req)
    return resp.to_dict()


@router.post("/ingesta/{job_id}/confirm")
async def confirmar_ingesta(
    job_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    try:
        resultado = mo.confirmar_ingesta(job_id, ctx["org_id"], ctx.get("user_id") or "system")
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=409, detail=str(e))
    return resultado
