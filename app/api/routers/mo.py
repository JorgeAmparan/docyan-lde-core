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
from app.api.blocking import run_blocking
from app.orchestrator import providers
from app.orchestrator.master_orchestrator import MasterOrchestrator
from app.orchestrator.models import Canal, MORequest, SessionType
from app.schemas.pipeline_payloads import ConsultaResuelta
from app.schemas.playbook_payloads import (
    AceptarSugerenciaRequest,
    AceptarSugerenciaResponse,
    ActualizarPlaybookRequest,
    ConsultaGuardadaOut,
    ConsultasGuardadasList,
    CrearPlaybookRequest,
    DispararConsultaResponse,
    DispararPlaybookResponse,
    GuardarConsultaRequest,
    PlaybookOut,
    RenombrarRequest,
    SeedVerticalRequest,
    SeedVerticalResponse,
    SugerenciaOut,
)

router = APIRouter(prefix="/mo", tags=["master-orchestrator"])


def get_pb() -> dict:
    """Bundle de servicios de Playbooks (Niveles A/B/C). Override en tests."""
    return providers.get_playbook_services()


def _user(ctx: dict) -> str:
    """Actor estable: user_id del JWT o, en auth por API-key, el org_id (admin)."""
    return ctx.get("user_id") or ctx["org_id"]


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
    # B8: contexto de la consulta para clasificación + navegación de pipeline.
    entidad_id: str | None = None
    # Documento activo del CoDo (documento suelto). Acota el retrieval a ese
    # :DocumentoSource y segrega el caché PCL — sin él, una consulta puede citar el
    # contenido de otro documento del mismo tenant (cross-citation, aislamiento).
    documento_id: str | None = None
    token_qr: str | None = None
    tipo_documento: str | None = None
    criticidad: str | None = None
    params: dict = {}


class QueryResponse(BaseModel):
    """Respuesta tipada de `POST /mo/query` (B8): clasificación + payload tipado."""

    ok: bool
    kind: str
    canal: str
    servido: bool
    session_id: str | None = None
    resultado: ConsultaResuelta


class IngestaRequest(BaseModel):
    texto_documento: str
    nombre_archivo: str = "documento"
    tipo_documento: str | None = None
    canal: Canal = Canal.api
    session_id: str | None = None


# ── CoDos consultables (cierre del ciclo de consulta, B13) ─────────────────────


class CodoOut(BaseModel):
    """Un CoDo consultable del tenant (entidad operativa o documento suelto)."""

    id: str
    tipo: str  # "entidad" | "documento"
    nombre: str
    tipo_documento: str | None = None
    documentos: int = 0
    alertas: int = 0  # nº de alertas administrativas pendientes (conteo real del grafo)
    estado: str = "ok"  # "ok" | "warn" (warn = alertas administrativas pendientes)


class CodosResponse(BaseModel):
    items: list[CodoOut]
    total: int


class DocumentoRefOut(BaseModel):
    id: str
    nombre: str | None = None
    tipo: str | None = None


class CodoContextoOut(BaseModel):
    """
    Contexto de consulta de un CoDo (lo que antes fingía `CANNED_CTX` en el frontend).
    `entidad_id` es el id real de la entidad cuando el CoDo es una entidad; None para
    un documento suelto (la consulta corre con scope de tenant).
    """

    id: str
    tipo: str
    entidad_id: str | None = None
    nombre: str
    titulo: str
    meta: str
    documentos: list[DocumentoRefOut] = []


class RelacionInmediata(BaseModel):
    """Una relación inmediata de un CoDo en el grafo (alimenta `RelDetail`)."""

    id: str
    tipo: str
    icono: str
    titulo: str
    tag: str
    severidad: str = "muted"  # ok | warn | caution | muted
    nota: str | None = None
    meta: str | None = None


class ConsultaSugerida(BaseModel):
    """Consulta sugerida sobre un documento, derivada de su contenido en el grafo."""

    icono: str
    texto: str
    tipo_intencion: str


class RecursoApoyo(BaseModel):
    """Recurso de apoyo adjunto a un documento (video, etc.)."""

    id: str
    tipo: str
    titulo: str
    meta: str | None = None


class CodoRelacionesOut(BaseModel):
    """Relaciones inmediatas + sugerencias por doc + recursos de un CoDo (P1)."""

    codo_id: str
    tipo_codo: str
    relaciones: list[RelacionInmediata] = []
    consultas_sugeridas: list[ConsultaSugerida] = []
    recursos: list[RecursoApoyo] = []


