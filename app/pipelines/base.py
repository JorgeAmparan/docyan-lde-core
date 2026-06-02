"""
Tipos compartidos por los pipelines de consulta (B8 §A2).

DOCYAN LDE™ by XCID.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.pipeline_payloads import CruceSugerido


@dataclass
class ContextoPipeline:
    """
    Contexto resuelto que recibe un pipeline para navegar el DKG.

    `entidad_id` es la entidad operativa a la que apunta el QR (si la hay).
    `params` lleva parámetros específicos del tipo (p. ej. `nodo_id` para
    troubleshooting, `ref_izquierda`/`ref_derecha` para comparativa).
    """

    tenant_id: str
    pregunta: str
    entidad_id: str | None = None
    token_qr: str | None = None
    tipo_documento: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    params: dict = field(default_factory=dict)


@dataclass
class ResultadoPipeline:
    """Salida uniforme de un pipeline: payload tipado + cruces estructurales."""

    payload: object  # una de las variantes de PipelinePayload (validada Pydantic)
    cruces: list[CruceSugerido] = field(default_factory=list)
