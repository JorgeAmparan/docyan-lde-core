"""
:ConfiguracionGRG por tenant (B7 — componente B del contrato).

DOCYAN LDE™ by XCID — doc 07.

Configura por tenant:
  - Tier del cliente (base / profesional / enterprise).
  - Umbrales F2 ajustables (override de los defaults del catálogo, doc 07).

Cache: 15 min para la CONFIGURACIÓN del tenant; SIN cache para la evaluación de
segmentos individuales (los evaluadores de `grg_extendido` son puros y no cachean).

Store inyectable: `InMemoryConfiguracionStore` (tests) y `SupabaseConfiguracionStore`
(producción, tabla `configuracion_grg` de la migración 013). Patrón idéntico al
AuditSink del MO.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.governance.familias_grg import UMBRALES_CRITICIDAD, Criticidad, Tier

#: TTL del cache de configuración por tenant (15 min, contrato B7 componente B).
CONFIG_CACHE_TTL_SEG = 15 * 60


@dataclass
class ConfiguracionGRG:
    """Configuración GRG de un tenant."""

    tenant_id: str
    tier: Tier = Tier.BASE
    # Override de umbrales F2 por criticidad. Vacío = defaults del catálogo.
    umbrales_f2: dict[Criticidad, float] = field(default_factory=dict)

    def umbrales_efectivos(self) -> dict[Criticidad, float]:
        return {**UMBRALES_CRITICIDAD, **self.umbrales_f2}


class ConfiguracionStore(Protocol):
    def get(self, tenant_id: str) -> ConfiguracionGRG | None: ...

    def upsert(self, config: ConfiguracionGRG) -> None: ...


@dataclass
class InMemoryConfiguracionStore:
    """Store en memoria para tests."""

    _data: dict[str, ConfiguracionGRG] = field(default_factory=dict)

    def get(self, tenant_id: str) -> ConfiguracionGRG | None:
        return self._data.get(tenant_id)

    def upsert(self, config: ConfiguracionGRG) -> None:
        self._data[config.tenant_id] = config


class SupabaseConfiguracionStore:
    """Store real sobre `configuracion_grg` (Supabase). Cliente inyectable."""

    _TABLE = "configuracion_grg"

    def __init__(self, supabase: Any = None) -> None:
        self._supabase = supabase

    def _client(self) -> Any:
        if self._supabase is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("ConfiguracionGRG", service=True)
            self._supabase = create_client(url, key)
        return self._supabase

    def get(self, tenant_id: str) -> ConfiguracionGRG | None:
        res = (
            self._client()
            .table(self._TABLE)
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        return _config_from_row(rows[0])

    def upsert(self, config: ConfiguracionGRG) -> None:
        self._client().table(self._TABLE).upsert(
            {
                "tenant_id": config.tenant_id,
                "tier": config.tier.value,
                "umbrales_f2": {c.value: v for c, v in config.umbrales_f2.items()},
            },
            on_conflict="tenant_id",
        ).execute()


def _config_from_row(row: dict[str, Any]) -> ConfiguracionGRG:
    umbrales_raw = row.get("umbrales_f2") or {}
    umbrales = {Criticidad(k): float(v) for k, v in umbrales_raw.items()}
    return ConfiguracionGRG(
        tenant_id=row["tenant_id"],
        tier=Tier(row.get("tier") or "base"),
        umbrales_f2=umbrales,
    )


class ConfiguracionGRGService:
    """
    Lee configuración por tenant con cache TTL de 15 min. La evaluación de
    segmentos NO se cachea (se construye un GRGExtendido con la config fresca por
    request); aquí solo se cachea el LOOKUP de configuración.
    """

    def __init__(self, store: ConfiguracionStore | None = None) -> None:
        self.store: ConfiguracionStore = store or InMemoryConfiguracionStore()
        self._cache: dict[str, tuple[float, ConfiguracionGRG]] = {}

    def get_config(self, tenant_id: str) -> ConfiguracionGRG:
        ahora = time.time()
        hit = self._cache.get(tenant_id)
        if hit is not None and (ahora - hit[0]) < CONFIG_CACHE_TTL_SEG:
            return hit[1]
        config = self.store.get(tenant_id) or ConfiguracionGRG(tenant_id=tenant_id)
        self._cache[tenant_id] = (ahora, config)
        return config

    def invalidar(self, tenant_id: str) -> None:
        self._cache.pop(tenant_id, None)

    def set_config(self, config: ConfiguracionGRG) -> None:
        self.store.upsert(config)
        self.invalidar(config.tenant_id)

    def build_grg(self, tenant_id: str) -> Any:
        """Construye un GRGExtendido con la config (tier + umbrales) del tenant."""
        from app.governance.grg_extendido import GRGExtendido

        config = self.get_config(tenant_id)
        return GRGExtendido(
            umbrales=config.umbrales_efectivos(),
            tier=config.tier,
        )
