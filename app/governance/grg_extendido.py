"""
GRG extendido — familias ACTIVAS en runtime MVP (F2, F3, F7, F8) + fachada (B7).

DOCYAN LDE™ by XCID — doc 07.

Evoluciona `app/core/grg.py` SIN recrearlo: `GRGExtendido` compone el
`GovernanceGuardrails` existente (block/flag/quarantine/redact + cache TTL de
reglas Supabase) y le agrega la estructura por familias de reglas. El core
sigue intacto; aquí viven las reglas de consulta viva como FUNCIONES evaluables
(puras donde es posible) que el Governance Gate del MO consulta.

Familias activas:
  F2 — Umbrales de confianza por criticidad (R-UC-01..05).
  F3 — Freno de alucinación (numérica / normativa / identificadores).
  F7 — Consulta operativa (3 reglas para UI #1 de B9).
  F8 — Canal PWA vs WhatsApp (2 reglas: criticidad preservada en degradación).

Las familias inertes (F1/F4/F5/F6) viven en `familias_inertes.py`: modeladas y
testables, NO enchufadas al pipeline activo (ver docs/grg_familias_inertes_mvp.md).
"""
from __future__ import annotations

import re
from typing import Any

from app.governance.familias_grg import (
    DISCLAIMER_CRITICO,
    UMBRALES_CRITICIDAD,
    AccionGRG,
    Criticidad,
    FamiliaGRG,
    ResultadoRegla,
    Tier,
)

# Criticidades que, bajo su umbral, NO se sirven directo (escalan a revisor).
_CRITICIDAD_ESCALA = frozenset({Criticidad.SEGURIDAD, Criticidad.REGULATORIO})

# ── Patrones de fabricación (F3) ──────────────────────────────────────────────
# Números "significativos": enteros de ≥2 dígitos o decimales (evita falsos
# positivos con numeración de pasos de un solo dígito).
_NUM_RE = re.compile(r"\d+(?:[.,]\d+)+|\d{2,}")
# Referencias normativas: NOM-/NMX-/ISO/IEC/ASTM/IATF/AS + número.
_NORMA_RE = re.compile(
    r"\b(?:NOM|NMX|ISO|IEC|ASTM|IATF|AS|EN|ANSI)[-\s]?\d[\w\-./:]*",
    re.IGNORECASE,
)
# Identificadores: códigos alfanuméricos tipo lote/parte/certificado
# (letras + dígitos con separador), p. ej. "LOTE-4471", "CERT-AB12".
_ID_RE = re.compile(r"\b[A-Z]{2,}[-/]?\d{2,}[A-Z0-9\-]*\b")


def _normaliza_num(token: str) -> str:
    return token.replace(",", "").rstrip(".")


