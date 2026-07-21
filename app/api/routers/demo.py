"""
Router del demo público sin registro (F3 §D/§E).

DOCYAN LDE™ by XCID.

`POST /demo/query` — consulta REAL contra un tenant demo dedicado (solo lectura),
SIN auth, rate-limited por IP (Redis), timeout 9s. Reutiliza el Master Orchestrator
(`/mo/query`) con el `auth` scopeado al tenant demo — NO reimplementa el pipeline.

Aislamiento (D3 + restricción de seguridad):
  · Solo se expone CONSULTA (lectura). No hay endpoint de escritura para tenants demo;
    la ingesta exige rol admin/editor (JWT), inaccesible desde esta ruta anónima.
  · El `auth` sintético lleva rol "viewer" y el `org_id` del tenant demo del CoDo.

Tercera capa del input libre (handoff §8): match exacto y por palabras clave viven en
el front (datos preparados de `codo-data`); esta es la CAPA 3 (backend real) + el
fallback honesto cuando el grafo demo no sostiene la pregunta.
"""
from __future__ import annotations

import asyncio
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.api.routers.mo import DocumentoRefOut
from app.orchestrator import providers
from app.orchestrator.master_orchestrator import MasterOrchestrator
from app.orchestrator.models import Canal, MORequest

router = APIRouter(prefix="/demo", tags=["demo-publico"])

logger = logging.getLogger("docyan.api.demo")

# ── Mapeo CoDo → tenant demo (graph_name). Configurable por env. ──────────────
# Los 5 CoDos del handoff (lab/maq/pharma/min/agri) + el hero (consulta multilingüe).
# Cada uno es un tenant demo REAL, poblado una vez por el pipeline (script de siembra).
DEMO_TENANTS: dict[str, str] = {
    # Dos CoDos del corredor CIPSA, cada tenant nombrado por el equipo que contiene
    # (aislamiento = multi-tenancy strict; una consulta de un CoDo JAMÁS cita el otro):
    #   "bomba" → Bomba de concreto LS-400 (3 docs: operación/partes/ficha).
    #   "maxi"  → Revolvedora MAXI-10 (3 docs: operación/partes/ficha).
    # Son equipos DISTINTOS de CIPSA — no mezclar. Cada tenant demo REAL, poblado por
    # el pipeline de ingesta (siembra directa a la cola).
    "bomba": os.getenv("DEMO_TENANT_BOMBA", "demo-bomba"),
    "maxi": os.getenv("DEMO_TENANT_MAXI", "demo-maxi"),
    "hero": os.getenv("DEMO_TENANT_HERO", "demo-hero"),
    "lab": os.getenv("DEMO_TENANT_LAB", "demo-lab"),
    "maq": os.getenv("DEMO_TENANT_MAQ", "demo-maq"),
    "pharma": os.getenv("DEMO_TENANT_PHARMA", "demo-pharma"),
    "min": os.getenv("DEMO_TENANT_MIN", "demo-min"),
    "agri": os.getenv("DEMO_TENANT_AGRI", "demo-agri"),
}

DEMO_QUERY_TIMEOUT_S = float(os.getenv("DEMO_QUERY_TIMEOUT_S", "9"))

# Fallback honesto (handoff §8 / capa 3). NO inventa: invita a probar con docs propios.
FALLBACK_MSG = (
    "Esa pregunta no está en este documento demo — pruébalo con tus documentos."
)


# ── Dependencias inyectables (override en tests) ──────────────────────────────


def get_mo() -> MasterOrchestrator:
    return providers.get_master_orchestrator()


def get_rate_limiter():
    """Rate limiter del demo (ventana fija sobre Redis). Override en tests."""
    from app.cache.rate_limiter import RedisRateLimiter

    return RedisRateLimiter(
        limit=int(os.getenv("DEMO_RATE_LIMIT_PER_MIN", "30")),
        window_seconds=60,
        prefix="rate:demo:",
    )


