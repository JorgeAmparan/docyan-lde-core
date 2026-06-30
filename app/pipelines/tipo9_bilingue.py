"""
Pipeline Tipo 9 — Bilingüe → BilingualAlignment (memoria_traduccion · Pista B).

DOCYAN LDE™ by XCID.

La vista bilingüe alineada del prototipo (`answers.jsx` → `BilingualAnswer`):
segmentos origen↔destino del DTM por par lingüístico, con lock terminológico
(equivalencias fijadas del glosario). NO traduce al vuelo: lee la memoria de
traducción (`:SegmentoTraduccion`). Si no hay memoria para el par/consulta,
devuelve un payload vacío VÁLIDO + `desde_memoria=False` (degradación honesta,
responsabilidad 10 del MO): nunca inventa equivalencias.

El par direccional por defecto es en-US → es-MX (Pista B: documentos en inglés,
consulta/equivalencia en español). `ctx.params` puede fijar `source_lang`/
`target_lang` para otros pares.
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import (
    BilingualAlignmentPayload,
    Cita,
    ParLock,
    SegmentoBilingue,
)


def _cita(seg: dict) -> Cita | None:
    if not any(seg.get(k) for k in ("documento_nombre", "seccion", "fragmento")):
        return None
    return Cita(
        documento_nombre=seg.get("documento_nombre"),
        documento_tipo=seg.get("documento_tipo"),
        seccion=seg.get("seccion"),
        # Verbatim del segmento origen de la memoria (no texto sintetizado).
        fragmento=seg.get("fragmento"),
    )


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    termino = ctx.params.get("termino", ctx.pregunta) or ""
    source_lang = str(ctx.params.get("source_lang", "en-US"))
    target_lang = str(ctx.params.get("target_lang", "es-MX"))

    data = reader.bilingue(ctx.tenant_id, termino, source_lang, target_lang)
    segs_raw = data.get("segmentos") or []

    segmentos = [
        SegmentoBilingue(
            texto_origen=s.get("texto_origen") or "",
            texto_destino=s.get("texto_destino"),
            idioma_origen=s.get("idioma_origen") or source_lang,
            idioma_destino=s.get("idioma_destino") or target_lang,
            tipo_segmento=s.get("tipo_segmento"),
            lock=[
                ParLock(termino_origen=lk["termino_origen"], termino_destino=lk["termino_destino"])
                for lk in (s.get("lock") or [])
                if lk.get("termino_origen") and lk.get("termino_destino")
            ],
            cita=_cita(s),
        )
        for s in segs_raw
        if s.get("texto_origen")
    ]
    citas = [seg.cita for seg in segmentos if seg.cita is not None]

    payload = BilingualAlignmentPayload(
        titulo=f"Memoria de traducción · {data.get('par_linguistico') or f'{source_lang} → {target_lang}'}",
        par_linguistico=data.get("par_linguistico") or f"{source_lang} → {target_lang}",
        desde_memoria=bool(data.get("desde_memoria")) and len(segmentos) > 0,
        lock_terminologico_activo=bool(data.get("lock_activo"))
        or any(seg.lock for seg in segmentos),
        segmentos=segmentos,
        citas=citas,
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.BILINGUE, ctx.entidad_id),
    )
