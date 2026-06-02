"""
GRG — familias MODELADAS pero INERTES en runtime MVP (cimiento para B5).

DOCYAN LDE™ by XCID — doc 07.

F1 Lock terminológico, F4 Fidelidad de no-traducibles, F5 Validación por tipo de
segmento traducido, F6 Consistencia cross-segmento. Son reglas de PRODUCCIÓN DE
TRADUCCIÓN: el motor que las ejecuta es B5 (diferido en la Adenda MVP). Aquí
quedan como FUNCIONES PURAS, testables aisladamente (entrada → salida), pero
SIN invocación desde el pipeline activo. No las importa ni el Governance Gate ni
el MO. Ver docs/grg_familias_inertes_mvp.md.

Activarlas en B5 = enchufar estas funciones al motor de traducción; la lógica ya
está aquí y probada.
"""
from __future__ import annotations

import re

from app.governance.familias_grg import (
    AccionGRG,
    FamiliaGRG,
    ResultadoRegla,
)

# ── F1 — Lock terminológico (R-LT-01..03) ─────────────────────────────────────


def f1_lock_terminologico(
    origen: str,
    traduccion: str,
    lock_map: dict[str, str],
) -> ResultadoRegla:
    """
    R-LT-01..03 (INERTE): dado un mapa {término_origen: traducción_obligatoria},
    verifica que cada término bloqueado presente en `origen` aparezca con su
    traducción exacta en `traduccion`. Violación → bloquear (en B5).
    """
    violaciones: list[dict[str, str]] = []
    origen_l = origen.lower()
    trad_l = traduccion.lower()
    for termino, obligatoria in lock_map.items():
        if termino.lower() in origen_l and obligatoria.lower() not in trad_l:
            violaciones.append({"termino": termino, "esperado": obligatoria})

    if violaciones:
        return ResultadoRegla(
            familia=FamiliaGRG.F1_LOCK_TERMINOLOGICO,
            regla_id="R-LT-01",
            aprobada=False,
            accion=AccionGRG.BLOQUEAR,
            razon=f"{len(violaciones)} término(s) bloqueado(s) no respetado(s).",
            detalle={"violaciones": violaciones},
        )
    return ResultadoRegla(
        familia=FamiliaGRG.F1_LOCK_TERMINOLOGICO,
        regla_id="R-LT-01",
        aprobada=True,
        accion=AccionGRG.SERVIR,
        razon="Lock terminológico respetado.",
    )


# ── F4 — Fidelidad de no-traducibles ──────────────────────────────────────────

# Fórmulas químicas (H2O, CaCO3), unidades SI (mg/L, °C, kPa), marcadores {var}.
_NO_TRADUCIBLE_RE = re.compile(
    r"\{[a-zA-Z_][\w]*\}"  # marcadores paramétricos {variable}
    r"|°[CFK]"  # grados
    r"|\b[A-Z][a-z]?\d+(?:[A-Z][a-z]?\d*)*\b"  # fórmulas químicas
    r"|\b\d+(?:[.,]\d+)?\s?(?:mg|kg|g|mL|L|kPa|MPa|Pa|mm|cm|m|°C|°F|%)\b"  # unidades
)


def f4_fidelidad_no_traducibles(origen: str, traduccion: str) -> ResultadoRegla:
    """
    F4 (INERTE): los no-traducibles (fórmulas químicas, unidades SI, marcas,
    marcadores {variable}) deben preservarse VERBATIM entre origen y traducción.
    """
    en_origen = set(_NO_TRADUCIBLE_RE.findall(origen))
    en_trad = set(_NO_TRADUCIBLE_RE.findall(traduccion))
    perdidos = sorted(en_origen - en_trad)
    if perdidos:
        return ResultadoRegla(
            familia=FamiliaGRG.F4_FIDELIDAD_NO_TRADUCIBLES,
            regla_id="R-NT-01",
            aprobada=False,
            accion=AccionGRG.BLOQUEAR,
            razon="No-traducibles alterados/perdidos en la traducción.",
            detalle={"perdidos": perdidos},
        )
    return ResultadoRegla(
        familia=FamiliaGRG.F4_FIDELIDAD_NO_TRADUCIBLES,
        regla_id="R-NT-01",
        aprobada=True,
        accion=AccionGRG.SERVIR,
        razon="No-traducibles preservados verbatim.",
    )


