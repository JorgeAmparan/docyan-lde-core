"""
Validador de seguridad regulatoria de alertas — línea ABSOLUTA (B8, CLAUDE.md §11.1).

DOCYAN LDE™ by XCID.

Las alertas del sistema deben ser **SOLO administrativas** (vencimientos,
faltantes, fechas de calibración, documentos por expirar) y **NUNCA** sugerir una
decisión clínica u operativa ("administre X", "suspenda el tratamiento", "detenga
la línea", "incremente la dosis"). Una alerta con sugerencia clínica/operativa
convertiría a DOCYAN en software como dispositivo médico (SaMD) sujeto a
COFEPRIS/FDA y responsabilidad por mala praxis.

`validar_alerta` devuelve si es admisible (administrativa). Toda alerta NO
administrativa se manda a CUARENTENA por el GRG y se registra en FAT; NUNCA se
sirve. Cobertura de tests crítica: esta línea no se cruza.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


def _norm(texto: str) -> str:
    t = (texto or "").lower()
    t = unicodedata.normalize("NFKD", t)
    return "".join(c for c in t if not unicodedata.combining(c))


# Patrones que delatan una SUGERENCIA de decisión clínica u operativa. Si
# cualquiera aparece en la alerta, NO es administrativa → cuarentena.
_PATRONES_PROHIBIDOS: tuple[str, ...] = (
    # Clínico
    r"\badminist(re|rar|re la)\b",
    r"\bdosis\b",
    r"\bmedicament",
    r"\bdiagnostic(o|ar|ique)\b",
    r"\btratamiento\b",
    r"\bsuspend(a|er) (el|la|los)\b",
    r"\bincrement(e|ar) la\b",
    r"\bredu(zca|cir) la dosis\b",
    r"\bprescrib",
    r"\biny(ecte|eccion)\b",
    r"\bcontraindica",
    # Operativo decisorio
    r"\bdeten(ga|er) (la|el) (linea|maquina|reactor|proceso|equipo)\b",
    r"\bapag(ue|ar) (el|la) (reactor|maquina|equipo|linea)\b",
    r"\bcierre (la|el) valvula\b",
    r"\bopere\b",
    r"\bdesconect(e|ar) (el|la)\b",
    r"\bevacu(e|ar)\b",
)

# Señales de que SÍ es administrativa (refuerzan, no son obligatorias).
_PATRONES_ADMINISTRATIVOS: tuple[str, ...] = (
    r"\bvenc",
    r"\bcaduc",
    r"\bexpir",
    r"\bcalibrac",
    r"\bcertificad",
    r"\bdocumento[s]? (por|pendiente|faltante|por vencer)\b",
    r"\bfecha (limite|de vencimiento|de calibracion)\b",
    r"\brenovac",
    r"\bfaltante",
)


@dataclass
class ResultadoValidacion:
    admisible: bool
    motivo: str
    patron_detectado: str | None = None


def validar_alerta(descripcion: str) -> ResultadoValidacion:
    """
    True (admisible) solo si la alerta es administrativa y NO sugiere decisión
    clínica/operativa. El criterio prohibido MANDA sobre el administrativo: una
    alerta que mezcle ambos se rechaza (la línea es absoluta).
    """
    texto = _norm(descripcion)
    for patron in _PATRONES_PROHIBIDOS:
        if re.search(patron, texto):
            return ResultadoValidacion(
                admisible=False,
                motivo="Sugerencia clínica/operativa detectada — línea SaMD (CLAUDE.md §11.1).",
                patron_detectado=patron,
            )
    return ResultadoValidacion(admisible=True, motivo="Alerta administrativa admisible.")


def particionar_alertas(alertas: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Separa (administrativas_admisibles, cuarentena). Cada alerta de cuarentena
    lleva `motivo_cuarentena` y `patron_detectado` para el GRG/FAT.
    """
    admisibles: list[dict] = []
    cuarentena: list[dict] = []
    for a in alertas:
        res = validar_alerta(a.get("descripcion", ""))
        if res.admisible:
            admisibles.append(a)
        else:
            cuarentena.append(
                {**a, "motivo_cuarentena": res.motivo, "patron_detectado": res.patron_detectado}
            )
    return admisibles, cuarentena
