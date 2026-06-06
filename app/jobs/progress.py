"""
Progreso observable de jobs de ingesta (F1 §2.1 / handoff §2-§4).

DOCYAN LDE™ by XCID.

El worker emite, por job, `phase` + `phase_fraction` + `counters`. Este módulo
es la **fuente única de verdad de los pesos de fase** (idénticos al mock del
handoff, `ING_PHASES`) y traduce el estado interno del job al shape `DocProgress`
que el endpoint de estatus expone y la UI consume.

Reparto de pesos (handoff §2): el % de ancho de cada tramo de la barra. El `pct`
total = peso acumulado de las fases previas + peso de la fase actual × fracción.
El estado `DocStatus` se deriva de la fase (handoff §2):
  descarga → cargando ; conversion…dedup → procesando ; fin → completado ;
  aborto → error.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.jobs.job_models import IngestJob, JobStatus

# Fases del pipeline en orden, con su peso (handoff §2 — mismo reparto del mock).
PHASE_ORDER: list[str] = ["descarga", "conversion", "extraccion", "grafo", "dedup"]
PHASE_WEIGHTS: dict[str, float] = {
    "descarga": 6.0,
    "conversion": 16.0,
    "extraccion": 38.0,
    "grafo": 28.0,
    "dedup": 12.0,
}
PHASE_LABELS: dict[str, str] = {
    "descarga": "Descarga",
    "conversion": "Conversión",
    "extraccion": "Extracción",
    "grafo": "Escritura a grafo",
    "dedup": "Deduplicación",
}


def cum_weight(phase: str | None) -> float:
    """Peso acumulado de las fases ANTERIORES a `phase` (0 si None/desconocida)."""
    if phase not in PHASE_WEIGHTS:
        return 0.0
    idx = PHASE_ORDER.index(phase)
    return sum(PHASE_WEIGHTS[p] for p in PHASE_ORDER[:idx])


def pct_total(phase: str | None, phase_fraction: float) -> float:
    """Avance total 0..100 = peso acumulado previo + peso fase × fracción."""
    if phase not in PHASE_WEIGHTS:
        return 0.0
    frac = max(0.0, min(1.0, phase_fraction))
    return round(cum_weight(phase) + PHASE_WEIGHTS[phase] * frac, 2)


def derive_status(job: IngestJob) -> str:
    """Mapea el JobStatus interno + la fase al DocStatus del handoff (§2)."""
    if job.status == JobStatus.completed:
        return "completado"
    if job.status == JobStatus.failed:
        return "error"
    if job.status == JobStatus.processing:
        # descarga → "cargando"; cualquier otra fase de proceso → "procesando".
        return "cargando" if job.phase == "descarga" else "procesando"
    # queued / pending_confirmation / rejected → la UI lo trata como en cola.
    return "encolado"


class ProgressError(BaseModel):
    code: str
    message: str


class DocProgress(BaseModel):
    """
    Respuesta de `GET /ingesta/documents/{job_id}/status` (handoff §3.1).

    `BatchProgress` NO existe en el backend: el cliente lo agrega a partir de N
    de estos (orquestación en cliente, decisión rectora #3). Los nombres siguen
    el contrato TS del handoff (camelCase) para que el shape calce 1:1 con el
    componente de diseño sin transformación intermedia.
    """

    docId: str
    name: str
    kind: str = ""
    status: str  # encolado | cargando | procesando | completado | error
    phase: str | None = None
    phaseFraction: float = 0.0
    pct: float = 0.0
    etaSeconds: float | None = None
    queuePosition: int | None = None
    counters: dict = Field(default_factory=dict)
    retryAttempt: int = 0
    error: ProgressError | None = None
    consultUrl: str | None = None
    # Disponibilidad explícita para consulta (F1 §2.1): true al completar.
    disponibleParaConsulta: bool = False


def _kind_from_name(nombre: str, tipo: str | None) -> str:
    """Etiqueta corta de tipo para la tarjeta ("pdf · OCR", "xlsx", …)."""
    ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else (tipo or "doc")
    return ext


def build_doc_progress(
    job: IngestJob,
    *,
    queue_position: int | None = None,
    consult_url: str | None = None,
) -> DocProgress:
    """
    Construye el `DocProgress` de un job. `pct` y `etaSeconds` se calculan aquí
    (los pesos viven en el backend; handoff §4) salvo en estados terminales.
    """
    status = derive_status(job)

    if status == "completado":
        pct = 100.0
        eta: float | None = 0.0
        phase = None
    elif status == "error":
        pct = pct_total(job.phase, job.phase_fraction)
        eta = None
        phase = job.phase
    elif status == "encolado":
        pct = 0.0
        eta = None
        phase = None
    else:  # cargando / procesando
        phase = job.phase
        pct = pct_total(job.phase, job.phase_fraction)
        # ETA honesta: tiempo estimado de la cotización × fracción restante. Es la
        # mejor señal disponible sin instrumentar duraciones por fase en el worker.
        total_seg = job.cotizacion.tiempo_estimado_seg if job.cotizacion else None
        eta = round(total_seg * (1 - pct / 100.0), 1) if total_seg else None

    err = None
    if status == "error":
        err = ProgressError(
            code="ingest_failed",
            message=job.error or "La ingesta falló de forma persistente.",
        )

    return DocProgress(
        docId=job.job_id,
        name=job.nombre_archivo,
        kind=_kind_from_name(job.nombre_archivo, job.tipo_documento),
        status=status,
        phase=phase,
        phaseFraction=round(max(0.0, min(1.0, job.phase_fraction)), 3),
        pct=pct,
        etaSeconds=eta,
        queuePosition=queue_position if status == "encolado" else None,
        counters=job.counters or {},
        retryAttempt=job.retry_attempt,
        error=err,
        consultUrl=consult_url if status == "completado" else None,
        disponibleParaConsulta=status == "completado",
    )
