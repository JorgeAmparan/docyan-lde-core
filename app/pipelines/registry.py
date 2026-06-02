"""
Registro de pipelines por tipo de intención (B8 §A2 / §A4).

DOCYAN LDE™ by XCID.

Mapea cada `TipoIntencion` a la función `resolver(ctx, reader)` de su pipeline.
El coordinador del MO despacha por aquí según la clasificación.
"""
from __future__ import annotations

from typing import Callable

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines import (
    tipo1_informativa,
    tipo2_guia_paso_a_paso,
    tipo3_graficos_diagramas,
    tipo4_video,
    tipo5_troubleshooting,
    tipo6_historial,
    tipo7_alertas,
    tipo8_comparativa,
)
from app.pipelines.base import ContextoPipeline, ResultadoPipeline
from app.pipelines.dkg_reader import PipelineGraphReader

Resolver = Callable[[ContextoPipeline, PipelineGraphReader], ResultadoPipeline]

RESOLVERS: dict[TipoIntencion, Resolver] = {
    TipoIntencion.INFORMATIVA: tipo1_informativa.resolver,
    TipoIntencion.GUIA_PASO_A_PASO: tipo2_guia_paso_a_paso.resolver,
    TipoIntencion.GRAFICOS_DIAGRAMAS: tipo3_graficos_diagramas.resolver,
    TipoIntencion.VIDEO: tipo4_video.resolver,
    TipoIntencion.TROUBLESHOOTING: tipo5_troubleshooting.resolver,
    TipoIntencion.HISTORIAL: tipo6_historial.resolver,
    TipoIntencion.ALERTAS: tipo7_alertas.resolver,
    TipoIntencion.COMPARATIVA: tipo8_comparativa.resolver,
}


def resolver_para(tipo: TipoIntencion) -> Resolver:
    """Devuelve la función de resolución del pipeline para un tipo de intención."""
    return RESOLVERS[tipo]


def payload_vacio(tipo: TipoIntencion, titulo: str):
    """
    Payload vacío VÁLIDO del tipo dado (degradación graceful, responsabilidad 10).

    Se usa cuando el grafo no responde: el contrato del tipo se respeta (la UI
    sabe qué variante renderizar) y la nota honesta la pone el envelope.
    """
    from app.schemas import pipeline_payloads as pp

    if tipo == TipoIntencion.INFORMATIVA:
        return pp.InfoCardPayload(titulo=titulo)
    if tipo == TipoIntencion.GUIA_PASO_A_PASO:
        return pp.ProcedureCardPayload(titulo=titulo)
    if tipo == TipoIntencion.GRAFICOS_DIAGRAMAS:
        return pp.DiagramViewerPayload(titulo=titulo)
    if tipo == TipoIntencion.VIDEO:
        return pp.VideoPlayerPayload(titulo=titulo)
    if tipo == TipoIntencion.TROUBLESHOOTING:
        return pp.DiagnosticTreePayload(titulo=titulo)
    if tipo == TipoIntencion.HISTORIAL:
        return pp.TimelinePayload(titulo=titulo)
    if tipo == TipoIntencion.ALERTAS:
        return pp.AlertsDashboardPayload(titulo=titulo)
    return pp.ComparativeViewPayload(
        titulo=titulo, estrategia="entidades_mismo_tipo",
        referencia_izquierda="", referencia_derecha="",
    )
