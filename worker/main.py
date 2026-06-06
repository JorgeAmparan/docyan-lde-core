"""
Entry point del worker de ingesta (B2 §4.1 / §8 · F1 §2.2-§2.4).

DOCYAN LDE™ by XCID — `docyan-lde-ingest`.

Dos responsabilidades:

  1. Servir `/health` sobre flycast (criterio de cierre §11: "ingest health 200").
     NO se expone HTTP público (fly.toml sin http_service público; solo .flycast).
  2. Consumir la cola Redis de jobs de ingesta (BLPOP), descargar el documento,
     ejecutar el pipeline (Docling → GraphRAG-SDK → BGE-M3 → dedup → finalize),
     emitir progreso por fase y actualizar el estado del job.

El consumidor corre como tarea de fondo de asyncio dentro del proceso uvicorn.

F1 — resiliencia de procesamiento por lotes (decisiones rectoras 5/7/8):
  · **Concurrencia acotada** a `INGEST_MAX_CONCURRENCY` (default 3) con tope duro
    por semáforo — fluidez visible sin reabrir el patrón de concurrencia
    descontrolada del incidente de $5,000.
  · **Reintento automático** con backoff exponencial + jitter, tope duro
    `INGEST_MAX_RETRIES` (default 2 → hasta 3 intentos). Agotados → estado
    terminal `failed`. Nunca reintento infinito, nunca delay fijo.
  · **Idempotencia por SHA-256 del contenido**: un documento cuyo contenido ya se
    ingirió NO se reprocesa ni re-cobra; se cierra reusando el resultado previo.
"""
from __future__ import annotations

import asyncio
import contextlib
import hashlib
import logging
import os
import random
import tempfile

from fastapi import FastAPI

from app.jobs.dispatcher import JobDispatcher, RedisQueueBackend
from worker.ingest_pipeline import IngestPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("docyan.worker")

# Tiempo de espera del BLPOP (s) antes de reintentar (permite shutdown limpio).
POP_TIMEOUT = int(os.getenv("WORKER_POP_TIMEOUT", "5"))
# Concurrencia acotada (decisión rectora #5): tope duro de jobs en paralelo.
MAX_CONCURRENCY = max(1, int(os.getenv("INGEST_MAX_CONCURRENCY", "3")))
# Reintento automático (decisión rectora #7): reintentos tras el primer intento.
MAX_RETRIES = max(0, int(os.getenv("INGEST_MAX_RETRIES", "2")))
# Base del backoff exponencial en segundos (delay = base * 2**intento + jitter).
BACKOFF_BASE = float(os.getenv("INGEST_BACKOFF_BASE", "2.0"))

app = FastAPI(title="DOCYAN LDE — Ingest Worker", docs_url=None, redoc_url=None)


def _build_document_store():
    """Almacén de documentos (Supabase Storage en prod; local si se configura)."""
    if os.getenv("INGEST_STORAGE_DIR"):
        from app.ingesta.document_store import LocalDocumentStore

        return LocalDocumentStore()
    from app.ingesta.document_store import SupabaseStorageDocumentStore

    return SupabaseStorageDocumentStore()


def _build_schema_registry():
    from app.schemas_documentales.registry import SchemaRegistry

    return SchemaRegistry()


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _backoff_delay(intento: int, rng: random.Random | None = None) -> float:
    """Backoff exponencial + jitter (F1 §2.4). `intento` es 0-based."""
    r = rng or random
    base = BACKOFF_BASE * (2 ** intento)
    jitter = r.uniform(0, BACKOFF_BASE)  # jitter acotado, nunca delay fijo
    return base + jitter


