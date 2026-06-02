"""
Pipeline Tipo 4 — Video → VideoPlayer (B8 §A2).

DOCYAN LDE™ by XCID.

`:RecursoVideo` + `:Capitulo` + `:Subtitulo` + `:Transcripcion`. NO genera
subtítulos por traducción (B5 diferido): entrega lo que existe + la bandera
honesta `subtitulos_disponibles_en_par_activo`. Modo "video acompaña
procedimiento" si el contexto referencia uno.
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import (
    CapituloVideo,
    SubtituloVideo,
    VideoPlayerPayload,
)


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    termino = ctx.params.get("termino", ctx.pregunta)
    data = reader.video(ctx.tenant_id, termino, ctx.entidad_id)
    par_activo = ctx.params.get("par_linguistico") or data.get("par_activo")

    capitulos = [
        CapituloVideo(titulo=c.get("titulo") or "", inicio_seg=float(c.get("inicio_seg") or 0))
        for c in (data.get("capitulos") or [])
        if c and c.get("titulo")
    ]
    subtitulos = [
        SubtituloVideo(
            idioma=s.get("idioma") or "",
            texto=s.get("texto") or "",
            inicio_seg=s.get("inicio_seg"),
            fin_seg=s.get("fin_seg"),
        )
        for s in (data.get("subtitulos") or [])
        if s and s.get("texto")
    ]
    # Bandera honesta: True solo si existe al menos un subtítulo en el par activo.
    disponibles = bool(par_activo) and any(s.idioma == par_activo for s in subtitulos)

    payload = VideoPlayerPayload(
        recurso_id=data.get("recurso_id"),
        titulo=data.get("titulo") or termino or "Video",
        video_url=data.get("video_url"),
        capitulos=capitulos,
        subtitulos=subtitulos,
        transcripcion=data.get("transcripcion"),
        subtitulos_disponibles_en_par_activo=disponibles,
        acompana_procedimiento_id=ctx.params.get("procedimiento_id"),
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.VIDEO, ctx.entidad_id),
    )
