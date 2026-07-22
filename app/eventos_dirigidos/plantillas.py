"""
Plantillas paramétricas de mensajes de eventos dirigidos (ED-1 §2.4.3).

DOCYAN LDE™ by XCID.

Mensajes con `{variables}` interpoladas, por tipo de evento y por idioma del
destinatario (referencia: infraestructura i18n / `tipo_segmento = mensaje_alerta`
del doc 12). Todo mensaje de alerta pasa por `safety_validator` ANTES de enviarse
(el gate se aplica en el `notificador`, sobre el texto final renderizado).

Regla regulatoria (CLAUDE.md §11.1): las plantillas describen SOLO el hecho
administrativo ("X vence el YYYY-MM-DD"), jamás qué hacer al respecto.
"""
from __future__ import annotations

from dataclasses import dataclass


class _SafeDict(dict):
    """format_map tolerante: una variable ausente deja el placeholder visible."""

    def __missing__(self, key: str) -> str:  # noqa: D401
        return "{" + key + "}"


@dataclass
class PlantillaRender:
    asunto: str
    cuerpo_texto: str
    cuerpo_html: str
    titulo: str  # para el centro in-app (compacto)


# Plantillas por (tipo_evento, idioma). Solo administrativas. `{var}` interpolables:
#   entidad, descripcion, fecha_vencimiento, dias, urgencia, nombre_destinatario.
_PLANTILLAS: dict[str, dict[str, dict[str, str]]] = {
    "alerta_vencimiento": {
        "es": {
            "titulo": "Vencimiento administrativo",
            "asunto": "DOCYAN · Aviso administrativo: {descripcion}",
            "cuerpo": (
                "Hola {nombre_destinatario}:\n\n"
                "Aviso administrativo de DOCYAN LDE.\n\n"
                "{descripcion}\n\n"
                "Urgencia: {urgencia}.\n\n"
                "Este es un aviso informativo de vencimiento; no constituye una "
                "instrucción operativa ni clínica.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
        "en": {
            "titulo": "Administrative expiration",
            "asunto": "DOCYAN · Administrative notice: {descripcion}",
            "cuerpo": (
                "Hello {nombre_destinatario}:\n\n"
                "Administrative notice from DOCYAN LDE.\n\n"
                "{descripcion}\n\n"
                "Urgency: {urgencia}.\n\n"
                "This is an informational expiration notice; it is not an "
                "operational or clinical instruction.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
    },
    "alerta_manual": {
        "es": {
            "titulo": "Aviso administrativo",
            "asunto": "DOCYAN · Aviso administrativo: {descripcion}",
            "cuerpo": (
                "Hola {nombre_destinatario}:\n\n"
                "Aviso administrativo registrado en DOCYAN LDE.\n\n"
                "{descripcion}\n\n"
                "Urgencia: {urgencia}.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
        "en": {
            "titulo": "Administrative notice",
            "asunto": "DOCYAN · Administrative notice: {descripcion}",
            "cuerpo": (
                "Hello {nombre_destinatario}:\n\n"
                "Administrative notice recorded in DOCYAN LDE.\n\n"
                "{descripcion}\n\n"
                "Urgency: {urgencia}.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
    },
    "alerta_escalacion": {
        "es": {
            "titulo": "Alerta escalada",
            "asunto": "DOCYAN · Alerta escalada sin reconocimiento: {descripcion}",
            "cuerpo": (
                "Hola {nombre_destinatario}:\n\n"
                "Una alerta administrativa lleva {dias} día(s) sin reconocerse y se "
                "ha escalado.\n\n"
                "{descripcion}\n\n"
                "Urgencia: {urgencia}.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
        "en": {
            "titulo": "Escalated alert",
            "asunto": "DOCYAN · Alert escalated without acknowledgement: {descripcion}",
            "cuerpo": (
                "Hello {nombre_destinatario}:\n\n"
                "An administrative alert has gone {dias} day(s) without "
                "acknowledgement and has been escalated.\n\n"
                "{descripcion}\n\n"
                "Urgency: {urgencia}.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
    },
    # ── Solicitudes (ED-2 §2.6) ───────────────────────────────────────────────
    # Externa: al proveedor sin cuenta DOCYAN. Incluye la cita de origen (fragmento
    # verbatim, NO el documento), datos de contacto del solicitante y branding. La
    # respuesta va al solicitante (reply-to). `descripcion` = mensaje del formulario.
    "solicitud_externa": {
        "es": {
            "titulo": "Nueva solicitud",
            "asunto": "DOCYAN · Solicitud de {tipo_solicitud}: {descripcion}",
            "cuerpo": (
                "Hola {nombre_destinatario}:\n\n"
                "{solicitante_nombre} le hace llegar una solicitud de "
                "{tipo_solicitud} a través de DOCYAN LDE.\n\n"
                "Mensaje:\n{descripcion}\n\n"
                "Dato de referencia (cita del documento «{documento_nombre}»):\n"
                "«{fragmento}»\n\n"
                "Para responder, conteste directamente a este correo "
                "({solicitante_email}).\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
        "en": {
            "titulo": "New request",
            "asunto": "DOCYAN · {tipo_solicitud} request: {descripcion}",
            "cuerpo": (
                "Hello {nombre_destinatario}:\n\n"
                "{solicitante_nombre} is sending you a {tipo_solicitud} request "
                "through DOCYAN LDE.\n\n"
                "Message:\n{descripcion}\n\n"
                "Reference (quote from «{documento_nombre}»):\n"
                "«{fragmento}»\n\n"
                "To reply, respond directly to this email "
                "({solicitante_email}).\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
    },
    # Interna: a un usuario/departamento del tenant. Mismo contenido, sin datos de
    # contacto externos (el destinatario ya está en el tenant y ve la bandeja).
    "solicitud_interna": {
        "es": {
            "titulo": "Nueva solicitud",
            "asunto": "DOCYAN · Solicitud de {tipo_solicitud}: {descripcion}",
            "cuerpo": (
                "Hola {nombre_destinatario}:\n\n"
                "{solicitante_nombre} creó una solicitud de {tipo_solicitud} y la "
                "dirigió a usted.\n\n"
                "Mensaje:\n{descripcion}\n\n"
                "Dato de referencia (cita del documento «{documento_nombre}»):\n"
                "«{fragmento}»\n\n"
                "Puede darle seguimiento en su bandeja de solicitudes en DOCYAN LDE.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
        "en": {
            "titulo": "New request",
            "asunto": "DOCYAN · {tipo_solicitud} request: {descripcion}",
            "cuerpo": (
                "Hello {nombre_destinatario}:\n\n"
                "{solicitante_nombre} created a {tipo_solicitud} request addressed "
                "to you.\n\n"
                "Message:\n{descripcion}\n\n"
                "Reference (quote from «{documento_nombre}»):\n"
                "«{fragmento}»\n\n"
                "You can follow up in your requests inbox in DOCYAN LDE.\n\n"
                "— DOCYAN LDE by XCID"
            ),
        },
    },
}

# Familia de plantilla por defecto cuando el tipo no está catalogado.
_FALLBACK_TIPO = "alerta_manual"
_IDIOMA_DEFAULT = "es"


def tipos_disponibles() -> tuple[str, ...]:
    return tuple(_PLANTILLAS.keys())


def _to_html(texto: str) -> str:
    import html

    parrafos = [f"<p>{html.escape(p).replace(chr(10), '<br/>')}</p>" for p in texto.split("\n\n")]
    return "<div>" + "".join(parrafos) + "</div>"


def render(tipo_evento: str, idioma: str, variables: dict) -> PlantillaRender:
    """
    Renderiza (asunto, cuerpo texto, cuerpo html, título) para un tipo de evento e
    idioma. Idioma desconocido → español. Tipo desconocido → plantilla genérica.
    Variables ausentes dejan el placeholder visible (nunca crashea).
    """
    familia = _PLANTILLAS.get(tipo_evento) or _PLANTILLAS[_FALLBACK_TIPO]
    plantilla = familia.get(idioma) or familia.get(_IDIOMA_DEFAULT) or next(iter(familia.values()))
    safe = _SafeDict(variables or {})
    safe.setdefault("nombre_destinatario", "")
    safe.setdefault("urgencia", "media")
    asunto = plantilla["asunto"].format_map(safe).strip()
    cuerpo = plantilla["cuerpo"].format_map(safe).strip()
    titulo = plantilla["titulo"].format_map(safe).strip()
    return PlantillaRender(
        asunto=asunto,
        cuerpo_texto=cuerpo,
        cuerpo_html=_to_html(cuerpo),
        titulo=titulo,
    )