# ── Sesiones ────────────────────────────────────────────────────────────────────


@router.post("/sessions")
async def crear_sesion(
    body: CrearSesionRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    sid = await run_blocking(
        mo.iniciar_sesion, ctx, body.session_type, body.canal, body.initial_state,
        endpoint="/mo/sessions",
    )
    return {"session_id": sid, "session_type": body.session_type.value, "canal": body.canal.value}


@router.get("/sessions/{session_id}")
async def obtener_sesion(
    session_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    state = await run_blocking(
        mo.session_manager.get_session, session_id, endpoint="/mo/sessions/{id}"
    )
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
    state = await run_blocking(
        mo.session_manager.get_session, session_id, endpoint="/mo/sessions/{id}/transfer"
    )
    if state is None or state.tenant_id != ctx["org_id"]:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    nuevo = await run_blocking(
        mo.transferir_sesion, session_id, body.canal, endpoint="/mo/sessions/{id}/transfer"
    )
    return {"session_id": session_id, "canal": nuevo.canal, "state": nuevo.state}


@router.post("/sessions/{session_id}/close")
async def cerrar_sesion(
    session_id: str,
    body: CerrarSesionRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    state = await run_blocking(
        mo.session_manager.get_session, session_id, endpoint="/mo/sessions/{id}/close"
    )
    if state is None or state.tenant_id != ctx["org_id"]:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    completed = await run_blocking(
        mo.cerrar_sesion, session_id, body.reason, endpoint="/mo/sessions/{id}/close"
    )
    return {"session_id": session_id, "cerrada": True, "spillover": completed is not None}


# ── Consulta / Ingesta ──────────────────────────────────────────────────────────


@router.post("/query", response_model=QueryResponse)
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
            "criticidad": body.criticidad,
            "entidad_id": body.entidad_id,
            "documento_id": body.documento_id,
            "token_qr": body.token_qr,
            "tipo_documento": body.tipo_documento,
            "params": body.params,
        },
        session_id=body.session_id,
    )
    actor = _user(ctx)
    resp = await run_blocking(
        mo.handle_request,
        req,
        endpoint="/mo/query",
        audit=lambda: mo.audit_logger.event(
            ctx["org_id"], "consulta_timeout", actor,
            {"canal": body.canal.value, "texto_len": len(body.texto)},
        ),
    )
    if not resp.servido:
        raise HTTPException(status_code=403, detail=resp.motivo_bloqueo or "Output retenido.")
    return QueryResponse(
        ok=resp.ok,
        kind=resp.kind.value,
        canal=resp.canal.value,
        servido=resp.servido,
        session_id=resp.session_id,
        resultado=ConsultaResuelta(**resp.data),
    )


# ── CoDos consultables ──────────────────────────────────────────────────────────


@router.get("/codos", response_model=CodosResponse)
async def listar_codos(
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
) -> CodosResponse:
    """
    Lista los CoDos consultables del tenant autenticado: entidades operativas (QR) +
    documentos sueltos (onboarding freemium). Datos REALES del grafo del tenant; sin
    fallback enlatado. Aislamiento multi-tenant: solo el grafo del `org_id` del JWT.
    """
    from app.graph import dkg_codos
    from app.onboarding import providers as onb

    tenant_id = ctx["org_id"]
    rows = await run_blocking(
        dkg_codos.listar_codos, onb.get_dkg(), tenant_id, endpoint="/mo/codos"
    )
    items = [CodoOut(**r) for r in rows]
    return CodosResponse(items=items, total=len(items))


@router.get("/codos/{codo_id}", response_model=CodoContextoOut)
async def contexto_codo(
    codo_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
) -> CodoContextoOut:
    """
    Contexto de consulta de un CoDo del tenant (entidad o documento suelto). 404 si el
    id no existe en el grafo del tenant — sin filtrar existencia de otros tenants.
    """
    from app.graph import dkg_codos
    from app.onboarding import providers as onb

    tenant_id = ctx["org_id"]
    ctxd = await run_blocking(
        dkg_codos.contexto_codo, onb.get_dkg(), tenant_id, codo_id,
        endpoint="/mo/codos/{id}",
    )
    if ctxd is None:
        raise HTTPException(status_code=404, detail="CoDo no encontrado.")
    return CodoContextoOut(
        id=ctxd["id"], tipo=ctxd["tipo"], entidad_id=ctxd.get("entidad_id"),
        nombre=ctxd["nombre"], titulo=ctxd["titulo"], meta=ctxd["meta"],
        documentos=[DocumentoRefOut(**d) for d in ctxd.get("documentos", [])],
    )


@router.get("/codos/{codo_id}/relaciones", response_model=CodoRelacionesOut)
async def relaciones_codo(
    codo_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
) -> CodoRelacionesOut:
    """
    Relaciones inmediatas de un CoDo (del grafo real) + consultas sugeridas por
    documento + recursos de apoyo. 404 si el CoDo no existe en el grafo del tenant.
    Alimenta el Expediente (P1): rama "Relaciones inmediatas", RelDetail, sugerencias.
    """
    from app.graph import dkg_codos, dkg_relaciones, dkg_sugerencias_doc
    from app.onboarding import providers as onb

    tenant_id = ctx["org_id"]
    dkg = onb.get_dkg()

    def _cargar() -> dict | None:
        """Hasta 4 round-trips a FalkorDB; se corren juntos en un solo thread."""
        ctxd = dkg_codos.contexto_codo(dkg, tenant_id, codo_id)
        if ctxd is None:
            return None
        relaciones = dkg_relaciones.relaciones_de_codo(dkg, tenant_id, codo_id, ctxd["tipo"])
        sugeridas: list[dict] = []
        recursos: list[dict] = []
        docs = ctxd.get("documentos") or []
        if docs:
            doc_id = docs[0]["id"]
            sugeridas = dkg_sugerencias_doc.sugerencias_por_documento(dkg, tenant_id, doc_id)
            recursos = [
                r for r in dkg_relaciones.relaciones_de_documento(dkg, tenant_id, doc_id)
                if r.get("tipo") == "video"
            ]
        return {"ctxd": ctxd, "relaciones": relaciones, "sugeridas": sugeridas, "recursos": recursos}

    data = await run_blocking(_cargar, endpoint="/mo/codos/{id}/relaciones")
    if data is None:
        raise HTTPException(status_code=404, detail="CoDo no encontrado.")
    ctxd = data["ctxd"]
    relaciones = data["relaciones"]
    sugeridas = data["sugeridas"]
    recursos = data["recursos"]

    return CodoRelacionesOut(
        codo_id=codo_id,
        tipo_codo=ctxd["tipo"],
        relaciones=[RelacionInmediata(**r) for r in relaciones],
        consultas_sugeridas=[ConsultaSugerida(**s) for s in sugeridas],
        recursos=[
            RecursoApoyo(
                id=r["id"], tipo=r.get("tipo", "video"),
                titulo=r.get("titulo") or "Video de apoyo", meta=r.get("meta"),
            )
            for r in recursos
        ],
    )


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
    resp = await run_blocking(mo.handle_request, req, endpoint="/mo/ingesta")
    return resp.to_dict()


@router.post("/ingesta/{job_id}/confirm")
async def confirmar_ingesta(
    job_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    mo: MasterOrchestrator = Depends(get_mo),
):
    try:
        resultado = await run_blocking(
            mo.confirmar_ingesta, job_id, ctx["org_id"], ctx.get("user_id") or "system",
            endpoint="/mo/ingesta/{id}/confirm",
        )
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=409, detail=str(e))
    return resultado


