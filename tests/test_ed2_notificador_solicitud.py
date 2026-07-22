"""
ED-2 §2.6 — Ruteo/notificación de solicitud vía el motor ÚNICO de ED-1.

Tests 5 y 6 del contrato:
- Externo: email con fragmento verbatim + reply-to = solicitante (Resend mockeado).
- Interno: notificación in-app persistida.
- safety_validator bloquea un mensaje no administrativo (jamás se envía).
"""

from __future__ import annotations

from app.eventos_dirigidos.directorio import (
    Destinatario,
    InMemoryDirectorioStore,
    InMemoryUsuarioResolver,
)
from app.eventos_dirigidos.notificaciones_inapp import InMemoryNotificacionInAppStore
from app.eventos_dirigidos.notificador import Notificador
from app.notifications.email import CapturingEmailSender

TENANT = "org-A"


def _solicitud(**over):
    base = {
        "id": "sol_1",
        "mensaje": "Necesito cotización de 5 acoples motor-eje.",
        "tipo_solicitud": "Cotización",
        "fragmento": "Acople motor-eje, número de parte MX-4471.",
        "documento_nombre": "Lista de partes MAXI-10ND",
        "solicitante_nombre": "Jorge Amparán",
        "solicitante_email": "jorge@planta.mx",
    }
    base.update(over)
    return base


def test_externo_email_con_fragmento_y_reply_to():
    directorio = InMemoryDirectorioStore()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="Refaccionaria X",
            email="ventas@refax.mx",
        )
    )
    sender = CapturingEmailSender()
    notif = Notificador(
        directorio_store=directorio,
        inapp_store=InMemoryNotificacionInAppStore(),
        email_sender=sender,
        sleep=lambda s: None,
    )

    res = notif.notificar_solicitud(
        TENANT,
        solicitud=_solicitud(),
        destinatario_id=prov.id,
        reply_to="jorge@planta.mx",
    )

    assert res.entregada and res.email_enviados == 1
    assert len(sender.sent) == 1
    msg = sender.sent[0]
    assert msg.to == "ventas@refax.mx"
    assert msg.reply_to == "jorge@planta.mx"  # respuesta va al solicitante
    assert "MX-4471" in msg.body_text  # cita verbatim del catálogo
    assert "DOCYAN" in msg.body_text  # branding
    # Externo (sin cuenta) NO recibe in-app.
    assert res.inapp_creadas == 0


def test_interno_inapp_persistida():
    directorio = InMemoryDirectorioStore()
    colab = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="colaborador",
            nombre="Compras",
            usuario_id="user-42",
            email="compras@planta.mx",
        )
    )
    resolver = InMemoryUsuarioResolver({(TENANT, "user-42"): ("compras@planta.mx", "es")})
    inapp = InMemoryNotificacionInAppStore()
    notif = Notificador(
        directorio_store=directorio,
        inapp_store=inapp,
        email_sender=CapturingEmailSender(),
        usuario_resolver=resolver,
        sleep=lambda s: None,
    )

    res = notif.notificar_solicitud(TENANT, solicitud=_solicitud(), destinatario_id=colab.id)

    assert res.entregada and res.inapp_creadas == 1
    filas = inapp.listar(TENANT, "user-42")
    assert filas and filas[0].tipo_evento == "solicitud_interna"
    assert filas[0].evento_ref == "sol_1"


def test_safety_bloquea_mensaje_no_administrativo():
    directorio = InMemoryDirectorioStore()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="Prov",
            email="p@x.mx",
        )
    )
    sender = CapturingEmailSender()
    notif = Notificador(
        directorio_store=directorio,
        inapp_store=InMemoryNotificacionInAppStore(),
        email_sender=sender,
        sleep=lambda s: None,
    )

    res = notif.notificar_solicitud(
        TENANT,
        solicitud=_solicitud(mensaje="Suspenda el tratamiento y administre la dosis."),
        destinatario_id=prov.id,
    )

    assert res.bloqueada_por_safety is True
    assert res.entregada is False
    assert sender.sent == []  # nunca se envió por ningún canal
