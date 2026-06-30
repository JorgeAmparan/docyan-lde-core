"""
Pipeline Tipo 5 — Troubleshooting → DiagnosticTree (B8 §A2).

DOCYAN LDE™ by XCID.

`:ArbolDiagnostico` con navegación interactiva. El estado de navegación vive en la
sesión MO (TTL 2h, decisión #6). Cruces a Tipo 2 (ejecutar el procedimiento de la
acción resolutoria) y a Tipo 6 (la sesión se registra como :EventoOperativo).
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import DiagnosticTreePayload, OpcionDecision


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    termino = ctx.params.get("termino", ctx.pregunta)
    nodo_id = ctx.params.get("nodo_id")
    data = reader.arbol_diagnostico(ctx.tenant_id, termino, ctx.entidad_id, nodo_id, ctx.documento_id)

    opciones = [
        OpcionDecision(
            etiqueta=o.get("etiqueta") or "",
            siguiente_nodo_id=o.get("siguiente_nodo_id"),
            causa_probable=o.get("causa_probable"),
            accion_resolutoria=o.get("accion_resolutoria"),
        )
        for o in (data.get("opciones") or [])
        if o and o.get("etiqueta")
    ]
    es_hoja = not opciones and bool(
        data.get("causa_probable") or data.get("accion_resolutoria")
    )

    payload = DiagnosticTreePayload(
        arbol_id=data.get("arbol_id"),
        titulo=data.get("titulo") or termino or "Diagnóstico",
        nodo_actual_id=data.get("nodo_actual_id"),
        pregunta=data.get("pregunta"),
        opciones=opciones,
        es_hoja=es_hoja,
        causa_probable=data.get("causa_probable"),
        accion_resolutoria=data.get("accion_resolutoria"),
        session_id=ctx.session_id,
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.TROUBLESHOOTING, ctx.entidad_id),
    )
