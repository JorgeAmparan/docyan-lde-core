"""
Familias de eventos FAT (doc 08) + retención por familia (decisión #12 Paso C).

DOCYAN LDE™ by XCID — B7.

10 familias. 7 ACTIVAS en runtime MVP (F4 consulta, F5 troubleshooting,
F6 alertas, F7 gobernanza, F8 onboarding, F9 sistema, F10 eventos dirigidos) y 3
MODELADAS pero INERTES hasta la reactivación de traducción en B5 (F1 pipeline
traducción, F2 revisión humana, F3 ingesta bilingüe). La estructura, la retención
y la inmutabilidad se construyen completas para todas; las inertes simplemente no
se emiten en runtime MVP (mismo patrón que B3-DTM).

F10 (eventos dirigidos, ED-1): cada transición del ciclo de vida común de un
`:EventoDirigido` (alertas ahora, solicitudes en ED-2) registra un evento FAT en
esta familia. La adenda de Eventos Dirigidos §1.1 la introduce como extensión del
subsistema de alertas hacia la base común Alerta+Solicitud.
"""
from __future__ import annotations

from enum import Enum


class FamiliaFAT(str, Enum):
    """Las 10 familias de eventos FAT (doc 08 + adenda Eventos Dirigidos §1.1)."""

    # ── Modeladas pero INERTES en MVP (cimiento para reactivación de traducción) ─
    F1_PIPELINE_TRADUCCION = "F1"
    F2_REVISION_HUMANA = "F2"
    F3_INGESTA_BILINGUE = "F3"
    # ── ACTIVAS en runtime MVP ───────────────────────────────────────────────
    F4_CONSULTA = "F4"
    F5_TROUBLESHOOTING = "F5"
    F6_ALERTAS = "F6"
    F7_GOBERNANZA = "F7"
    F8_ONBOARDING = "F8"
    F9_SISTEMA = "F9"
    # Eventos dirigidos (ED-1): transiciones del ciclo de vida común Alerta/Solicitud.
    F10_EVENTO_DIRIGIDO = "F10"


#: Familias activas en runtime MVP (las que el sistema emite hoy).
FAMILIAS_ACTIVAS_MVP: frozenset[FamiliaFAT] = frozenset(
    {
        FamiliaFAT.F4_CONSULTA,
        FamiliaFAT.F5_TROUBLESHOOTING,
        FamiliaFAT.F6_ALERTAS,
        FamiliaFAT.F7_GOBERNANZA,
        FamiliaFAT.F8_ONBOARDING,
        FamiliaFAT.F9_SISTEMA,
        FamiliaFAT.F10_EVENTO_DIRIGIDO,
    }
)

#: Familias modeladas pero inertes en MVP (se reactivan con el motor de B5).
FAMILIAS_INERTES_MVP: frozenset[FamiliaFAT] = frozenset(
    {
        FamiliaFAT.F1_PIPELINE_TRADUCCION,
        FamiliaFAT.F2_REVISION_HUMANA,
        FamiliaFAT.F3_INGESTA_BILINGUE,
    }
)

#: Retención en AÑOS por familia (decisión #12 Paso C / doc 08). Fuente de verdad
#: del código; la tabla `fat_retention_policy` (migración 013) la replica para
#: configuración y la rutina de retención puede leer de cualquiera de las dos.
RETENCION_ANIOS: dict[FamiliaFAT, int] = {
    FamiliaFAT.F1_PIPELINE_TRADUCCION: 7,
    FamiliaFAT.F2_REVISION_HUMANA: 7,
    FamiliaFAT.F3_INGESTA_BILINGUE: 7,
    FamiliaFAT.F4_CONSULTA: 3,
    FamiliaFAT.F5_TROUBLESHOOTING: 3,
    FamiliaFAT.F6_ALERTAS: 3,
    FamiliaFAT.F7_GOBERNANZA: 7,
    FamiliaFAT.F8_ONBOARDING: 5,
    FamiliaFAT.F9_SISTEMA: 2,
    # Eventos dirigidos: registro administrativo/operacional (vencimientos,
    # solicitudes). Retención alineada con alertas (F6).
    FamiliaFAT.F10_EVENTO_DIRIGIDO: 3,
}


def es_activa(familia: FamiliaFAT) -> bool:
    """True si la familia se emite en runtime MVP."""
    return familia in FAMILIAS_ACTIVAS_MVP
