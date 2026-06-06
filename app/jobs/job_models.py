"""
Modelos Pydantic de jobs de ingesta (B2 §8.2).

DOCYAN LDE™ by XCID.

Un `IngestJob` viaja del backend al worker por la cola. Lleva la referencia al
documento (no el binario: el documento se sube a storage y se referencia por
path/clave), el tenant, el tipo de documento resuelto, y un snapshot de la
cotización aprobada — el worker NUNCA ingiere un job cuyo `cotizacion` no fue
aprobada y confirmada (gate sin bypass, CLAUDE.md §14).
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    # Cotizado, esperando confirmación explícita del usuario (NO encolado).
    pending_confirmation = "pending_confirmation"
    # Rechazado por el cotizador (saldo o hard cap) — no procede.
    rejected = "rejected"
    # Confirmado y encolado hacia el worker.
    queued = "queued"
    # El worker lo tomó y está procesando.
    processing = "processing"
    # Ingesta completada con éxito.
    completed = "completed"
    # Falló durante el procesamiento.
    failed = "failed"


class CotizacionSnapshot(BaseModel):
    """Resumen inmutable de la cotización aprobada, adjunto al job."""

    costo_estimado_usd: float
    tiempo_estimado_seg: float
    tokens_documento: int
    aprobado: bool
    decision: str
    # Precio de setup comercial (Modelo Comercial §2.3, F1.5). Informativo en el
    # job; el SALDO reserva/liquida `costo_estimado_usd` (cómputo), no este precio.
    precio_setup_usd: float = 0.0


class IngestJob(BaseModel):
    job_id: str
    tenant_id: str
    # Referencia al documento en storage (no el binario). En dev/manual: path.
    documento_ref: str
    nombre_archivo: str
    tipo_documento: str | None = None
    tipo_forzado: str | None = None
    usuario_id: str | None = None
    contexto: dict = Field(default_factory=dict)
    cotizacion: CotizacionSnapshot | None = None
    status: JobStatus = JobStatus.pending_confirmation
    # Resultado del worker (poblado al completar).
    resultado: dict = Field(default_factory=dict)
    error: str | None = None

    # ── F1: observabilidad de progreso (worker → status endpoint → UI) ──────────
    # Clave de IDEMPOTENCIA (F1 §2.4): SHA-256 del CONTENIDO del documento. La fija
    # el worker al descargar. Dos jobs con el mismo contenido comparten hash, así
    # un reintento —o la misma re-subida con otro nombre/sesión— se reconoce como
    # ya ingerido y NO reprocesa ni re-cobra tokens. También es el `document_id`
    # que se pasa a apply_changes() del SDK (crash-safe por SHA-256).
    content_sha256: str | None = None
    # Fase actual del pipeline (descarga|conversion|extraccion|grafo|dedup) o None.
    phase: str | None = None
    # Avance DENTRO de la fase actual (0..1).
    phase_fraction: float = 0.0
    # Contadores reales de la fase (page/pages, spans, entities, relations, …).
    counters: dict = Field(default_factory=dict)
    # Intento de reintento en curso (0 = primer intento). Lo sube el worker.
    retry_attempt: int = 0
    # True si la ingesta se resolvió por idempotencia (contenido ya ingerido):
    # no se reprocesó ni se re-cobró; el documento ya estaba disponible.
    idempotente: bool = False

    # ── F1.5 Parte A: estado del débito (reservar/liquidar/liberar) ─────────────
    # Monto retenido (reservado) para este job al confirmar. La idempotencia del
    # débito vive aquí: un reintento NO vuelve a reservar (opera sobre esta reserva
    # viva); liquidar/liberar son idempotentes vía `reserva_estado`.
    reserva_usd: float = 0.0
    # ninguna | retenido | liquidado | liberado.
    reserva_estado: str = "ninguna"
    # Costo de cómputo real con el que se liquidó (o el cotizado como aproximación).
    costo_real_usd: float | None = None

    # ── F1.5 Parte B: instrumentación de peso y tiempo ──────────────────────────
    # Peso en bytes del archivo original y del resultado almacenado (markdown).
    bytes_originales: int | None = None
    bytes_resultado: int | None = None
    # Timestamps ISO-8601 (UTC) de inicio/fin de procesamiento del worker.
    started_at: str | None = None
    completed_at: str | None = None
    # Duración real de la ingesta en segundos (completed_at − started_at).
    duracion_seg: float | None = None

    def confirmable(self) -> bool:
        """Solo un job aprobado y pendiente de confirmación puede encolarse."""
        return (
            self.status == JobStatus.pending_confirmation
            and self.cotizacion is not None
            and self.cotizacion.aprobado
        )

    def reintentable(self) -> bool:
        """Solo un job en estado terminal de error puede reintentarse a mano."""
        return self.status == JobStatus.failed
