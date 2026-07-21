"""
Schemas Pydantic v2 del subsistema de Eventos Dirigidos (ED-1).

DOCYAN LDE™ by XCID.

Contratos de API para Directorio de Destinatarios, ReglaAlerta, acciones sobre
alertas, alertas manuales y notificaciones in-app. Exportados a OpenAPI → tipos TS
del frontend (regenerar con `npm run gen-types`).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TipoDestinatario = Literal["proveedor_externo", "departamento_interno", "colaborador"]
Canal = Literal["email", "in_app"]
NombreAccion = Literal[
    "reconocer", "iniciar_proceso", "escalar", "postponer", "suprimir", "resolver", "comentar"
]


# ── Directorio de Destinatarios (§2.5) ────────────────────────────────────────
class DestinatarioCreate(BaseModel):
    tipo: TipoDestinatario
    nombre: str = Field(min_length=1, max_length=200)
    email: str | None = None
    empresa: str | None = None
    usuario_id: str | None = None
    miembros: list[str] = Field(default_factory=list)
    categorias: list[str] = Field(default_factory=list)
    activo: bool = True


class DestinatarioUpdate(BaseModel):
    nombre: str | None = None
    email: str | None = None
    empresa: str | None = None
    usuario_id: str | None = None
    miembros: list[str] | None = None
    categorias: list[str] | None = None
    activo: bool | None = None


class DestinatarioOut(BaseModel):
    id: str
    tipo: TipoDestinatario
    nombre: str
    email: str | None = None
    empresa: str | None = None
    usuario_id: str | None = None
    miembros: list[str] = Field(default_factory=list)
    categorias: list[str] = Field(default_factory=list)
    activo: bool = True


# ── ReglaAlerta (§2.3.1) ──────────────────────────────────────────────────────
class ReglaAlertaUpdate(BaseModel):
    tipo: str = "*"
    thresholds: list[int] = Field(default_factory=lambda: [30, 15, 7])
    urgencias: dict[str, str] | None = None
    destinatarios: list[str] = Field(default_factory=list)
    canales: list[Canal] = Field(default_factory=lambda: ["in_app"])
    escalacion_dias: int | None = 7
    escalacion_destinatario_id: str | None = None
    activo: bool = True


class ReglaAlertaOut(BaseModel):
    tipo: str
    thresholds: list[int]
    urgencias: dict[str, str]
    destinatarios: list[str]
    canales: list[str]
    escalacion_dias: int | None = None
    escalacion_destinatario_id: str | None = None
    activo: bool = True


# ── Alertas: acciones, manual, listado admin (§2.3.2/§2.3.3/§2.3.5) ────────────
class AccionRequest(BaseModel):
    accion: NombreAccion
    justificacion: str | None = None
    comentario: str | None = None


class AlertaManualCreate(BaseModel):
    descripcion: str = Field(min_length=1, max_length=1000)
    fecha_vencimiento: str | None = None
    entidad_id: str | None = None
    documento_id: str | None = None
    #: Override de destinatarios; si es None se usan los de la ReglaAlerta del tenant.
    destinatarios: list[str] | None = None


class AccionRegistro(BaseModel):
    id: str | None = None
    accion: str
    actor_id: str | None = None
    timestamp: str | None = None
    estado_anterior: str | None = None
    estado_nuevo: str | None = None
    justificacion: str | None = None
    comentario: str | None = None


class AlertaAdmin(BaseModel):
    alerta_id: str | None = None
    descripcion: str
    fecha_vencimiento: str | None = None
    urgencia: str = "media"
    entidad_id: str | None = None
    estado: str = "creado"
    origen: str | None = None
    tipo: str | None = None
    administrativa: bool = True
    thresholds_notificados: list[int] = Field(default_factory=list)
    notificado_ts: str | None = None
    acciones: list[AccionRegistro] = Field(default_factory=list)


class AlertaListado(BaseModel):
    alertas: list[AlertaAdmin] = Field(default_factory=list)
    total: int = 0


class AccionResultado(BaseModel):
    alerta_id: str
    accion: str
    estado_anterior: str
    estado: str
    accion_id: str
    timestamp: str


# ── Notificaciones in-app (§2.4.2) ────────────────────────────────────────────
class NotificacionOut(BaseModel):
    id: str
    tipo_evento: str
    evento_ref: str | None = None
    canal: str = "in_app"
    titulo: str
    cuerpo: str
    leida: bool = False
    estado: str = "enviada"
    error: str | None = None
    created_at: str | None = None
    leida_at: str | None = None


class NotificacionesListado(BaseModel):
    notificaciones: list[NotificacionOut] = Field(default_factory=list)
    no_leidas: int = 0
