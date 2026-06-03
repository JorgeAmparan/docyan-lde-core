"""
Heurística retrieval-first vs synthesis-first (CCP/PCL — doc arquitectura §4).

DOCYAN LDE™ by XCID — B8.5.

No toda consulta necesita LLM. Distinguir entre las dos rutas es lo que permite
que la mayoría de consultas cueste casi cero (doc §4.4): el caché captura las
repetidas; el retrieval-first captura las que el grafo resuelve con un span
directo. Solo lo que queda paga inferencia.

  - **RETRIEVAL_FIRST** — la respuesta es un span del documento fuente
    (especificación, diagrama, video, evento de historial, alerta administrativa)
    con provenance. Sin LLM. Costo ~0.
  - **SYNTHESIS_FIRST** — la respuesta requiere razonamiento/síntesis (guía,
    troubleshooting, comparativa, o un tipo informativo con ambigüedad). Paga
    inferencia.
  - **CACHE_HIT** — servida desde el caché semántico (lo decide la fachada, no
    esta heurística).

La decisión NO la toma el pipeline coordinator directamente: delega aquí
(contrato B8.5 §2). Esto preserva los 8 pipelines de B8 sin tocar su código —
solo cambia cómo se etiqueta su costo y cómo se decide el modo a partir del
resultado de la navegación al DKG.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.orchestrator.clasificacion.tipos import TipoIntencion

# ModoRespuesta vive en la capa de schemas (compartido por payloads y esta
# heurística) para evitar un ciclo de importación; se re-exporta aquí por
# conveniencia de los consumidores de `app/pcl`.
from app.schemas.pcl_payloads import ModoRespuesta  # noqa: E402,F401

#: Tipos que por default se resuelven con retrieval puro cuando el grafo produce
#: un match único y bien definido (doc §4.1). Los demás (T2 guía, T5
#: troubleshooting, T8 comparativa) requieren síntesis por naturaleza.
MODOS_RETRIEVAL_FIRST_DEFAULT: frozenset[TipoIntencion] = frozenset(
    {
        TipoIntencion.INFORMATIVA,
        TipoIntencion.GRAFICOS_DIAGRAMAS,
        TipoIntencion.VIDEO,
        TipoIntencion.HISTORIAL,
        TipoIntencion.ALERTAS,
    }
)

#: Tope de elementos para considerar la navegación "pequeña y bien definida".
MAX_ELEMENTOS_RETRIEVAL = 3


@dataclass(frozen=True)
class NavegacionResultado:
    """
    Resumen de lo que la navegación al DKG produjo para una consulta. Lo deriva
    `navegacion_desde_envelope` a partir del payload tipado del pipeline (no hay
    una segunda navegación: se mide el resultado real que ya produjo el pipeline).
    """

    n_resultados: int
    ambiguo: bool = False
    degradado: bool = False

    def es_definido_y_pequeno(self, maximo: int = MAX_ELEMENTOS_RETRIEVAL) -> bool:
        """
        True si hay un match único o un conjunto pequeño y bien definido (≤ máx),
        sin ambigüedad ni degradación. Cero resultados o ambigüedad → synthesis.
        """
        return (
            not self.degradado
            and not self.ambiguo
            and 1 <= self.n_resultados <= maximo
        )


def navegacion_desde_envelope(envelope) -> NavegacionResultado:
    """
    Traduce el `ConsultaResuelta` que produjo un pipeline a un `NavegacionResultado`.

    Cuenta los elementos sustantivos del payload por variante (`kind`) y detecta
    ambigüedad (p. ej. `match_multiple` en una InfoCard) o degradación (grafo no
    respondió). Es lo que permite que `elegir_modo` decida sin re-navegar.
    """
    if getattr(envelope, "degradado", False):
        return NavegacionResultado(n_resultados=0, degradado=True)

    payload = envelope.payload
    kind = getattr(payload, "kind", None)

    if kind == "info_card":
        n = len(payload.especificaciones)
        if n == 0 and payload.definicion:
            n = 1
        return NavegacionResultado(n_resultados=n, ambiguo=bool(payload.match_multiple))
    if kind == "diagram_viewer":
        return NavegacionResultado(n_resultados=1 if payload.recurso_id else 0)
    if kind == "video_player":
        return NavegacionResultado(n_resultados=1 if payload.recurso_id else 0)
    if kind == "timeline":
        n = len(payload.eventos) + len(payload.certificados_vigencia) + len(payload.mediciones)
        return NavegacionResultado(n_resultados=n)
    if kind == "alerts_dashboard":
        return NavegacionResultado(n_resultados=len(payload.alertas))

    # Variantes de síntesis (procedure_card, diagnostic_tree, comparative_view):
    # el conteo no aplica; elegir_modo las manda a synthesis por tipo.
    return NavegacionResultado(n_resultados=0)


def puede_resolver_con_retrieval_puro(navegacion: NavegacionResultado) -> bool:
    """Match único o conjunto pequeño y bien definido → retrieval. Doc §4.3."""
    return navegacion.es_definido_y_pequeno()


def elegir_modo(
    tipo_intencion: TipoIntencion,
    contexto_consulta: dict | None,
    navegacion: NavegacionResultado,
) -> ModoRespuesta:
    """
    Heurística de elección (doc §4.3 / contrato §1.5).

    Si el tipo es retrieval-first por default Y la navegación produjo un match
    único/pequeño bien definido → RETRIEVAL_FIRST. Cualquier ambigüedad, cero
    resultados, degradación, o un tipo de síntesis → SYNTHESIS_FIRST. El cliente
    puede forzar síntesis (p. ej. "explícame") vía `contexto_consulta`.
    """
    ctx = contexto_consulta or {}
    if ctx.get("forzar_synthesis"):
        return ModoRespuesta.SYNTHESIS_FIRST
    if tipo_intencion in MODOS_RETRIEVAL_FIRST_DEFAULT:
        if puede_resolver_con_retrieval_puro(navegacion):
            return ModoRespuesta.RETRIEVAL_FIRST
    return ModoRespuesta.SYNTHESIS_FIRST
