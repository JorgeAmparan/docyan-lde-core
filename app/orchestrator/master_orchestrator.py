"""
Master Orchestrator (B4 §1 / §2).

DOCYAN LDE™ by XCID.

Pieza central del MVP (doc 05): la FACHADA del sistema hacia el exterior. Todo
request (API, webhook WhatsApp, escaneo de QR, acción de UI, tarea programada)
termina invocando al MO. Reemplaza al `DocyanOrchestrator` (CLI pre-modelado) que
NO es el MO del plan.

Cubre las 10 responsabilidades del doc 05 coordinando sus sub-componentes:
  1. Resolución de contexto       → context_resolver
  2. Clasificación y ruteo        → intent_router
  3. Coordinación de pipelines    → pipeline_coordinator (ingesta + cotizador-gate)
  4. Gestión de estado de sesiones→ session_manager
  5. Governance Gate              → governance_gate
  6. Variante regional            → localization
  7. Adaptación a canal           → channel_adapter
  8. Scheduler proactivo          → scheduler (módulo aparte, lo arranca la API)
  9. Registro auditable en FAT    → audit_logger
 10. Errores y degradación        → error_handler

Las responsabilidades 6/7/9/10 son transversales y se aplican dentro de
`handle_request`. El clasificador de intención COMPLETO y los pipelines de
consulta (Tipos 1-8) llegan en B8: B4 deja el router mínimo y la composición.
"""
from __future__ import annotations

from app.orchestrator.audit_logger import AuditLogger
from app.orchestrator.channel_adapter import ChannelAdapter
from app.orchestrator.context_resolver import ContextResolver
from app.orchestrator.error_handler import ErrorHandler
from app.orchestrator.governance_gate import GovernanceGate
from app.orchestrator.intent_router import IntentRouter
from app.orchestrator.localization import VariantResolver
from app.orchestrator.models import (
    Canal,
    MORequest,
    MOResponse,
    RequestKind,
    SessionType,
)
from app.orchestrator.pipeline_coordinator import PipelineCoordinator
from app.orchestrator.session_manager import SessionManager

# Permiso requerido por clase de request (Governance Gate, responsabilidad 5).
PERMISO_POR_KIND: dict[RequestKind, str] = {
    RequestKind.consulta: "consulta",
    RequestKind.ingesta: "ingesta",
    RequestKind.configuracion: "configuracion",
    RequestKind.evento_programado: "evento_programado",
}


