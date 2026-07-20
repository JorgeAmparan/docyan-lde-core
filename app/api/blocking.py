"""
Guardia del event loop para paths autenticados (Sprint ED-0).

DOCYAN LDE™ by XCID.

Generaliza el patrón canónico de `app/api/routers/demo.py:159-166`
(`asyncio.wait_for(asyncio.to_thread(fn, ...), timeout)`) a TODOS los endpoints
`async def` que invocan código SÍNCRONO de pipeline (MO, RI, grafo, ingesta).

Causa raíz del incidente (post-mortem 2026-07): un handler `async def` que llama
directo a una función `def` bloqueante (una consulta al LLM/embedder/FalkorDB que
se estanca) congela el ÚNICO event loop de uvicorn. Con el loop congelado, hasta
`/health` (trivial, sin DB) deja de responder y el probe de Fly reinicia la
máquina. Descargar la llamada a un thread mantiene el loop libre para `/health`;
el `wait_for` le pone un corte duro y responde 504 en vez de colgar la petición.

Importante sobre la cancelación: `wait_for` cancela la *espera*, no el thread —
Python no interrumpe threads. El thread huérfano sigue vivo hasta que termina o
hasta que su socket expira (de ahí que ED-0 §3.2 exija socket timeouts en TODO
cliente de red). Las escrituras del pipeline son discretas e idempotentes
(append al FAT, `setex` de sesión en Redis), así que un thread que termina
después del 504 deja estado consistente, no una transacción a medias.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Callable

from fastapi import HTTPException

logger = logging.getLogger("docyan.api.blocking")

# Default para paths AUTENTICADOS. El demo conserva su 9s propio
# (`DEMO_QUERY_TIMEOUT_S`); las consultas autenticadas pueden ser más complejas,
# de ahí un techo mayor. Configurable por entorno (ver `.env.example`).
QUERY_TIMEOUT_SECONDS = float(os.getenv("QUERY_TIMEOUT_SECONDS", "30"))

# Techo del intento best-effort de registrar el timeout en el FAT. Corto: el
# registro nunca debe volver a poner en riesgo el loop ni retrasar el 504.
_FAT_LOG_TIMEOUT_S = 5.0


def _fire_fat_timeout(audit: Callable[[], Any], endpoint: str) -> None:
    """
    Registra el timeout en el FAT de forma DESACOPLADA (fire-and-forget): corre en
    un thread con su propio corte duro para no re-bloquear el loop ni demorar el
    504. Best-effort: si el propio FAT está estancado, se loguea y se sigue.
    """

    async def _run() -> None:
        try:
            await asyncio.wait_for(asyncio.to_thread(audit), timeout=_FAT_LOG_TIMEOUT_S)
        except Exception as exc:  # noqa: BLE001 — el registro no puede tumbar nada.
            logger.warning(
                "FAT timeout-log no registrado en %s: %s", endpoint, type(exc).__name__
            )

    try:
        asyncio.create_task(_run())
    except RuntimeError:
        # Sin loop corriendo (no debería ocurrir dentro de un handler async).
        logger.warning("FAT timeout-log omitido en %s (sin event loop)", endpoint)


async def run_blocking(
    fn: Callable[..., Any],
    *args: Any,
    timeout: float | None = None,
    endpoint: str = "",
    audit: Callable[[], Any] | None = None,
    **kwargs: Any,
) -> Any:
    """
    Ejecuta una función SÍNCRONA bloqueante fuera del event loop, con corte duro.

    Patrón canónico ED-0 (generaliza `demo.py:159-166`):
        return await run_blocking(mo.handle_request, req, endpoint="/mo/query")

    Args:
        fn:        función síncrona a ejecutar (p. ej. `mo.handle_request`).
        *args:     posicionales de `fn`.
        timeout:   segundos; default `QUERY_TIMEOUT_SECONDS`.
        endpoint:  etiqueta para logs/FAT (p. ej. "/mo/query").
        audit:     callable sin args que registra el timeout en el FAT. Se dispara
                   desacoplado (nunca bloquea la respuesta). Opcional.
        **kwargs:  keyword args de `fn`.

    Returns:
        Lo que devuelva `fn`.

    Raises:
        HTTPException 504 con cuerpo JSON `{"error": "timeout_consulta", ...}` si
        `fn` no termina dentro del timeout. Cualquier otra excepción de `fn` se
        propaga tal cual (el manejo de errores de dominio no cambia).
    """
    t = timeout if timeout is not None else QUERY_TIMEOUT_SECONDS
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args, **kwargs), timeout=t)
    except asyncio.TimeoutError:
        logger.error(
            "event_loop_guard: timeout %.1fs en %s — respondiendo 504", t, endpoint or "?"
        )
        if audit is not None:
            _fire_fat_timeout(audit, endpoint)
        raise HTTPException(
            status_code=504,
            detail={
                "error": "timeout_consulta",
                "endpoint": endpoint or None,
                "timeout_s": t,
                "mensaje": (
                    "La consulta excedió el tiempo máximo y fue interrumpida. "
                    "Inténtalo de nuevo; si persiste, el servicio subyacente puede "
                    "estar degradado."
                ),
            },
        )
