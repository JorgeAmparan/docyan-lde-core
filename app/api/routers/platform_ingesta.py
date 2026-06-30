"""
Ingesta de documentos de PRUEBA desde la consola de plataforma (super-admin).

Prefijo `/platform/test-ingesta/*`. Exige scope `platform_admin`. Permite al dueño
de DOCYAN cargar documentos a un **tenant de prueba destino explícito** (hoy la
mezcladora `demo-maxi`, mañana otra entidad) para recorrer y confirmar las
funcionalidades del producto, sin pasar por el alta de un cliente real.

Reusa EXACTAMENTE el pipeline canónico de ingesta (cotizador → dispatcher → cola
Redis → worker → Docling/Gemini/GraphRAG-SDK), igual que `scripts/seed_demo_tenants.py`:
NO hay ruta de ingesta alterna. Diferencias vs la ingesta de cliente:
  · El tenant destino es EXPLÍCITO (no se deriva del JWT) — escritura controlada
    cross-tenant, análoga al canje que provisiona orgs. Multi-tenant strict intacto:
    el destino lo nombra el super-admin, no se filtra a otro tenant.
  · Se provisiona saldo de cómputo de prueba (los tenants de prueba no se facturan).
  · NO aplica los gates de CLIENTE (cupo / tamaño freemium) — son de facturación.
  · El gate FINANCIERO del cotizador SIGUE vigente (no se bypassa; CLAUDE.md §11).

Invariante del dominio de plataforma ("metadata SÍ / contenido NO"): estos endpoints
reciben el archivo a ingerir pero NUNCA devuelven texto del documento ni del grafo —
solo cotización (metadata de costo) y estado del job.
"""
from __future__ import annotations

import hashlib
import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.ingesta import providers as ingesta_providers
from app.ingesta.text_extract import extraer_texto
from app.jobs.job_models import CotizacionSnapshot, IngestJob
from app.jobs.progress import build_doc_progress
from app.platform_admin import providers as platform_providers
from app.platform_admin.security import actor_de, requiere_platform_admin

router = APIRouter(prefix="/platform/test-ingesta", tags=["platform-admin"])

logger = logging.getLogger("docyan.api.platform_ingesta")

# Saldo de cómputo de cortesía para tenants de prueba (cubre la ingesta; no se
# factura). Mismo criterio que el seed de demos.
TEST_SALDO_USD = float(os.getenv("PLATFORM_TEST_SALDO_USD", "50.0"))

# Tenants de prueba conocidos (los del sitio de demo). El super-admin puede usar
# uno de estos o nombrar uno nuevo (alta de tenant de prueba al vuelo).
_DEMO_TENANTS_DEFAULT = {
    "hero": os.getenv("DEMO_TENANT_HERO", "demo-hero"),
    "maxi": os.getenv("DEMO_TENANT_MAXI", "demo-maxi"),
}


def _tenant_destino(valor: str) -> str:
    """Resuelve el tenant destino: un alias de demo conocido o un graph_name libre.

    Sanea para que sea un `graph_name` válido y aislado (solo demos/pruebas): exige
    el prefijo `demo-`/`test-` para que NUNCA se pueda apuntar a un tenant de cliente
    real desde esta superficie de prueba (defensa en profundidad del aislamiento).
    """
    if valor in _DEMO_TENANTS_DEFAULT:
        return _DEMO_TENANTS_DEFAULT[valor]
    t = valor.strip().lower()
    if not (t.startswith("demo-") or t.startswith("test-")):
        raise HTTPException(
            status_code=400,
            detail="El tenant de prueba debe empezar con 'demo-' o 'test-' "
            "(esta superficie no ingiere a tenants de cliente).",
        )
    return t


@router.get("/tenants")
async def listar_tenants_prueba(ctx: dict = Depends(requiere_platform_admin)) -> dict:
    """Tenants de prueba sugeridos (alias → graph_name). Metadata, no contenido."""
    return {"tenants": _DEMO_TENANTS_DEFAULT}


