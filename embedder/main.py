"""
docyan-lde-embedder — Servicio HTTP de embeddings BGE-M3 self-hosted.

DOCYAN LDE™ by XCID — B1 §4 · ED-0d (estabilidad del event loop del embedder).

Proceso Fly INDEPENDIENTE del backend (decisión #1). Carga el modelo BAAI/bge-m3
(1024 dim) UNA vez y expone `/embed` sobre la red privada de Fly.

ED-0d — misma lección que ED-0/ED-0b/ED-0c, aplicada aquí: el handler NO debe
bloquear el event loop, la carga NO debe ser perezosa, y el health NO debe mentir.

  1. Inferencia en UN SOLO hilo (executor de 1 worker): BGE-M3 en CPU no gana con
     encodes concurrentes (se pisan por el GIL/CPU). Objetivo = event loop libre
     (health y arranque responden) + inferencia SERIALIZADA, no paralela.
  2. Carga del modelo en STARTUP (no perezosa) + warmup real; `/health` reporta
     sano SOLO cuando el modelo cargó y embebió ("ok") al menos una vez.
  3. Batch acotado por env + timeout interno del encode: un batch que excede el
     tope se trocea; un encode que excede el timeout da error claro, no cuelgue.

Contrato de API (B1 §4.1):
    POST /embed   {"texts": ["...", "..."]} → {"embeddings": [[...1024...]], "dim": 1024}
    GET  /health  → 200 {status, ready, busy} sólo si el modelo está listo; 503 si no.
"""
import asyncio
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

# El modelo va baked en la imagen (ver Dockerfile). Modo offline ANTES de importar
# sentence-transformers: sin esto huggingface_hub contacta huggingface.co en cada
# carga y se cuelga si el egress es lento (timeouts >300s observados en Fly).
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("docyan.embedder")

MODEL_NAME = os.getenv("BGE_MODEL_NAME", "BAAI/bge-m3")
EMBED_DIM = 1024  # BGE-M3 — dimensión fija (decisión #1). NO 1536 (OpenAI).

# ED-0d §3 — tope de batch (se trocea) + timeout interno del encode (error claro).
MAX_BATCH = max(1, int(os.getenv("EMBED_MAX_BATCH", "32")))
ENCODE_TIMEOUT = float(os.getenv("EMBED_ENCODE_TIMEOUT", "180"))
HEALTH_TIMEOUT = float(os.getenv("EMBED_HEALTH_TIMEOUT", "1.0"))

app = FastAPI(
    title="DOCYAN LDE™ — BGE-M3 Embedder",
    description="Servicio self-hosted de embeddings BGE-M3 (1024 dim). DOCYAN LDE™ by XCID.",
    version="1.1.0",
)

_model = None
_ready = False  # True SOLO tras cargar el modelo + un embed de warmup exitoso.
# ED-0d §1 — UN solo hilo de inferencia: serializa los encodes (BGE-M3 CPU no gana
# con concurrencia) y deja el event loop libre para /health y el arranque.
_infer_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="bge-infer")
_inferring = False  # hay un encode en curso (evita encolar el embed de /health).


def _load_model():
    global _model
    from sentence_transformers import SentenceTransformer

    _model = SentenceTransformer(MODEL_NAME)
    return _model


def _encode(texts: list[str]) -> list[list[float]]:
    """Inferencia SÍNCRONA (corre en el hilo del executor, no en el event loop).
    Trocea en sub-batches de MAX_BATCH para acotar tiempo/memoria por llamada."""
    out: list[list[float]] = []
    for i in range(0, len(texts), MAX_BATCH):
        sub = texts[i:i + MAX_BATCH]
        vectors = _model.encode(sub, normalize_embeddings=True)
        out.extend(v.tolist() for v in vectors)
    return out


async def _encode_async(texts: list[str], *, timeout: float) -> list[list[float]]:
    """Corre `_encode` en el hilo único de inferencia con corte duro. Marca
    `_inferring` mientras trabaja para que /health no encole otro embed encima."""
    global _inferring

    def _work():
        global _inferring
        _inferring = True
        try:
            return _encode(texts)
        finally:
            _inferring = False

    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(loop.run_in_executor(_infer_pool, _work), timeout=timeout)


@app.on_event("startup")
async def _startup() -> None:
    """Carga el modelo en STARTUP (en el hilo de inferencia) + warmup real. El
    event loop sigue libre (el arranque no bloquea); /health miente 503 hasta listo."""

    def _boot():
        global _ready
        t0 = time.time()
        try:
            _load_model()
            _model.encode(["ok"], normalize_embeddings=True)  # warmup: embed real
            _ready = True
            logger.info(
                "BGE-M3 cargado + warmup en %.1fs — embedder LISTO (max_batch=%d)",
                time.time() - t0, MAX_BATCH,
            )
        except Exception:  # noqa: BLE001
            logger.exception("FALLO al cargar/warm-up el modelo BGE-M3 tras %.1fs", time.time() - t0)

    asyncio.get_event_loop().run_in_executor(_infer_pool, _boot)


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, description="Textos a embeddir (≥1).")


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dim: int


@app.get("/health")
async def health():
    """
    Health PROFUNDO pero acotado (ED-0d §2): reporta sano sólo con el modelo listo.
    Si el hilo de inferencia está OCUPADO, responde igual sano (`busy=true`) SIN
    encolar otro embed — así /health responde <1s incluso durante una inferencia
    larga (regresión ED-0). 503 mientras carga o si un embed de prueba falla.
    """
    if not _ready:
        raise HTTPException(status_code=503, detail="modelo cargando (no listo)")
    if _inferring:
        return {"status": "healthy", "model": MODEL_NAME, "dim": EMBED_DIM,
                "ready": True, "busy": True}
    try:
        await _encode_async(["ok"], timeout=HEALTH_TIMEOUT)
    except asyncio.TimeoutError:
        # se ocupó entre el chequeo y el submit: sano y ocupado, no colgado.
        return {"status": "healthy", "model": MODEL_NAME, "dim": EMBED_DIM,
                "ready": True, "busy": True}
    except Exception as exc:  # noqa: BLE001 — embed de prueba falló ⇒ NO sano
        raise HTTPException(status_code=503, detail=f"embed de prueba falló: {type(exc).__name__}")
    return {"status": "healthy", "model": MODEL_NAME, "dim": EMBED_DIM,
            "ready": True, "busy": False}


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not _ready:
        raise HTTPException(status_code=503, detail="modelo aún cargando; reintenta")
    cleaned = [t.strip() for t in req.texts]
    if not any(cleaned):
        raise HTTPException(status_code=400, detail="Todos los textos están vacíos.")
    try:
        embeddings = await _encode_async(cleaned, timeout=ENCODE_TIMEOUT)
    except asyncio.TimeoutError:
        # ED-0d §3: error CLARO (no cuelgue) si el batch excede el timeout interno.
        raise HTTPException(
            status_code=504,
            detail=f"encode excedió {ENCODE_TIMEOUT:.0f}s ({len(cleaned)} textos). "
                   "Reduce el batch o revisa la carga de CPU del embedder.",
        )
    dim = len(embeddings[0]) if embeddings else EMBED_DIM
    if dim != EMBED_DIM:
        raise HTTPException(
            status_code=500,
            detail=f"Dimensión inesperada {dim}, se esperaba {EMBED_DIM} (BGE-M3).",
        )
    return {"embeddings": embeddings, "dim": dim}
