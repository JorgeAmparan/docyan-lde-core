"""
Pipeline Tipo 1 — Informativa → InfoCard (B8 §A2).

DOCYAN LDE™ by XCID.

`:Especificacion` + `:TerminoTecnico`. Match único o múltiple (desambiguación).
El gate F2 (confianza/seguridad) lo aplica el Governance Gate del MO sobre el
score de clasificación; aquí se compone el payload con citas de procedencia.
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import Cita, EspecificacionItem, InfoCardPayload
from app.solicitudes import inferencia as _inferencia


def _cita(row: dict) -> Cita | None:
    if not any(row.get(k) for k in ("documento_id", "documento_nombre", "seccion", "pagina")):
        return None
    return Cita(
        documento_id=row.get("documento_id"),
        documento_nombre=row.get("documento_nombre"),
        documento_tipo=row.get("documento_tipo"),
        documento_url=row.get("documento_url"),
        seccion=row.get("seccion"),
        pagina=row.get("pagina"),
        span_inicio=row.get("span_inicio"),
        span_fin=row.get("span_fin"),
        # Verbatim del documento (chunk[start:end]) cuando hay span; None ⇒ la UI
        # muestra "fragmento no disponible". Nunca se rellena con texto sintetizado.
        fragmento=row.get("fragmento"),
    )


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    termino = ctx.params.get("termino", ctx.pregunta)
    data = reader.informativa(ctx.tenant_id, termino, ctx.entidad_id, ctx.documento_id)
    especs_raw = data.get("especificaciones") or []

    especificaciones = []
    for r in especs_raw:
        cita = _cita(r)
        doc_tipo = cita.documento_tipo if cita else None
        # ED-2 §2.4: marcado accionable determinístico (INFORMATIVA + tipo_documento).
        tipo_sugerido = _inferencia.inferir_tipo("INFORMATIVA", doc_tipo)
        especificaciones.append(EspecificacionItem(
            nombre=r.get("nombre") or "—",
            valor=r.get("valor"),
            unidad=r.get("unidad"),
            cita=cita,
            accionable=tipo_sugerido is not None,
            tipo_sugerido=tipo_sugerido,
        ))
    citas = [e.cita for e in especificaciones if e.cita is not None]
    match_multiple = len(especificaciones) > 1
    desambiguacion = [e.nombre for e in especificaciones] if match_multiple else []

    payload = InfoCardPayload(
        titulo=data.get("termino") or termino or "Información",
        termino_tecnico=data.get("termino"),
        definicion=data.get("definicion"),
        especificaciones=especificaciones,
        match_multiple=match_multiple,
        desambiguacion=desambiguacion,
        citas=citas,
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.INFORMATIVA, ctx.entidad_id),
    )
