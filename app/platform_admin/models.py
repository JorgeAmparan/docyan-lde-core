"""
Modelos Pydantic v2 del Super-Admin de Plataforma (F2).

Solo metadata: ningún modelo de respuesta lleva contenido de documentos, texto de
consultas ni contenido de grafos (restricción dura del Sprint F2).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── Auth de plataforma ────────────────────────────────────────────────────────


class PlatformLoginRequest(BaseModel):
    email: str
    password: str


class PlatformTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: dict


# ── (A) Métricas / observabilidad ─────────────────────────────────────────────


class OrgSummary(BaseModel):
    """Fila de la lista de orgs — SOLO metadata."""

    org_id: str
    display_name: str | None = None
    plan: str = "piloto"
    lifecycle_status: str = "active"
    created_at: datetime | None = None
    users: int = 0


class OrgList(BaseModel):
    items: list[OrgSummary]
    total: int


class GraphMetrics(BaseModel):
    """Tamaño del grafo como CONTEO (metadata), nunca su contenido."""

    nodes: int | None = None
    relationships: int | None = None
    reachable: bool = True


class BudgetMetrics(BaseModel):
    saldo_actual_usd: float | None = None
    retenido_usd: float | None = None  # comprometido por reservas vivas (F1.5)
    hard_cap_por_documento: float | None = None
    hard_cap_por_sesion: float | None = None
    moneda: str = "USD"


class OrgMetrics(BaseModel):
    """Métricas por org — SOLO metadata agregada (sin contenido)."""

    org_id: str
    users: int = 0
    documentos_ingeridos: int = 0
    almacenamiento_bytes: int | None = None  # null = no instrumentado (ver reporte)
    ingesta_tiempo_total_seg: float | None = None
    ingesta_tiempo_promedio_seg: float | None = None
    consultas_total: int = 0
    grafo: GraphMetrics = Field(default_factory=GraphMetrics)
    presupuesto: BudgetMetrics = Field(default_factory=BudgetMetrics)


class JobSummary(BaseModel):
    """Estado operativo de un job cross-org — metadata, sin contenido del documento."""

    job_id: str
    org_id: str
    status: str
    phase: str | None = None
    pct: float = 0.0
    nombre_archivo: str | None = None
    tiempo_estimado_seg: float | None = None


class JobList(BaseModel):
    items: list[JobSummary]
    total: int


class PlatformSummary(BaseModel):
    total_orgs: int
    total_usuarios: int
    almacenamiento_total_bytes: int | None = None
    jobs_activos: int
    ingresos_periodo: float
    ingresos_moneda: str = "MXN"


# ── (B) Códigos de acceso ─────────────────────────────────────────────────────


class CreateAccessCodeRequest(BaseModel):
    tipo: str = "piloto"  # prueba | piloto
    cuota_documentos: int = 0
    cuota_saldo_usd: float = 0.0
    dias_vigencia: int = 30


class AccessCodeOut(BaseModel):
    id: str
    code: str
    tipo: str
    cuota_documentos: int
    cuota_saldo_usd: float
    expires_at: datetime | None = None
    status: str
    org_generada: str | None = None
    created_at: datetime | None = None
    redeemed_at: datetime | None = None


class AccessCodeList(BaseModel):
    items: list[AccessCodeOut]
    total: int


class RedeemAccessCodeRequest(BaseModel):
    """Canje (lado tenant): provisiona una org nueva. Alta controlada, NO cross-tenant."""

    email: str
    password: str
    name: str
    org_name: str


class RedeemAccessCodeResponse(BaseModel):
    org_id: str
    user_id: str
    plan: str
    cuota_documentos: int
    cuota_saldo_usd: float
    expires_at: datetime | None = None


# ── (C) Pagos manuales ────────────────────────────────────────────────────────


class CreatePaymentRequest(BaseModel):
    org_id: str
    monto: float
    moneda: str = "MXN"  # MXN | USD
    concepto: str = "suscripcion"  # suscripcion | setup | recarga
    nota: str | None = None


class PaymentOut(BaseModel):
    id: str
    org_id: str
    monto: float
    moneda: str
    concepto: str
    fecha: datetime | None = None
    nota: str | None = None
    registrado_por: str | None = None


class PaymentList(BaseModel):
    items: list[PaymentOut]
    total: int


class BillingStatus(BaseModel):
    org_id: str
    plan: str = "piloto"
    lifecycle_status: str = "active"
    next_billing_date: datetime | None = None
    pagos_registrados: int = 0
    total_pagado: float = 0.0
    moneda: str = "MXN"


# ── (D) Soporte ───────────────────────────────────────────────────────────────


class OpenThreadRequest(BaseModel):
    pantalla_origen: str | None = None
    mensaje: str


class AddMessageRequest(BaseModel):
    cuerpo: str


class ReplyThreadRequest(BaseModel):
    cuerpo: str
    cerrar: bool = False


class SupportMessageOut(BaseModel):
    id: str
    thread_id: str
    autor_tipo: str
    autor_id: str | None = None
    cuerpo: str
    created_at: datetime | None = None


class SupportThreadOut(BaseModel):
    id: str
    org_id: str
    user_id: str | None = None
    pantalla_origen: str | None = None
    estado: str
    auto_respondible: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
    mensajes: list[SupportMessageOut] = Field(default_factory=list)


class SupportThreadList(BaseModel):
    items: list[SupportThreadOut]
    total: int
