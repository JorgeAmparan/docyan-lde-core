"""
Motor de notificación único (ED-1 §2.4 / Adenda ED §4).

DOCYAN LDE™ by XCID.

Entrega un evento dirigido (hoy alertas; ED-2 solicitudes) por los canales de la
regla aplicable (email vía Resend + in-app), con:

- **Gate de seguridad obligatorio:** todo mensaje pasa por `safety_validator` ANTES
  de enviarse. Un mensaje con sugerencia clínica/operativa se BLOQUEA (no se envía
  por ningún canal) y se registra en FAT (CLAUDE.md §11.1).
- **Directorio, no email libre:** los destinos se resuelven vía `resolver_destinos`
  contra el Directorio del tenant. El motor jamás acepta un email arbitrario.
- **Entrega y fallos:** email con reintento (backoff, 3 intentos). Fallo definitivo
  → notificación in-app marcada `fallida` (visible al admin) + evento FAT. Registro
  por envío exitoso: arista `[:NOTIFICADO_DE {timestamp, canal}]` + FAT.

El motor NO gestiona el ciclo de vida del `:Alerta` (creado→notificado): eso lo
hace `app.alerts.despacho`, que conoce el store del grafo. Aquí solo se entrega.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.alerts.safety_validator import validar_alerta
from app.eventos_dirigidos import plantillas
from app.eventos_dirigidos.directorio import resolver_destinos
from app.eventos_dirigidos.fat import registrar_notificacion
from app.eventos_dirigidos.notificaciones_inapp import NotificacionInApp
from app.notifications.email import EmailMessage

logger = logging.getLogger("docyan.eventos_dirigidos.notificador")


@dataclass
class ResultadoNotificacion:
    destinos: int = 0
    email_enviados: int = 0
    email_fallidos: int = 0
    inapp_creadas: int = 0
    bloqueada_por_safety: bool = False
    motivo_bloqueo: str | None = None
    entregada: bool = False  # True si al menos un canal entregó algo
    notif_ids: list[str] = field(default_factory=list)


class Notificador:
    def __init__(
        self,
        *,
        directorio_store,
        inapp_store,
        email_sender=None,
        fat=None,
        usuario_resolver=None,
        dkg=None,
        sleep=time.sleep,
        max_intentos: int = 3,
        backoff_base: float = 0.5,
    ) -> None:
        self.directorio = directorio_store
        self.inapp = inapp_store
        self.email_sender = email_sender
        self.fat = fat
        self.usuario_resolver = usuario_resolver
        self.dkg = dkg
        self.sleep = sleep
        self.max_intentos = max_intentos
        self.backoff_base = backoff_base

    # ── API principal ─────────────────────────────────────────────────────────
    def notificar_alerta(
        self,
        tenant_id: str,
        *,
        alerta: dict,
        regla,
        tipo_evento: str = "alerta_vencimiento",
        variables_extra: dict | None = None,
    ) -> ResultadoNotificacion:
        """
        Entrega una alerta a los destinatarios de `regla` por los canales de `regla`.

        `alerta`: dict con al menos `id`, `descripcion`, `urgencia`, `fecha_vencimiento`.
        `regla`: `ReglaAlerta` (usa `.destinatarios`, `.canales`).
        """
        res = ResultadoNotificacion()
        descripcion = str(alerta.get("descripcion") or "")

        # Gate absoluto sobre el hecho administrativo (la variable que podría
        # arrastrar texto decisorio). Si no es admisible, NO se envía nada.
        veredicto = validar_alerta(descripcion)
        if not veredicto.admisible:
            res.bloqueada_por_safety = True
            res.motivo_bloqueo = veredicto.motivo
            logger.warning(
                "notificación BLOQUEADA por safety_validator (tenant=%s alerta=%s): %s",
                tenant_id, alerta.get("id"), veredicto.motivo,
            )
            self._fat_notif(tenant_id, tipo_evento, str(alerta.get("id")), "safety",
                            None, exito=False, error="safety_validator: " + veredicto.motivo)
            return res

        canales = list(getattr(regla, "canales", ["in_app"]) or ["in_app"])
        destinatario_ids = list(getattr(regla, "destinatarios", []) or [])
        destinos = resolver_destinos(
            self.directorio, tenant_id, destinatario_ids,
            usuario_resolver=self.usuario_resolver,
        )
        res.destinos = len(destinos)

        base_vars = {
            "descripcion": descripcion,
            "urgencia": alerta.get("urgencia") or "media",
            "fecha_vencimiento": alerta.get("fecha_vencimiento"),
            "entidad": alerta.get("entidad_id"),
            "dias": alerta.get("dias"),
        }
        if variables_extra:
            base_vars.update(variables_extra)

        for destino in destinos:
            render = plantillas.render(
                tipo_evento, destino.idioma,
                {**base_vars, "nombre_destinatario": destino.nombre},
            )
            # Defensa en profundidad: gate también sobre el texto final renderizado.
            if not validar_alerta(f"{render.asunto}\n{render.cuerpo_texto}").admisible:
                logger.warning("mensaje renderizado no admisible; se omite destino %s", destino.destinatario_id)
                continue

            # Canal in-app (requiere usuario interno).
            if "in_app" in canales and destino.usuario_id:
                notif = self.inapp.crear(NotificacionInApp(
                    org_id=tenant_id,
                    usuario_id=destino.usuario_id,
                    tipo_evento=tipo_evento,
                    evento_ref=str(alerta.get("id")),
                    destinatario_id=destino.destinatario_id,
                    canal="in_app",
                    titulo=render.titulo,
                    cuerpo=render.cuerpo_texto,
                    estado="enviada",
                ))
                res.inapp_creadas += 1
                res.entregada = True
                res.notif_ids.append(notif.id)
                self._edge_notificado(tenant_id, str(alerta.get("id")), destino.destinatario_id, "in_app")
                self._fat_notif(tenant_id, tipo_evento, str(alerta.get("id")), "in_app",
                                destino.destinatario_id, exito=True)

            # Canal email (requiere email + proveedor configurado).
            if "email" in canales and destino.email:
                self._entregar_email(tenant_id, alerta, tipo_evento, destino, render, res)

        return res

    # ── Canal email con reintento/backoff ─────────────────────────────────────
    def _entregar_email(self, tenant_id, alerta, tipo_evento, destino, render, res: ResultadoNotificacion) -> None:
        if self.email_sender is None:
            logger.info("canal email deshabilitado (sin proveedor); se omite %s", destino.email)
            return
        msg = EmailMessage(
            to=destino.email,
            subject=render.asunto,
            body_text=render.cuerpo_texto,
            body_html=render.cuerpo_html,
        )
        exito, error = self._enviar_con_reintento(msg)
        # Fila in-app del envío por email (visible en el listado admin; fallida si aplica).
        notif = self.inapp.crear(NotificacionInApp(
            org_id=tenant_id,
            usuario_id=destino.usuario_id,  # None para externo
            tipo_evento=tipo_evento,
            evento_ref=str(alerta.get("id")),
            destinatario_id=destino.destinatario_id,
            canal="email",
            titulo=render.titulo,
            cuerpo=render.cuerpo_texto,
            estado="enviada" if exito else "fallida",
            error=None if exito else error,
        ))
        res.notif_ids.append(notif.id)
        if exito:
            res.email_enviados += 1
            res.entregada = True
            self._edge_notificado(tenant_id, str(alerta.get("id")), destino.destinatario_id, "email")
            self._fat_notif(tenant_id, tipo_evento, str(alerta.get("id")), "email",
                            destino.destinatario_id, exito=True)
        else:
            res.email_fallidos += 1
            logger.error("email a %s falló definitivamente: %s", destino.email, error)
            self._fat_notif(tenant_id, tipo_evento, str(alerta.get("id")), "email",
                            destino.destinatario_id, exito=False, error=error,
                            intento=self.max_intentos)

    def _enviar_con_reintento(self, msg: EmailMessage) -> tuple[bool, str | None]:
        ultimo_error: str | None = None
        for intento in range(1, self.max_intentos + 1):
            try:
                self.email_sender.send(msg)
                return True, None
            except Exception as exc:  # noqa: BLE001 — cualquier fallo de envío se reintenta.
                ultimo_error = f"{type(exc).__name__}: {exc}"
                if intento < self.max_intentos:
                    self.sleep(self.backoff_base * (2 ** (intento - 1)))
        return False, ultimo_error

    # ── Registro (arista grafo + FAT) ─────────────────────────────────────────
    def _edge_notificado(self, tenant_id: str, alerta_id: str, destinatario_id: str, canal: str) -> None:
        if self.dkg is None:
            return
        try:
            self.dkg.query(
                tenant_id,
                """
                MATCH (a:Alerta {id: $aid})
                MERGE (d:Destinatario {id: $did})
                MERGE (a)-[r:NOTIFICADO_DE {canal: $canal}]->(d)
                SET r.timestamp = $ts
                """,
                {"aid": alerta_id, "did": destinatario_id, "canal": canal,
                 "ts": datetime.now(timezone.utc).isoformat()},
            )
        except Exception as exc:  # noqa: BLE001 — el registro nunca tumba la entrega.
            logger.warning("no se pudo registrar arista NOTIFICADO_DE: %s", type(exc).__name__)

    def _fat_notif(self, tenant_id, tipo_evento, evento_id, canal, destinatario_id, *,
                   exito: bool, error: str | None = None, intento: int = 1) -> None:
        if self.fat is None:
            return
        try:
            registrar_notificacion(
                self.fat, tenant_id, evento_tipo="alerta", evento_id=evento_id,
                canal=canal, destinatario_id=destinatario_id, exito=exito,
                intento=intento, error=error,
            )
        except Exception as exc:  # noqa: BLE001 — el FAT best-effort no tumba la entrega.
            logger.warning("no se pudo registrar FAT de notificación: %s", type(exc).__name__)


def build_notificador(*, dkg=None, sleep=time.sleep) -> Notificador:
    """Notificador de producción (Supabase + Resend + FAT híbrido)."""
    from app.eventos_dirigidos.directorio import SupabaseDirectorioStore, SupabaseUsuarioResolver
    from app.eventos_dirigidos.fat import get_fat
    from app.eventos_dirigidos.notificaciones_inapp import SupabaseNotificacionInAppStore
    from app.notifications.email import get_email_sender

    return Notificador(
        directorio_store=SupabaseDirectorioStore(),
        inapp_store=SupabaseNotificacionInAppStore(),
        email_sender=get_email_sender(),
        fat=get_fat(),
        usuario_resolver=SupabaseUsuarioResolver(),
        dkg=dkg,
        sleep=sleep,
    )