# ── Nivel A — Consultas guardadas (B8 §B1) ────────────────────────────────────


@router.post("/queries/save", response_model=ConsultaGuardadaOut)
async def guardar_consulta(
    body: GuardarConsultaRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    def _work() -> dict:
        consulta = pb["consultas"].guardar(
            tenant_id=ctx["org_id"], user_id=_user(ctx), nombre=body.nombre,
            consulta_original=body.consulta_original, tipo_intencion=body.tipo_intencion,
            tipo_documento_origen=body.tipo_documento_origen,
            entidad_referenciada_id=body.entidad_referenciada_id, metadata=body.metadata,
        )
        mo.audit_logger.event(
            ctx["org_id"], "consulta_guardada", _user(ctx),
            {"consulta_id": consulta["id"], "tipo_intencion": body.tipo_intencion},
        )
        return consulta

    consulta = await run_blocking(_work, endpoint="/mo/queries/save")
    return ConsultaGuardadaOut(**consulta)


@router.get("/queries/saved", response_model=ConsultasGuardadasList)
async def listar_consultas_guardadas(
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    pb: dict = Depends(get_pb),
):
    def _work() -> tuple[list, bool]:
        return (
            pb["consultas"].listar(ctx["org_id"], _user(ctx)),
            pb["consultas"].termino_playbook_disponible(ctx["org_id"], _user(ctx)),
        )

    items, disponible = await run_blocking(_work, endpoint="/mo/queries/saved")
    return ConsultasGuardadasList(
        items=[ConsultaGuardadaOut(**c) for c in items],
        termino_playbook_disponible=disponible,
    )


@router.post("/queries/saved/{consulta_id}/run", response_model=DispararConsultaResponse)
async def disparar_consulta_guardada(
    consulta_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    def _work() -> dict:
        res = pb["consultas"].disparar(ctx["org_id"], consulta_id, mo, ctx)
        mo.audit_logger.event(
            ctx["org_id"], "consulta_guardada_disparada", _user(ctx),
            {"consulta_id": consulta_id},
        )
        return res

    try:
        res = await run_blocking(
            _work, endpoint="/mo/queries/saved/{id}/run",
            audit=lambda: mo.audit_logger.event(
                ctx["org_id"], "consulta_timeout", _user(ctx),
                {"consulta_guardada_id": consulta_id},
            ),
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return DispararConsultaResponse(
        consulta=ConsultaGuardadaOut(**res["consulta"]),
        resultado=ConsultaResuelta(**res["resultado"]),
        servido=res["servido"],
    )


@router.delete("/queries/saved/{consulta_id}")
async def borrar_consulta_guardada(
    consulta_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    try:
        ok = await run_blocking(
            pb["consultas"].borrar, ctx["org_id"], consulta_id,
            endpoint="/mo/queries/saved/{id}",
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Consulta guardada no encontrada.")
    await run_blocking(
        mo.audit_logger.event,
        ctx["org_id"], "consulta_guardada_borrada", _user(ctx), {"consulta_id": consulta_id},
        endpoint="/mo/queries/saved/{id}",
    )
    return {"consulta_id": consulta_id, "borrada": True}


@router.patch("/queries/saved/{consulta_id}", response_model=ConsultaGuardadaOut)
async def renombrar_consulta_guardada(
    consulta_id: str,
    body: RenombrarRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    pb: dict = Depends(get_pb),
):
    actualizada = await run_blocking(
        pb["consultas"].renombrar, ctx["org_id"], consulta_id, body.nombre,
        endpoint="/mo/queries/saved/{id} (patch)",
    )
    if actualizada is None:
        raise HTTPException(status_code=404, detail="Consulta guardada no encontrada.")
    return ConsultaGuardadaOut(**actualizada)


# ── Nivel C — Sugerencias (B8 §B3) — declaradas ANTES de /playbooks/{id} ──────


@router.get("/playbooks/sugerencias", response_model=list[SugerenciaOut])
async def listar_sugerencias(
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    pb: dict = Depends(get_pb),
):
    pendientes = await run_blocking(
        pb["sugerencias"].listar_pendientes, ctx["org_id"], _user(ctx),
        endpoint="/mo/playbooks/sugerencias",
    )
    return [SugerenciaOut(**s) for s in pendientes]


@router.post("/playbooks/sugerencias/{sugerencia_id}/accept",
             response_model=AceptarSugerenciaResponse)
async def aceptar_sugerencia(
    sugerencia_id: str,
    body: AceptarSugerenciaRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    def _work() -> dict:
        res = pb["sugerencias"].aceptar(ctx["org_id"], sugerencia_id, _user(ctx), body.nombre)
        mo.audit_logger.event(
            ctx["org_id"], "sugerencia_aceptada", _user(ctx),
            {"sugerencia_id": sugerencia_id, "playbook_id": res["playbook"]["id"]},
        )
        return res

    try:
        res = await run_blocking(_work, endpoint="/mo/playbooks/sugerencias/{id}/accept")
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AceptarSugerenciaResponse(
        sugerencia_id=res["sugerencia_id"], playbook=PlaybookOut(**res["playbook"])
    )


@router.post("/playbooks/sugerencias/{sugerencia_id}/reject", response_model=SugerenciaOut)
async def rechazar_sugerencia(
    sugerencia_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    def _work() -> dict:
        sug = pb["sugerencias"].rechazar(ctx["org_id"], sugerencia_id)
        mo.audit_logger.event(
            ctx["org_id"], "sugerencia_rechazada", _user(ctx), {"sugerencia_id": sugerencia_id}
        )
        return sug

    try:
        sug = await run_blocking(_work, endpoint="/mo/playbooks/sugerencias/{id}/reject")
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return SugerenciaOut(**sug)


@router.post("/playbooks/sugerencias/{sugerencia_id}/ignore", response_model=SugerenciaOut)
async def ignorar_sugerencia(
    sugerencia_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    pb: dict = Depends(get_pb),
):
    try:
        sug = await run_blocking(
            pb["sugerencias"].ignorar, ctx["org_id"], sugerencia_id,
            endpoint="/mo/playbooks/sugerencias/{id}/ignore",
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return SugerenciaOut(**sug)


# ── Nivel B — Playbooks (B8 §B2) ──────────────────────────────────────────────


@router.post("/playbooks", response_model=PlaybookOut)
async def crear_playbook(
    body: CrearPlaybookRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    pasos = [p.model_dump() for p in body.pasos]

    def _work() -> dict:
        playbook = pb["playbooks"].crear(
            tenant_id=ctx["org_id"], user_id=_user(ctx), nombre=body.nombre,
            descripcion=body.descripcion, pasos=pasos,
        )
        mo.audit_logger.event(
            ctx["org_id"], "playbook_creado", _user(ctx),
            {"playbook_id": playbook["id"], "pasos": len(pasos)},
        )
        return playbook

    playbook = await run_blocking(_work, endpoint="/mo/playbooks")
    return PlaybookOut(**playbook)


@router.get("/playbooks", response_model=list[PlaybookOut])
async def listar_playbooks(
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    pb: dict = Depends(get_pb),
):
    plist = await run_blocking(
        pb["playbooks"].listar, ctx["org_id"], endpoint="/mo/playbooks (list)"
    )
    return [PlaybookOut(**p) for p in plist]


@router.post("/playbooks/seed_for_vertical", response_model=SeedVerticalResponse)
async def seed_for_vertical(
    body: SeedVerticalRequest,
    ctx: dict = Depends(requiere_rol("admin")),
    pb: dict = Depends(get_pb),
):
    from app.playbooks.seed_vertical import seed_for_vertical as _seed

    creados = await run_blocking(
        _seed, ctx["org_id"], body.vertical, pb["store"],
        endpoint="/mo/playbooks/seed_for_vertical", user_id=_user(ctx),
    )
    nota = None if creados else "Sin contenido para este vertical en B8 (se llena en B13)."
    return SeedVerticalResponse(
        vertical=body.vertical, creados=[PlaybookOut(**c) for c in creados], nota=nota
    )


@router.post("/playbooks/{playbook_id}/run", response_model=DispararPlaybookResponse)
async def disparar_playbook(
    playbook_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    try:
        res = await run_blocking(
            pb["playbooks"].disparar,
            ctx["org_id"], playbook_id, mo, ctx,
            endpoint="/mo/playbooks/{id}/run",
            audit_logger=mo.audit_logger, actor=_user(ctx),
            audit=lambda: mo.audit_logger.event(
                ctx["org_id"], "consulta_timeout", _user(ctx),
                {"playbook_id": playbook_id},
            ),
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return DispararPlaybookResponse(
        playbook=PlaybookOut(**res["playbook"]),
        vista_unificada=res["vista_unificada"],
    )


@router.patch("/playbooks/{playbook_id}", response_model=PlaybookOut)
async def actualizar_playbook(
    playbook_id: str,
    body: ActualizarPlaybookRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
    pb: dict = Depends(get_pb),
):
    pasos = [p.model_dump() for p in body.pasos] if body.pasos is not None else None
    actualizado = await run_blocking(
        pb["playbooks"].actualizar,
        ctx["org_id"], playbook_id,
        endpoint="/mo/playbooks/{id} (patch)",
        nombre=body.nombre, descripcion=body.descripcion, pasos=pasos,
    )
    if actualizado is None:
        raise HTTPException(status_code=404, detail="Playbook no encontrado.")
    return PlaybookOut(**actualizado)


@router.delete("/playbooks/{playbook_id}")
async def borrar_playbook(
    playbook_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    mo: MasterOrchestrator = Depends(get_mo),
    pb: dict = Depends(get_pb),
):
    def _work() -> bool:
        ok = pb["playbooks"].borrar(ctx["org_id"], playbook_id)
        if ok:
            mo.audit_logger.event(
                ctx["org_id"], "playbook_borrado", _user(ctx), {"playbook_id": playbook_id}
            )
        return ok

    ok = await run_blocking(_work, endpoint="/mo/playbooks/{id} (delete)")
    if not ok:
        raise HTTPException(status_code=404, detail="Playbook no encontrado.")
    return {"playbook_id": playbook_id, "borrado": True}
