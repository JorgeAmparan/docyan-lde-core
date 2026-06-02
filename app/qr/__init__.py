"""Tokens QR persistentes del Master Orchestrator (B4 §6)."""
from app.qr.qr_generator import GeneratedQr, QrGenerator
from app.qr.qr_resolver import QrResolutionError, QrResolver, ResolvedQr
from app.qr.store import (
    InMemoryQrTokenStore,
    QrTokenRecord,
    QrTokenStore,
    SupabaseQrTokenStore,
)

__all__ = [
    "QrGenerator",
    "GeneratedQr",
    "QrResolver",
    "ResolvedQr",
    "QrResolutionError",
    "QrTokenStore",
    "QrTokenRecord",
    "InMemoryQrTokenStore",
    "SupabaseQrTokenStore",
]
