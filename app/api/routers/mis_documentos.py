"""
Router de gestión de documentos vivos del cliente (B13 §1.5).

Los "documentos vivos" son los `:DocumentoSource` del grafo del tenant. Aquí el
cliente los LISTA y los ELIMINA (quita del grafo, sin residuo, y libera cupo del
plan). "Reemplazar" = eliminar + volver a ingerir por el flujo de `/ingesta`
(libera cupo al borrar, luego carga otro dentro del límite).

Multi-tenant estricto: toda operación va contra el grafo del `org_id` del JWT.
El evento de borrado queda en el FAT (auditoría) aunque el contenido consultable
se elimine (retención FAT respetada).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import requiere_rol
from app.api.blocking import run_blocking
from app.graph import dkg_documents
from app.onboarding import providers
from app.onboarding.limites import estado_cupo
from app.onboarding.models import (
    DeleteDocumentoResponse,
    DocumentoOut,
    DocumentosResponse,
)

logger = logging.getLogger("docyan.api.mis_documentos")

router = APIRouter(prefix="/mis-documentos", tags=["mis-documentos"])


@router.get("", response_model=DocumentosResponse)
async def listar_documentos(
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
) -> DocumentosResponse:
    """Lista los documentos vivos del tenant + estado del cupo del plan."""
    tenant_id = ctx["org_id"]
    store = providers.get_store()
    dkg = providers.get_dkg()

    def _work() -> tuple[list, dict]:
        return (
            dkg_documents.listar_documentos(dkg, tenant_id),
            estado_cupo(store, dkg, tenant_id),
        )

    rows, cupo = await run_blocking(_work, endpoint="/mis-documentos")
    items = [
        DocumentoOut(
            id=r.get("id"), nombre_archivo=r.get("nombre_archivo"),
            tipo_documento=r.get("tipo_documento"), version=r.get("version"),
            hash_contenido=r.get("hash_contenido"), idioma_origen=r.get("idioma_origen"),
            contenido_directo=int(r.get("contenido_directo") or 0),
        )
        for r in rows
    ]
    return DocumentosResponse(
        items=items, total=len(items), doc_limit=cupo["limit"],
        usados=cupo["usados"], disponibles=cupo["disponibles"],
    )


@router.delete("/{doc_id}", response_model=DeleteDocumentoResponse)
async def eliminar_documento(
    doc_id: str,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
) -> DeleteDocumentoResponse:
    """Elimina un documento del grafo (sin residuo) y libera cupo. FAT conserva el evento."""
    tenant_id = ctx["org_id"]
    store = providers.get_store()
    dkg = providers.get_dkg()
    actor = ctx.get("email") or ctx.get("user_id") or tenant_id

    def _work() -> tuple[dict, dict]:
        if not dkg_documents.documento_existe(dkg, tenant_id, doc_id):
            raise HTTPException(status_code=404, detail="Documento no encontrado.")

        contadores = dkg_documents.eliminar_documento(dkg, tenant_id, doc_id)

        # B13.3 fix: limpiar la marca de idempotencia del SHA (doc_id == SHA). Sin esto,
        # re-subir el MISMO archivo tras borrarlo hace idempotency-skip en el worker
        # ("completed" reusando el resultado viejo, sin recrear el :DocumentoSource) — el
        # bug del documento que "queda vivo" pero no aparece. Best-effort: no es gate.
        try:
            from app.ingesta.providers import get_dispatcher
            get_dispatcher().borrar_idempotencia(tenant_id, doc_id)
        except Exception as exc:  # noqa: BLE001 — limpiar idempotencia no debe romper el borrado
            logger.warning("no se pudo limpiar idempotencia de %s: %s", doc_id[:12], type(exc).__name__)

        # B13.3 §5 fix: invalidar la caché de CONSULTA (PCL) del tenant. Sin esto, las
        # preguntas del documento borrado siguen sirviendo respuestas cacheadas viejas
        # ("RESPUESTA INSTANTÁNEA · CACHÉ", incluidas las VACÍAS) sobre un grafo ya
        # cambiado. La invalidación es parte del ciclo de vida del documento.
        try:
            from app.pcl.pcl_cache import PCLCache
            n = PCLCache().invalidar_tenant(tenant_id)
            logger.info("caché PCL invalidada tras borrado | tenant=%s entradas=%d", tenant_id, n)
        except Exception as exc:  # noqa: BLE001 — el caché es optimización, no gate del borrado
            logger.warning("no se pudo invalidar caché PCL de %s: %s", tenant_id, type(exc).__name__)

        # FAT: el evento de borrado queda en auditoría (sin el contenido del documento).
        providers.get_audit().record("document_deleted", actor, {
            "doc_id": doc_id,
            "contenido_eliminado": contadores["contenido_eliminado"],
        }, org_id=tenant_id)

        return contadores, estado_cupo(store, dkg, tenant_id)

    contadores, cupo = await run_blocking(_work, endpoint="/mis-documentos/{id} (delete)")
    return DeleteDocumentoResponse(
        doc_id=doc_id, contenido_eliminado=contadores["contenido_eliminado"],
        doc_limit=cupo["limit"], usados=cupo["usados"], disponibles=cupo["disponibles"],
    )
