"""
Tipos núcleo del GRG extendido: familias, criticidad, tiers, umbrales, resultados.

DOCYAN LDE™ by XCID — B7 (doc 07).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class FamiliaGRG(str, Enum):
    """Las 8 familias del doc 07. Códigos R-LT-* (F1) / R-UC-* (F2), etc."""

    # ── ACTIVAS en runtime MVP (consulta viva) ───────────────────────────────
    F2_UMBRALES_CONFIANZA = "F2"
    F3_FRENO_ALUCINACION = "F3"
    F7_CONSULTA_OPERATIVA = "F7"
    F8_CANAL = "F8"
    # ── MODELADAS pero INERTES (cimiento para B5 — motor de traducción) ───────
    F1_LOCK_TERMINOLOGICO = "F1"
    F4_FIDELIDAD_NO_TRADUCIBLES = "F4"
    F5_VALIDACION_SEGMENTO = "F5"
    F6_CONSISTENCIA_CROSS_SEGMENTO = "F6"


FAMILIAS_ACTIVAS_MVP: frozenset[FamiliaGRG] = frozenset(
    {
        FamiliaGRG.F2_UMBRALES_CONFIANZA,
        FamiliaGRG.F3_FRENO_ALUCINACION,
        FamiliaGRG.F7_CONSULTA_OPERATIVA,
        FamiliaGRG.F8_CANAL,
    }
)

FAMILIAS_INERTES_MVP: frozenset[FamiliaGRG] = frozenset(
    {
        FamiliaGRG.F1_LOCK_TERMINOLOGICO,
        FamiliaGRG.F4_FIDELIDAD_NO_TRADUCIBLES,
        FamiliaGRG.F5_VALIDACION_SEGMENTO,
        FamiliaGRG.F6_CONSISTENCIA_CROSS_SEGMENTO,
    }
)


class Criticidad(str, Enum):
    """Criticidad del segmento (decisión #15). Define el umbral de confianza F2."""

    SEGURIDAD = "seguridad"
    REGULATORIO = "regulatorio"
    CALIDAD = "calidad"
    OPERACIONAL = "operacional"
    INFORMATIVA = "informativa"


#: Umbrales de confianza por criticidad (F2 / doc 07). Defaults del catálogo;
#: `configuracion_grg` los puede sobrescribir por tenant (migración 013).
UMBRALES_CRITICIDAD: dict[Criticidad, float] = {
    Criticidad.SEGURIDAD: 0.95,
    Criticidad.REGULATORIO: 0.90,
    Criticidad.CALIDAD: 0.85,
    Criticidad.OPERACIONAL: 0.75,
    Criticidad.INFORMATIVA: 0.60,
}


class Tier(str, Enum):
    """Tier del cliente. Tier alto = gobernanza más estricta (escala a revisor)."""

    BASE = "base"
    PROFESIONAL = "profesional"
    ENTERPRISE = "enterprise"


class AccionGRG(str, Enum):
    """Acción resultante de evaluar una regla GRG."""

    SERVIR = "servir"  # aprobado, sirve directo
    FLAG_DISCLAIMER = "flag_disclaimer"  # sirve con disclaimer crítico + FAT
    ESCALAR_REVISOR = "escalar_revisor"  # no sirve directo, revisión humana
    BLOQUEAR = "bloquear"  # no sirve (p. ej. fabricación detectada)


@dataclass
class ResultadoRegla:
    """
    Resultado de evaluar una regla GRG. Es lo que el Governance Gate / MO usan
    para decidir y lo que se registra en el FAT (familia F7 gobernanza).
    """

    familia: FamiliaGRG
    regla_id: str
    aprobada: bool
    accion: AccionGRG
    razon: str
    disclaimer: str | None = None
    escalar_a_revisor: bool = False
    detalle: dict[str, Any] = field(default_factory=dict)

    def to_fat_payload(self) -> dict[str, Any]:
        """Payload listo para registrar en el FAT (familia F7 gobernanza)."""
        return {
            "familia": self.familia.value,
            "regla_id": self.regla_id,
            "aprobada": self.aprobada,
            "accion": self.accion.value,
            "razon": self.razon,
            "escalar_a_revisor": self.escalar_a_revisor,
            **({"detalle": self.detalle} if self.detalle else {}),
        }


# Disclaimer crítico estándar (mismo en PWA y WhatsApp — regla F8).
DISCLAIMER_CRITICO = (
    "⚠️ Información crítica con confianza por debajo del umbral. "
    "Verifique contra la fuente antes de actuar."
)
