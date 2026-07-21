"""
Registro FAT de eventos dirigidos (familia F10).

DOCYAN LDE™ by XCID.

Cada transición del ciclo de vida común (`ciclo_vida`) y cada envío/fallo de
notificación registra un evento en la familia `F10_EVENTO_DIRIGIDO` con la cadena
hash SHA-256 del FAT extendido (doc 08). El store es lazy: en producción escribe al
FAT híbrido (Supabase); en tests se inyecta un `FATExtendido(InMemoryFATStore())`.

Uso:
    from app.eventos_dirigidos.fat import get_fat, registrar_transicion
    fat = get_fat()  # o inyectado
    registrar_transicion(
        fat, tenant_id, evento_tipo="alerta", evento_id="alert_x",
        estado_anterior="notificado", estado_nuevo="reconocido",
        accion="reconocer", actor_id="user-1",
    )
"""
from __future__ import annotations

from typing import Any

from app.audit.familias import FamiliaFAT


def get_fat():
    """FAT extendido de producción (híbrido). Barato de construir (lazy)."""
    from app.audit.fat_extendido import FATExtendido
    from app.audit.stores import HybridFATStore

    return FATExtendido(HybridFATStore())


def registrar_transicion(
    fat: Any,
    tenant_id: str,
    *,
    evento_tipo: str,
    evento_id: str,
    estado_anterior: str | None,
    estado_nuevo: str,
    accion: str | None = None,
    actor_tipo: str = "sistema",
    actor_id: str = "system",
    justificacion: str | None = None,
    extra: dict[str, Any] | None = None,
):
    """
    Registra una transición del ciclo de vida en la familia F10.

    `evento_tipo`: "alerta" (ED-1) o "solicitud" (ED-2). `tipo_evento` FAT queda
    como "evento_dirigido.<evento_tipo>.<estado_nuevo>" para que los reportes por
    familia distingan la especialización sin abrir familias nuevas.
    """
    payload: dict[str, Any] = {
        "evento_tipo": evento_tipo,
        "estado_anterior": estado_anterior,
        "estado_nuevo": estado_nuevo,
    }
    if accion:
        payload["accion"] = accion
    if justificacion:
        payload["justificacion"] = justificacion
    if extra:
        payload.update(extra)

    return fat.registrar(
        tipo_evento=f"evento_dirigido.{evento_tipo}.{estado_nuevo}",
        familia=FamiliaFAT.F10_EVENTO_DIRIGIDO,
        tenant_id=tenant_id,
        actor_tipo=actor_tipo,
        actor_id=actor_id,
        payload=payload,
        entidad_afectada_tipo=evento_tipo,
        entidad_afectada_id=evento_id,
    )


def registrar_notificacion(
    fat: Any,
    tenant_id: str,
    *,
    evento_tipo: str,
    evento_id: str,
    canal: str,
    destinatario_id: str | None,
    exito: bool,
    intento: int = 1,
    error: str | None = None,
    actor_id: str = "system",
):
    """Registra el resultado (éxito/fallo) de un envío de notificación (F10)."""
    estado = "notificado" if exito else "notificacion_fallida"
    payload: dict[str, Any] = {
        "evento_tipo": evento_tipo,
        "canal": canal,
        "destinatario_id": destinatario_id,
        "exito": exito,
        "intento": intento,
    }
    if error:
        payload["error"] = error
    return fat.registrar(
        tipo_evento=f"evento_dirigido.{evento_tipo}.{estado}",
        familia=FamiliaFAT.F10_EVENTO_DIRIGIDO,
        tenant_id=tenant_id,
        actor_tipo="sistema",
        actor_id=actor_id,
        payload=payload,
        entidad_afectada_tipo=evento_tipo,
        entidad_afectada_id=evento_id,
    )
