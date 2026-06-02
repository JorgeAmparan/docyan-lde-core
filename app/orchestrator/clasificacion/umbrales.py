"""
Umbrales de confianza del clasificador por tenant (B8 §A1).

DOCYAN LDE™ by XCID.

El clasificador híbrido usa la heurística cuando su confianza ≥ umbral del tenant;
por debajo, escala al LLM. El default es 0.80 (contrato B8). Configurable por
tenant vía `configuracion_grg`/onboarding en bloques posteriores; aquí se deja el
seam (`UmbralStore`) con un backend en memoria para tests y el default global.
"""
from __future__ import annotations

import os
from typing import Protocol

DEFAULT_UMBRAL_CLASIFICADOR = float(os.getenv("CLASIF_UMBRAL_CONFIANZA", "0.80"))


class UmbralStore(Protocol):
    def umbral_para(self, tenant_id: str) -> float: ...


class DefaultUmbralStore:
    """Umbral global por default (mismo valor para todo tenant)."""

    def __init__(self, default: float = DEFAULT_UMBRAL_CLASIFICADOR) -> None:
        self.default = default

    def umbral_para(self, tenant_id: str) -> float:
        return self.default


class InMemoryUmbralStore:
    """Umbrales por tenant en memoria (tests / overrides explícitos)."""

    def __init__(self, default: float = DEFAULT_UMBRAL_CLASIFICADOR) -> None:
        self.default = default
        self._por_tenant: dict[str, float] = {}

    def set_umbral(self, tenant_id: str, umbral: float) -> None:
        self._por_tenant[tenant_id] = umbral

    def umbral_para(self, tenant_id: str) -> float:
        return self._por_tenant.get(tenant_id, self.default)
