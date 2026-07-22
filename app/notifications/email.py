"""
Envío de correo — abstracción pluggable con proveedor ÚNICO (ED-1 §2.4 / Adenda ED §4).

Producción: **Resend** (decisión cerrada julio 2026) vía `ResendEmailSender` cuando
existe `RESEND_API_KEY`. Absorbe también las invitaciones de onboarding — un solo
proveedor. Fallback al SMTP actual (`SmtpEmailSender`) si solo hay `SMTP_HOST`; si
no hay nada, el factory devuelve `None` (canal deshabilitado con log claro, NO
excepción) para que el flujo no se bloquee, dejando explícito que falta credencial.
Tests: `CapturingEmailSender` (en memoria, sin red).

Regla ED-0 permanente: todo cliente de red nace con timeouts explícitos
(`ResendEmailSender` usa `httpx` con `timeout=`; `SmtpEmailSender` con `timeout=`).
"""
from __future__ import annotations

import logging
import os
import smtplib
from dataclasses import dataclass, field
from email.message import EmailMessage as _MimeMessage
from typing import Protocol

logger = logging.getLogger("docyan.notifications.email")

# Timeouts del cliente HTTP de Resend (ED-0: ningún cliente de red sin timeout).
RESEND_TIMEOUT_S = float(os.getenv("RESEND_TIMEOUT_S", "10"))
RESEND_CONNECT_TIMEOUT_S = float(os.getenv("RESEND_CONNECT_TIMEOUT_S", "5"))
RESEND_API_URL = "https://api.resend.com/emails"
# Con `onboarding@resend.dev` Resend solo entrega al dueño de la cuenta — suficiente
# para verificar el sprint; el dominio propio es prerequisito de pilotos, no de ED-1.
RESEND_FROM_DEFAULT = "onboarding@resend.dev"


class EmailSendError(RuntimeError):
    """Fallo real al enviar correo (credencial/servidor). Se reporta específico."""


@dataclass
class EmailMessage:
    to: str
    subject: str
    body_text: str
    body_html: str | None = None
    # Reply-to: para solicitudes a externos (ED-2) la respuesta va al solicitante.
    reply_to: str | None = None


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


@dataclass
class CapturingEmailSender:
    """Registra los correos en memoria (tests). No envía nada."""

    sent: list[EmailMessage] = field(default_factory=list)

    def send(self, message: EmailMessage) -> None:
        self.sent.append(message)


class ConsoleEmailSender:
    """Loguea el correo en vez de enviarlo (dev / fallback sin SMTP configurado)."""

    def send(self, message: EmailMessage) -> None:
        logger.warning(
            "[EMAIL no enviado: SMTP no configurado] to=%s subject=%r\n%s",
            message.to, message.subject, message.body_text,
        )


class SmtpEmailSender:
    """Envía por SMTP (TLS). Config por entorno; lazy — no conecta hasta `send`."""

    def __init__(
        self,
        host: str,
        port: int,
        user: str | None,
        password: str | None,
        sender: str,
        use_tls: bool = True,
    ) -> None:
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.sender = sender
        self.use_tls = use_tls

    def send(self, message: EmailMessage) -> None:
        mime = _MimeMessage()
        mime["From"] = self.sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.body_text)
        if message.body_html:
            mime.add_alternative(message.body_html, subtype="html")
        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
                if self.use_tls:
                    smtp.starttls()
                if self.user and self.password:
                    smtp.login(self.user, self.password)
                smtp.send_message(mime)
        except (smtplib.SMTPException, OSError) as exc:
            raise EmailSendError(
                f"Fallo al enviar correo vía SMTP {self.host}:{self.port}: {exc}"
            ) from exc


class ResendEmailSender:
    """
    Envía por la API HTTP de Resend (decisión cerrada). `httpx` con timeouts
    explícitos (ED-0). Lazy: no crea el cliente HTTP hasta el primer `send`.
    """

    def __init__(self, api_key: str, sender: str, *, api_url: str = RESEND_API_URL) -> None:
        self.api_key = api_key
        self.sender = sender
        self.api_url = api_url

    def send(self, message: EmailMessage) -> None:
        import httpx

        body: dict = {
            "from": self.sender,
            "to": [message.to],
            "subject": message.subject,
            "text": message.body_text,
        }
        if message.body_html:
            body["html"] = message.body_html
        if message.reply_to:
            body["reply_to"] = message.reply_to
        try:
            resp = httpx.post(
                self.api_url,
                json=body,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=httpx.Timeout(RESEND_TIMEOUT_S, connect=RESEND_CONNECT_TIMEOUT_S),
            )
        except httpx.HTTPError as exc:
            raise EmailSendError(f"Fallo de red al enviar vía Resend: {exc}") from exc
        if resp.status_code >= 400:
            raise EmailSendError(
                f"Resend rechazó el envío ({resp.status_code}): {resp.text[:300]}"
            )


def get_email_sender() -> EmailSender | None:
    """
    Factory de producción con proveedor ÚNICO (ED-1 §2.4):

    1. `RESEND_API_KEY` presente → `ResendEmailSender` (from = `EMAIL_FROM` o el
       default `onboarding@resend.dev`). Es el camino de producción.
    2. Solo `SMTP_HOST` (+ `EMAIL_FROM`/`SMTP_USER`) → `SmtpEmailSender` (fallback).
    3. Nada configurado → `None` (canal deshabilitado, log claro; NO excepción).

    Devolver `None` NO bloquea el flujo: el llamador (invitaciones de onboarding,
    motor de notificación de alertas) lo trata como "no se envió" y sigue. Cuando se
    configure el secret en Fly, el envío real se activa sin tocar código.
    """
    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        sender = os.getenv("EMAIL_FROM") or RESEND_FROM_DEFAULT
        return ResendEmailSender(resend_key, sender)

    host = os.getenv("SMTP_HOST")
    sender = os.getenv("EMAIL_FROM") or os.getenv("SMTP_USER")
    if host and sender:
        return SmtpEmailSender(
            host=host,
            port=int(os.getenv("SMTP_PORT", "587")),
            user=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASSWORD"),
            sender=sender,
            use_tls=os.getenv("SMTP_USE_TLS", "true").lower() != "false",
        )

    logger.info("Sin proveedor de correo (ni RESEND_API_KEY ni SMTP_HOST) — canal email deshabilitado.")
    return None