class GRGExtendido:
    """
    Fachada del GRG extendido. Compone el GovernanceGuardrails core (opcional, solo
    si se necesita el camino Supabase de reglas declarativas) y expone las familias
    activas como métodos evaluables.

    Los evaluadores de familia son PUROS (entrada → ResultadoRegla); no cachean por
    segmento (decisión: sin cache para evaluación de segmentos individuales). La
    configuración por tenant (tier, umbrales F2) se inyecta vía `umbrales` /`tier`.
    """

    def __init__(
        self,
        core: Any = None,
        *,
        umbrales: dict[Criticidad, float] | None = None,
        tier: Tier = Tier.BASE,
    ) -> None:
        # `core` es un GovernanceGuardrails (app.core.grg). Opcional: las familias
        # de consulta viva no lo requieren. Se construye perezosamente si se pide.
        self._core = core
        self.umbrales = {**UMBRALES_CRITICIDAD, **(umbrales or {})}
        self.tier = tier

    @property
    def core(self) -> Any:
        """GovernanceGuardrails core (block/flag/quarantine/redact). Lazy."""
        if self._core is None:
            from app.core.grg import GovernanceGuardrails

            self._core = GovernanceGuardrails()
        return self._core

    def umbral_de(self, criticidad: Criticidad) -> float:
        return self.umbrales.get(criticidad, UMBRALES_CRITICIDAD[criticidad])

    # ── F2 — Umbrales de confianza por criticidad (R-UC-01..05) ──────────────

    def f2_evaluar_umbral(
        self,
        criticidad: Criticidad,
        confianza: float,
        *,
        tier: Tier | None = None,
    ) -> ResultadoRegla:
        """
        R-UC-0{1..5}: una regla por criticidad. Si la confianza alcanza el umbral
        de la criticidad → servir. Si no:
          - seguridad / regulatorio → escalar a revisor (no servir directo) con
            disclaimer crítico (más estricto en Enterprise).
          - calidad / operacional / informativa → servir con flag + disclaimer.
        Siempre se registra en FAT (el caller usa `to_fat_payload`).
        """
        tier = tier or self.tier
        umbral = self.umbral_de(criticidad)
        regla_id = f"R-UC-0{list(Criticidad).index(criticidad) + 1}"

        if confianza >= umbral:
            return ResultadoRegla(
                familia=FamiliaGRG.F2_UMBRALES_CONFIANZA,
                regla_id=regla_id,
                aprobada=True,
                accion=AccionGRG.SERVIR,
                razon=(
                    f"Confianza {confianza:.2f} ≥ umbral {umbral:.2f} "
                    f"({criticidad.value})."
                ),
                detalle={"criticidad": criticidad.value, "umbral": umbral,
                         "confianza": confianza, "tier": tier.value},
            )

        bajo = (
            f"Confianza {confianza:.2f} < umbral {umbral:.2f} ({criticidad.value})."
        )
        if criticidad in _CRITICIDAD_ESCALA:
            return ResultadoRegla(
                familia=FamiliaGRG.F2_UMBRALES_CONFIANZA,
                regla_id=regla_id,
                aprobada=False,
                accion=AccionGRG.ESCALAR_REVISOR,
                razon=bajo + " Criticidad alta → revisión humana antes de servir.",
                disclaimer=DISCLAIMER_CRITICO,
                escalar_a_revisor=True,
                detalle={"criticidad": criticidad.value, "umbral": umbral,
                         "confianza": confianza, "tier": tier.value},
            )
        return ResultadoRegla(
            familia=FamiliaGRG.F2_UMBRALES_CONFIANZA,
            regla_id=regla_id,
            aprobada=True,
            accion=AccionGRG.FLAG_DISCLAIMER,
            razon=bajo + " Sirve con disclaimer.",
            disclaimer=DISCLAIMER_CRITICO,
            detalle={"criticidad": criticidad.value, "umbral": umbral,
                     "confianza": confianza, "tier": tier.value},
        )

    # ── F3 — Freno de alucinación ────────────────────────────────────────────

    def f3_freno_alucinacion(self, output: str, fuente: str) -> ResultadoRegla:
        """
        Detecta y bloquea fabricaciones en `output` que NO existen en `fuente`:
          - numérica (cifras inventadas),
          - normativa (NOM/ISO/ASTM/… inventadas),
          - identificadores (códigos de pieza/lote/certificado inventados).
        Si hay fabricación → BLOQUEAR (no servir) + FAT.
        """
        fuente_nums = {_normaliza_num(m) for m in _NUM_RE.findall(fuente)}
        out_nums = {_normaliza_num(m) for m in _NUM_RE.findall(output)}
        num_fabricados = sorted(out_nums - fuente_nums)

        fuente_l = fuente.lower()
        norma_fabricadas = sorted(
            {
                m.strip()
                for m in _NORMA_RE.findall(output)
                if m.strip().lower() not in fuente_l
            }
        )
        id_fabricados = sorted(
            {
                m
                for m in _ID_RE.findall(output)
                # excluye las que ya capturó el detector de normas
                if m.lower() not in fuente_l and not _NORMA_RE.match(m)
            }
        )

        fabricaciones = {
            "numerica": num_fabricados,
            "normativa": norma_fabricadas,
            "identificadores": id_fabricados,
        }
        hay = any(fabricaciones.values())
        if hay:
            tipos = [k for k, v in fabricaciones.items() if v]
            return ResultadoRegla(
                familia=FamiliaGRG.F3_FRENO_ALUCINACION,
                regla_id="R-FA-01",
                aprobada=False,
                accion=AccionGRG.BLOQUEAR,
                razon=(
                    "Fabricación detectada respecto a la fuente: "
                    + ", ".join(tipos)
                    + ". Output retenido (freno de alucinación)."
                ),
                detalle=fabricaciones,
            )
        return ResultadoRegla(
            familia=FamiliaGRG.F3_FRENO_ALUCINACION,
            regla_id="R-FA-01",
            aprobada=True,
            accion=AccionGRG.SERVIR,
            razon="Sin fabricaciones: toda cifra/norma/identificador está en la fuente.",
        )

    # ── F7 — Consulta operativa (3 reglas para UI #1) ────────────────────────

    def f7_consulta_operativa(
        self,
        respuesta: str,
        *,
        fuente: str,
        tiene_pedigree: bool,
        requiere_pasos: bool = True,
    ) -> ResultadoRegla:
        """
        3 reglas para la respuesta a una consulta operativa:
          R-CO-01: imperativo en pasos accionables (cuando aplica).
          R-CO-02: sin fabricaciones (delega en F3).
          R-CO-03: pedigree clickeable OBLIGATORIO.
        Falla → no apta para servir como consulta operativa.
        """
        fallos: list[str] = []

        # R-CO-03 — pedigree obligatorio.
        if not tiene_pedigree:
            fallos.append("R-CO-03: falta pedigree clickeable obligatorio.")

        # R-CO-02 — sin fabricaciones.
        f3 = self.f3_freno_alucinacion(respuesta, fuente)
        if not f3.aprobada:
            fallos.append(f"R-CO-02: {f3.razon}")

        # R-CO-01 — imperativo en pasos accionables.
        if requiere_pasos and not _tiene_pasos_accionables(respuesta):
            fallos.append(
                "R-CO-01: respuesta sin pasos accionables imperativos."
            )

        if fallos:
            return ResultadoRegla(
                familia=FamiliaGRG.F7_CONSULTA_OPERATIVA,
                regla_id="R-CO",
                aprobada=False,
                accion=AccionGRG.BLOQUEAR,
                razon="Consulta operativa no conforme: " + " | ".join(fallos),
                detalle={"fallos": fallos},
            )
        return ResultadoRegla(
            familia=FamiliaGRG.F7_CONSULTA_OPERATIVA,
            regla_id="R-CO",
            aprobada=True,
            accion=AccionGRG.SERVIR,
            razon="Consulta operativa conforme (pasos + sin fabricación + pedigree).",
        )

    # ── F8 — Canal PWA vs WhatsApp ────────────────────────────────────────────

    def f8_canal(
        self,
        criticidad: Criticidad,
        canal: str,
        *,
        disclaimer_presente: bool,
    ) -> ResultadoRegla:
        """
        2 reglas que aseguran que la degradación graceful a WhatsApp NO pierda
        criticidad:
          R-CN-01: un segmento crítico (seguridad/regulatorio) debe llevar el
            disclaimer crítico igual que en PWA, sea cual sea el canal.
          R-CN-02: la información de criticidad no se degrada por canal.
        """
        critico = criticidad in _CRITICIDAD_ESCALA
        if critico and not disclaimer_presente:
            return ResultadoRegla(
                familia=FamiliaGRG.F8_CANAL,
                regla_id="R-CN-01",
                aprobada=False,
                accion=AccionGRG.FLAG_DISCLAIMER,
                razon=(
                    f"Segmento '{criticidad.value}' por canal '{canal}' SIN "
                    "disclaimer crítico. Debe ir con disclaimer igual que en PWA."
                ),
                disclaimer=DISCLAIMER_CRITICO,
                detalle={"criticidad": criticidad.value, "canal": canal},
            )
        return ResultadoRegla(
            familia=FamiliaGRG.F8_CANAL,
            regla_id="R-CN-02",
            aprobada=True,
            accion=AccionGRG.SERVIR,
            razon="Criticidad preservada en el canal (degradación graceful conforme).",
            detalle={"criticidad": criticidad.value, "canal": canal},
        )


# Verbos imperativos frecuentes en pasos operativos regulatorios (es-MX).
_IMPERATIVOS = (
    "verifique", "revise", "use", "utilice", "coloque", "registre", "active",
    "desactive", "apague", "encienda", "mida", "aplique", "retire", "instale",
    "confirme", "documente", "notifique", "identifique", "inspeccione",
    "asegure", "calibre", "limpie", "reemplace", "ajuste", "selle",
)


def _tiene_pasos_accionables(texto: str) -> bool:
    """Heurística: lista numerada/viñetas o verbos imperativos al inicio de línea."""
    lineas = [ln.strip() for ln in texto.splitlines() if ln.strip()]
    if any(re.match(r"^(\d+[.)]|[-*•])\s+", ln) for ln in lineas):
        return True
    palabras = re.findall(r"\b\w+\b", texto.lower())
    return any(p in _IMPERATIVOS for p in palabras)
