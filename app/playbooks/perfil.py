"""
Perfil de usuario para la IA proactiva (B8 §B3).

DOCYAN LDE™ by XCID.

Provee las dos banderas del usuario que gobiernan el Nivel C:
  - `permiso_ia_proactiva` (señal de permiso de la compuerta de tres señales).
  - `silenciar_sugerencias` (el experto es el techo de autoridad).

Los toggles los expone el onboarding (B13) en la UI; B8 los MODELA en la tabla
`users` (migración 014) y los LEE. Backend en memoria (tests) + Supabase (prod).
"""
from __future__ import annotations

from typing import Any, Protocol


class PerfilProvider(Protocol):
    def permiso_ia_proactiva(self, tenant_id: str, user_id: str) -> bool: ...
    def silenciar_sugerencias(self, tenant_id: str, user_id: str) -> bool: ...


class InMemoryPerfilProvider:
    """Perfiles en memoria (tests). `set_perfil` configura las banderas."""

    def __init__(self) -> None:
        self._perfiles: dict[tuple[str, str], dict] = {}

    def set_perfil(
        self,
        tenant_id: str,
        user_id: str,
        permiso_ia_proactiva: bool = False,
        silenciar_sugerencias: bool = False,
    ) -> None:
        self._perfiles[(tenant_id, user_id)] = {
            "permiso_ia_proactiva": permiso_ia_proactiva,
            "silenciar_sugerencias": silenciar_sugerencias,
        }

    def permiso_ia_proactiva(self, tenant_id: str, user_id: str) -> bool:
        return self._perfiles.get((tenant_id, user_id), {}).get("permiso_ia_proactiva", False)

    def silenciar_sugerencias(self, tenant_id: str, user_id: str) -> bool:
        return self._perfiles.get((tenant_id, user_id), {}).get("silenciar_sugerencias", False)


class SupabasePerfilProvider:
    """Lee las banderas de la tabla `users` (migración 014). Construcción perezosa."""

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("perfil", service=True)
            self._client = create_client(url, key)
        return self._client

    def _flag(self, tenant_id: str, user_id: str, col: str) -> bool:
        res = (self._sb().table("users").select(col)
               .eq("id", user_id).eq("org_id", tenant_id).limit(1).execute())
        return bool(res.data and res.data[0].get(col))

    def permiso_ia_proactiva(self, tenant_id: str, user_id: str) -> bool:
        return self._flag(tenant_id, user_id, "permiso_ia_proactiva")

    def silenciar_sugerencias(self, tenant_id: str, user_id: str) -> bool:
        return self._flag(tenant_id, user_id, "silenciar_sugerencias")
