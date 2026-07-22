"""
ED-1 §4.4 — Motor de notificación.

Creación de alerta → notificación in-app persistida + email invocado (cliente
mockeado); reintento con backoff y fallo definitivo marcado `fallida`;
`safety_validator` rechaza un mensaje no-administrativo y el envío se bloquea.
"""
from __future__ import annotations

from app.alerts.reglas import ReglaAlerta
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.eventos_dirigidos.directorio import (
    Destinatario,
    InMemoryDirectorioStore,
    InMemoryUsuarioResolver,
)
from app.eventos_dirigidos.notificaciones_inapp import InMemoryNotificacionInAppStore
from app.eventos_dirigidos.notificador import Notificador
from app.notifications.email import CapturingEmailSender, EmailSendError

TENANT = "org-ed1"


class FailingEmailSender:
    """Sender que falla `fallos` veces y luego (si queda) tiene éxito."""

    def __init__(self, fallos: int = 99):
        self.fallos = fallos
        self.calls = 0

    def send(self, message):
        self.calls += 1
        if self.calls <= self.fallos:
            raise EmailSendError(f"fallo simulado #{self.calls}")


def _directorio_con_colaborador():
    store = InMemoryDirectorioStore()
    store.crear(Destinatario(
        org_id=TENANT, tipo="colaborador", nombre="Ana", email="ana@lab.mx",
        usuario_id="user-ana", id="dest-ana",
    ))
    resolver = InMemoryUsuarioResolver({(TENANT, "user-ana"): ("ana@lab.mx", "es")})
    return store, resolver


def _regla(canales):
    return ReglaAlerta(tenant_id=TENANT, destinatarios=["dest-ana"], canales=canales)


def _alerta(desc="Certificado de calibración vence el 2026-08-01 (en 10 días)."):
    return {"id": "alert-1", "descripcion": desc, "urgencia": "media",
            "fecha_vencimiento": "2026-08-01", "entidad_id": "ent-1", "dias": 10}


def test_notificacion_crea_inapp_y_llama_email():
    store, resolver = _directorio_con_colaborador()
    inapp = InMemoryNotificacionInAppStore()
    email = CapturingEmailSender()
    fat = FATExtendido(InMemoryFATStore())
    notif = Notificador(directorio_store=store, inapp_store=inapp, email_sender=email,
                        fat=fat, usuario_resolver=resolver, sleep=lambda s: None)

    res = notif.notificar_alerta(TENANT, alerta=_alerta(), regla=_regla(["in_app", "email"]))

    assert res.entregada is True
    assert res.inapp_creadas == 1
    assert res.email_enviados == 1
    # in-app persistida para el usuario interno.
    no_leidas = inapp.listar(TENANT, "user-ana", solo_no_leidas=True)
    assert len(no_leidas) >= 1
    # email realmente invocado con la plantilla.
    assert len(email.sent) == 1
    assert "vence" in email.sent[0].body_text.lower()
    # FAT registró la notificación (familia F10).
    assert len(fat.eventos(TENANT)) >= 1


def test_reintento_backoff_y_fallo_definitivo_marcado():
    store, resolver = _directorio_con_colaborador()
    inapp = InMemoryNotificacionInAppStore()
    email = FailingEmailSender(fallos=99)  # siempre falla
    fat = FATExtendido(InMemoryFATStore())
    notif = Notificador(directorio_store=store, inapp_store=inapp, email_sender=email,
                        fat=fat, usuario_resolver=resolver, sleep=lambda s: None, max_intentos=3)

    res = notif.notificar_alerta(TENANT, alerta=_alerta(), regla=_regla(["email"]))

    assert email.calls == 3  # 3 intentos (backoff)
    assert res.email_enviados == 0
    assert res.email_fallidos == 1
    # la notificación quedó marcada 'fallida' (visible al admin).
    fallidas = inapp.listar_admin(TENANT, estado="fallida")
    assert len(fallidas) == 1
    assert fallidas[0].error is not None


def test_reintento_exitoso_en_segundo_intento():
    store, resolver = _directorio_con_colaborador()
    inapp = InMemoryNotificacionInAppStore()
    email = FailingEmailSender(fallos=1)  # falla 1, éxito al 2º
    notif = Notificador(directorio_store=store, inapp_store=inapp, email_sender=email,
                        usuario_resolver=resolver, sleep=lambda s: None, max_intentos=3)

    res = notif.notificar_alerta(TENANT, alerta=_alerta(), regla=_regla(["email"]))

    assert email.calls == 2
    assert res.email_enviados == 1
    assert res.email_fallidos == 0


def test_safety_validator_bloquea_mensaje_no_administrativo():
    store, resolver = _directorio_con_colaborador()
    inapp = InMemoryNotificacionInAppStore()
    email = CapturingEmailSender()
    notif = Notificador(directorio_store=store, inapp_store=inapp, email_sender=email,
                        usuario_resolver=resolver, sleep=lambda s: None)

    alerta = _alerta(desc="Suspenda el tratamiento del paciente y administre la dosis.")
    res = notif.notificar_alerta(TENANT, alerta=alerta, regla=_regla(["in_app", "email"]))

    assert res.bloqueada_por_safety is True
    assert res.entregada is False
    assert res.inapp_creadas == 0
    assert len(email.sent) == 0  # NADA se envió


def test_email_deshabilitado_sin_proveedor_no_falla():
    store, resolver = _directorio_con_colaborador()
    inapp = InMemoryNotificacionInAppStore()
    notif = Notificador(directorio_store=store, inapp_store=inapp, email_sender=None,
                        usuario_resolver=resolver, sleep=lambda s: None)
    # Solo email, sin proveedor → no envía, no crea fila email, no truena.
    res = notif.notificar_alerta(TENANT, alerta=_alerta(), regla=_regla(["email"]))
    assert res.email_enviados == 0
    assert res.email_fallidos == 0