class MasterOrchestrator:
    """Fachada del sistema. Orquesta el negocio; la ingesta interna la cubre el SDK."""

    def __init__(
        self,
        context_resolver: ContextResolver | None = None,
        intent_router: IntentRouter | None = None,
        pipeline_coordinator: PipelineCoordinator | None = None,
        session_manager: SessionManager | None = None,
        governance_gate: GovernanceGate | None = None,
        localization: VariantResolver | None = None,
        channel_adapter: ChannelAdapter | None = None,
        audit_logger: AuditLogger | None = None,
        error_handler: ErrorHandler | None = None,
    ):
        self.context_resolver = context_resolver or ContextResolver()
        self.intent_router = intent_router or IntentRouter()
        self.pipeline_coordinator = pipeline_coordinator or PipelineCoordinator()
        self.session_manager = session_manager or SessionManager()
        self.governance_gate = governance_gate or GovernanceGate()
        self.localization = localization or VariantResolver()
        self.channel_adapter = channel_adapter or ChannelAdapter()
        self.audit_logger = audit_logger or AuditLogger()
        self.error_handler = error_handler or ErrorHandler()

    # ── Entrada principal ─────────────────────────────────────────────────────

    def handle_request(self, req: MORequest) -> MOResponse:
        """
        Procesa un request de punta a punta: resuelve contexto, clasifica, rutea,
        aplica Governance Gate, adapta a canal y registra en FAT. SIEMPRE deja al
        menos una entrada de auditoría (responsabilidad 9).
        """
        # 1. Contexto.
        session = (
            self.session_manager.get_session(req.session_id) if req.session_id else None
        )
        ctx = self.context_resolver.resolve(req, session=session)
        actor = ctx.user_id or ctx.email or "anon"

        self.audit_logger.request_received(
            ctx.tenant_id, actor, {"canal": ctx.canal.value, "session_id": ctx.session_id}
        )

        # 2. Clasificación / ruteo.
        kind = self.intent_router.classify(req)
        self.audit_logger.routed(ctx.tenant_id, actor, {"kind": kind.value})

        if kind == RequestKind.desconocido:
            return self._responder_bloqueo(
                ctx, kind, "No se pudo clasificar el request (ni consulta ni ingesta "
                "ni configuración ni evento).", actor, razon="desconocido"
            )

        # 3. Governance Gate de PERMISOS (antes de ejecutar el pipeline).
        permiso = PERMISO_POR_KIND.get(kind)
        decision_permiso = self.governance_gate.evaluate(
            permiso_requerido=permiso, permisos=ctx.permisos
        )
        if decision_permiso.bloqueado:
            return self._responder_bloqueo(
                ctx, kind, decision_permiso.motivo, actor,
                razon=decision_permiso.razon_codigo,
            )

        # 4. Coordinación de pipeline por clase.
        if kind == RequestKind.ingesta:
            return self._handle_ingesta(ctx, req, actor)
        if kind == RequestKind.consulta:
            return self._handle_consulta(ctx, req, actor)

        # configuracion (onboarding B13) / evento_programado (scheduler) — B4 deja
        # la interfaz; se acusa el ruteo honestamente sin fingir ejecución.
        return self._responder_ok(
            ctx, kind,
            {"ruteado_a": kind.value, "nota": "Interfaz lista; ejecución en su bloque."},
            actor,
        )

    # ── Handlers por clase ────────────────────────────────────────────────────

    def _handle_ingesta(self, ctx, req: MORequest, actor: str) -> MOResponse:
        """Cotiza (gate sin bypass) y crea el job. NO encola sin confirmación."""
        payload = req.payload or {}
        texto = payload.get("texto_documento") or req.texto or ""
        documento_ref = payload.get("documento_ref", "")
        nombre = payload.get("nombre_archivo", "documento")
        tipo = payload.get("tipo_documento")

        cotizada = self.pipeline_coordinator.cotizar_ingesta(
            tenant_id=ctx.tenant_id,
            texto_documento=texto,
            documento_ref=documento_ref,
            nombre_archivo=nombre,
            tipo_documento=tipo,
            usuario_id=ctx.user_id,
        )
        self.audit_logger.event(
            ctx.tenant_id, "ingesta_cotizada", actor,
            {
                "job_id": cotizada.job_id,
                "status": cotizada.status,
                "costo_usd": cotizada.cotizacion.costo_estimado_usd,
                "tiempo_seg": cotizada.cotizacion.tiempo_estimado_seg,
                "decision": cotizada.cotizacion.decision.value,
            },
        )
        servido = cotizada.requiere_confirmacion
        return self._responder_ok(
            ctx, RequestKind.ingesta, cotizada.to_dict(), actor, servido=servido
        )

    def confirmar_ingesta(self, job_id: str, tenant_id: str, actor: str = "system") -> dict:
        """Confirma e encola un job aprobado (gate sin bypass). Registra en FAT."""
        resultado = self.pipeline_coordinator.confirmar_ingesta(job_id)
        self.audit_logger.event(
            tenant_id, "ingesta_confirmada", actor,
            {"job_id": job_id, "status": resultado["status"]},
        )
        return resultado

    def _handle_consulta(self, ctx, req: MORequest, actor: str) -> MOResponse:
        """Compone la consulta, pasa por Governance Gate de confianza, adapta a canal."""
        payload = req.payload or {}
        contenido = self.pipeline_coordinator.componer_consulta(
            req.texto or "", payload.get("contenido_pipeline")
        )
        score = payload.get("score_confianza")
        segmento_critico = bool(payload.get("segmento_critico", False))

        decision = self.governance_gate.evaluate(
            permiso_requerido=None,
            permisos=ctx.permisos,
            score_confianza=score,
            segmento_critico=segmento_critico,
        )
        self.audit_logger.governance_decision(
            ctx.tenant_id, actor,
            {"razon": decision.razon_codigo, "servir": decision.servir,
             "escalar": decision.escalar_a_revisor},
        )
        if decision.bloqueado:
            return self._responder_bloqueo(
                ctx, RequestKind.consulta, decision.motivo, actor,
                razon=decision.razon_codigo, escalar=decision.escalar_a_revisor,
            )

        adaptado = self.channel_adapter.adapt(contenido, ctx.canal)
        self.audit_logger.served(ctx.tenant_id, actor, {"kind": "consulta"})
        return MOResponse(
            ok=True, kind=RequestKind.consulta, canal=ctx.canal,
            data=adaptado, session_id=ctx.session_id, servido=True,
        )

    # ── Sesiones (responsabilidad 4) — fachada hacia el session_manager ───────

    def iniciar_sesion(
        self, ctx_auth: dict, session_type: SessionType, canal: Canal,
        initial_state: dict | None = None,
    ) -> str:
        tenant_id = ctx_auth["org_id"]
        sid = self.session_manager.create_session(
            tenant_id, ctx_auth.get("user_id"), session_type, canal, initial_state
        )
        self.audit_logger.event(
            tenant_id, "sesion_iniciada", ctx_auth.get("user_id") or "anon",
            {"session_id": sid, "tipo": session_type.value, "canal": canal.value},
        )
        return sid

    def transferir_sesion(self, session_id: str, nuevo_canal: Canal):
        state = self.session_manager.transfer_session(session_id, nuevo_canal)
        if state is not None:
            self.audit_logger.event(
                state.tenant_id, "sesion_transferida", state.user_id or "anon",
                {"session_id": session_id, "nuevo_canal": nuevo_canal.value},
            )
        return state

    def cerrar_sesion(self, session_id: str, reason: str = "completed"):
        state = self.session_manager.get_session(session_id)
        completed = self.session_manager.close_session(session_id, reason)
        if state is not None:
            self.audit_logger.event(
                state.tenant_id, "sesion_cerrada", state.user_id or "anon",
                {"session_id": session_id, "reason": reason},
            )
        return completed

    # ── Helpers de respuesta ──────────────────────────────────────────────────

    def _responder_ok(self, ctx, kind, data, actor, servido=True) -> MOResponse:
        self.audit_logger.served(ctx.tenant_id, actor, {"kind": kind.value})
        return MOResponse(
            ok=True, kind=kind, canal=ctx.canal, data=data,
            session_id=ctx.session_id, servido=servido,
        )

    def _responder_bloqueo(
        self, ctx, kind, motivo, actor, razon="bloqueado", escalar=False
    ) -> MOResponse:
        self.audit_logger.governance_decision(
            ctx.tenant_id, actor, {"razon": razon, "servir": False, "escalar": escalar}
        )
        return MOResponse(
            ok=False, kind=kind, canal=ctx.canal, data={},
            mensaje=motivo, session_id=ctx.session_id, servido=False,
            motivo_bloqueo=motivo,
        )