def _client_ip(request: Request) -> str:
    """IP del cliente, respetando el proxy de Vercel/Fly (X-Forwarded-For)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Modelos ───────────────────────────────────────────────────────────────────


class DemoQueryRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=500)
    codo: str = "hero"  # clave del CoDo demo (hero/lab/maq/pharma/min/agri)
    # Documento activo de las doc-tabs (F3/§2.4 fix): acota el retrieval a ESE
    # :DocumentoSource. Sin él, la consulta corre contra todo el CoDo y puede citar
    # otro documento del mismo tenant demo (cross-citation, mismo riesgo que en la
    # consulta autenticada — ver ConsultaRequest.documento_id en mo.py).
    documento_id: str | None = None


class DemoQueryResponse(BaseModel):
    servido: bool
    kind: str | None = None
    resultado: dict | None = None  # ConsultaResuelta (dict) cuando hay respuesta citada
    fallback: str | None = None    # mensaje honesto cuando el grafo demo no la sostiene
    codo: str
    tenant_demo: str


class DemoCodoDocumentosOut(BaseModel):
    """Documentos reales del tenant demo — alimenta las doc-tabs (fix §2.4).
    Sin `id`/`titulo`/`entidad_id`: en el demo el "CoDo" (p. ej. "CODO-LAB-04") es
    una etiqueta de presentación del front, no un nodo del grafo — el tenant
    completo son sus documentos sueltos."""

    documentos: list[DocumentoRefOut]


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/query", response_model=DemoQueryResponse)
async def demo_query(
    body: DemoQueryRequest,
    request: Request,
    response: Response,
    mo: MasterOrchestrator = Depends(get_mo),
    limiter=Depends(get_rate_limiter),
) -> DemoQueryResponse:
    """
    Consulta real contra un tenant demo (solo lectura), sin auth, rate-limited por IP.
    Devuelve la respuesta citada si el grafo demo la sostiene; si no, el fallback honesto.
    """
    codo = body.codo if body.codo in DEMO_TENANTS else "hero"
    tenant_demo = DEMO_TENANTS[codo]

    # Rate-limit por IP (Redis). 429 con Retry-After si excede.
    ip = _client_ip(request)
    rl = limiter.hit(f"{ip}:{codo}")
    response.headers["X-RateLimit-Limit"] = str(rl.limit)
    response.headers["X-RateLimit-Remaining"] = str(rl.remaining)
    if not rl.allowed:
        raise HTTPException(
            status_code=429,
            detail="Demasiadas consultas al demo. Intenta en un momento.",
            headers={"Retry-After": str(rl.retry_after)},
        )

    # Auth SINTÉTICO scopeado al tenant demo, rol viewer (solo lectura).
    auth = {"org_id": tenant_demo, "user_id": "demo", "role": "viewer", "demo": True}
    req = MORequest(
        auth=auth,
        canal=Canal.pwa,
        texto=body.texto,
        accion="consulta",
        payload={"documento_id": body.documento_id, "params": {}},
        session_id=None,
    )

    # Timeout 9s: el MO es síncrono → se corre en threadpool con corte duro.
    try:
        resp = await asyncio.wait_for(
            asyncio.to_thread(mo.handle_request, req), timeout=DEMO_QUERY_TIMEOUT_S
        )
    except asyncio.TimeoutError:
        logger.warning("demo_query timeout (%ss) codo=%s", DEMO_QUERY_TIMEOUT_S, codo)
        return DemoQueryResponse(
            servido=False, fallback=FALLBACK_MSG, codo=codo, tenant_demo=tenant_demo
        )
    except Exception as exc:  # noqa: BLE001 — el demo nunca debe 500 al visitante.
        logger.warning("demo_query error codo=%s: %s", codo, type(exc).__name__)
        return DemoQueryResponse(
            servido=False, fallback=FALLBACK_MSG, codo=codo, tenant_demo=tenant_demo
        )

    if resp.servido and resp.data:
        return DemoQueryResponse(
            servido=True, kind=resp.kind.value, resultado=resp.data,
            codo=codo, tenant_demo=tenant_demo,
        )
    # Sin respuesta citada en el grafo demo → fallback honesto (no inventa).
    return DemoQueryResponse(
        servido=False, fallback=FALLBACK_MSG, codo=codo, tenant_demo=tenant_demo
    )


@router.get("/codo/{key}", response_model=DemoCodoDocumentosOut)
async def demo_codo_documentos(
    key: str,
    request: Request,
    response: Response,
    limiter=Depends(get_rate_limiter),
) -> DemoCodoDocumentosOut:
    """
    Documentos REALES del tenant demo (con su id) — sin auth, rate-limited por IP.
    Alimenta las doc-tabs del explorador demo (F3/§2.4 fix): el front necesita el
    `id` real de cada documento para acotar `/demo/query` por documento
    (`documento_id`) y evitar cross-citation entre los documentos del mismo tenant.

    Sin `codo_id`: en estos tenants demo no hay `:EntidadOperativa` que agrupe los
    documentos — "el CoDo" que muestra la UI (p. ej. "CODO-LAB-04") es una etiqueta
    de presentación sin nodo propio en el grafo. El tenant completo son sus 2-3
    documentos sueltos, igual que ya scopea `/demo/query` (por `org_id`, no por un
    id de CoDo). Sin datos enlatados: lista vacía si el tenant no tiene documentos.
    """
    from app.graph import dkg_codos
    from app.onboarding import providers as onb

    if key not in DEMO_TENANTS:
        raise HTTPException(status_code=404, detail="Demo no encontrado.")
    tenant_demo = DEMO_TENANTS[key]

    ip = _client_ip(request)
    rl = limiter.hit(f"{ip}:{key}:codo")
    response.headers["X-RateLimit-Limit"] = str(rl.limit)
    response.headers["X-RateLimit-Remaining"] = str(rl.remaining)
    if not rl.allowed:
        raise HTTPException(
            status_code=429,
            detail="Demasiadas consultas al demo. Intenta en un momento.",
            headers={"Retry-After": str(rl.retry_after)},
        )

    # Descarga a thread + corte duro (9s del demo): el grafo no bloquea el loop.
    from app.api.blocking import run_blocking

    docs = await run_blocking(
        dkg_codos.documentos_tenant, onb.get_dkg(), tenant_demo,
        timeout=DEMO_QUERY_TIMEOUT_S, endpoint="/demo/codo/{key}",
    )
    return DemoCodoDocumentosOut(documentos=[DocumentoRefOut(**d) for d in docs])