async def _procesar_un_job(
    dispatcher: JobDispatcher,
    pipeline: IngestPipeline,
    job_id: str,
    *,
    sleep=asyncio.sleep,
    rng: random.Random | None = None,
):
    """
    Descarga, verifica idempotencia, procesa con reintento y actualiza el estado.

    Idempotente: el SHA-256 del contenido es la clave. Reintento con backoff +
    jitter hasta `MAX_RETRIES`; agotado → estado terminal `failed` (no bloquea el
    lote: cada job es independiente). Un job malo nunca tumba el worker.
    """
    dispatcher.marcar_procesando(job_id)
    job = dispatcher.backend.load_job(job_id)
    if job is None:
        logger.error("job %s desapareció del estado; se omite", job_id)
        return

    # ── Descarga + SHA-256 del contenido (clave de idempotencia) ──────────────
    try:
        data = pipeline.document_store.get(job.documento_ref)
    except Exception as exc:  # noqa: BLE001 — descarga fallida = error terminal
        logger.exception("job %s: descarga falló", job_id)
        dispatcher.marcar_fallido(job_id, f"descarga: {type(exc).__name__}: {exc}")
        return

    sha = _sha256(data)
    dispatcher.actualizar_progreso(
        job_id,
        phase="descarga",
        phase_fraction=1.0,
        counters={"bytes": len(data), "bytesTotal": len(data)},
        content_sha256=sha,
    )
    job.content_sha256 = sha

    # ── Idempotencia: contenido ya ingerido → cerrar sin reprocesar ───────────
    previo = dispatcher.buscar_idempotente(job.tenant_id, sha)
    if previo is not None:
        logger.info("job %s: contenido SHA-256 ya ingerido; idempotente (no reprocesa)", job_id)
        dispatcher.marcar_completado_idempotente(job_id, previo.get("resultado", {}))
        return

    # ── Procesar con reintento (backoff exponencial + jitter, tope duro) ──────
    tmp_path = None
    try:
        suffix = os.path.splitext(job.nombre_archivo)[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        def _progreso(phase, fraction, counters):
            dispatcher.actualizar_progreso(
                job_id, phase=phase, phase_fraction=fraction, counters=counters
            )

        last_exc: Exception | None = None
        for intento in range(MAX_RETRIES + 1):
            if intento > 0:
                dispatcher.actualizar_progreso(job_id, retry_attempt=intento)
                await sleep(_backoff_delay(intento - 1, rng))
                logger.warning("job %s: reintento %d/%d", job_id, intento, MAX_RETRIES)
            try:
                resultado = await pipeline.procesar(job, tmp_path, progreso=_progreso)
                dispatcher.marcar_completado(job_id, resultado)
                logger.info("job %s completado: %s", job_id, resultado)
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — transitorio: reintentar acotado
                last_exc = exc
                logger.warning(
                    "job %s: intento %d/%d falló: %s",
                    job_id, intento + 1, MAX_RETRIES + 1, exc,
                )
        # Agotados los reintentos → estado terminal de error.
        logger.error("job %s: agotados los reintentos; estado terminal error", job_id)
        dispatcher.marcar_fallido(
            job_id,
            f"{type(last_exc).__name__}: {last_exc}" if last_exc else "error desconocido",
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


async def _consumer_loop():
    """
    Loop principal del worker: BLPOP de la cola → procesar, con concurrencia
    acotada a MAX_CONCURRENCY (tope duro por semáforo). Mientras N jobs corren,
    el loop sigue tomando de la cola hasta llenar los N slots.
    """
    import redis  # cliente ya en el runtime del worker

    backend = RedisQueueBackend()
    dispatcher = JobDispatcher(backend=backend)
    pipeline = IngestPipeline(
        document_store=_build_document_store(),
        schema_registry=_build_schema_registry(),
    )
    sem = asyncio.Semaphore(MAX_CONCURRENCY)
    tareas: set[asyncio.Task] = set()
    logger.info(
        "worker de ingesta iniciado (concurrencia=%d, reintentos=%d); esperando jobs…",
        MAX_CONCURRENCY, MAX_RETRIES,
    )
    while True:
        try:
            await sem.acquire()  # nunca más de MAX_CONCURRENCY jobs en vuelo
            try:
                job_id = await asyncio.to_thread(backend.pop, POP_TIMEOUT)
            except (redis.exceptions.TimeoutError, TimeoutError) as exc:
                logger.debug("BLPOP idle timeout (esperado): %s", exc)
                sem.release()
                continue
            if not job_id:
                sem.release()
                continue

            async def _run(jid: str):
                try:
                    await _procesar_un_job(dispatcher, pipeline, jid)
                finally:
                    sem.release()

            tarea = asyncio.create_task(_run(job_id))
            tareas.add(tarea)
            tarea.add_done_callback(tareas.discard)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — errores reales SÍ se loggean
            logger.exception("error en el loop del consumidor; reintentando")
            with contextlib.suppress(Exception):
                sem.release()
            await asyncio.sleep(2)


@app.on_event("startup")
async def _startup():
    # Solo arranca el consumidor si hay cola configurada (evita arrancarlo en
    # contextos de test/health-only sin Redis).
    if os.getenv("REDIS_QUEUE_URL") or os.getenv("REDIS_URL"):
        app.state.consumer = asyncio.create_task(_consumer_loop())
    else:
        logger.warning("sin REDIS_QUEUE_URL/REDIS_URL; consumidor NO iniciado")


@app.on_event("shutdown")
async def _shutdown():
    task = getattr(app.state, "consumer", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


@app.get("/health")
async def health():
    """Health check sobre flycast (criterio §11). Reporta dependencias."""
    from app.graph.dkg_client import dkg_client

    falkor_ok = False
    try:
        falkor_ok = dkg_client.health()
    except Exception:  # noqa: BLE001
        falkor_ok = False

    embedder_ok = False
    try:
        from app.embeddings.bge_client import bge_client

        embedder_ok = bool(bge_client.health()) if hasattr(bge_client, "health") else None
    except Exception:  # noqa: BLE001
        embedder_ok = False

    return {
        "status": "healthy",
        "service": "docyan-lde-ingest",
        "falkordb": falkor_ok,
        "embedder": embedder_ok,
        "consumer_running": getattr(app.state, "consumer", None) is not None,
        "max_concurrency": MAX_CONCURRENCY,
    }
