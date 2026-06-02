"""
Modelos de dominio del Master Orchestrator (B4 §1).

DOCYAN LDE™ by XCID.

Tipos compartidos por los sub-componentes del MO: canales, tipos de sesión,
clases de request, y los objetos request/response que atraviesan el orquestador.
Se usan dataclasses (no Pydantic) para mantener el núcleo del MO sin acoplarse a
la capa de API; los routers FastAPI adaptan a/desde estos tipos.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Canal(str, Enum):
    """Canal por el que entra/sale un request (responsabilidad 7: adaptación)."""

    pwa = "pwa"
    whatsapp = "whatsapp"
    api = "api"


class SessionType(str, Enum):
    """Tipo de sesión — determina el TTL (decisión #6, doc 14)."""

    consulta = "consulta"
    troubleshooting = "troubleshooting"
    revision = "revision"
    onboarding = "onboarding"


class RequestKind(str, Enum):
    """Clase de request que el intent_router detecta (responsabilidad 2)."""

    consulta = "consulta"
    ingesta = "ingesta"
    configuracion = "configuracion"
    evento_programado = "evento_programado"
    desconocido = "desconocido"


@dataclass
class RequestContext:
    """
    Contexto resuelto de un request (responsabilidad 1). En DOCYAN
    `tenant_id == org_id` (el JWT lleva `org_id`; FAT y budget usan ese valor).
    """

    tenant_id: str
    user_id: str | None
    role: str | None
    canal: Canal
    par_linguistico: str | None = None
    region: str | None = None
    permisos: list[str] = field(default_factory=list)
    session_id: str | None = None
    email: str | None = None


@dataclass
class MORequest:
    """Request entrante al MO, antes de resolver contexto."""

    # ctx de auth (lo que devuelve verificar_credenciales): org_id, user_id, role…
    auth: dict
    canal: Canal = Canal.api
    texto: str | None = None
    accion: str | None = None
    payload: dict = field(default_factory=dict)
    session_id: str | None = None
    par_linguistico: str | None = None
    region: str | None = None


@dataclass
class MOResponse:
    """Respuesta uniforme del MO, ya adaptada a canal."""

    ok: bool
    kind: RequestKind
    canal: Canal
    data: dict = field(default_factory=dict)
    mensaje: str | None = None
    session_id: str | None = None
    servido: bool = True  # False si Governance Gate frenó el output
    motivo_bloqueo: str | None = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "kind": self.kind.value,
            "canal": self.canal.value,
            "data": self.data,
            "mensaje": self.mensaje,
            "session_id": self.session_id,
            "servido": self.servido,
            "motivo_bloqueo": self.motivo_bloqueo,
        }
