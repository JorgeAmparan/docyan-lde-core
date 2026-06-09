"""
Envío de correo (B13) — abstracción pluggable.

Producción: `SmtpEmailSender` por variables de entorno (`SMTP_HOST`/`SMTP_PORT`/
`SMTP_USER`/`SMTP_PASSWORD`/`EMAIL_FROM`). Si no hay SMTP configurado, el factory
degrada a `ConsoleEmailSender` (loguea el correo en vez de enviarlo) — útil en
dev y para que el flujo NO se bloquee, dejando explícito que falta credencial.
Tests: `CapturingEmailSender` (en memoria, sin red).
"""
from __future__ import annotations

import logging
import os
import smtplib
from dataclasses import dataclass, field
from email.message import EmailMessage as _MimeMessage
from typing import Protocol

logger = logging.getLogger("docyan.notifications.email")


class EmailSendError(RuntimeError):
    """Fallo real al enviar correo (credencial/servidor). Se reporta específico."""


@dataclass
class EmailMessage:
    to: str
    subject: str
    body_text: str
    body_html: str | None = None


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


def get_email_sender() -> EmailSender | None:
    """
    Factory de producción: SMTP si está configurado; si NO, devuelve `None` (sin
    proveedor de correo).

    Falta de SMTP NO bloquea el flujo de invitación: el llamador (crear_invitacion)
    trata `None` como "no se envió" (`email_enviado=False`) y devuelve igual el
    `invite_url` en la respuesta de la API para reenvío/prueba manual. Cuando se
    configure SMTP (Fly secrets: SMTP_HOST + EMAIL_FROM), el envío real se activa
    sin tocar código.
    """
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
    return None
