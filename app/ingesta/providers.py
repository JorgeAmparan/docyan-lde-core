"""
Providers de dependencias de ingesta (B2 §8.3).

DOCYAN LDE™ by XCID.

Construyen las instancias de producción (Supabase/Redis) que usan los endpoints.
Centralizadas aquí para que los tests las sustituyan con una sola sobreescritura
(monkeypatch) por backend en memoria, sin tocar los handlers.
"""
from __future__ import annotations

from app.ingesta.budget_manager import BudgetManager
from app.ingesta.cotizador import Cotizador
from app.ingesta.document_store import SupabaseStorageDocumentStore
from app.ingesta.quota_manager import QuotaManager
from app.jobs.dispatcher import JobDispatcher
from app.jobs.job_status import JobStatusReader
from app.schemas_documentales.registry import SchemaRegistry
from app.schemas_documentales.selector import SchemaSelector


def get_budget_manager() -> BudgetManager:
    return BudgetManager()


def get_quota_manager() -> QuotaManager:
    return QuotaManager()


def get_cotizador() -> Cotizador:
    # F3 §C: el cotizador consulta el cupo de ingestas del plan (setup $0 dentro de
    # cupo; fórmula al agotarlo). Sin fila de cupo (freemium) → fórmula como antes.
    return Cotizador(budget_manager=BudgetManager(), quota_manager=QuotaManager())


def get_dispatcher() -> JobDispatcher:
    # F1.5: el dispatcher de producción reserva/liquida/libera saldo en cada
    # transición del gate, por eso siempre lleva un BudgetManager real.
    # F3 §C: además descuenta cupo al confirmar una ingesta cotizada dentro de cupo.
    return JobDispatcher(budget_manager=BudgetManager(), quota_manager=QuotaManager())


def get_status_reader() -> JobStatusReader:
    return JobStatusReader()


def get_selector() -> SchemaSelector:
    return SchemaSelector(registry=SchemaRegistry())


def get_document_store() -> SupabaseStorageDocumentStore:
    return SupabaseStorageDocumentStore()
