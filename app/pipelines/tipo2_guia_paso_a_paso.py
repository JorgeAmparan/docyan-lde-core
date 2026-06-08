"""
Pipeline Tipo 2 — Guía paso a paso → ProcedureCard (B8 §A2).

DOCYAN LDE™ by XCID.

`:Procedimiento` + `:Paso` con EPP/Herramientas/Advertencias/Pre-Postcondiciones.
Cruces a Tipo 1 (especificación), 3 (diagrama) y 4 (video). Modo "ejecutar paso a
paso" con confirmación: la UI confirma cada paso y el MO registra FAT F4+F5
(auditoría IATF 16949). El gate F2/F3/F7 lo aplica el Governance Gate del MO.
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import Cita, PasoProcedimiento, ProcedureCardPayload


def _lista(v) -> list[str]:
    if not v:
        return []
    if isinstance(v, str):
        return [v]
    return [str(x) for x in v if x]


def _cita(data: dict) -> Cita | None:
    """Cita de procedencia del procedimiento (bridge §1.0.1). None si no hay doc."""
    if not (data.get("documento_id") or data.get("documento_nombre")):
        return None
    return Cita(
        documento_id=data.get("documento_id"),
        documento_nombre=data.get("documento_nombre"),
    )


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    termino = ctx.params.get("termino", ctx.pregunta)
    data = reader.procedimiento(ctx.tenant_id, termino, ctx.entidad_id)

    pasos_raw = [p for p in (data.get("pasos") or []) if p and p.get("descripcion")]
    pasos_raw.sort(key=lambda p: p.get("orden") or 0)
    pasos = [
        PasoProcedimiento(
            orden=int(p.get("orden") or i + 1),
            descripcion=p.get("descripcion") or "",
            epp=_lista(p.get("epp")),
            herramientas=_lista(p.get("herramientas")),
            advertencias=_lista(p.get("advertencias")),
            precondiciones=_lista(p.get("precondiciones")),
            postcondiciones=_lista(p.get("postcondiciones")),
        )
        for i, p in enumerate(pasos_raw)
    ]

    cita = _cita(data)
    payload = ProcedureCardPayload(
        procedimiento_id=data.get("procedimiento_id"),
        titulo=data.get("titulo") or termino or "Procedimiento",
        pasos=pasos,
        modo_ejecutar_paso_a_paso=bool(ctx.params.get("ejecutar_paso_a_paso", False)),
        citas=[cita] if cita else [],
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.GUIA_PASO_A_PASO, ctx.entidad_id),
    )
