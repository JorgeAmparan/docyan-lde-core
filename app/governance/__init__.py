"""
GRG extendido — Guardrail Governance con las 8 familias del doc 07 (B7).

DOCYAN LDE™ by XCID.

Evoluciona `app/core/grg.py` (block/flag/quarantine/redact + cache TTL)
estructurando las reglas en 8 familias. 4 ACTIVAS en runtime MVP (consulta viva):
  F2 umbrales de confianza por criticidad, F3 freno de alucinación, F7 consulta
  operativa, F8 canal PWA vs WhatsApp.
4 MODELADAS pero INERTES (cimiento para el motor de traducción de B5):
  F1 lock terminológico, F4 fidelidad de no-traducibles, F5 validación por tipo
  de segmento traducido, F6 consistencia cross-segmento.

GRG es FUNCIÓN TÉCNICA, no instrucción verbal: diferenciador defendible vs CAT
tools. Cada regla: trigger + condición + acción + registro FAT.
"""
from app.governance.familias_grg import (
    UMBRALES_CRITICIDAD,
    AccionGRG,
    Criticidad,
    FamiliaGRG,
    ResultadoRegla,
    Tier,
)
from app.governance.grg_extendido import GRGExtendido

__all__ = [
    "AccionGRG",
    "Criticidad",
    "FamiliaGRG",
    "ResultadoRegla",
    "Tier",
    "UMBRALES_CRITICIDAD",
    "GRGExtendido",
]
