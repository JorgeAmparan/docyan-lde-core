"""
Schemas Pydantic v2 del Pilar 3 — Solicitudes (ED-2).

DOCYAN LDE™ by XCID.

Contratos de API para el catálogo de tipos, la creación de solicitudes (con
provenance heredado de la consulta), la bandeja (enviadas/recibidas), las
transiciones de ciclo de vida y las propuestas de promoción de etiquetas libres.
Exportados a OpenAPI → tipos TS del frontend (regenerar con `npm run gen-types`).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TipoCampo = Literal["text", "number", "date", "textarea"]
TipoDestinatarioSugerido = Literal["proveedor_externo", "departamento_interno", "colaborador"]
AccionSolicitud = Literal["marcar_leida", "iniciar_proceso", "resolver", "cancelar"]


# ── Catálogo :TipoSolicitud (§2.1) ────────────────────────────────────────────
class CampoTipado(BaseModel):
    clave: str = Field(min_length=1, max_length=60)
    etiqueta: str = Field(min_length=1, max_length=120)
    tipo: TipoCampo = "text"
    requerido: bool = False


class TipoSolicitudCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    campos: list[CampoTipado] = Field(default_factory=list)
    destinatarios_sugeridos: list[TipoDestinatarioSugerido] = Field(default_factory=list)
    activo: bool = True
    #: Al aceptar una propuesta de promoción se pasa la etiqueta como nombre (§2.1.3).


class TipoSolicitudUpdate(BaseModel):
    nombre: str | None = None
    campos: list[CampoTipado] | None = None
    destinatarios_sugeridos: list[TipoDestinatarioSugerido] | None = None
    activo: bool | None = None


class TipoSolicitudOut(BaseModel):
    id: str
    clave: str | None = None
    nombre: str
    campos: list[CampoTipado] = Field(default_factory=list)
    destinatarios_sugeridos: list[str] = Field(default_factory=list)
    es_base: bool = False
    activo: bool = True


# ── Propuestas de promoción (§2.1.3) ──────────────────────────────────────────
class PropuestaPromocion(BaseModel):
    etiqueta_libre: str
    conteo: int


class PropuestasListado(BaseModel):
    propuestas: list[PropuestaPromocion] = Field(default_factory=list)
    umbral: int


# ── Solicitud (§2.2/§2.5) ─────────────────────────────────────────────────────
class DatoOrigen(BaseModel):
    """Provenance heredado de la cita del dato de origen (§2.2)."""

    nodo_id: str | None = None
    documento_id: str | None = None
    documento_nombre: str | None = None
    span_inicio: int | None = None
    span_fin: int | None = None
    fragmento: str | None = None


class SolicitudCreate(BaseModel):
    #: Uno de los dos: tipo del catálogo (tipo_id) o "Otra" (etiqueta_libre).
    tipo_id: str | None = None
    etiqueta_libre: str | None = Field(default=None, max_length=120)
    #: ÚNICO camino de ruteo — id del Directorio del tenant. Jamás un email libre.
    destinatario_id: str = Field(min_length=1)
    mensaje: str | None = Field(default=None, max_length=2000)
    campos_tipados: dict = Field(default_factory=dict)
    dato_origen: DatoOrigen | None = None
    consulta_id: str | None = None
    entidad_id: str | None = None
    codo_id: str | None = None


class SolicitudOut(BaseModel):
    id: str
    tipo_id: str | None = None
    tipo_nombre: str | None = None
    etiqueta_libre: str | None = None
    estado: str = "creado"
    documento_id: str | None = None
    span_inicio: int | None = None
    span_fin: int | None = None
    fragmento: str | None = None
    consulta_id: str | None = None
    solicitante_id: str | None = None
    solicitante_nombre: str | None = None
    solicitante_email: str | None = None
    destinatario_id: str
    mensaje: str | None = None
    campos_tipados: dict = Field(default_factory=dict)
    entidad_id: str | None = None
    codo_id: str | None = None
    fecha_creacion: str | None = None
    fecha_resolucion: str | None = None


class SolicitudListado(BaseModel):
    solicitudes: list[SolicitudOut] = Field(default_factory=list)
    total: int = 0


class TransicionRequest(BaseModel):
    accion: AccionSolicitud


class MapeoRegla(BaseModel):
    tipo_intencion: str
    documento_tipo: str
    tipo_sugerido: str


class MapeoInferencia(BaseModel):
    version: str
    reglas: list[MapeoRegla] = Field(default_factory=list)
