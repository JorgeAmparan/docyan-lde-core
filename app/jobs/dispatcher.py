"""
Dispatcher de jobs de ingesta (B2 §8.1 / §8.2).

DOCYAN LDE™ by XCID.

Decisión técnica §8 = **Opción A (cola Redis)**. Razones (vs HTTP directo o Fly
machine API): separación limpia de concerns, retry/monitoring naturales, escalado
horizontal (varios workers si crece la carga) y Redis ya está en el stack por la
decisión #6 (sesiones MO + APScheduler). Se implementa con una cola ligera sobre
`redis-py` (LIST + BLPOP) en vez de `rq`, para no añadir una dependencia nueva al
backend ni acoplar su modelo de worker; el backend solo necesita `redis` (ya en
deps). Ver docs/worker_architecture.md.

Diseño testeable: el backend de cola se abstrae en `QueueBackend`. Tests inyectan
`InMemoryQueueBackend`; producción usa `RedisQueueBackend` (REDIS_QUEUE_URL).

Flujo del gate (sin bypass):
  crear job (cotizado) → pending_confirmation  [NO se encola]
  confirmar (si aprobado) → queued              [se encola hacia el worker]
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from app.jobs.job_models import IngestJob, JobStatus

QUEUE_KEY = "docyan:ingest:queue"
JOB_KEY_PREFIX = "docyan:ingest:job:"
# Registro de IDEMPOTENCIA (F1 §2.4): contenido ya ingerido, por tenant + SHA-256.
# Aislado por tenant — el hash de un tenant NO se reconoce en otro (multi-tenant).
INGESTED_KEY_PREFIX = "docyan:ingest:done:"
# TTL del estado de jobs en Redis (7 días); el FAT lleva el registro permanente.
JOB_STATE_TTL_SECONDS = 7 * 24 * 3600


def _ingested_key(tenant_id: str, content_sha256: str) -> str:
    return f"{INGESTED_KEY_PREFIX}{tenant_id}:{content_sha256}"


class QueueBackend:
    """Contrato de cola + almacén de estado de jobs + registro de idempotencia."""

    def save_job(self, job: IngestJob) -> None: ...
    def load_job(self, job_id: str) -> IngestJob | None: ...
    def push(self, job_id: str) -> None: ...
    def pop(self, timeout: int = 0) -> str | None: ...
    def queue_length(self) -> int: ...
    def queue_position(self, job_id: str) -> int | None: ...
    def list_all_jobs(self) -> list[IngestJob]: ...
    # Idempotencia por contenido (SHA-256), aislada por tenant.
    def record_ingested(self, tenant_id: str, content_sha256: str, payload: dict) -> None: ...
    def lookup_ingested(self, tenant_id: str, content_sha256: str) -> dict | None: ...


# ── Backend en memoria (tests / dev sin Redis) ───────────────────────────────


@dataclass
class InMemoryQueueBackend:
    _jobs: dict[str, str] = field(default_factory=dict)
    _queue: list[str] = field(default_factory=list)
    _ingested: dict[str, dict] = field(default_factory=dict)

    def save_job(self, job: IngestJob) -> None:
        self._jobs[job.job_id] = job.model_dump_json()

    def load_job(self, job_id: str) -> IngestJob | None:
        raw = self._jobs.get(job_id)
        return IngestJob.model_validate_json(raw) if raw else None

    def push(self, job_id: str) -> None:
        self._queue.append(job_id)

    def pop(self, timeout: int = 0) -> str | None:
        return self._queue.pop(0) if self._queue else None

    def queue_length(self) -> int:
        return len(self._queue)

    def queue_position(self, job_id: str) -> int | None:
        return self._queue.index(job_id) + 1 if job_id in self._queue else None

    def list_all_jobs(self) -> list[IngestJob]:
        return [IngestJob.model_validate_json(raw) for raw in self._jobs.values()]

    def record_ingested(self, tenant_id: str, content_sha256: str, payload: dict) -> None:
        self._ingested[_ingested_key(tenant_id, content_sha256)] = payload

    def lookup_ingested(self, tenant_id: str, content_sha256: str) -> dict | None:
        return self._ingested.get(_ingested_key(tenant_id, content_sha256))


# ── Backend Redis (producción) ────────────────────────────────────────────────


class RedisQueueBackend:
    def __init__(self, url: str | None = None, client=None):
        self.url = url or os.getenv("REDIS_QUEUE_URL") or os.getenv("REDIS_URL")
        self._client = client

    def _r(self):
        if self._client is None:
            import redis

            self._client = redis.from_url(self.url, decode_responses=True)
        return self._client

    def save_job(self, job: IngestJob) -> None:
        self._r().setex(
            JOB_KEY_PREFIX + job.job_id, JOB_STATE_TTL_SECONDS, job.model_dump_json()
        )

    def load_job(self, job_id: str) -> IngestJob | None:
        raw = self._r().get(JOB_KEY_PREFIX + job_id)
        return IngestJob.model_validate_json(raw) if raw else None

    def push(self, job_id: str) -> None:
        self._r().rpush(QUEUE_KEY, job_id)

    def pop(self, timeout: int = 0) -> str | None:
        if timeout > 0:
            res = self._r().blpop(QUEUE_KEY, timeout=timeout)
            return res[1] if res else None
        return self._r().lpop(QUEUE_KEY)

    def queue_length(self) -> int:
        return int(self._r().llen(QUEUE_KEY))

    def queue_position(self, job_id: str) -> int | None:
        ids = self._r().lrange(QUEUE_KEY, 0, -1)
        return ids.index(job_id) + 1 if job_id in ids else None

    def list_all_jobs(self) -> list[IngestJob]:
        """Escanea el estado de todos los jobs (observabilidad de plataforma, F2)."""
        r = self._r()
        jobs: list[IngestJob] = []
        for key in r.scan_iter(match=f"{JOB_KEY_PREFIX}*", count=200):
            raw = r.get(key)
            if raw:
                jobs.append(IngestJob.model_validate_json(raw))
        return jobs

    def record_ingested(self, tenant_id: str, content_sha256: str, payload: dict) -> None:
        import json

        self._r().setex(
            _ingested_key(tenant_id, content_sha256),
            JOB_STATE_TTL_SECONDS,
            json.dumps(payload),
        )

    def lookup_ingested(self, tenant_id: str, content_sha256: str) -> dict | None:
        import json

        raw = self._r().get(_ingested_key(tenant_id, content_sha256))
        return json.loads(raw) if raw else None


# ── Dispatcher ─────────────────────────────────────────────────────────────────


class JobDispatcher:
    """Encola jobs hacia el worker y gestiona transiciones de estado."""

    def __init__(self, backend: QueueBackend | None = None):
        self.backend = backend or RedisQueueBackend()

    def crear_job(self, job: IngestJob) -> IngestJob:
        """
        Persiste un job recién cotizado. Si el cotizador lo rechazó, queda
        `rejected` y NO es confirmable. Si fue aprobado, queda
        `pending_confirmation` (aún NO encolado). No hay encolado sin confirmación.
        """
        if job.cotizacion is not None and not job.cotizacion.aprobado:
            job.status = JobStatus.rejected
        else:
            job.status = JobStatus.pending_confirmation
        self.backend.save_job(job)
        return job

    def confirmar(self, job_id: str) -> IngestJob:
        """
        Confirma e encola un job aprobado. Lanza si el job no existe o no es
        confirmable (rechazado, ya procesado, o sin cotización aprobada).
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        if not job.confirmable():
            raise ValueError(
                f"job {job_id} no es confirmable (status={job.status.value}, "
                f"aprobado={job.cotizacion.aprobado if job.cotizacion else None}). "
                "Sin confirmación válida no se encola hacia el worker."
            )
        job.status = JobStatus.queued
        self.backend.save_job(job)
        self.backend.push(job_id)
        return job

    # ── Transiciones que ejecuta el worker ───────────────────────────────────
    def marcar_procesando(self, job_id: str) -> IngestJob:
        return self._transicion(job_id, JobStatus.processing)

    def actualizar_progreso(
        self,
        job_id: str,
        *,
        phase: str | None = None,
        phase_fraction: float | None = None,
        counters: dict | None = None,
        retry_attempt: int | None = None,
        content_sha256: str | None = None,
    ) -> IngestJob:
        """
        Actualiza la granularidad de progreso de un job en proceso (F1 §2.2). El
        worker la llama al entrar a cada fase y al avanzar contadores. Solo toca
        los campos provistos; no cambia el `status`.
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        if phase is not None:
            job.phase = phase
        if phase_fraction is not None:
            job.phase_fraction = max(0.0, min(1.0, phase_fraction))
        if counters is not None:
            job.counters = counters
        if retry_attempt is not None:
            job.retry_attempt = retry_attempt
        if content_sha256 is not None:
            job.content_sha256 = content_sha256
        self.backend.save_job(job)
        return job

    def marcar_completado(self, job_id: str, resultado: dict) -> IngestJob:
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.completed
        job.resultado = resultado
        job.phase = None
        job.phase_fraction = 1.0
        self.backend.save_job(job)
        # Idempotencia: registra el contenido como ya ingerido (clave SHA-256 por
        # tenant). Un futuro job con el mismo contenido se resuelve sin reprocesar.
        if job.content_sha256:
            self.backend.record_ingested(
                job.tenant_id, job.content_sha256, {"resultado": resultado}
            )
        return job

    def marcar_completado_idempotente(self, job_id: str, resultado: dict) -> IngestJob:
        """
        Cierra un job porque su contenido (SHA-256) YA estaba ingerido: reusa el
        resultado previo, marca `idempotente=True` y NO reprocesa ni re-cobra. El
        estado final del sistema es idéntico a la primera ingesta (F1 §2.4 / #8).
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.completed
        job.resultado = resultado
        job.idempotente = True
        job.phase = None
        job.phase_fraction = 1.0
        self.backend.save_job(job)
        return job

    def marcar_fallido(self, job_id: str, error: str) -> IngestJob:
        """Estado terminal de error (F1 §2.4): agotados los reintentos del worker."""
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.failed
        job.error = error
        self.backend.save_job(job)
        return job

    # ── Idempotencia por contenido (SHA-256), aislada por tenant ──────────────
    def buscar_idempotente(self, tenant_id: str, content_sha256: str) -> dict | None:
        """Devuelve el resultado previo si ese contenido ya se ingirió, o None."""
        return self.backend.lookup_ingested(tenant_id, content_sha256)

    # ── Reintento manual (F1 §2.5) ────────────────────────────────────────────
    def reintentar(self, job_id: str) -> IngestJob:
        """
        Re-encola un job en estado terminal de error para volver a procesarlo
        (acción manual del admin). Limpia el error y el progreso previo; conserva
        la cotización aprobada (no re-cotiza). Idempotente: si el contenido ya
        quedó ingerido, el worker lo resolverá sin duplicar.
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        if not job.reintentable():
            raise ValueError(
                f"job {job_id} no es reintentable (status={job.status.value}). "
                "Solo un job en estado terminal de error se reintenta a mano."
            )
        job.status = JobStatus.queued
        job.error = None
        job.phase = None
        job.phase_fraction = 0.0
        job.counters = {}
        job.idempotente = False
        self.backend.save_job(job)
        self.backend.push(job_id)
        return job

    def _transicion(self, job_id: str, status: JobStatus) -> IngestJob:
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = status
        self.backend.save_job(job)
        return job
