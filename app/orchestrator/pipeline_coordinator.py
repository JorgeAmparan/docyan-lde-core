"""
Pipeline Coordinator del MO (B4 §1 responsabilidad 3 / §7).

DOCYAN LDE™ by XCID.

Coordina los pipelines aguas abajo del MO. En B4 cubre el camino de INGESTA con
el COTIZADOR como gate sin bypass (Adenda §8): todo request de ingesta que llega
al MO pasa por el cotizador ANTES de encolar. El cotizador YA existe
(`app/ingesta/cotizador.py`); aquí se INTEGRA al MO (no se reconstruye).

Flujo (idéntico al gate del router de ingesta B2, ahora orquestado por el MO):

  cotizar(texto) →
    RECHAZADO (saldo/hard cap)  → job 'rejected', NO se encola, se devuelve motivo.
    APROBADO                    → job 'pending_confirmation', se devuelve estimación
                                  (costo + TIEMPO). Solo tras confirmación explícita
                                  se encola hacia el worker (gate sin bypass).

El camino de CONSULTA queda como interfaz: el clasificador completo + pipelines
Tipos 1-8 llegan en B8. El MO rutea y compone; aquí se deja el punto de entrada.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.ingesta.cotizador import Cotizacion, Cotizador
from app.jobs.dispatcher import JobDispatcher
from app.jobs.job_models import CotizacionSnapshot, IngestJob, JobStatus


@dataclass
class IngestaCotizada:
    """Resultado de cotizar una ingesta vía el MO."""

    job_id: str
    status: str
    cotizacion: Cotizacion
    requiere_confirmacion: bool

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "requiere_confirmacion": self.requiere_confirmacion,
            "cotizacion": self.cotizacion.to_dict(),
        }


class PipelineCoordinator:
    """Coordina ingesta (con cotizador-gate) y deja la interfaz de consulta."""

    def __init__(
        self,
        cotizador: Cotizador | None = None,
        dispatcher: JobDispatcher | None = None,
        graph_reader=None,
    ):
        self.cotizador = cotizador or Cotizador()
        self.dispatcher = dispatcher or JobDispatcher()
        # B8: lector del DKG para los pipelines de consulta. Lazy en producción
        # (DKGReader sobre dkg_client); los tests inyectan un reader sintético.
        self._graph_reader = graph_reader

    # ── Ingesta (gate de cotización sin bypass) ───────────────────────────────

    def cotizar_ingesta(
        self,
        tenant_id: str,
        texto_documento: str,
        documento_ref: str,
        nombre_archivo: str,
        tipo_documento: str | None = None,
        usuario_id: str | None = None,
        costo_sesion_acumulado_usd: float = 0.0,
    ) -> IngestaCotizada:
        """
        Cotiza (mide tokens, estima costo + TIEMPO, verifica saldo y hard caps) y
        crea el job. NO encola: devuelve la estimación o el rechazo con cifras.
        """
        cotizacion = self.cotizador.cotizar(
            tenant_id=tenant_id,
            texto_documento=texto_documento,
            tipo_documento=tipo_documento,
            costo_sesion_acumulado_usd=costo_sesion_acumulado_usd,
        )

        job = IngestJob(
            job_id=uuid.uuid4().hex,
            tenant_id=tenant_id,
            documento_ref=documento_ref,
            nombre_archivo=nombre_archivo,
            tipo_documento=tipo_documento,
            usuario_id=usuario_id,
            cotizacion=CotizacionSnapshot(
                costo_estimado_usd=cotizacion.costo_estimado_usd,
                tiempo_estimado_seg=cotizacion.tiempo_estimado_seg,
                tokens_documento=cotizacion.tokens_documento,
                aprobado=cotizacion.aprobado,
                decision=cotizacion.decision.value,
            ),
        )
        # crear_job fija el status: 'rejected' si la cotización no aprobó,
        # 'pending_confirmation' si aprobó (aún NO encolado).
        job = self.dispatcher.crear_job(job)

        return IngestaCotizada(
            job_id=job.job_id,
            status=job.status.value,
            cotizacion=cotizacion,
            requiere_confirmacion=job.status == JobStatus.pending_confirmation,
        )

    def confirmar_ingesta(self, job_id: str) -> dict:
        """
        Confirma e encola un job aprobado hacia el worker. Sin confirmación no hay
        ingesta (gate sin bypass). Lanza ValueError si el job no es confirmable.
        """
        job = self.dispatcher.confirmar(job_id)
        return {"job_id": job.job_id, "status": job.status.value, "encolado": True}

    # ── Consulta (pipelines Tipos 1-8, B8) ────────────────────────────────────

    def _reader(self):
        if self._graph_reader is None:
            from app.pipelines.dkg_reader import DKGReader

            self._graph_reader = DKGReader()
        return self._graph_reader

    def ejecutar_pipeline(self, clasificacion, ctx) -> tuple:
        """
        Despacha al pipeline del tipo clasificado y compone el envelope tipado.

        Devuelve (ConsultaResuelta, extras). `extras` puede traer
        `alertas_cuarentena` (Tipo 7) para que el MO las registre en GRG+FAT, o
        `error` si hubo degradación graceful (responsabilidad 10 del MO: el grafo
        no responde → payload vacío VÁLIDO + nota honesta, nunca contenido falso).
        """
        from app.pipelines.registry import payload_vacio, resolver_para
        from app.schemas.pipeline_payloads import ConsultaResuelta

        resolver = resolver_para(clasificacion.tipo)
        try:
            res = resolver(ctx, self._reader())
            envelope = ConsultaResuelta(
                tipo_intencion=clasificacion.tipo.value,
                score=clasificacion.score,
                ruta=clasificacion.ruta,
                metodo=clasificacion.metodo,
                cruces=res.cruces,
                payload=res.payload,
            )
            extras = {"alertas_cuarentena": ctx.params.get("_alertas_cuarentena", [])}
            return envelope, extras
        except Exception as exc:  # noqa: BLE001 — degradación HONESTA, no se finge.
            nota = "El grafo de conocimiento no respondió; respuesta degradada."
            envelope = ConsultaResuelta(
                tipo_intencion=clasificacion.tipo.value,
                score=clasificacion.score,
                ruta=clasificacion.ruta,
                metodo=clasificacion.metodo,
                cruces=[],
                payload=payload_vacio(clasificacion.tipo, ctx.pregunta or "Consulta"),
                degradado=True,
                nota=nota,
            )
            return envelope, {"error": f"{type(exc).__name__}: {exc}"}

    def componer_consulta(self, texto: str, contenido_pipeline: dict | None = None) -> dict:
        """
        Compone el contenido canónico de una respuesta de consulta. En B4 el MO
        rutea y compone; el clasificador + pipelines Tipos 1-8 que llenan
        `contenido_pipeline` llegan en B8. Si no hay contenido, devuelve un acuse
        honesto de ruteo (no finge una respuesta sustantiva inexistente).
        """
        if contenido_pipeline:
            return contenido_pipeline
        return {
            "titulo": "Consulta recibida",
            "secciones": [
                {
                    "titulo": "Estado",
                    "cuerpo": (
                        "La consulta fue ruteada al pipeline de consulta. La "
                        "clasificación de intención y los pipelines de respuesta "
                        "se activan en B8."
                    ),
                }
            ],
            "consulta": texto,
        }
