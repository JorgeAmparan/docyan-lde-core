"""
Contratos tipados de la mecánica de Playbooks (B8 §B / §A5).

DOCYAN LDE™ by XCID.

Requests/responses Pydantic v2 de los endpoints de Niveles A/B/C. Se exportan a
OpenAPI 3.1; B9 genera los tipos TypeScript. Naming progresivo: los modelos de
Nivel A NO usan la palabra "Playbook"; el flag `termino_playbook_disponible`
indica a la UI cuándo habilitarla.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.pipeline_payloads import ConsultaResuelta

# ── Nivel A — Consultas guardadas ─────────────────────────────────────────────


class GuardarConsultaRequest(BaseModel):
    nombre: str
    consulta_original: str
    tipo_intencion: str
    tipo_documento_origen: str | None = None
    entidad_referenciada_id: str | None = None
    metadata: dict = Field(default_factory=dict)


class RenombrarRequest(BaseModel):
    nombre: str


class ConsultaGuardadaOut(BaseModel):
    id: str
    nombre: str
    consulta_original: str
    tipo_intencion: str
    tipo_documento_origen: str | None = None
    entidad_referenciada_id: str | None = None
    disparos_totales: int = 0
    ultimo_disparo_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ConsultasGuardadasList(BaseModel):
    items: list[ConsultaGuardadaOut] = Field(default_factory=list)
    # Naming progresivo: True cuando el usuario tiene ≥2 consultas relacionadas.
    termino_playbook_disponible: bool = False


class DispararConsultaResponse(BaseModel):
    consulta: ConsultaGuardadaOut
    resultado: ConsultaResuelta
    servido: bool


# ── Nivel B — Playbooks ───────────────────────────────────────────────────────


class PasoPlaybookIn(BaseModel):
    consulta_guardada_id: str
    nota_paso: str | None = None
    orden: int | None = None


class PasoPlaybookOut(BaseModel):
    id: str
    orden: int
    consulta_guardada_id: str
    nota_paso: str | None = None


class CrearPlaybookRequest(BaseModel):
    nombre: str
    descripcion: str | None = None
    pasos: list[PasoPlaybookIn]


class ActualizarPlaybookRequest(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    pasos: list[PasoPlaybookIn] | None = None


class PlaybookOut(BaseModel):
    id: str
    nombre: str
    descripcion: str | None = None
    tipo_creacion: str
    vertical: str | None = None
    disparos_totales: int = 0
    ultimo_disparo_at: str | None = None
    created_at: str | None = None
    pasos: list[PasoPlaybookOut] = Field(default_factory=list)


class PasoVistaUnificada(BaseModel):
    orden: int
    consulta_guardada_id: str | None = None
    nombre: str | None = None
    nota_paso: str | None = None
    tipo_intencion: str | None = None
    entidad_id: str | None = None
    provenance: list[dict] = Field(default_factory=list)
    resultado: ConsultaResuelta | None = None
    error: str | None = None


class DispararPlaybookResponse(BaseModel):
    playbook: PlaybookOut
    vista_unificada: list[PasoVistaUnificada] = Field(default_factory=list)


# ── Nivel C — Sugerencias ─────────────────────────────────────────────────────


class SugerenciaOut(BaseModel):
    id: str
    tipo_sugerencia: str
    consulta_guardada_ids: list[str] = Field(default_factory=list)
    evidencia_estructural: dict = Field(default_factory=dict)
    evidencia_conductual: dict = Field(default_factory=dict)
    estado: str
    created_at: str | None = None
    decidido_at: str | None = None


class AceptarSugerenciaRequest(BaseModel):
    nombre: str | None = None


class AceptarSugerenciaResponse(BaseModel):
    sugerencia_id: str
    playbook: PlaybookOut


class SeedVerticalRequest(BaseModel):
    vertical: str


class SeedVerticalResponse(BaseModel):
    vertical: str
    creados: list[PlaybookOut] = Field(default_factory=list)
    nota: str | None = None
