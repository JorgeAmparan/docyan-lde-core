"""
Pipeline Tipo 3 — Gráficos/diagramas → DiagramViewer (B8 §A2).

DOCYAN LDE™ by XCID.

`:RecursoVisual` + `:Etiqueta` (con coordenadas) + `:LeyendaSimbolica`. Las
etiquetas se resuelven léxicamente contra el DTM (lookup en el par activo, NO el
motor de traducción, que está diferido a B5). Gate F2 vía Governance Gate del MO.
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import (
    DiagramViewerPayload,
    EtiquetaDiagrama,
    SimboloLeyenda,
)


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    termino = ctx.params.get("termino", ctx.pregunta)
    data = reader.recurso_visual(ctx.tenant_id, termino, ctx.entidad_id)

    etiquetas = [
        EtiquetaDiagrama(
            texto=e.get("texto") or "",
            x=e.get("x"),
            y=e.get("y"),
            lookup_dtm=e.get("lookup_dtm"),
        )
        for e in (data.get("etiquetas") or [])
        if e and e.get("texto")
    ]
    leyenda = [
        SimboloLeyenda(simbolo=s.get("simbolo") or "", significado=s.get("significado") or "")
        for s in (data.get("leyenda") or [])
        if s and s.get("simbolo")
    ]

    payload = DiagramViewerPayload(
        recurso_id=data.get("recurso_id"),
        titulo=data.get("titulo") or termino or "Diagrama",
        recurso_url=data.get("recurso_url"),
        etiquetas=etiquetas,
        leyenda_simbolica=leyenda,
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.GRAFICOS_DIAGRAMAS, ctx.entidad_id),
    )
