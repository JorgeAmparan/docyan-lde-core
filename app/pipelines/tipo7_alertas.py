"""
Pipeline Tipo 7 — Alertas → AlertsDashboard (B8 §A2).

DOCYAN LDE™ by XCID.

`:Alerta` + `:ReglaAlerta` + `:AccionSobreAlerta`. **Línea regulatoria ABSOLUTA:
alertas SOLO administrativas, NUNCA clínicas u operativas decisorias** (CLAUDE.md
§11.1). Toda alerta con tag no administrativo se manda a CUARENTENA (GRG) y se
registra en FAT; jamás se sirve. La generación periódica la dispara el scheduler
(diaria / cada 6h tenants críticos, decisión #15); este pipeline SIRVE lo vigente.
"""
from __future__ import annotations

from app.alerts.safety_validator import particionar_alertas
from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import cruces
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader
from app.schemas.pipeline_payloads import AlertaItem, AlertsDashboardPayload, Cita


def _cita_alerta(a: dict) -> Cita | None:
    """Cita de procedencia del vencimiento (B13.3 §2.4). None si no hay doc fuente."""
    if not any(a.get(k) for k in ("documento_id", "documento_nombre", "fragmento")):
        return None
    return Cita(
        documento_id=a.get("documento_id"),
        documento_nombre=a.get("documento_nombre"),
        documento_tipo=a.get("documento_tipo"),
        documento_url=a.get("documento_url"),
        span_inicio=a.get("span_inicio"),
        span_fin=a.get("span_fin"),
        fragmento=a.get("fragmento"),  # verbatim anclado al año del vencimiento
    )


def resolver(ctx: ContextoPipeline, reader: PipelineGraphReader) -> ResultadoPipeline:
    crudas = reader.alertas(ctx.tenant_id, ctx.entidad_id)
    admisibles, cuarentena = particionar_alertas(crudas)

    alertas = [
        AlertaItem(
            alerta_id=a.get("alerta_id"),
            descripcion=a.get("descripcion") or "",
            fecha_vencimiento=a.get("fecha_vencimiento"),
            urgencia=a.get("urgencia") or "media",
            entidad_id=a.get("entidad_id"),
            administrativa=True,
            cita=_cita_alerta(a),
        )
        for a in admisibles
    ]

    payload = AlertsDashboardPayload(
        titulo="Alertas administrativas",
        alertas=alertas,
        solo_administrativas=True,
        citas=[al.cita for al in alertas if al.cita is not None],
    )
    res = ResultadoPipeline(
        payload=payload,
        cruces=cruces.sugerencias_para(TipoIntencion.ALERTAS, ctx.entidad_id),
    )
    # La cuarentena se expone vía params para que el coordinador/MO la registre en
    # GRG+FAT. NUNCA forma parte del payload servido al operador.
    ctx.params["_alertas_cuarentena"] = cuarentena
    return res
