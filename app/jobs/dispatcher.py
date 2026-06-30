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

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.jobs.job_models import IngestJob, JobStatus

logger = logging.getLogger("docyan.jobs.dispatcher")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _duracion_seg(started_at: str | None, completed_at: str | None) -> float | None:
    """Segundos entre dos timestamps ISO-8601, o None si falta alguno/parseo falla."""
    if not started_at or not completed_at:
        return None
    try:
        ini = datetime.fromisoformat(started_at)
        fin = datetime.fromisoformat(completed_at)
        return round(max(0.0, (fin - ini).total_seconds()), 3)
    except ValueError:
        return None

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
    def borrar_ingested(self, tenant_id: str, content_sha256: str) -> None: ...


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

    def borrar_ingested(self, tenant_id: str, content_sha256: str) -> None:
        self._ingested.pop(_ingested_key(tenant_id, content_sha256), None)


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

    def borrar_ingested(self, tenant_id: str, content_sha256: str) -> None:
        self._r().delete(_ingested_key(tenant_id, content_sha256))


# ── Dispatcher ─────────────────────────────────────────────────────────────────


class JobDispatcher:
    """Encola jobs hacia el worker y gestiona transiciones de estado.

    F1.5: si se inyecta `budget_manager`, las transiciones del gate ejecutan el
    esquema reservar/liquidar/liberar sobre `tenant_budget` (confirmar reserva el
    monto cotizado; completar liquida a costo real; fallar/idempotente liberan).
    Producción y worker SIEMPRE lo inyectan (ver providers / worker.main). Si es
    None, el débito se omite (tests que verifican invariantes ortogonales al saldo).
    """

    def __init__(
        self,
        backend: QueueBackend | None = None,
        budget_manager=None,
        quota_manager=None,
    ):
        self.backend = backend or RedisQueueBackend()
        self.budget = budget_manager
        # Cupo de ingestas (F3 §C). Si se inyecta y la ingesta fue cotizada DENTRO de
        # cupo, al confirmar se descuenta 1 (idempotente por job_id). Si es None, no
        # se toca cupo (tests ortogonales al cupo / planes sin cupo).
        self.quota = quota_manager

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

        F1.5: tras pasar el gate, RESERVA el monto cotizado (disponible→retenido).
          · Idempotencia (A.3): si el contenido (SHA-256) YA fue liquidado, corta
            ANTES de reservar — no re-cobra; cierra el job como idempotente sin
            encolar.
          · Si la reserva falla (saldo disponible insuficiente), NO encola y lanza
            ValueError (el endpoint responde 409; el comportamiento "cuántos caben"
            del cotizador sigue vigente).
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

        # Idempotencia (A.3): contenido ya ingerido/liquidado → no se cobra de
        # nuevo. Corta antes de reservar (igual que F1 corta antes de reprocesar).
        if job.content_sha256:
            previo = self.backend.lookup_ingested(job.tenant_id, job.content_sha256)
            if previo is not None:
                logger.info(
                    "job %s: SHA-256 ya liquidado; idempotente, no reserva ni encola",
                    job_id,
                )
                return self.marcar_completado_idempotente(
                    job_id, previo.get("resultado", {})
                )

        # Reserva del monto cotizado (costo de cómputo estimado).
        if self.budget is not None and job.reserva_estado == "ninguna":
            monto = job.cotizacion.costo_estimado_usd if job.cotizacion else 0.0
            res = self.budget.reservar(job.tenant_id, monto)
            if not res.ok:
                raise ValueError(
                    f"job {job_id}: {res.motivo} (falta ${res.falta_usd:.4f})."
                )
            job.reserva_usd = res.monto_reservado
            job.reserva_estado = "retenido"

        # Cupo de ingestas (F3 §C): si esta ingesta fue cotizada DENTRO de cupo,
        # descuenta 1 al confirmar. Idempotente por job_id (un reintento de confirm
        # del mismo job NO vuelve a descontar — lo garantiza el ledger de la RPC /
        # el store en memoria). El cupo gobierna el setup comercial, no el cómputo:
        # el saldo ya se reservó arriba por separado.
        if (
            self.quota is not None
            and job.cotizacion is not None
            and getattr(job.cotizacion, "dentro_de_cupo", False)
        ):
            self.quota.decrementar(job.tenant_id, job_id)

        job.status = JobStatus.queued
        self.backend.save_job(job)
        self.backend.push(job_id)
        return job

    # ── Transiciones que ejecuta el worker ───────────────────────────────────
    def marcar_procesando(self, job_id: str) -> IngestJob:
        """Marca el job en proceso y sella `started_at` (instrumentación F1.5)."""
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.processing
        if job.started_at is None:  # el primer intento fija el inicio real
            job.started_at = _now_iso()
        self.backend.save_job(job)
        return job

    def actualizar_progreso(
        self,
        job_id: str,
        *,
        phase: str | None = None,
        phase_fraction: float | None = None,
        counters: dict | None = None,
        retry_attempt: int | None = None,
        content_sha256: str | None = None,
        bytes_originales: int | None = None,
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
        if bytes_originales is not None:
            job.bytes_originales = bytes_originales
        self.backend.save_job(job)
        return job

    def marcar_completado(
        self, job_id: str, resultado: dict, costo_real_usd: float | None = None
    ) -> IngestJob:
        """
        Cierra un job con éxito. F1.5:
          · LIQUIDA la reserva a costo real (devuelve el sobrante a disponible).
            `costo_real_usd` = tokens reales del SDK si se conocen; si no, se usa
            el cotizado como aproximación (el IngestionResult del SDK NO expone los
            tokens consumidos — documentado en el reporte). Idempotente vía
            `reserva_estado`: un cierre repetido no re-liquida.
          · Sella `completed_at`/`duracion_seg` y el peso del resultado.
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.completed
        job.resultado = resultado
        job.phase = None
        job.phase_fraction = 1.0
        job.completed_at = _now_iso()
        job.duracion_seg = _duracion_seg(job.started_at, job.completed_at)
        if job.bytes_resultado is None and resultado.get("markdown_bytes") is not None:
            job.bytes_resultado = int(resultado["markdown_bytes"])

        # Pieza 6 — POLÍTICA DE NO-COBRO: una ingesta que rinde 0 ontología (o que no
        # dejó `:DocumentoSource` vivo) NO entregó contenido consultable → NO se cobra.
        # Se LIBERA la reserva completa (en vez de liquidarla). El usuario ve el estado
        # honesto (`completed_sin_ontologia`) + Retry, y su saldo queda intacto.
        sin_contenido = bool(
            resultado.get("completed_sin_ontologia")
            or resultado.get("completed_sin_documento")
        )
        # Liquidación del débito (idempotente: solo si hay reserva viva).
        if self.budget is not None and job.reserva_estado == "retenido":
            if sin_contenido:
                self.budget.liberar(job.tenant_id, job.reserva_usd)
                job.costo_real_usd = 0.0
                job.reserva_estado = "liberado_sin_contenido"
            else:
                real = job.reserva_usd if costo_real_usd is None else round(costo_real_usd, 4)
                self.budget.liquidar(job.tenant_id, job.reserva_usd, real)
                job.costo_real_usd = real
                job.reserva_estado = "liquidado"

        self.backend.save_job(job)
        # Idempotencia: registra el contenido como ya ingerido (clave SHA-256 por
        # tenant). Un futuro job con el mismo contenido se resuelve sin reprocesar.
        # NO se registra si quedó SIN CONTENIDO (0 ontología / sin DocumentoSource):
        # el usuario debe poder reintentar/re-subir y que SÍ se re-extraiga (no un
        # idempotency-skip que reuse un resultado vacío). Coherente con no-cobro.
        if job.content_sha256 and not sin_contenido:
            self.backend.record_ingested(
                job.tenant_id, job.content_sha256, {"resultado": resultado}
            )
        return job

    def marcar_completado_idempotente(self, job_id: str, resultado: dict) -> IngestJob:
        """
        Cierra un job porque su contenido (SHA-256) YA estaba ingerido: reusa el
        resultado previo, marca `idempotente=True` y NO reprocesa ni re-cobra. El
        estado final del sistema es idéntico a la primera ingesta (F1 §2.4 / #8).

        F1.5: como NO se consumió cómputo, LIBERA la reserva (si la hubiera) — el
        re-ingerir el mismo contenido no cuesta saldo (A.3).
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.completed
        job.resultado = resultado
        job.idempotente = True
        job.phase = None
        job.phase_fraction = 1.0
        job.completed_at = _now_iso()
        job.duracion_seg = _duracion_seg(job.started_at, job.completed_at)
        if self.budget is not None and job.reserva_estado == "retenido":
            self.budget.liberar(job.tenant_id, job.reserva_usd)
            job.reserva_estado = "liberado"
        self.backend.save_job(job)
        return job

    def marcar_fallido(self, job_id: str, error: str) -> IngestJob:
        """
        Estado terminal de error (F1 §2.4): agotados los reintentos del worker.
        F1.5: LIBERA la reserva completa a disponible (idempotente vía estado).
        """
        job = self.backend.load_job(job_id)
        if job is None:
            raise KeyError(f"job inexistente: {job_id}")
        job.status = JobStatus.failed
        job.error = error
        if self.budget is not None and job.reserva_estado == "retenido":
            self.budget.liberar(job.tenant_id, job.reserva_usd)
            job.reserva_estado = "liberado"
        self.backend.save_job(job)
        return job

    # ── Idempotencia por contenido (SHA-256), aislada por tenant ──────────────
    def buscar_idempotente(self, tenant_id: str, content_sha256: str) -> dict | None:
        """Devuelve el resultado previo si ese contenido ya se ingirió, o None."""
        return self.backend.lookup_ingested(tenant_id, content_sha256)

    def borrar_idempotencia(self, tenant_id: str, content_sha256: str) -> None:
        """Limpia la marca de idempotencia de un contenido (B13.3 fix). Se llama al
        BORRAR el documento: sin esto, re-subir el MISMO archivo hace idempotency-skip
        (worker lo cierra "completed" reusando el resultado viejo, sin re-extraer ni
        recrear el `:DocumentoSource`) — el bug del 'quedó vivo' que no quedó vivo."""
        self.backend.borrar_ingested(tenant_id, content_sha256)

    # ── Gate de costo del reintento AUTOMÁTICO del worker (Pieza 4c) ──────────
    def gate_costo_reintento(self, job_id: str) -> tuple[bool, str]:
        """
        ¿Puede el worker REINTENTAR automáticamente este job sin saltarse el gate de
        costo? Cada reintento re-corre la extracción COMPLETA = gasto real adicional;
        sin gate, `MAX_RETRIES` multiplica el costo ≤3× sin control (lo que el contrato
        prohíbe). Verifica que el tenant pueda absorber OTRA corrida estimada (la
        reserva original solo cubre una). Devuelve (permitido, motivo).

        Conservador con el COSTO: si no se puede verificar el presupuesto (sin budget
        manager / store inalcanzable) NO se asume saldo — pero para no estrangular
        entornos de test sin saldo configurado, la ausencia TOTAL de budget manager
        (inyección None) sí permite. La falta de saldo real (verificar→rechazado)
        bloquea el reintento.
        """
        if self.budget is None:
            return True, ""  # sin contabilidad de saldo (tests) — no aplica gate
        job = self.backend.load_job(job_id)
        if job is None or job.cotizacion is None:
            return True, ""
        verdict = self.budget.verificar(
            job.tenant_id, job.cotizacion.costo_estimado_usd
        )
        if verdict.aprobado:
            return True, ""
        return False, verdict.motivo

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
        # F1.5: el fallo terminal ya liberó la reserva; un reintento manual vuelve
        # a procesar (consume cómputo), así que RE-reserva. Si el contenido ya
        # estaba ingerido, el worker lo resolverá por idempotencia y liberará. Un
        # reintento AUTOMÁTICO del worker (antes del fallo terminal) NO pasa por
        # aquí: opera sobre la reserva viva sin re-reservar (A.3).
        if self.budget is not None and job.reserva_estado != "retenido":
            monto = job.cotizacion.costo_estimado_usd if job.cotizacion else 0.0
            res = self.budget.reservar(job.tenant_id, monto)
            if not res.ok:
                raise ValueError(
                    f"job {job_id}: {res.motivo} (falta ${res.falta_usd:.4f})."
                )
            job.reserva_usd = res.monto_reservado
            job.reserva_estado = "retenido"
            job.costo_real_usd = None
        job.status = JobStatus.queued
        job.error = None
        job.phase = None
        job.phase_fraction = 0.0
        job.counters = {}
        job.idempotente = False
        self.backend.save_job(job)
        self.backend.push(job_id)
        return job
