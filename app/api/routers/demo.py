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


def get_solicitud_rate_limiter():
    """Rate limiter ESTRICTO para el envío de solicitudes demo (anti-spam): por
    IP, pocas por minuto. El envío dispara un correo real → cota más baja que la
    consulta. Override en tests."""
    from app.cache.rate_limiter import RedisRateLimiter

    return RedisRateLimiter(
        limit=int(os.getenv("DEMO_SOLICITUD_RATE_LIMIT_PER_MIN", "3")),
        window_seconds=60,
        prefix="rate:demo:sol:",
    )


def get_email_sender():
    """Sender de correo de producción (Resend). Override en tests (Capturing)."""
    from app.notifications.email import get_email_sender as _factory

    return _factory()


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


DEMO_SOLICITUD_TO = os.getenv("DEMO_SOLICITUD_TO", "jamparan@lappicerostudio.com")
DEMO_SOLICITUD_FROM_LABEL = os.getenv("DEMO_SOLICITUD_FROM_LABEL", "Proveedor Demo DOCYAN")


class DemoSolicitudRequest(BaseModel):
    """Un dato accionable de la respuesta demo → solicitud REAL por correo (Pilar 3).
    Sin auth (visitante anónimo): el destino es FIJO (correo demo del fundador), NUNCA
    un correo libre del visitante → no es vector de spam saliente. El `contacto_email`
    (opcional) solo se usa como reply-to para que el destinatario pueda responder."""

    tipo: str = Field(min_length=1, max_length=80)          # "Cotización de refacción", …
    dato: str = Field(min_length=1, max_length=400)         # el dato accionable citado
    codo: str = "hero"
    documento_nombre: str | None = Field(default=None, max_length=200)
    pagina: int | None = None
    fragmento: str | None = Field(default=None, max_length=1500)  # cita verbatim (trazabilidad)
    contacto_nombre: str | None = Field(default=None, max_length=120)
    contacto_email: str | None = Field(default=None, max_length=200)


class DemoSolicitudResponse(BaseModel):
    enviada: bool
    mensaje: str


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


def _cuerpo_solicitud_demo(body: DemoSolicitudRequest, ip: str) -> tuple[str, str]:
    """Arma (subject, texto) del correo de solicitud demo. Etiquetado VISIBLE como
    demostración (regla del sprint: real, limitado, jamás fingido)."""
    subject = f"[DEMO DOCYAN] Solicitud de demostración — {body.tipo}"
    cita = "—"
    if body.documento_nombre:
        cita = body.documento_nombre
        if body.pagina:
            cita += f", p. {body.pagina}"
    contacto = "(el visitante no dejó contacto)"
    if body.contacto_nombre or body.contacto_email:
        contacto = " · ".join(x for x in (body.contacto_nombre, body.contacto_email) if x)
    frag = f"\n\nFragmento citado:\n«{body.fragmento.strip()}»" if body.fragmento else ""
    texto = (
        "SOLICITUD DE DEMOSTRACIÓN — DOCYAN LDE™\n"
        "Generada por un visitante ANÓNIMO del demo público. Es una demostración del\n"
        "Pilar 3 (dato accionable → solicitud), no un pedido comercial real.\n"
        "──────────────────────────────────────────\n"
        f"Tipo de solicitud: {body.tipo}\n"
        f"Dato / necesidad:  {body.dato}\n"
        f"Procedencia:       {cita}\n"
        f"CoDo demo:         {body.codo}\n"
        f"Contacto visitante: {contacto}"
        f"{frag}\n"
        "──────────────────────────────────────────\n"
        f"(origen: demo público · IP {ip})\n"
    )
    return subject, texto


@router.post("/solicitud", response_model=DemoSolicitudResponse)
async def demo_solicitud(
    body: DemoSolicitudRequest,
    request: Request,
    response: Response,
    limiter=Depends(get_solicitud_rate_limiter),
    email_sender=Depends(get_email_sender),
) -> DemoSolicitudResponse:
    """
    Pilar 3 en el demo público: convierte un dato accionable citado en una solicitud
    REAL por correo, SIN auth, con destino FIJO (correo demo del fundador → único que
    entrega el sandbox de Resend). Rate-limited estricto por IP (anti-spam). El correo
    va etiquetado como "solicitud de demostración". NUNCA se finge el envío: si el canal
    no está configurado o Resend rechaza, se devuelve el fallo honesto.
    """
    ip = _client_ip(request)
    rl = limiter.hit(ip)
    response.headers["X-RateLimit-Limit"] = str(rl.limit)
    response.headers["X-RateLimit-Remaining"] = str(rl.remaining)
    if not rl.allowed:
        raise HTTPException(
            status_code=429,
            detail="Demasiadas solicitudes demo. Intenta en un momento.",
            headers={"Retry-After": str(rl.retry_after)},
        )

    if email_sender is None:
        # Canal no configurado (sin RESEND_API_KEY): honesto, no fingido.
        logger.warning("demo_solicitud: sin proveedor de correo — no se envió")
        return DemoSolicitudResponse(
            enviada=False,
            mensaje="El envío de demostración no está disponible en este momento.",
        )

    from app.notifications.email import EmailMessage, EmailSendError

    subject, texto = _cuerpo_solicitud_demo(body, ip)
    reply_to = body.contacto_email if (body.contacto_email and "@" in body.contacto_email) else None
    msg = EmailMessage(to=DEMO_SOLICITUD_TO, subject=subject, body_text=texto, reply_to=reply_to)
    try:
        await asyncio.to_thread(email_sender.send, msg)
    except EmailSendError as exc:
        logger.warning("demo_solicitud: Resend rechazó (%s)", type(exc).__name__)
        return DemoSolicitudResponse(
            enviada=False,
            mensaje="No se pudo enviar la solicitud de demostración. Intenta de nuevo.",
        )
    except Exception as exc:  # noqa: BLE001 — el demo nunca 500 al visitante
        logger.warning("demo_solicitud: error inesperado (%s)", type(exc).__name__)
        return DemoSolicitudResponse(
            enviada=False, mensaje="No se pudo enviar la solicitud de demostración."
        )

    logger.info("demo_solicitud enviada tipo=%s codo=%s", body.tipo, body.codo)
    return DemoSolicitudResponse(
        enviada=True,
        mensaje="Solicitud de demostración enviada. Así viaja un dato accionable a su destinatario.",
    )
