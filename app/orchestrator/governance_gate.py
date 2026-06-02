"""
Governance Gate del MO (B4 §1 responsabilidad 5 / §5 — integración mínima).

DOCYAN LDE™ by XCID.

Antes de servir CUALQUIER output, el MO pasa por este gate. En B4:

  - Verifica PERMISOS del rol (modelo de roles doc 09): si el rol no tiene la
    capacidad requerida para el tipo de request, se bloquea.
  - Lee `score_confianza` del output del pipeline. Si está bajo el umbral del
    tenant → NO sirve, frena la alucinación, lo registra (FAT lo hace el MO).
  - Aplica CRITICIDAD (decisión #15): si el segmento es crítico y la confianza es
    MEDIA (sobre el umbral de bloqueo pero bajo el umbral crítico), requiere
    revisión humana antes de servir (escalación a revisor).

La EXTENSIÓN completa de GRG (reglas declarativas por tenant F1–F10, librería de
policies) va en B7. Este gate deja un hook opcional (`grg`) para esa integración
sin reescribir el contrato. Sin GRG inyectado opera con los chequeos doc-05.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

# Umbrales default (configurables por tenant en B7). Bajo `umbral_confianza` se
# frena la alucinación; sobre él pero bajo `umbral_critico` un segmento crítico
# escala a revisión humana.
DEFAULT_UMBRAL_CONFIANZA = float(os.getenv("GOV_UMBRAL_CONFIANZA", "0.7"))
DEFAULT_UMBRAL_CRITICO = float(os.getenv("GOV_UMBRAL_CRITICO", "0.85"))


@dataclass
class GateDecision:
    """Resultado del Governance Gate."""

    servir: bool
    motivo: str
    escalar_a_revisor: bool = False
    razon_codigo: str = "ok"  # ok | sin_permiso | confianza_baja | requiere_revision
    # B7: disclaimer crítico cuando el GRG extendido (F2/F8) lo exige; el canal lo
    # propaga igual en PWA y WhatsApp. None = sin disclaimer.
    disclaimer: str | None = None
    regla_grg: str | None = None  # regla F2 aplicada (R-UC-0x), si la hubo.

    @property
    def bloqueado(self) -> bool:
        return not self.servir


class GovernanceGate:
    """Gate centralizado de gobernanza previo a servir output."""

    def __init__(
        self,
        umbral_confianza: float = DEFAULT_UMBRAL_CONFIANZA,
        umbral_critico: float = DEFAULT_UMBRAL_CRITICO,
        grg=None,
    ):
        self.umbral_confianza = umbral_confianza
        self.umbral_critico = umbral_critico
        self.grg = grg  # hook GRG existente (B7 lo usa a fondo); opcional en B4.

    def evaluate(
        self,
        *,
        permiso_requerido: str | None,
        permisos: list[str],
        score_confianza: float | None = None,
        segmento_critico: bool = False,
        criticidad: object | None = None,
    ) -> GateDecision:
        # 1. Permisos del rol (doc 09).
        if permiso_requerido is not None and permiso_requerido not in (permisos or []):
            return GateDecision(
                servir=False,
                motivo=(
                    f"El rol no tiene permiso '{permiso_requerido}'. "
                    "Acceso denegado por Governance Gate."
                ),
                razon_codigo="sin_permiso",
            )

        # 1b. B7 — GRG extendido F2: si hay `criticidad` (decisión #15) y un GRG
        # extendido inyectado, los umbrales por criticidad del doc 07 mandan sobre
        # el umbral estático. El gate sigue siendo transparente al MO (misma
        # interfaz; `criticidad` es opcional). Sin GRG inyectado, cae al camino
        # estático de B4.
        if criticidad is not None and self.grg is not None and score_confianza is not None:
            decision = self._evaluar_f2(criticidad, score_confianza)
            if decision is not None:
                return decision

        # 2. Confianza vs umbral (freno de alucinación). Sin score → se asume
        # contenido determinista (no generado por LLM) y pasa.
        if score_confianza is not None:
            if score_confianza < self.umbral_confianza:
                return GateDecision(
                    servir=False,
                    motivo=(
                        f"Confianza {score_confianza:.2f} bajo el umbral "
                        f"{self.umbral_confianza:.2f}. Output retenido (freno de "
                        "alucinación)."
                    ),
                    razon_codigo="confianza_baja",
                )

            # 3. Criticidad (decisión #15): segmento crítico + confianza media →
            # revisión humana antes de servir.
            if segmento_critico and score_confianza < self.umbral_critico:
                return GateDecision(
                    servir=False,
                    motivo=(
                        f"Segmento crítico con confianza media "
                        f"({score_confianza:.2f} < {self.umbral_critico:.2f}). "
                        "Requiere revisión humana antes de servir."
                    ),
                    escalar_a_revisor=True,
                    razon_codigo="requiere_revision",
                )

        return GateDecision(servir=True, motivo="Aprobado por Governance Gate.")

    def _evaluar_f2(self, criticidad: object, score_confianza: float) -> GateDecision | None:
        """
        Traduce la regla F2 del GRG extendido (umbral por criticidad) a una
        GateDecision. Devuelve None si `criticidad` no es una Criticidad válida o
        el GRG inyectado no soporta F2 (cae al camino estático).
        """
        f2 = getattr(self.grg, "f2_evaluar_umbral", None)
        if f2 is None:
            return None
        try:
            from app.governance.familias_grg import AccionGRG, Criticidad

            crit = criticidad if isinstance(criticidad, Criticidad) else Criticidad(criticidad)
        except (ValueError, ImportError):
            return None

        res = f2(crit, score_confianza)
        if res.accion == AccionGRG.SERVIR:
            return GateDecision(
                servir=True, motivo=res.razon, razon_codigo="ok", regla_grg=res.regla_id
            )
        if res.accion == AccionGRG.ESCALAR_REVISOR:
            return GateDecision(
                servir=False, motivo=res.razon, escalar_a_revisor=True,
                razon_codigo="requiere_revision", disclaimer=res.disclaimer,
                regla_grg=res.regla_id,
            )
        # FLAG_DISCLAIMER: sirve con disclaimer crítico (no bloquea).
        return GateDecision(
            servir=True, motivo=res.razon, razon_codigo="ok",
            disclaimer=res.disclaimer, regla_grg=res.regla_id,
        )