@router.post("/documents")
async def cotizar_documento_prueba(
    file: UploadFile = File(...),
    tenant: str = Form(...),
    tipo_forzado: str | None = Form(default=None),
    ctx: dict = Depends(requiere_platform_admin),
) -> dict:
    """Cotiza un documento contra un tenant de PRUEBA y crea el job (no ingiere aún).

    Provisiona saldo de cómputo de prueba ANTES de cotizar, para que el gate
    financiero (vigente) apruebe la ingesta de demo. Devuelve cotización + job_id.
    """
    tenant_id = _tenant_destino(tenant)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío.")

    texto, _confiable = extraer_texto(data, file.filename)

    # Clasificación heurística (sin LLM en el backend; el worker genera el schema
    # definitivo si el tipo no calza con el catálogo). Paridad con la ruta de cliente.
    selector = ingesta_providers.get_selector()
    tipo_heuristico, _conf = selector.clasificar_heuristica(texto[:8000], file.filename)
    tipo_documento = tipo_forzado or tipo_heuristico

    # Saldo de prueba: asegura cómputo para el tenant de demo (sin auto-recharge en
    # prod; aquí se provisiona explícitamente, como el seed).
    ingesta_providers.get_budget_manager().ensure_budget(
        tenant_id, saldo_inicial_usd=TEST_SALDO_USD
    )

    cot = ingesta_providers.get_cotizador().cotizar(
        tenant_id=tenant_id, texto_documento=texto, tipo_documento=tipo_documento
    )

    job_id = uuid.uuid4().hex
    if not cot.aprobado:
        # El gate rechazó (no debería con saldo de prueba, pero se respeta): no se crea
        # job confirmable; se reporta el motivo honesto.
        platform_providers.get_audit().record(
            "platform_test_ingesta_rechazada", actor_de(ctx),
            {"tenant": tenant_id, "archivo": file.filename, "motivo": cot.motivo},
        )
        return {
            "job_id": job_id, "status": "rejected", "tenant": tenant_id,
            "tipo_documento": tipo_documento,
            "cotizacion": {
                "tokens_documento": cot.tokens_documento,
                "costo_estimado_usd": cot.costo_estimado_usd,
                "tiempo_estimado_seg": cot.tiempo_estimado_seg,
                "decision": cot.decision.value, "aprobado": False,
                "motivo": cot.motivo,
            },
        }

    # Guarda el binario en storage y crea el job cotizado (pending_confirmation).
    ref = ingesta_providers.get_document_store().put(tenant_id, file.filename, data)
    job = IngestJob(
        job_id=job_id, tenant_id=tenant_id, documento_ref=ref,
        nombre_archivo=file.filename,
        content_sha256=hashlib.sha256(data).hexdigest(),
        tipo_documento=tipo_documento, tipo_forzado=tipo_forzado,
        bytes_originales=len(data),
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=cot.costo_estimado_usd,
            tiempo_estimado_seg=cot.tiempo_estimado_seg,
            tokens_documento=cot.tokens_documento, aprobado=True,
            decision=cot.decision.value, precio_setup_usd=cot.precio_setup_usd,
        ),
    )
    ingesta_providers.get_dispatcher().crear_job(job)
    platform_providers.get_audit().record(
        "platform_test_ingesta_cotizada", actor_de(ctx),
        {"tenant": tenant_id, "archivo": file.filename, "job_id": job_id,
         "tipo_documento": tipo_documento, "costo_usd": cot.costo_estimado_usd},
    )
    return {
        "job_id": job_id, "status": "pending_confirmation", "tenant": tenant_id,
        "tipo_documento": tipo_documento,
        "cotizacion": {
            "tokens_documento": cot.tokens_documento,
            "costo_estimado_usd": cot.costo_estimado_usd,
            "tiempo_estimado_seg": cot.tiempo_estimado_seg,
            "decision": cot.decision.value, "aprobado": True,
        },
    }


@router.post("/documents/{job_id}/confirm")
async def confirmar_ingesta_prueba(
    job_id: str, ctx: dict = Depends(requiere_platform_admin)
) -> dict:
    """Confirma e encola el job hacia el worker. Sin esto, no hay ingesta."""
    dispatcher = ingesta_providers.get_dispatcher()
    try:
        job = dispatcher.confirmar(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    platform_providers.get_audit().record(
        "platform_test_ingesta_confirmada", actor_de(ctx),
        {"tenant": job.tenant_id, "job_id": job_id},
    )
    return {"job_id": job_id, "status": job.status.value, "tenant": job.tenant_id}


@router.get("/documents/{job_id}")
async def estado_job_prueba(
    job_id: str, ctx: dict = Depends(requiere_platform_admin)
) -> dict:
    """Estado/progreso del job (metadata). Nunca devuelve contenido del grafo."""
    job = ingesta_providers.get_dispatcher().backend.load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    progreso = build_doc_progress(job)
    return progreso.model_dump() if hasattr(progreso, "model_dump") else dict(progreso)
