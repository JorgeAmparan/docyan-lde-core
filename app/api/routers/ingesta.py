"""
Router de ingesta manual (B2 §8.3).

DOCYAN LDE™ by XCID.

Flujo del gate (cotizador sin bypass, CLAUDE.md §14):

  POST /ingesta/documents
      → mide tokens, selecciona schema, cotiza, crea job.
      → si RECHAZADO (saldo/hard cap): job 'rejected', responde la cotización.
      → si APROBADO: job 'pending_confirmation', responde estimación + job_id.
        NO se encola nada todavía.

  POST /ingesta/documents/{job_id}/confirm
      → solo si el job es confirmable (aprobado y pendiente): encola al worker.

  GET  /ingesta/documents/{job_id}
      → estado del job (aislado por tenant).

Separado del router `ingest_sources` (B0.5, modo conectado — stubs, NO activo en
B2). El activo en B2 es el modo manual (usuario sube archivo).
"""
from __future__ import annotations

import hashlib
import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.auth import requiere_rol
from app.ingesta import providers
from app.ingesta.text_extract import contar_figuras, contar_paginas, extraer_texto
from app.jobs.job_models import CotizacionSnapshot, IngestJob, JobStatus
from app.jobs.progress import DocProgress, build_doc_progress

router = APIRouter(prefix="/ingesta", tags=["ingesta"])

logger = logging.getLogger("docyan.api.ingesta")


def _chequear_limite_documentos(tenant_id: str) -> None:
    """
    Aplica el límite de documentos vivos del plan (B13). Lanza HTTP 409 si la cuenta
    está en su tope. Fail-open ante errores de infraestructura (org sin formalizar /
    grafo inalcanzable): no bloquea la cotización por una incertidumbre operativa.
    """
    from app.onboarding import providers as onboarding_providers
    from app.onboarding.limites import LimiteDocumentosError, verificar_limite_documentos

    try:
        verificar_limite_documentos(
            onboarding_providers.get_store(),
            onboarding_providers.get_dkg(),
            tenant_id,
        )
    except LimiteDocumentosError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — fail-open: el gate financiero protege el costo
        logger.warning("límite de documentos no verificable (%s): %s",
                       tenant_id, type(exc).__name__)


def _chequear_tamano_freemium(tenant_id: str, paginas: int) -> None:
    """
    Gate de TAMAÑO freemium (B13): rechaza documentos de >100 páginas en cuentas
    freemium con un payload orientado a CONVERSIÓN (HTTP 402). No aplica a planes
    pagados. Fail-open ante errores de infraestructura (org sin formalizar): el gate
    financiero del cotizador protege el costo por separado.
    """
    from app.onboarding import providers as onboarding_providers
    from app.onboarding.limites import (
        DocumentoFreemiumExcedeError,
        verificar_tamano_freemium,
    )

    try:
        verificar_tamano_freemium(onboarding_providers.get_store(), tenant_id, paginas)
    except DocumentoFreemiumExcedeError as e:
        # 402 Payment Required: el detalle estructurado es la invitación a convertir.
        raise HTTPException(status_code=402, detail=e.payload())
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — fail-open
        logger.warning("tamaño freemium no verificable (%s): %s",
                       tenant_id, type(exc).__name__)


