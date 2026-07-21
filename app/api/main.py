import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.lifespan import lifespan
from app.api.routers import (
    admin,
    alertas,
    billing,
    chat,
    demo,
    destinatarios,
    documents,
    governance,
    ingest_sources,
    ingesta,
    invitations,
    mis_documentos,
    mo,
    notificaciones,
    observations,
    onboarding,
    platform,
    platform_ingesta,
    platform_tenant,
    qr,
    recursos,
    search,
    trail,
)

load_dotenv()

app = FastAPI(
    title="DOCYAN LDE™ API",
    description="Intelligent Middleware for Enterprise AI | DOCYAN LDE™",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")
if not ALLOWED_ORIGINS:
    raise RuntimeError(
        "ALLOWED_ORIGINS environment variable is required "
        "(comma-separated domains, e.g. https://app.docyan.com,http://localhost:3000)"
    )
_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]

# Previews de Vercel (F3 B5): los deploys de preview usan dominios DINÁMICOS
# (`https://docyan-<hash>-<scope>.vercel.app`) que no pueden listarse fijos en
# ALLOWED_ORIGINS, así que auth desde un preview da "No pudimos conectar" (CORS).
# `ALLOWED_ORIGIN_REGEX` (opcional) permite un PATRÓN de origen — se activa SOLO en
# el backend de staging para probar auth desde previews. **Producción lo deja sin
# setear** (CORS estricto por lista exacta). Ver docs/runbook_cors_previews.md.
_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(governance.router)
app.include_router(trail.router)
app.include_router(ingest_sources.router)
app.include_router(ingesta.router)
app.include_router(observations.router)
app.include_router(billing.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(qr.router)
app.include_router(mo.router)
app.include_router(platform.router)
app.include_router(platform_ingesta.router)
app.include_router(platform_tenant.router)
app.include_router(recursos.router)
app.include_router(onboarding.router)
app.include_router(invitations.router)
app.include_router(mis_documentos.router)
app.include_router(demo.router)
app.include_router(destinatarios.router)
app.include_router(alertas.router)
app.include_router(notificaciones.router)

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root():
    return {
        "product": "DOCYAN LDE™",
        "architecture": "DOCYAN™",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "org": os.getenv("ORG_ID")}


@app.get("/demo")
async def demo_portal():
    demo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "demo", "index.html")
    return FileResponse(demo_path, media_type="text/html")

