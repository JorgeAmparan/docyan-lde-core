"""
Audit logger del MO (B4 §1 responsabilidad 9 — FAT).

DOCYAN LDE™ by XCID.

Cada request del MO deja AL MENOS una entrada en el FAT (`audit_trail`, módulo
`app/core/matrix.py` ya activo con service_role). El MO NO inventa otra tabla:
reusa el FAT existente. La extensión criptográfica (hash chain SHA-256) llega en
B7; aquí es logging plano al `audit_trail`.

Testabilidad: `AuditSink` Protocol con backend en memoria (tests) y backend
Supabase (producción, vía TraceabilityMatrix). El componente registrado es "MO".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from app.audit.familias import FamiliaFAT

COMPONENT = "MO"


class AuditSink(Protocol):
    def record(
        self,
        tenant_id: str,
        action: str,
        actor: str,
        detail: dict,
        document_id: str | None = None,
        entity_id: str | None = None,
    ) -> str | None: ...


@dataclass
class InMemoryAuditSink:
    """Backend de FAT en memoria para tests. Expone `entries` para aserciones."""

    entries: list[dict] = field(default_factory=list)

    def record(
        self,
        tenant_id: str,
        action: str,
        actor: str,
        detail: dict,
        document_id: str | None = None,
        entity_id: str | None = None,
    ) -> str | None:
        entry = {
            "tenant_id": tenant_id,
            "component": COMPONENT,
            "action": action,
            "actor": actor,
            "detail": detail,
            "document_id": document_id,
            "entity_id": entity_id,
        }
        self.entries.append(entry)
        return f"mem-{len(self.entries)}"


class SupabaseAuditSink:
    """Backend real: escribe al `audit_trail` vía TraceabilityMatrix (FAT)."""

    def __init__(self, matrix: Any = None) -> None:
        self._matrix = matrix

    def _m(self) -> Any:
        if self._matrix is None:
            from app.core.matrix import TraceabilityMatrix

            self._matrix = TraceabilityMatrix()
        return self._matrix

    def record(
        self,
        tenant_id: str,
        action: str,
        actor: str,
        detail: dict,
        document_id: str | None = None,
        entity_id: str | None = None,
    ) -> str | None:
        m = self._m()
        # TraceabilityMatrix scope-a por org_id; en DOCYAN tenant_id == org_id.
        m.org_id = tenant_id
        return m.log(
            component=COMPONENT,
            action=action,
            actor=actor,
            detail=detail,
            document_id=document_id,
            entity_id=entity_id,
        )


def familia_para_accion(action: str) -> "FamiliaFAT":
    """
    Mapea una acción del MO a su familia FAT (doc 08). Las decisiones de
    gobernanza son F7; el ciclo de vida de la consulta/ingesta operativa es F4;
    las sesiones y operaciones internas son F9.
    """
    from app.audit.familias import FamiliaFAT

    if action == "governance_decision":
        return FamiliaFAT.F7_GOBERNANZA
    if action.startswith("sesion"):
        return FamiliaFAT.F9_SISTEMA
    if action.startswith("troubleshoot"):
        return FamiliaFAT.F5_TROUBLESHOOTING
    if action.startswith("alerta"):
        return FamiliaFAT.F6_ALERTAS
    if action.startswith("onboarding"):
        return FamiliaFAT.F8_ONBOARDING
    # request_received / routed / output_served / error / ingesta_* → consulta op.
    return FamiliaFAT.F4_CONSULTA


class FATAuditSink:
    """
    Backend del MO sobre el FAT EXTENDIDO con hash chain SHA-256 (B7).

    Reemplaza al logging plano (`SupabaseAuditSink`) en producción: cada `record`
    crea un `EventoFAT` encadenado por tenant. La familia se deriva de la acción
    (`familia_para_accion`). El store por default es híbrido (Supabase para alta
    frecuencia, FalkorDB para gobernanza) y se construye perezosamente.
    """

    def __init__(self, fat: Any = None, store: Any = None) -> None:
        self._fat = fat
        self._store = store

    def _f(self) -> Any:
        if self._fat is None:
            from app.audit.fat_extendido import FATExtendido

            if self._store is None:
                from app.audit.stores import HybridFATStore

                self._store = HybridFATStore()
            self._fat = FATExtendido(self._store)
        return self._fat

    def record(
        self,
        tenant_id: str,
        action: str,
        actor: str,
        detail: dict,
        document_id: str | None = None,
        entity_id: str | None = None,
    ) -> str | None:
        familia = familia_para_accion(action)
        entidad_tipo = "documento" if document_id else ("entidad" if entity_id else None)
        evento = self._f().registrar(
            tipo_evento=action,
            familia=familia,
            tenant_id=tenant_id,
            actor_tipo="mo",
            actor_id=actor,
            payload=detail or {},
            entidad_afectada_tipo=entidad_tipo,
            entidad_afectada_id=document_id or entity_id,
        )
        return evento.evento_id


class AuditLogger:
    """Fachada de conveniencia sobre un AuditSink para los eventos del MO."""

    def __init__(self, sink: AuditSink | None = None):
        self.sink = sink or SupabaseAuditSink()

    def request_received(self, tenant_id: str, actor: str, detail: dict) -> str | None:
        return self.sink.record(tenant_id, "request_received", actor, detail)

    def routed(self, tenant_id: str, actor: str, detail: dict) -> str | None:
        return self.sink.record(tenant_id, "routed", actor, detail)

    def governance_decision(self, tenant_id: str, actor: str, detail: dict) -> str | None:
        return self.sink.record(tenant_id, "governance_decision", actor, detail)

    def served(self, tenant_id: str, actor: str, detail: dict) -> str | None:
        return self.sink.record(tenant_id, "output_served", actor, detail)

    def error(self, tenant_id: str, actor: str, detail: dict) -> str | None:
        return self.sink.record(tenant_id, "error", actor, detail)

    def event(
        self,
        tenant_id: str,
        action: str,
        actor: str,
        detail: dict,
        document_id: str | None = None,
        entity_id: str | None = None,
    ) -> str | None:
        return self.sink.record(tenant_id, action, actor, detail, document_id, entity_id)
