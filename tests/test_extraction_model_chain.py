"""
Cadena canónica de modelos de extracción (decisión Jorge, jun 2026).

DOCYAN LDE™ by XCID.

Verifica la config de 3 capas del worker: primaria Flash → retry de calidad Pro
(0 ontología/timeout) → fallback de proveedor Opus 4.8 (ya NO Sonnet). Y que el
cotizador estima contra la PRIMARIA (Flash), con precios de las capas 2/3 presentes
para cuantificar la discrepancia (que no se traslada al cliente).
"""
from __future__ import annotations

import importlib

import pytest


@pytest.fixture()
def cfg(monkeypatch):
    for k in ("INGEST_EXTRACTION_MODEL", "INGEST_QUALITY_RETRY_MODEL",
              "INGEST_PROVIDER_FALLBACK_MODELS", "INGEST_EXTRACTION_FALLBACK_MODELS"):
        monkeypatch.delenv(k, raising=False)
    import worker.llm_config as c
    return importlib.reload(c)


def test_defaults_canonicos(cfg):
    assert cfg.extraction_model() == "gemini/gemini-2.5-flash"        # capa 1
    assert cfg.quality_retry_model() == "gemini/gemini-2.5-pro"        # capa 2
    assert cfg.provider_fallback_models() == ["claude-opus-4-8"]       # capa 3 (NO Sonnet)


def test_fallback_ya_no_es_sonnet(cfg):
    assert "sonnet" not in " ".join(cfg.provider_fallback_models()).lower()


def test_quality_retry_es_misma_familia_que_primaria(cfg):
    # Determinista Flash→Pro: misma familia (gemini/), no cambio de proveedor.
    assert cfg.quality_retry_model().split("/")[0] == cfg.extraction_model().split("/")[0]


def test_override_por_env(monkeypatch):
    monkeypatch.setenv("INGEST_EXTRACTION_MODEL", "gemini/gemini-2.5-flash")
    monkeypatch.setenv("INGEST_QUALITY_RETRY_MODEL", "")   # desactiva capa 2
    monkeypatch.setenv("INGEST_PROVIDER_FALLBACK_MODELS", "claude-opus-4-8,gpt-4o")
    import worker.llm_config as c
    importlib.reload(c)
    assert c.quality_retry_model() is None
    assert c.provider_fallback_models() == ["claude-opus-4-8", "gpt-4o"]
    importlib.reload(c)  # restaura defaults para otros tests


def test_cotizador_estima_contra_primaria_flash():
    from app.ingesta import pricing_table as pt
    # estimar_costo usa Flash; los precios de las capas 2/3 existen para cuantificar
    # la discrepancia (no para cotizar). model_pricing no debe lanzar para ninguno.
    for m in ("gemini/gemini-2.5-flash", "gemini/gemini-2.5-pro", "claude-opus-4-8"):
        assert pt.model_pricing(m).input_usd_per_1m > 0
    # La capa 3 (Opus) es más cara que la primaria → discrepancia real si opera.
    assert pt.model_pricing("claude-opus-4-8").output_usd_per_1m > \
        pt.model_pricing("gemini/gemini-2.5-flash").output_usd_per_1m
