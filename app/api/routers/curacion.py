"""
Router de curación asistida + recursos de apoyo (B9.5 §1.2 / §2.4).

DOCYAN LDE™ by XCID.

Flujo decisión-C: la ingesta produce un BORRADOR (Tipo 3 diagrama / Tipo 5 árbol);
el humano lo corrige vía el editor (UI B9.5 §2.4); al confirmar, el borrador se
materializa en el grafo del tenant y queda vivo para la consulta. La curación
ocurre AL INGERIR, antes de que el documento quede disponible.

Multi-tenant strict: el `tenant_id` sale del usuario logueado (`ctx["org_id"]`);
el store y el grafo se aíslan por tenant. El borrador se elimina al confirmar
(ya vive en el grafo) o al descartar.

Persistencia del borrador: `InMemoryDraftStore` por defecto (singleton de proceso).
En producción se inyecta un store Supabase — se mockea el ALMACÉN, nunca la
decisión de curar (mismo principio que el cotizador, CLAUDE.md §14).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import requiere_rol
from app.curacion.confirm import confirmar_arbol, confirmar_diagrama
from app.curacion.models import DraftArbol, DraftDiagrama
from app.curacion.store import build_draft_store
from app.recursos.video import adjuntar_video

router = APIRouter(prefix="/curacion", tags=["curacion"])

# Store COMPARTIDO con el worker (Supabase en prod; memoria en dev/tests). El
# worker auto-extrae el borrador y lo persiste aquí; este editor lo lee.
_store = build_draft_store()


def _dkg():
    from app.graph.dkg_client import dkg_client

    return dkg_client


class GuardarDiagramaRequest(BaseModel):
    draft: DraftDiagrama
    doc_id: str | None = None
    entidad_id: str | None = None


class GuardarArbolRequest(BaseModel):
    draft: DraftArbol
    doc_id: str | None = None
    entidad_id: str | None = None


class AdjuntarVideoRequest(BaseModel):
    titulo: str = Field(min_length=1, max_length=300)
    video_url: str = Field(min_length=1)
    doc_id: str | None = None
    entidad_id: str | None = None
    acompana_procedimiento_id: str | None = None
    capitulos: list[dict] = Field(default_factory=list)


def _guardar(ctx: dict, payload: BaseModel, doc_id, entidad_id) -> str:
    draft_id = uuid.uuid4().hex
    _store.save(ctx["org_id"], draft_id, {
        "draft_id": draft_id,  # el id viaja en el objeto para que el listado/editor lo use
        "draft": payload.model_dump(),
        "doc_id": doc_id,
        "entidad_id": entidad_id,
    })
    return draft_id


@router.post("/diagrama/draft")
async def guardar_borrador_diagrama(
    req: GuardarDiagramaRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    """Persiste un borrador de diagrama (Tipo 3) para corrección humana."""
    draft_id = _guardar(ctx, req.draft, req.doc_id, req.entidad_id)
    return {"status": "draft_saved", "draft_id": draft_id, "kind": "diagrama"}


@router.post("/arbol/draft")
async def guardar_borrador_arbol(
    req: GuardarArbolRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    """Persiste un borrador de árbol de diagnóstico (Tipo 5); incluye advertencias
    de conectividad para que el editor las muestre."""
    draft_id = _guardar(ctx, req.draft, req.doc_id, req.entidad_id)
    return {
        "status": "draft_saved",
        "draft_id": draft_id,
        "kind": "arbol",
        "advertencias_conectividad": req.draft.validar_conectividad(),
    }


@router.get("")
async def listar_borradores(ctx: dict = Depends(requiere_rol("admin", "editor"))):
    """Lista borradores pendientes de curar del tenant."""
    return {"borradores": _store.list(ctx["org_id"])}


@router.get("/{draft_id}")
async def obtener_borrador(
    draft_id: str, ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    data = _store.get(ctx["org_id"], draft_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Borrador no encontrado.")
    return data


@router.post("/{draft_id}/confirmar")
async def confirmar_borrador(
    draft_id: str, ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    """Materializa el borrador (corregido) en el grafo y lo elimina del store."""
    data = _store.get(ctx["org_id"], draft_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Borrador no encontrado.")
    raw = data["draft"]
    kind = raw.get("kind")
    try:
        if kind == "diagrama":
            rid = confirmar_diagrama(
                _dkg(), ctx["org_id"], DraftDiagrama(**raw),
                doc_id=data.get("doc_id"), entidad_id=data.get("entidad_id"),
            )
        elif kind == "arbol":
            rid = confirmar_arbol(
                _dkg(), ctx["org_id"], DraftArbol(**raw),
                doc_id=data.get("doc_id"), entidad_id=data.get("entidad_id"),
            )
        else:
            raise HTTPException(status_code=400, detail=f"kind de borrador inválido: {kind}")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"No se pudo materializar: {e}")
    _store.delete(ctx["org_id"], draft_id)
    return {"status": "confirmed", "recurso_id": rid, "kind": kind}


@router.delete("/{draft_id}")
async def descartar_borrador(
    draft_id: str, ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    _store.delete(ctx["org_id"], draft_id)
    return {"status": "discarded", "draft_id": draft_id}


@router.post("/video")
async def adjuntar_recurso_video(
    req: AdjuntarVideoRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
):
    """Adjunta un video como recurso de apoyo (Tipo 4; no se analiza ni transcribe)."""
    try:
        rid = adjuntar_video(
            _dkg(), ctx["org_id"],
            titulo=req.titulo, video_url=req.video_url,
            doc_id=req.doc_id, entidad_id=req.entidad_id,
            acompana_procedimiento_id=req.acompana_procedimiento_id,
            capitulos=req.capitulos,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"No se pudo adjuntar el video: {e}")
    return {"status": "attached", "recurso_id": rid, "kind": "video_player"}
