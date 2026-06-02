"""
Providers de dependencias del Master Orchestrator (B4).

DOCYAN LDE™ by XCID.

Construyen las instancias de PRODUCCIÓN (Redis/Supabase) que usan los endpoints y
las tareas programadas. Centralizadas aquí para que los tests las sustituyan con
una sola sobreescritura (monkeypatch) por backend en memoria, sin tocar handlers
ni el cuerpo del scheduler. Mismo patrón que `app/ingesta/providers.py`.
"""
from __future__ import annotations

from app.orchestrator.audit_logger import AuditLogger
from app.orchestrator.pipeline_coordinator import PipelineCoordinator
from app.orchestrator.session_manager import SessionManager
from app.qr.qr_generator import QrGenerator
from app.qr.qr_resolver import QrResolver


def get_session_manager() -> SessionManager:
    return SessionManager()


def get_audit_logger() -> AuditLogger:
    return AuditLogger()


def get_pipeline_coordinator() -> PipelineCoordinator:
    return PipelineCoordinator()


def get_qr_generator() -> QrGenerator:
    return QrGenerator()


def get_qr_resolver() -> QrResolver:
    return QrResolver()


def get_master_orchestrator():
    """Construye el MO con dependencias de producción."""
    from app.orchestrator.master_orchestrator import MasterOrchestrator

    return MasterOrchestrator(
        session_manager=get_session_manager(),
        pipeline_coordinator=get_pipeline_coordinator(),
        audit_logger=get_audit_logger(),
    )
