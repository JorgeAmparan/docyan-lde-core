"""
Context Resolver del MO (B4 §1 responsabilidad 1).

DOCYAN LDE™ by XCID.

Resuelve el contexto de cada request: identidad (del JWT/API key), tenant, par
lingüístico, canal, variante regional, permisos (del modelo de roles doc 09) y
sesión activa o nueva. En DOCYAN `tenant_id == org_id`.
"""
from __future__ import annotations

from app.orchestrator.models import Canal, MORequest, RequestContext

# Modelo de roles (doc 09). Permisos mínimos por rol para el Governance Gate.
# admin: todo. editor: consulta + ingesta + revisión. viewer: solo consulta.
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ["consulta", "ingesta", "configuracion", "revision", "evento_programado"],
    "editor": ["consulta", "ingesta", "revision"],
    "viewer": ["consulta"],
}


class ContextResolver:
    """Construye un RequestContext a partir del auth ctx + canal + sesión."""

    def resolve(self, req: MORequest, session=None) -> RequestContext:
        auth = req.auth or {}
        tenant_id = auth.get("org_id")
        if not tenant_id:
            raise ValueError("El request no trae tenant (org_id) en el contexto de auth.")

        role = auth.get("role")
        permisos = ROLE_PERMISSIONS.get(role or "", [])

        # Par lingüístico: explícito del request > de la sesión > default del tenant.
        par = req.par_linguistico
        if par is None and session is not None:
            par = (session.state or {}).get("par_linguistico")

        # Región: explícita del request > de la sesión > None (se resuelve luego
        # con la jerarquía de localization).
        region = req.region
        if region is None and session is not None:
            region = (session.state or {}).get("region")

        canal = req.canal if isinstance(req.canal, Canal) else Canal(req.canal)

        return RequestContext(
            tenant_id=tenant_id,
            user_id=auth.get("user_id"),
            role=role,
            canal=canal,
            par_linguistico=par,
            region=region,
            permisos=list(permisos),
            session_id=req.session_id,
            email=auth.get("email"),
        )
