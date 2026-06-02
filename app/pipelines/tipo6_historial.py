"""
Pipeline Tipo 6 — Historial → Timeline (B8 §A2).

DOCYAN LDE™ by XCID.

`:EventoOperativo` + `:CertificadoVigencia` + `:Observacion` +
`:MedicionRegistrada`. INCLUYE patrones EDB visibles (consultas frecuentes,
problemas recurrentes, observaciones acumuladas) — sustento EXPLÍCITO del Nivel 3
visible (Adenda). Es la base del Tipo 7 (alertas).
"""
from __future__ import annotations

from collections import Counter

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import (
    EventoTimeline,
    PatronesEDB,
    TimelinePayload,
)


def _eventos(rows: list[dict]) -> list[EventoTimeline]:
    return [
        EventoTimeline(
            tipo=r.get("tipo") or "evento",
            descripcion=r.get("descripcion") or "",
            timestamp=r.get("ts") or r.get("timestamp"),
            entidad_id=r.get("entidad_id"),
        )
        for r in rows
        if r
    ]


def _patrones_edb(data: dict) -> PatronesEDB:
    """Deriva patrones visibles del Nivel 3 a partir del historial del grafo."""
    eventos = data.get("eventos") or []
    consultas = [
        e.get("descripcion") for e in eventos
        if (e or {}).get("tipo") == "consulta_realizada" and e.get("descripcion")
    ]
    problemas = [
        e.get("descripcion") for e in eventos
        if (e or {}).get("tipo") in ("troubleshooting", "falla", "diagnostico")
        and e.get("descripcion")
    ]
    observaciones = [
        o.get("descripcion") for o in (data.get("observaciones") or []) if o.get("descripcion")
    ]
    frecuentes = [q for q, _ in Counter(consultas).most_common(5)]
    recurrentes = [p for p, n in Counter(problemas).most_common(5) if n >= 1]
    return PatronesEDB(
        consultas_frecuentes=frecuentes,
        problemas_recurrentes=recurrentes,
        observaciones_acumuladas=observaciones[:10],
    )


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    data = reader.historial(ctx.tenant_id, ctx.entidad_id)

    payload = TimelinePayload(
        titulo="Historial",
        entidad_id=ctx.entidad_id,
        eventos=_eventos(data.get("eventos") or []),
        certificados_vigencia=_eventos(data.get("certificados") or []),
        observaciones=_eventos(data.get("observaciones") or []),
        mediciones=_eventos(data.get("mediciones") or []),
        patrones_edb=_patrones_edb(data),
    )
    return ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.HISTORIAL, ctx.entidad_id),
    )
