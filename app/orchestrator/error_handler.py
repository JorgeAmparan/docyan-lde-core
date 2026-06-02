"""
Error handling y degradación graceful del MO (B4 §1 responsabilidad 10).

DOCYAN LDE™ by XCID.

Principios (doc 05):
  - Retry con backoff para fallos transitorios.
  - Fallback vía MR (Model Router existente) cuando aplica.
  - Degradación a un canal menos rico si el principal falla.
  - Escalación a humano (revisor del tenant) cuando el caso lo amerita.
  - Comunicación HONESTA: NUNCA enmascarar una falla como éxito (CLAUDE.md §2.2).

El backoff usa una función de sleep INYECTABLE (default time.sleep) para que los
tests no esperen tiempo real.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from app.orchestrator.models import Canal

# Degradación de canal: del más rico al menos rico.
_DEGRADE_ORDER = [Canal.pwa, Canal.whatsapp, Canal.api]


@dataclass
class ExecOutcome:
    ok: bool
    result: Any = None
    error: str | None = None
    intentos: int = 0


class ErrorHandler:
    """Retry, fallback y degradación con comunicación honesta de fallos."""

    def __init__(
        self,
        max_intentos: int = 3,
        base_backoff_seg: float = 0.2,
        sleep: Callable[[float], None] | None = None,
    ):
        self.max_intentos = max_intentos
        self.base_backoff_seg = base_backoff_seg
        self._sleep = sleep or _default_sleep

    def run_with_retry(self, fn: Callable[[], Any]) -> ExecOutcome:
        """Ejecuta `fn` con reintentos y backoff exponencial. Reporta el fallo real."""
        ultimo_error: str | None = None
        for intento in range(1, self.max_intentos + 1):
            try:
                return ExecOutcome(ok=True, result=fn(), intentos=intento)
            except Exception as exc:  # noqa: BLE001
                ultimo_error = f"{type(exc).__name__}: {exc}"
                if intento < self.max_intentos:
                    self._sleep(self.base_backoff_seg * (2 ** (intento - 1)))
        return ExecOutcome(ok=False, error=ultimo_error, intentos=self.max_intentos)

    def run_with_fallback(
        self, primary: Callable[[], Any], fallback: Callable[[], Any]
    ) -> ExecOutcome:
        """Intenta `primary` con retry; si falla, intenta `fallback` con retry."""
        outcome = self.run_with_retry(primary)
        if outcome.ok:
            return outcome
        fb = self.run_with_retry(fallback)
        if fb.ok:
            return fb
        # Ambos fallaron: se reporta el fallo, NO se finge éxito.
        return ExecOutcome(
            ok=False,
            error=f"primary[{outcome.error}] + fallback[{fb.error}]",
            intentos=outcome.intentos + fb.intentos,
        )

    @staticmethod
    def degrade_channel(canal: Canal) -> Canal | None:
        """Devuelve el siguiente canal menos rico, o None si ya es el último."""
        try:
            idx = _DEGRADE_ORDER.index(canal)
        except ValueError:
            return None
        return _DEGRADE_ORDER[idx + 1] if idx + 1 < len(_DEGRADE_ORDER) else None

    @staticmethod
    def honest_error(mensaje_usuario: str, detalle_tecnico: str) -> dict:
        """
        Construye una respuesta de error HONESTA. El detalle técnico va al campo
        de diagnóstico; al usuario se le dice claramente que algo falló, sin
        disfrazarlo de éxito.
        """
        return {
            "ok": False,
            "error_usuario": mensaje_usuario,
            "detalle_tecnico": detalle_tecnico,
        }


def _default_sleep(segundos: float) -> None:
    import time

    time.sleep(segundos)
