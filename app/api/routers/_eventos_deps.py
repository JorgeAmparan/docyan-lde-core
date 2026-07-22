"""
Dependencias inyectables del subsistema de Eventos Dirigidos (ED-1).

DOCYAN LDE™ by XCID.

Construyen las instancias de PRODUCCIÓN (FalkorDB / Supabase / Resend / FAT) que
usan los routers de alertas, destinatarios y notificaciones. Centralizadas aquí
para que los tests las sustituyan con `app.dependency_overrides` por backends en
memoria (mismo patrón que `app/orchestrator/providers.py`).
"""
from __future__ import annotations


def dep_dkg():
    from app.graph.dkg_client import dkg_client

    return dkg_client


def dep_directorio_store():
    from app.eventos_dirigidos.directorio import SupabaseDirectorioStore

    return SupabaseDirectorioStore()


def dep_inapp_store():
    from app.eventos_dirigidos.notificaciones_inapp import SupabaseNotificacionInAppStore

    return SupabaseNotificacionInAppStore()


def dep_fat():
    from app.eventos_dirigidos.fat import get_fat

    return get_fat()


def dep_notificador():
    from app.eventos_dirigidos.notificador import build_notificador
    from app.graph.dkg_client import dkg_client

    return build_notificador(dkg=dkg_client)


# ── ED-2 (Solicitudes) ────────────────────────────────────────────────────────


def dep_tipo_solicitud_store():
    from app.solicitudes.tipos import SupabaseTipoSolicitudStore

    return SupabaseTipoSolicitudStore()


def dep_solicitud_store():
    from app.solicitudes.modelo import SupabaseSolicitudStore

    return SupabaseSolicitudStore()
