"""
Auditoría FAT de las acciones de `platform_admin` (F2).

Toda acción mutante de plataforma (generar/revocar código, registrar pago,
responder soporte, provisionar org, login) se registra en el FAT con
componente "PLATFORM". Testable: `InMemoryPlatformAudit` (lista) en tests,
`SupabasePlatformAudit` (TraceabilityMatrix → audit_trail) en producción.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

COMPONENT = "PLATFORM"
# org_id usado para acciones globales de plataforma (no atadas a una org concreta).
PLATFORM_SCOPE_ORG = "platform"


class PlatformAudit(Protocol):
    def record(self, action: str, actor: str, detail: dict, org_id: str | None = None) -> str | None: ...


@dataclass
class InMemoryPlatformAudit:
    entries: list[dict] = field(default_factory=list)

    def record(self, action: str, actor: str, detail: dict, org_id: str | None = None) -> str | None:
        entry = {
            "component": COMPONENT,
            "action": action,
            "actor": actor,
            "org_id": org_id or PLATFORM_SCOPE_ORG,
            "detail": detail,
        }
        self.entries.append(entry)
        return f"mem-{len(self.entries)}"


class SupabasePlatformAudit:
    """Escribe al FAT (`audit_trail`) vía TraceabilityMatrix, componente PLATFORM."""

    def __init__(self, matrix: Any = None) -> None:
        self._matrix = matrix

    def _m(self) -> Any:
        if self._matrix is None:
            from app.core.matrix import TraceabilityMatrix

            self._matrix = TraceabilityMatrix()
        return self._matrix

    def record(self, action: str, actor: str, detail: dict, org_id: str | None = None) -> str | None:
        m = self._m()
        m.org_id = org_id or PLATFORM_SCOPE_ORG
        return m.log(component=COMPONENT, action=action, actor=actor, detail=detail)
