"""
Tipos del clasificador de intención (B8 §A1).

DOCYAN LDE™ by XCID.

Los 8 tipos de intención CONFIRMADOS para el MVP (doc 03; los tipos 9-11 quedan
fuera del alcance B8). Cada tipo mapea a un pipeline de resolución
(`app/pipelines/tipoN_*.py`) vía `RUTA_POR_TIPO`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class TipoIntencion(str, Enum):
    """Los 8 tipos de intención de consulta del MVP (doc 03)."""

    INFORMATIVA = "INFORMATIVA"
    GUIA_PASO_A_PASO = "GUIA_PASO_A_PASO"
    GRAFICOS_DIAGRAMAS = "GRAFICOS_DIAGRAMAS"
    VIDEO = "VIDEO"
    TROUBLESHOOTING = "TROUBLESHOOTING"
    HISTORIAL = "HISTORIAL"
    ALERTAS = "ALERTAS"
    COMPARATIVA = "COMPARATIVA"


#: Ruta (módulo de pipeline) que resuelve cada tipo de intención. Es la "ruta"
#: que devuelve `clasificar_intencion` y que el coordinador usa para despachar.
RUTA_POR_TIPO: dict[TipoIntencion, str] = {
    TipoIntencion.INFORMATIVA: "tipo1_informativa",
    TipoIntencion.GUIA_PASO_A_PASO: "tipo2_guia_paso_a_paso",
    TipoIntencion.GRAFICOS_DIAGRAMAS: "tipo3_graficos_diagramas",
    TipoIntencion.VIDEO: "tipo4_video",
    TipoIntencion.TROUBLESHOOTING: "tipo5_troubleshooting",
    TipoIntencion.HISTORIAL: "tipo6_historial",
    TipoIntencion.ALERTAS: "tipo7_alertas",
    TipoIntencion.COMPARATIVA: "tipo8_comparativa",
}


@dataclass
class ResultadoClasificacion:
    """
    Resultado de clasificar una consulta.

    `metodo` es "heuristico", "llm" o "fallback"; el FAT (familia F4) registra
    esta traza para telemetría del clasificador (distribución de confianza).
    """

    tipo: TipoIntencion
    score: float
    ruta: str
    metodo: str = "heuristico"
    razon: str = ""
    candidatos: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "tipo": self.tipo.value,
            "score": round(self.score, 4),
            "ruta": self.ruta,
            "metodo": self.metodo,
            "razon": self.razon,
            "candidatos": {k: round(v, 4) for k, v in self.candidatos.items()},
        }
