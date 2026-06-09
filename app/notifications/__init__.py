"""
Notificaciones salientes de DOCYAN (B13).

Hoy solo correo (invitaciones de usuario). Diseñado pluggable: `EmailSender` es un
Protocol; producción usa SMTP por variables de entorno; los tests inyectan un
`CapturingEmailSender` que registra los envíos en memoria (sin red).
"""
from app.notifications.email import (
    CapturingEmailSender,
    ConsoleEmailSender,
    EmailMessage,
    EmailSender,
    EmailSendError,
    SmtpEmailSender,
    get_email_sender,
)

__all__ = [
    "CapturingEmailSender",
    "ConsoleEmailSender",
    "EmailMessage",
    "EmailSender",
    "EmailSendError",
    "SmtpEmailSender",
    "get_email_sender",
]
