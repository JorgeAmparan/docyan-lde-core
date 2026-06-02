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


def get_retention_plan():
    """
    Plan de retención del FAT (B7): (FATExtendido, BackupSink, tenants).

    Seam de integración con la infraestructura: en MVP devuelve el FAT híbrido, un
    backup en memoria y una lista de tenants VACÍA (sin barrido hasta cablear el
    registro de tenants + Supabase Storage en su runbook). La LÓGICA de retención
    (backup verificado antes de eliminar) es real y vive en app/audit/retention.py.
    Los tests sustituyen este provider para ejercitar el barrido completo.
    """
    from app.audit.fat_extendido import FATExtendido
    from app.audit.retention import InMemoryBackupSink
    from app.audit.stores import HybridFATStore

    fat = FATExtendido(HybridFATStore())
    backup = InMemoryBackupSink()
    tenants: list[str] = []
    return fat, backup, tenants


def get_master_orchestrator():
    """Construye el MO con dependencias de producción."""
    from app.orchestrator.master_orchestrator import MasterOrchestrator

    return MasterOrchestrator(
        session_manager=get_session_manager(),
        pipeline_coordinator=get_pipeline_coordinator(),
        audit_logger=get_audit_logger(),
    )
