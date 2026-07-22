"""
Sprint ED-0 — Estabilidad del event loop en paths autenticados.

Regresión del incidente de producción: una sola consulta autenticada colgada
tumbó ambas máquinas de Fly porque bloqueó el ÚNICO event loop de uvicorn y con
él `/health` (el probe de Fly no recibió respuesta → reinicio).

Estos tests son la prueba de que no puede repetirse:
  1. `run_blocking` corta a 504 y propaga resultados/errores de dominio tal cual.
  2. Una `/mo/query` artificialmente colgada devuelve 504 al expirar el timeout,
     y **`/health` responde < 1s DURANTE el cuelgue** (petición concurrente).
  3. `DKGClient` construye el cliente FalkorDB con socket timeouts (desde env).

CI es la autoridad (los tests corren sin FalkorDB/Redis reales: usan dobles).
"""
from __future__ import annotations

import time

import httpx
import jwt
import pytest
from fastapi import HTTPException
from httpx import ASGITransport

from app.api.auth import JWT_ALGORITHM, JWT_SECRET


def _token(role: str = "admin") -> str:
    """JWT de tenant válido para pasar `requiere_rol` (auth es CPU puro, no bloquea)."""
    return jwt.encode(
        {"org_id": "test-org", "sub": "u1", "role": role, "email": "a@b.co"},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


# ── 1. El helper canónico (generaliza demo.py:159-166) ────────────────────────


async def test_run_blocking_retorna_resultado():
    from app.api.blocking import run_blocking

    def doblar(x: int) -> int:
        return x * 2

    assert await run_blocking(doblar, 21, endpoint="/x") == 42


async def test_run_blocking_propaga_excepcion_de_dominio():
    """Una excepción NO-timeout de la función se propaga intacta (404/409 siguen igual)."""
    from app.api.blocking import run_blocking

    def explota() -> None:
        raise KeyError("no encontrado")

    with pytest.raises(KeyError):
        await run_blocking(explota, endpoint="/x")


async def test_run_blocking_timeout_devuelve_504():
    from app.api.blocking import run_blocking

    with pytest.raises(HTTPException) as ei:
        await run_blocking(time.sleep, 2, timeout=0.3, endpoint="/lento")

    assert ei.value.status_code == 504
    assert ei.value.detail["error"] == "timeout_consulta"
    assert ei.value.detail["endpoint"] == "/lento"


# ── 2. Regresión del incidente: consulta colgada → 504 + /health vivo ─────────


class _FakeAudit:
    """Audit logger mínimo para el callback de FAT del timeout (no debe fallar)."""

    def event(self, *args, **kwargs) -> None:  # noqa: D401
        return None


class HangingMO:
    """MO cuyo `handle_request` se cuelga más que el timeout (simula LLM/DKG estancado)."""

    def __init__(self, sleep_s: float = 3.0) -> None:
        self._sleep_s = sleep_s
        self.audit_logger = _FakeAudit()

    def handle_request(self, req):  # noqa: ANN001
        time.sleep(self._sleep_s)  # nunca alcanza el timeout de la prueba
        raise AssertionError("handle_request no debía completar en este test")


async def test_consulta_colgada_devuelve_504_y_health_responde(monkeypatch):
    """
    El corazón del sprint: con una consulta colgada, `/mo/query` corta en 504 y
    `/health` sigue respondiendo (< 1s) porque el bloqueo vive en un thread, no
    en el event loop. Antes de ED-0 esto colgaba el loop y `/health` moría.
    """
    import asyncio

    import app.api.blocking as blocking

    # Timeout corto para no alargar el test; el MO se cuelga 3s (> timeout).
    monkeypatch.setattr(blocking, "QUERY_TIMEOUT_SECONDS", 0.5)

    from app.api.main import app
    from app.api.routers import mo as mo_router

    app.dependency_overrides[mo_router.get_mo] = lambda: HangingMO(sleep_s=3.0)
    try:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

            async def consulta_colgada():
                return await client.post(
                    "/mo/query",
                    json={"texto": "¿cuál es el TLV?"},
                    headers={"Authorization": f"Bearer {_token()}"},
                )

            async def health_durante_cuelgue():
                # Deja arrancar la consulta (que ya está bloqueada en el thread).
                await asyncio.sleep(0.1)
                loop = asyncio.get_event_loop()
                t0 = loop.time()
                r = await client.get("/health")
                return r, loop.time() - t0

            resp_q, (resp_h, dt_health) = await asyncio.gather(
                consulta_colgada(), health_durante_cuelgue()
            )
    finally:
        app.dependency_overrides.pop(mo_router.get_mo, None)

    # (a) la consulta colgada cortó en 504 con el cuerpo esperado
    assert resp_q.status_code == 504
    assert resp_q.json()["detail"]["error"] == "timeout_consulta"

    # (b) /health respondió DURANTE el cuelgue, y rápido (loop no bloqueado)
    assert resp_h.status_code == 200
    assert resp_h.json()["status"] == "healthy"
    assert dt_health < 1.0, f"/health tardó {dt_health:.2f}s — el loop quedó bloqueado"


# ── 3. Socket timeouts en el cliente DKG (defensa en profundidad §3.2) ────────


def test_dkg_client_socket_timeouts_por_default():
    from app.graph.dkg_client import (
        FALKORDB_SOCKET_CONNECT_TIMEOUT,
        FALKORDB_SOCKET_TIMEOUT,
        DKGClient,
    )

    c = DKGClient()
    assert c.socket_timeout == FALKORDB_SOCKET_TIMEOUT
    assert c.socket_connect_timeout == FALKORDB_SOCKET_CONNECT_TIMEOUT


def test_dkg_client_socket_timeouts_override():
    from app.graph.dkg_client import DKGClient

    c = DKGClient(socket_timeout=7, socket_connect_timeout=2)
    assert c.socket_timeout == 7
    assert c.socket_connect_timeout == 2


def test_dkg_connect_pasa_socket_timeouts_a_falkordb(monkeypatch):
    """El cliente FalkorDB se construye CON los socket timeouts (no solo el server-side)."""
    import falkordb

    from app.graph.dkg_client import DKGClient

    capturado: dict = {}

    class FakeFalkor:
        def __init__(self, **kwargs):
            capturado.update(kwargs)

    monkeypatch.setattr(falkordb, "FalkorDB", FakeFalkor)

    c = DKGClient(socket_timeout=9, socket_connect_timeout=3)
    c._connect()

    assert capturado["socket_timeout"] == 9
    assert capturado["socket_connect_timeout"] == 3
    assert capturado["host"] == c.host
    assert capturado["port"] == c.port
