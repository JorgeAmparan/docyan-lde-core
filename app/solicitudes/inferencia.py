"""
Inferencia determinística contexto→tipo de solicitud (ED-2 §2.3 / Adenda ED §3.1.1).

DOCYAN LDE™ by XCID.

Mapeo de reglas VERSIONADO (config, **NO LLM**): (tipo de intención de la consulta,
tipo de documento/entidad del dato de origen) → clave del tipo de solicitud sugerido.
El formulario abre con ese tipo preseleccionado; el usuario lo cambia con un tap.
*El sistema muestra, el humano decide.*

El mismo mapeo alimenta el marcado de datos accionables del payload de consulta
(§2.4): un dato es accionable **si y solo si** el par (intención, tipo_documento)
tiene una regla aquí. Ausencia de regla ⇒ dato NO accionable (sin flag) — evita el
sobre-marcado (evidencia §5.4). Determinístico por tipo de dato/render, nunca el
LLM "recomendando".

Ejemplos de la Adenda:
- catálogo de partes / especificación → cotización
- evento de inspección / vencimiento sobre equipo → mantenimiento
- documento de proveedor → servicio
- contexto interdepartamental → tarea
"""

from __future__ import annotations

#: Versión del mapeo (cambia con cada revisión de reglas; auditable en FAT/reporte).
MAPEO_VERSION = "2026-07-21.1"

#: (tipo_intencion, documento_tipo) → clave de :TipoSolicitud semilla.
#: `tipo_intencion` = valor de `TipoIntencion` (INFORMATIVA, HISTORIAL, ALERTAS, ...).
#: `documento_tipo` = `tipo_documento` de la cita del dato de origen.
_MAPEO: dict[tuple[str, str], str] = {
    # Catálogo de partes / especificación / ficha técnica → cotización.
    ("INFORMATIVA", "especificacion"): "cotizacion",
    ("INFORMATIVA", "ficha_tecnica"): "cotizacion",
    ("INFORMATIVA", "catalogo_partes"): "cotizacion",
    ("COMPARATIVA", "especificacion"): "cotizacion",
    ("COMPARATIVA", "ficha_tecnica"): "cotizacion",
    # Vencimiento / calibración sobre equipo → mantenimiento.
    ("ALERTAS", "calibracion"): "mantenimiento",
    ("HISTORIAL", "calibracion"): "mantenimiento",
    ("ALERTAS", "manual_tecnico"): "mantenimiento",
    # Documento de proveedor → servicio.
    ("INFORMATIVA", "documento_proveedor"): "servicio",
    ("HISTORIAL", "documento_proveedor"): "servicio",
    ("INFORMATIVA", "msds"): "servicio",
}


def _norm(valor: str | None) -> str:
    return (valor or "").strip().upper()


def inferir_tipo(tipo_intencion: str | None, documento_tipo: str | None) -> str | None:
    """
    Devuelve la clave del tipo de solicitud sugerido para el par (intención,
    tipo_documento), o None si no hay regla (⇒ dato no accionable). Determinístico.
    """
    if not tipo_intencion or not documento_tipo:
        return None
    return _MAPEO.get((_norm(tipo_intencion), (documento_tipo or "").strip().lower()))


def es_accionable(tipo_intencion: str | None, documento_tipo: str | None) -> bool:
    """True si el dato es accionable (hay tipo sugerido). Base del flag §2.4."""
    return inferir_tipo(tipo_intencion, documento_tipo) is not None


def reglas() -> list[dict]:
    """Vuelca el mapeo versionado (inventario §5.3 / endpoint de diagnóstico)."""
    return [
        {"tipo_intencion": ti, "documento_tipo": dt, "tipo_sugerido": clave}
        for (ti, dt), clave in sorted(_MAPEO.items())
    ]