# ── F5 — Validación por tipo de segmento traducido ────────────────────────────

# Caracteres por segundo máximos para subtítulos (estándar de industria ~17 CPS).
CPS_MAX_SUBTITULO = 17.0


def f5_validar_segmento(
    tipo_segmento: str,
    traduccion: str,
    *,
    duracion_seg: float | None = None,
    longitud_max: int | None = None,
) -> ResultadoRegla:
    """
    F5 (INERTE): validación por TIPO de segmento traducido:
      - "subtitulo": CPS ≤ CPS_MAX_SUBTITULO.
      - "etiqueta_diagrama": longitud ≤ longitud_max.
      - "paso": imperativo presente.
      - "advertencia": tono ANSI Z535 (señal de palabra de aviso).
    """
    fallos: list[str] = []
    tipo = tipo_segmento.lower()

    if tipo == "subtitulo" and duracion_seg and duracion_seg > 0:
        cps = len(traduccion) / duracion_seg
        if cps > CPS_MAX_SUBTITULO:
            fallos.append(f"CPS {cps:.1f} > {CPS_MAX_SUBTITULO} (subtítulo ilegible).")
    elif tipo == "etiqueta_diagrama" and longitud_max:
        if len(traduccion) > longitud_max:
            fallos.append(
                f"Etiqueta {len(traduccion)} > {longitud_max} caracteres."
            )
    elif tipo == "paso":
        from app.governance.grg_extendido import _tiene_pasos_accionables

        if not _tiene_pasos_accionables(traduccion):
            fallos.append("Paso traducido sin imperativo accionable.")
    elif tipo == "advertencia":
        if not re.search(
            r"\b(PELIGRO|ADVERTENCIA|PRECAUCI[ÓO]N|AVISO|DANGER|WARNING|CAUTION)\b",
            traduccion,
            re.IGNORECASE,
        ):
            fallos.append("Advertencia sin palabra de aviso ANSI Z535.")

    if fallos:
        return ResultadoRegla(
            familia=FamiliaGRG.F5_VALIDACION_SEGMENTO,
            regla_id="R-VS-01",
            aprobada=False,
            accion=AccionGRG.FLAG_DISCLAIMER,
            razon=f"Segmento '{tipo_segmento}' no conforme: " + " ".join(fallos),
            detalle={"tipo": tipo_segmento, "fallos": fallos},
        )
    return ResultadoRegla(
        familia=FamiliaGRG.F5_VALIDACION_SEGMENTO,
        regla_id="R-VS-01",
        aprobada=True,
        accion=AccionGRG.SERVIR,
        razon=f"Segmento '{tipo_segmento}' conforme.",
    )


# ── F6 — Consistencia cross-segmento ──────────────────────────────────────────


def f6_consistencia_cross_segmento(
    traducciones_por_termino: dict[str, list[str]],
) -> ResultadoRegla:
    """
    F6 (INERTE): un mismo término origen debe traducirse CONSISTENTEMENTE
    (intra-documento + cross-documento del mismo cliente). Recibe, por término,
    la lista de traducciones observadas; >1 traducción distinta = inconsistencia.
    """
    inconsistencias = {
        termino: sorted(set(trads))
        for termino, trads in traducciones_por_termino.items()
        if len(set(trads)) > 1
    }
    if inconsistencias:
        return ResultadoRegla(
            familia=FamiliaGRG.F6_CONSISTENCIA_CROSS_SEGMENTO,
            regla_id="R-CC-01",
            aprobada=False,
            accion=AccionGRG.FLAG_DISCLAIMER,
            razon=f"{len(inconsistencias)} término(s) con traducción inconsistente.",
            detalle={"inconsistencias": inconsistencias},
        )
    return ResultadoRegla(
        familia=FamiliaGRG.F6_CONSISTENCIA_CROSS_SEGMENTO,
        regla_id="R-CC-01",
        aprobada=True,
        accion=AccionGRG.SERVIR,
        razon="Traducción consistente en todos los segmentos.",
    )
