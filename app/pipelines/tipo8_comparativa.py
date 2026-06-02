"""
Pipeline Tipo 8 — Comparativa → ComparativeView (B8 §A2).

DOCYAN LDE™ by XCID.

Estrategias del MVP: comparar dos versiones del MISMO documento (diff) o comparar
especificaciones entre dos entidades del MISMO tipo. Cache 24h. La computación
asíncrona para comparativas largas (vía cola Redis, como el worker) se marca con
`computo_asincrono`. Gate F2 para cambios de seguridad/regulatorios (lo aplica el
Governance Gate del MO sobre el score).
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import ComparativeViewPayload, DiferenciaDetectada

# Campos cuyo cambio se considera de seguridad/regulatorio → fuerzan gate F2.
_CAMPOS_SEGURIDAD = {"hash", "version", "estado", "valor", "unidad", "limite", "tolerancia"}

# Umbral (nº de campos) por encima del cual el cómputo se delega a la cola Redis.
UMBRAL_ASINCRONO = 200


def _diff(izq: dict, der: dict) -> list[DiferenciaDetectada]:
    campos = sorted(set(izq) | set(der))
    diffs: list[DiferenciaDetectada] = []
    for campo in campos:
        vi, vd = izq.get(campo), der.get(campo)
        if vi != vd:
            diffs.append(
                DiferenciaDetectada(
                    campo=campo,
                    valor_izquierda=None if vi is None else str(vi),
                    valor_derecha=None if vd is None else str(vd),
                    es_cambio_seguridad=campo.lower() in _CAMPOS_SEGURIDAD,
                )
            )
    return diffs


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    estrategia = ctx.params.get("estrategia", "entidades_mismo_tipo")
    if estrategia not in ("versiones_documento", "entidades_mismo_tipo"):
        estrategia = "entidades_mismo_tipo"
    ref_izq = str(ctx.params.get("ref_izquierda", ""))
    ref_der = str(ctx.params.get("ref_derecha", ""))

    data = reader.comparar(ctx.tenant_id, estrategia, ref_izq, ref_der)
    izq = data.get("izquierda") or {}
    der = data.get("derecha") or {}
    diffs = _diff(izq, der)

    payload = ComparativeViewPayload(
        titulo="Comparativa",
        estrategia=estrategia,
        referencia_izquierda=ref_izq,
        referencia_derecha=ref_der,
        diferencias=diffs,
        cacheada=bool(ctx.params.get("cacheada", False)),
        computo_asincrono=len(set(izq) | set(der)) > UMBRAL_ASINCRONO,
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.COMPARATIVA, ctx.entidad_id),
    )
