"""Modelos Pydantic v2 del onboarding + ciclo de uso (B13)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

# ── Fase 1 — Registro (credenciales mínimas) ──────────────────────────────────


class SignupRequest(BaseModel):
    """
    Registro autoservicio. Credenciales mínimas — NADA de plan/fiscal/pago en la
    puerta (modelo nuevo B13). `codigo_acceso` opcional: si viene, canjea un código
    de piloto y la cuenta entra con plan piloto activo en vez de freemium.
    Banda de mercado e idioma se HEREDAN (default A / es; geolocalización vive en la
    capa pública, sprint posterior).
    """

    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    org_name: str | None = None
    banda_mercado: str | None = None
    idioma: str | None = None
    codigo_acceso: str | None = None


class TokenBundle(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int = 0


class SignupResponse(BaseModel):
    org_id: str
    user_id: str
    email: str
    role: str
    plan: str
    doc_limit: int | None = None
    freemium_expira: datetime | None = None
    fase2_completada: bool = False
    tokens: TokenBundle


# ── Fase 2 — Activación de plan + criticidad (decisión #15) ───────────────────


class ActivarPlanRequest(BaseModel):
    plan: str  # tier elegido (freemium→pagado, o ajuste de piloto)
    # Criticidad del segmento (decisión #15): los 5 niveles canónicos del modelo
    # comercial fijan el umbral de confianza. alta/media/baja se aceptan por compat.
    criticidad_segmento: str = Field(
        pattern="^(seguridad|regulatorio|calidad|operacional|informativa|alta|media|baja)$"
    )
    doc_limit: int | None = None  # límite del plan; None = ilimitado
    banda_mercado: str | None = None
    idioma: str | None = None


class OrgOut(BaseModel):
    org_id: str
    nombre: str | None = None
    banda_mercado: str = "A"
    idioma: str = "es"
    plan: str = "freemium"
    lifecycle_status: str = "active"
    doc_limit: int | None = None
    criticidad_segmento: str | None = None
    fase2_completada: bool = False
    freemium_inicio: datetime | None = None
    freemium_expira: datetime | None = None


# ── Invitaciones ──────────────────────────────────────────────────────────────


class CreateInvitationRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="viewer", pattern="^(admin|editor|viewer)$")


class InvitationOut(BaseModel):
    id: str
    org_id: str
    email: str
    role: str
    status: str
    expires_at: datetime | None = None
    created_at: datetime | None = None
    accepted_at: datetime | None = None
    # Solo presente en la respuesta de CREACIÓN (para reenvío manual si el correo
    # no salió). Nunca se persiste el token crudo ni se relista.
    invite_url: str | None = None
    email_enviado: bool | None = None


class InvitationList(BaseModel):
    items: list[InvitationOut]
    total: int


class AcceptInvitationRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)
    name: str | None = None


class AcceptInvitationResponse(BaseModel):
    org_id: str
    user_id: str
    email: str
    role: str
    tokens: TokenBundle


class UsuarioOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    role: str
    is_active: bool = True
    created_at: datetime | None = None


class UsuariosList(BaseModel):
    items: list[UsuarioOut]
    total: int


# ── Gestión de documentos vivos ───────────────────────────────────────────────


class DocumentoOut(BaseModel):
    id: str
    nombre_archivo: str | None = None
    tipo_documento: str | None = None
    version: str | None = None
    hash_contenido: str | None = None
    idioma_origen: str | None = None
    contenido_directo: int = 0


class DocumentosResponse(BaseModel):
    items: list[DocumentoOut]
    total: int
    doc_limit: int | None = None
    usados: int = 0
    disponibles: int | None = None


class DeleteDocumentoResponse(BaseModel):
    status: str = "deleted"
    doc_id: str
    contenido_eliminado: int = 0
    doc_limit: int | None = None
    usados: int = 0
    disponibles: int | None = None
