"""
Providers de dependencias del Master Orchestrator (B4).

DOCYAN LDE™ by XCID.

Construyen las instancias de PRODUCCIÓN (Redis/Supabase) que usan los endpoints y
las tareas programadas. Centralizadas aquí para que los tests las sustituyan con
una sola sobreescritura (monkeypatch) por backend en memoria, sin tocar handlers
ni el cuerpo del scheduler. Mismo patrón que `app/ingesta/providers.py`.
"""
from __future__ import annotations

from app.orchestrator.audit_logger import AuditLogger, FATAuditSink
from app.orchestrator.pipeline_coordinator import PipelineCoordinator
from app.orchestrator.session_manager import SessionManager
from app.qr.qr_generator import QrGenerator
from app.qr.qr_resolver import QrResolver


def get_session_manager() -> SessionManager:
    return SessionManager()


def get_audit_logger() -> AuditLogger:
    # B7: el MO loggea al FAT EXTENDIDO con hash chain SHA-256 (no logging plano).
    # El sink híbrido (Supabase alta frecuencia + FalkorDB gobernanza) es lazy.
    return AuditLogger(sink=FATAuditSink())


def get_pipeline_coordinator() -> PipelineCoordinator:
    return PipelineCoordinator()


def get_qr_generator() -> QrGenerator:
    return QrGenerator()


def get_qr_resolver() -> QrResolver:
    return QrResolver()


def tenants_vivos(supabase: object = None) -> list[str]:
    """
    Enumera los tenants (org_id) VIVOS para la rutina de retención del FAT.

    No existe una tabla `orgs` dedicada en el esquema: el registro canónico de
    organizaciones vive en `users.org_id` (flujo de alta `/auth/register`) y, para
    altas por API-key, en `api_keys.org_id` (is_active). Esta función toma la
    UNIÓN de org_id distintos de ambas, que es el conjunto real de tenants vivos.
    (Decisión documentada: si en un sprint futuro se crea una tabla `orgs`
    normalizada, esta función pasa a leer de ahí sin tocar la rutina de retención.)
    """
    if supabase is None:
        from supabase import create_client

        from app.core.supabase_client import require_supabase_config

        url, key = require_supabase_config("retention", service=True)
        supabase = create_client(url, key)

    orgs: set[str] = set()
    try:
        res = supabase.table("users").select("org_id").execute()  # type: ignore[attr-defined]
        orgs.update(r["org_id"] for r in (res.data or []) if r.get("org_id"))
    except Exception:  # noqa: BLE001
        pass
    try:
        res = (
            supabase.table("api_keys")  # type: ignore[attr-defined]
            .select("org_id")
            .eq("is_active", True)
            .execute()
        )
        orgs.update(r["org_id"] for r in (res.data or []) if r.get("org_id"))
    except Exception:  # noqa: BLE001
        pass
    return sorted(orgs)


def get_retention_plan():
    """
    Plan de retención del FAT (B7): (FATExtendido, BackupSink, tenants).

    Cableado de producción: FAT híbrido (Supabase + FalkorDB), backup VERIFICADO a
    Supabase Storage (bucket `fat-backups`) y la lista de tenants vivos enumerada
    desde el registro real (`tenants_vivos`). La LÓGICA de retención (backup
    verificado ANTES de eliminar) vive en app/audit/retention.py. Los tests
    sustituyen este provider para ejercitar el barrido con backends en memoria.
    """
    from app.audit.fat_extendido import FATExtendido
    from app.audit.retention import SupabaseStorageBackupSink
    from app.audit.stores import HybridFATStore

    fat = FATExtendido(HybridFATStore())
    backup = SupabaseStorageBackupSink()
    tenants = tenants_vivos()
    return fat, backup, tenants


def get_master_orchestrator():
    """Construye el MO con dependencias de producción."""
    from app.orchestrator.master_orchestrator import MasterOrchestrator

    return MasterOrchestrator(
        session_manager=get_session_manager(),
        pipeline_coordinator=get_pipeline_coordinator(),
        audit_logger=get_audit_logger(),
    )


# ── Playbooks (B8) ──────────────────────────────────────────────────────────


def get_playbook_store():
    """Almacén de Playbooks de producción (Supabase, RLS por tenant)."""
    from app.playbooks.models import SupabasePlaybookStore

    return SupabasePlaybookStore()


def get_perfil_provider():
    """Perfil de usuario (banderas de IA proactiva) desde la tabla users."""
    from app.playbooks.perfil import SupabasePerfilProvider

    return SupabasePerfilProvider()


def get_pcl_metrics():
    """
    Instrumentación PCL de producción (B8.5): agregados en `pcl_metrics_daily` y
    lectura de eventos FAT F4 desde el store híbrido. Los tests la sustituyen por
    backends en memoria.
    """
    from app.audit.fat_extendido import FATExtendido
    from app.audit.stores import HybridFATStore
    from app.pcl.pcl_metrics import PCLMetrics, SupabasePCLMetricsStore

    return PCLMetrics(store=SupabasePCLMetricsStore(), fat=FATExtendido(HybridFATStore()))


def get_pcl():
    """
    Fachada PCL de producción (B8.5): caché semántico (Redis + BGE-M3),
    instrumentación (FAT F4 + `pcl_metrics_daily`) y orquestación de Playbooks. Los
    endpoints la inyectan vía Depends; los tests la sustituyen.
    """
    from app.pcl.pcl_cache import PCLCache, SupabaseCacheConfigProvider
    from app.pcl.pcl_facade import PCL

    return PCL(
        cache=PCLCache(config_provider=SupabaseCacheConfigProvider()),
        metrics=get_pcl_metrics(),
        playbook_services=get_playbook_services(),
    )


def get_playbook_services():
    """
    Bundle de servicios de Playbooks (Niveles A/B/C) sobre el almacén de
    producción. Los endpoints lo inyectan vía Depends; los tests lo sustituyen por
    un bundle con `InMemoryPlaybookStore`.
    """
    from app.playbooks.consultas_guardadas import ConsultasGuardadasService
    from app.playbooks.playbooks_core import PlaybooksService
    from app.playbooks.sugerencias import SugerenciasService

    store = get_playbook_store()
    perfil = get_perfil_provider()
    return {
        "store": store,
        "perfil": perfil,
        "consultas": ConsultasGuardadasService(store),
        "playbooks": PlaybooksService(store),
        "sugerencias": SugerenciasService(store, perfil),
    }
