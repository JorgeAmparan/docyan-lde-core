"""
Router de recursos de apoyo (B9.5 Tipo 4).

DOCYAN LDE™ by XCID.

Adjuntar un video como recurso de apoyo al documento/entidad (decisión B: el video
NO se analiza ni transcribe; se sirve como apoyo, como el PDF o un diagrama). Crea
el `:RecursoVideo` que el pipeline de lectura del Tipo 4 ya consulta.

Multi-tenant strict: el `tenant_id` sale del usuario logueado (`ctx["org_id"]`).
(Antes vivía bajo /curacion; al retirar el editor de curación manual, se reubica
aquí como endpoint de recursos.)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import requiere_rol
from app.recursos.video import adjuntar_video

router = APIRouter(prefix="/recursos", tags=["recursos"])


def _dkg():
    from app.graph.dkg_client import dkg_client

    return dkg_client


class AdjuntarVideoRequest(BaseModel):
    titulo: str = Field(min_length=1, max_length=300)
    video_url: str = Field(min_length=1)
    doc_id: str | None = None
    entidad_id: str | None = None
    acompana_procedimiento_id: str | None = None
    capitulos: list[dict] = Field(default_factory=list)


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
