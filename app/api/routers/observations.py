"""
Router de observaciones por usuario (B2 §9.2).

DOCYAN LDE™ by XCID.

`POST /entities/{entity_id}/observations` crea un `:Observacion` vinculado a una
entidad operativa. Cubre a un operador anotando algo sobre una entidad. La UI que
lo consume es B9; aquí es persistencia funcional (no stub).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import requiere_rol
from app.api.blocking import run_blocking
from app.eventos import registrar_observacion

router = APIRouter(prefix="/entities", tags=["observations"])


class ObservacionRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=5000)


@router.post("/{entity_id}/observations")
async def crear_observacion(
    entity_id: str,
    request: ObservacionRequest,
    ctx: dict = Depends(requiere_rol("admin", "editor", "viewer")),
):
    """Crea una observación del usuario sobre una entidad (multi-tenant strict)."""
    def _work() -> dict:
        try:
            return registrar_observacion(
                tenant_id=ctx["org_id"],
                entidad_id=entity_id,
                texto=request.texto,
                autor_id=ctx.get("user_id"),
            )
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"No se pudo registrar la observación: {e}"
            )

    obs = await run_blocking(_work, endpoint="/entities/{id}/observations")
    return {"status": "created", "observacion_id": obs.get("id"), "entity_id": entity_id}
