"""
Clasificador de Intención HÍBRIDO (B8 §A1).

DOCYAN LDE™ by XCID.

Profundiza el Intent Router mínimo de B4 (que distingue consulta/ingesta/config/
evento) clasificando DENTRO de "consulta" en los 8 tipos del doc 03. Es híbrido:

  1. Heurística rápida (`heuristicos`) — patrones léxicos + tipo de documento.
     Resuelve los casos obvios sin costo de LLM, con latencia ~0.
  2. Si la confianza heurística ≥ umbral del tenant (`umbrales`, default 0.80) →
     se sirve esa clasificación.
  3. Si no → se escala al LLM (`llm_classifier`, gpt-4o-mini) con prompt cerrado
     de 8 opciones + ejemplos. Cubre ambigüedad y cobertura.

Por qué híbrido (cierre del pendiente doc 03): la heurística da latencia/costo
cero en el caso común; el LLM da cobertura/confianza en el caso ambiguo. Ni todo
heurístico (frágil) ni todo LLM (caro/lento por consulta).

El registro FAT (familia F4) de cada clasificación lo hace el MO con su
audit_logger; este módulo es PURO y determinista (testeable sin red).
"""
from __future__ import annotations

from app.orchestrator.clasificacion import heuristicos
from app.orchestrator.clasificacion.llm_classifier import LlmCaller, clasificar_con_llm
from app.orchestrator.clasificacion.tipos import (
    RUTA_POR_TIPO,
    ResultadoClasificacion,
    TipoIntencion,
)
from app.orchestrator.clasificacion.umbrales import (
    DefaultUmbralStore,
    UmbralStore,
)


class ClasificadorIntencion:
    """Clasificador híbrido: heurística + LLM fallback con umbral por tenant."""

    def __init__(
        self,
        umbral_store: UmbralStore | None = None,
        llm_caller: LlmCaller | None = None,
    ) -> None:
        self.umbral_store = umbral_store or DefaultUmbralStore()
        # Se inyecta para tests; en producción el llm_classifier usa su default.
        self._llm_caller = llm_caller

    def clasificar(
        self,
        pregunta: str,
        contexto: dict | None = None,
    ) -> ResultadoClasificacion:
        """
        Clasifica `pregunta` en uno de los 8 `TipoIntencion`.

        `contexto` puede incluir: `tenant_id`, `token_qr`, `tipo_documento`,
        `historial_resumen` (de la sesión). Devuelve el tipo, el score y la ruta
        (módulo de pipeline) más la traza del método usado.
        """
        ctx = contexto or {}
        tenant_id = ctx.get("tenant_id", "default")
        umbral = self.umbral_store.umbral_para(tenant_id)

        tipo_h, score_h, candidatos = heuristicos.clasificar(pregunta, ctx)

        if score_h >= umbral:
            return ResultadoClasificacion(
                tipo=tipo_h,
                score=score_h,
                ruta=RUTA_POR_TIPO[tipo_h],
                metodo="heuristico",
                razon=f"heurística ≥ umbral ({score_h:.2f} ≥ {umbral:.2f})",
                candidatos=candidatos,
            )

        # Escalamiento al LLM (ambiguo o cobertura insuficiente de la heurística).
        tipo_l, score_l, razon_l = clasificar_con_llm(pregunta, ctx, self._llm_caller)
        metodo = "fallback" if razon_l.startswith("fallback:") else "llm"
        return ResultadoClasificacion(
            tipo=tipo_l,
            score=score_l,
            ruta=RUTA_POR_TIPO[tipo_l],
            metodo=metodo,
            razon=razon_l or f"LLM (heurística {score_h:.2f} < umbral {umbral:.2f})",
            candidatos=candidatos,
        )


__all__ = ["ClasificadorIntencion", "ResultadoClasificacion", "TipoIntencion"]