@router.post("/documents")
async def cotizar_documento(
    file: UploadFile = File(...),
    tipo_forzado: str | None = Form(default=None),
    ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    """
    Cotiza un documento (gate financiero) y crea el job. NO ingiere: devuelve la
    estimación + job_id pendiente de confirmación, o el rechazo con motivo.
    """
    tenant_id = ctx["org_id"]

    # B13 §1.2/§1.5 — Gate de LÍMITE DE DOCUMENTOS VIVOS del plan (freemium = 3).
    # Antes del gate financiero: una cuenta en su límite no debe poder cotizar otra
    # ingesta. Fail-open ante incertidumbre (org sin formalizar / grafo inalcanzable):
    # el gate financiero del cotizador sigue protegiendo el costo.
    _chequear_limite_documentos(tenant_id)

    data = await file.read()

    texto, confiable = extraer_texto(data, file.filename)

    # B13 — Gate de TAMAÑO freemium: documentos de >100 páginas se rechazan en
    # cuentas freemium con un payload de conversión (no un "saldo insuficiente"
    # seco). Planes pagados: sin tope de páginas. Antes del gate financiero.
    paginas = contar_paginas(data, file.filename, texto=texto)
    _chequear_tamano_freemium(tenant_id, paginas)

    # Clasificación SOLO heurística en el backend (sin generación dinámica: esa usa
    # litellm/Gemini y vive en el worker, para mantener el backend <1 GB y sin
    # litellm). Si no hay match de catálogo, el tipo queda tentativo y el worker
    # resuelve/genera el schema definitivo al procesar.
    selector = providers.get_selector()
    tipo_heuristico, _conf = selector.clasificar_heuristica(texto[:8000], file.filename)
    tipo_tentativo = tipo_forzado or tipo_heuristico  # puede ser None → worker genera

    # Figuras (Pieza 3): conteo ligero pre-ingesta para sumar el costo de VISIÓN al
    # gate. Cota previa (sin Docling); el worker re-mide con Docling y aplica el tope.
    num_figuras = contar_figuras(data, file.filename)

    # Cotización (mide tokens + figuras, estima costo/tiempo, verifica presupuesto). El
    # costo NO depende del schema: se mide por tokens del documento + costo de visión.
    cotizador = providers.get_cotizador()
    cotizacion = cotizador.cotizar(
        tenant_id=tenant_id,
        texto_documento=texto,
        tipo_documento=tipo_tentativo,
        num_figuras=num_figuras,
    )

    # Guarda el binario y referencia (worker lo leerá si se confirma).
    store = providers.get_document_store()
    documento_ref = store.put(tenant_id, file.filename, data)

    # SHA-256 del contenido al subir (F1.5/A.3): habilita cortar la idempotencia
    # ANTES de reservar en /confirm (mismo contenido ya liquidado → no re-cobra).
    # El worker lo recalcula de los bytes descargados como defensa en profundidad.
    content_sha256 = hashlib.sha256(data).hexdigest()

    job = IngestJob(
        job_id=uuid.uuid4().hex,
        tenant_id=tenant_id,
        documento_ref=documento_ref,
        nombre_archivo=file.filename,
        tipo_documento=tipo_tentativo,
        tipo_forzado=tipo_forzado,
        usuario_id=ctx.get("user_id"),
        content_sha256=content_sha256,
        bytes_originales=len(data),
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=cotizacion.costo_estimado_usd,
            tiempo_estimado_seg=cotizacion.tiempo_estimado_seg,
            tokens_documento=cotizacion.tokens_documento,
            aprobado=cotizacion.aprobado,
            decision=cotizacion.decision.value,
            precio_setup_usd=cotizacion.precio_setup_usd,
            dentro_de_cupo=cotizacion.dentro_de_cupo,
        ),
    )

    dispatcher = providers.get_dispatcher()
    dispatcher.crear_job(job)

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "tipo_documento": tipo_tentativo,
        "tipo_resuelto_por": "usuario" if tipo_forzado else (
            "heuristica" if tipo_heuristico else "worker_generara"
        ),
        "cotizacion": cotizacion.to_dict(),
        # Conversión a moneda local de la banda del tenant (decisión Jorge): SOLO la
        # cotización variable de ingesta usa FX en vivo (Banxico FIX + 3 % + ceil $10),
        # congelado aquí. Banda A → MXN; B/C → None (la tarjeta muestra USD).
        "cotizacion_local": _cotizacion_local(tenant_id, cotizacion.precio_setup_usd),
        "paginas_estimadas": paginas,
        "extraccion_confiable": confiable,
        "advertencia": None if confiable else (
            "El extractor ligero pudo subestimar el texto (¿PDF escaneado?). "
            "El worker re-medirá con OCR; el costo real puede variar."
        ),
        "requiere_confirmacion": job.status == JobStatus.pending_confirmation,
    }


def _cotizacion_local(tenant_id: str, precio_setup_usd: float) -> dict | None:
    """Convierte el precio de setup a la moneda de la banda del tenant. Solo Banda A
    (MXN) usa FX vivo; B/C facturan en USD (None → la UI muestra el importe USD).
    Nunca rompe la cotización: ante cualquier fallo, devuelve None (degrada a USD)."""
    try:
        from app.ingesta.fx_banxico import convertir_usd_a_mxn
        from app.onboarding import providers as onboarding_providers

        org = onboarding_providers.get_store().get_org(tenant_id) or {}
        banda = (org.get("banda_mercado") or "A").upper()
        if banda != "A":
            return None
        c = convertir_usd_a_mxn(precio_setup_usd)
        return {
            "moneda": "MXN",
            "precio_setup": c.mxn,
            "fx_fix": c.fix,
            "fx_fecha": c.fecha,
            "fx_fuente": c.fuente,
            "margen": c.margen,
        }
    except Exception:  # noqa: BLE001 — el FX nunca bloquea la ingesta (degrada a USD)
        logger.warning("conversión MXN no disponible → la tarjeta muestra USD", exc_info=False)
        return None


