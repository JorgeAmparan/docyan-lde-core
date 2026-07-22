"""
Sprint ED-0b — Saneo del worker de ingesta.

Cubre los fixes que causaron el bloqueo de la siembra demo-maxi:
  · §3 `temperature` deprecado en claude-opus-4-8 → se omite (acepta_temperature).
  · §2 timeout de red de las llamadas LLM configurable por env + fijado en litellm.
  · §4 concurrencia de ingesta serializada (default 1) configurable por env.
  · §4 tolerancia al cold-start del embedder: reintento espaciado.

Sin graphrag_sdk/litellm reales (worker-only): se prueban las unidades puras y la
configuración por env; `configure_litellm` se verifica con un litellm inyectado.
"""
from __future__ import annotations

import importlib
import sys
import types

import pytest


def _reload(mod_name: str, monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    mod = importlib.import_module(mod_name)
    return importlib.reload(mod)


# ── §3 — temperature deprecado ────────────────────────────────────────────────


def test_acepta_temperature_opus_no_gemini_gpt_si(monkeypatch):
    m = _reload("worker.llm_config", monkeypatch)
    assert m.acepta_temperature("claude-opus-4-8") is False
    assert m.acepta_temperature("gemini/gemini-2.5-flash") is True
    assert m.acepta_temperature("gpt-4o-mini") is True
    # Case-insensitive + tolerante a espacios.
    assert m.acepta_temperature("  Claude-Opus-4-8 ") is False


def test_modelos_sin_temperature_configurable_por_env(monkeypatch):
    m = _reload("worker.llm_config", monkeypatch,
                INGEST_MODELOS_SIN_TEMPERATURE="foo-model, bar-model")
    assert m.acepta_temperature("foo-model") is False
    assert m.acepta_temperature("bar-model") is False
    # claude-opus-4-8 ya NO está en la lista override → vuelve a aceptar.
    assert m.acepta_temperature("claude-opus-4-8") is True


# ── §2 — timeout de LLM desde env + configuración de litellm ──────────────────


def test_llm_timeout_seconds_desde_env(monkeypatch):
    m = _reload("worker.llm_config", monkeypatch, INGEST_LLM_TIMEOUT_SECONDS="123")
    assert m.LLM_TIMEOUT_SECONDS == 123.0


def test_configure_litellm_fija_timeout_drop_params_y_retries(monkeypatch):
    # litellm es worker-only: se inyecta un doble para verificar la config.
    fake = types.ModuleType("litellm")
    fake.num_retries = None
    fake.request_timeout = None
    fake.drop_params = None
    fake.callbacks = []
    monkeypatch.setitem(sys.modules, "litellm", fake)

    m = _reload("worker.llm_config", monkeypatch,
                INGEST_LLM_TIMEOUT_SECONDS="200", INGEST_LLM_NUM_RETRIES="4")
    m._litellm_configured = False
    m.configure_litellm()

    assert fake.request_timeout == 200.0   # §2
    assert fake.drop_params is True         # §3 (defensa en profundidad)
    assert fake.num_retries == 4            # tope de reintentos
    # El medidor de uso quedó registrado como callback.
    assert any(type(c).__name__ == "_UsageLogger" for c in fake.callbacks)


# ── §4 — concurrencia serializada ─────────────────────────────────────────────


def test_concurrencia_default_es_1(monkeypatch):
    monkeypatch.delenv("INGEST_MAX_CONCURRENCY", raising=False)
    wm = _reload("worker.main", monkeypatch)
    assert wm.MAX_CONCURRENCY == 1  # SERIALIZADO por default (embedder 1 máquina)


def test_concurrencia_configurable_por_env(monkeypatch):
    wm = _reload("worker.main", monkeypatch, INGEST_MAX_CONCURRENCY="5")
    assert wm.MAX_CONCURRENCY == 5


def test_concurrencia_minimo_1_aunque_env_sea_0(monkeypatch):
    wm = _reload("worker.main", monkeypatch, INGEST_MAX_CONCURRENCY="0")
    assert wm.MAX_CONCURRENCY == 1  # tope inferior duro


# ── §4 — cold-start del embedder: reintento espaciado ─────────────────────────


def test_embedder_reintenta_y_luego_exito(monkeypatch):
    ea = _reload("app.graph.embedder_adapter", monkeypatch,
                 EMBEDDER_MAX_RETRIES="5", EMBEDDER_RETRY_DELAY_SECONDS="30")
    llamadas = {"n": 0}
    esperas: list[float] = []

    def flaky():
        llamadas["n"] += 1
        if llamadas["n"] < 3:
            raise TimeoutError("cold-start")
        return "embeddings"

    out = ea._with_cold_start_retry(flaky, sleep=esperas.append)
    assert out == "embeddings"
    assert llamadas["n"] == 3
    assert esperas == [30.0, 30.0]  # 2 esperas espaciadas antes del éxito


def test_embedder_agota_reintentos_y_propaga(monkeypatch):
    ea = _reload("app.graph.embedder_adapter", monkeypatch,
                 EMBEDDER_MAX_RETRIES="2", EMBEDDER_RETRY_DELAY_SECONDS="0")

    def siempre_falla():
        raise TimeoutError("embedder caído")

    with pytest.raises(TimeoutError):
        ea._with_cold_start_retry(siempre_falla, sleep=lambda _s: None)
