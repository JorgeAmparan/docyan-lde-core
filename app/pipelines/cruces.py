"""
Matriz de cruces estructurales entre tipos de intención (doc 03, B8 §A2).

DOCYAN LDE™ by XCID.

Cada tipo de intención puede ofrecer saltos a otros tipos relacionados sobre la
misma entidad (p. ej. de un procedimiento → la especificación que referencia, o
de un troubleshooting → el procedimiento que lo resuelve). La UI (B9) usa estos
cruces para ofrecer la navegación contextual.

Los 4 cruces más usados (verificados en tests): T2→T1, T5→T2, T7→T2, T5→T6.
"""
from __future__ import annotations

from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.schemas.pipeline_payloads import CruceSugerido

# (tipo_destino, etiqueta, motivo) por tipo de origen.
_MATRIZ: dict[TipoIntencion, list[tuple[TipoIntencion, str, str]]] = {
    TipoIntencion.INFORMATIVA: [
        (TipoIntencion.HISTORIAL, "Ver historial", "Eventos y mediciones de la entidad"),
    ],
    TipoIntencion.GUIA_PASO_A_PASO: [
        (TipoIntencion.INFORMATIVA, "Ver especificación",
         "Especificaciones referenciadas en los pasos"),
        (TipoIntencion.GRAFICOS_DIAGRAMAS, "Ver diagrama",
         "Diagrama de apoyo del procedimiento"),
        (TipoIntencion.VIDEO, "Ver video", "Video que acompaña el procedimiento"),
    ],
    TipoIntencion.GRAFICOS_DIAGRAMAS: [
        (TipoIntencion.INFORMATIVA, "Ver especificación",
         "Especificación de los elementos etiquetados"),
    ],
    TipoIntencion.VIDEO: [
        (TipoIntencion.GUIA_PASO_A_PASO, "Ver procedimiento",
         "Procedimiento que el video acompaña"),
    ],
    TipoIntencion.TROUBLESHOOTING: [
        (TipoIntencion.GUIA_PASO_A_PASO, "Ejecutar procedimiento",
         "Procedimiento de la acción resolutoria"),
        (TipoIntencion.HISTORIAL, "Registrar en historial",
         "La sesión de diagnóstico se registra como evento operativo"),
    ],
    TipoIntencion.HISTORIAL: [
        (TipoIntencion.ALERTAS, "Ver alertas",
         "Vencimientos derivados de los certificados de vigencia"),
    ],
    TipoIntencion.ALERTAS: [
        (TipoIntencion.GUIA_PASO_A_PASO, "Ver procedimiento",
         "Procedimiento para atender el vencimiento"),
        (TipoIntencion.HISTORIAL, "Ver historial", "Historial del certificado"),
    ],
    TipoIntencion.COMPARATIVA: [
        (TipoIntencion.INFORMATIVA, "Ver especificación",
         "Detalle de cada lado comparado"),
    ],
    TipoIntencion.BILINGUE: [
        (TipoIntencion.INFORMATIVA, "Ver especificación",
         "Especificación del término en el documento origen"),
    ],
}


def sugerencias_para(
    tipo: TipoIntencion, entidad_id: str | None = None
) -> list[CruceSugerido]:
    """Construye los cruces estructurales que un pipeline de `tipo` ofrece."""
    return [
        CruceSugerido(
            tipo_intencion=destino.value,
            entidad_id=entidad_id,
            etiqueta=etiqueta,
            motivo=motivo,
        )
        for destino, etiqueta, motivo in _MATRIZ.get(tipo, [])
    ]