@router.post("/documents/{job_id}/confirm")
async def confirmar_ingesta(
    job_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    """Confirma e encola un job aprobado hacia el worker. Sin esto, no hay ingesta."""
    tenant_id = ctx["org_id"]
    reader = providers.get_status_reader()
    job = reader.get(tenant_id, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado.")

    dispatcher = providers.get_dispatcher()
    try:
        job = dispatcher.confirmar(job_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # encolado=False si la idempotencia (A.3) lo resolvió sin reservar ni encolar
    # (mismo contenido ya liquidado): queda 'completed' marcado idempotente.
    encolado = job.status == JobStatus.queued
    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "encolado": encolado,
        "idempotente": job.idempotente,
    }


@router.get("/cupo")
async def cupo_ingestas(
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
):
    """
    Cupo de ingestas incluidas del plan (F3 §C). La UI de carga y `/cuenta` lo
    muestran ("te quedan N ingestas incluidas"). `aplica=False` para planes sin
    cupo (freemium opera con su saldo de cortesía).
    """
    quota = providers.get_quota_manager()
    return quota.estado(ctx["org_id"]).to_dict()


@router.get("/documents/{job_id}")
async def estado_job(
    job_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
):
    """Estado plano de un job (aislado por tenant). Compat B2."""
    reader = providers.get_status_reader()
    job = reader.get(ctx["org_id"], job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "tipo_documento": job.tipo_documento,
        "resultado": job.resultado,
        "error": job.error,
        "documento_vivo": _documento_vivo(ctx["org_id"], job),
    }


def _consult_url_for(job) -> str | None:
    """Destino de 'Consultar →' al completar (relativo; la UI lo navega)."""
    doc_id = (job.resultado or {}).get("document_id") or job.content_sha256 or job.job_id
    return f"/consulta?doc={doc_id}"


def _documento_vivo(org_id: str, job) -> bool | None:
    """ÚNICA fuente de verdad de 'vivo' (B13.3 fix): el `:DocumentoSource` EXISTE en
    el grafo del tenant, consultado EN VIVO. `doc_id` == SHA == `:DocumentoSource.id`.
    Refleja borrados (el banner ya no miente sobre un doc que no quedó vivo). None si
    aún no hay SHA (job recién creado) ⇒ el builder cae al estado del job (compat)."""
    sha = job.content_sha256 or (job.resultado or {}).get("document_id")
    if not sha:
        return None
    try:
        from app.graph import dkg_documents
        from app.graph.dkg_client import dkg_client
        return dkg_documents.documento_existe(dkg_client, org_id, sha)
    except Exception:  # noqa: BLE001 — si el grafo no responde, no afirmamos "vivo"
        return None


@router.get("/documents/{job_id}/status", response_model=DocProgress)
async def progreso_job(
    job_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
) -> DocProgress:
    """
    Progreso observable de un job (F1 §2.1, shape `DocProgress` del handoff). El
    cliente sondea este endpoint por job (cada 2-3 s) y agrega los N en su
    `BatchProgress`. Multi-tenant estricto: solo jobs del tenant del JWT (RLS).
    """
    reader = providers.get_status_reader()
    job = reader.get(ctx["org_id"], job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    pos = reader.backend.queue_position(job_id)
    return build_doc_progress(job, queue_position=pos, consult_url=_consult_url_for(job), documento_vivo=_documento_vivo(ctx["org_id"], job))


@router.post("/documents/{job_id}/retry", response_model=DocProgress)
async def reintentar_job(
    job_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
) -> DocProgress:
    """
    Reintento manual de un documento en estado terminal de error (F1 §2.5). Re-
    encola sin re-cotizar; la idempotencia por SHA-256 evita duplicar si el
    contenido ya quedó ingerido. ('Omitir' es acción de cliente, no toca backend.)
    """
    reader = providers.get_status_reader()
    job = reader.get(ctx["org_id"], job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    dispatcher = providers.get_dispatcher()
    try:
        job = dispatcher.reintentar(job_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    pos = reader.backend.queue_position(job_id)
    return build_doc_progress(job, queue_position=pos, consult_url=_consult_url_for(job), documento_vivo=_documento_vivo(ctx["org_id"], job))
