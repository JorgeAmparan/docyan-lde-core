"""
FAT extendido — EventoFAT + cadena criptográfica SHA-256 (doc 08, B7).

DOCYAN LDE™ by XCID.

Evoluciona `app/core/matrix.py` (logging plano) a un FAT inmutable, append-only,
con hash chain GLOBAL por tenant. Preserva el `audit_trail` existente (las
columnas nuevas son aditivas, migración 013) y NO recrea la trazabilidad: la
extiende.

Algoritmo de hash (doc 08, exacto):

    hash_evento = SHA-256(
        evento_id || timestamp || tipo_evento || payload || hash_evento_anterior
    )

donde `||` es concatenación de las representaciones canónicas, separadas por el
carácter ASCII Unit Separator (0x1f) para que ningún contenido del payload pueda
falsificar un límite de campo. `payload` se serializa como JSON canónico
(`sort_keys`, separadores compactos, `ensure_ascii=False`). El primer evento de
un tenant (génesis) usa `hash_evento_anterior = ""`.

Cada evento lleva el hash del anterior del MISMO tenant → cadena verificable:
alterar un evento intermedio rompe la cadena en todos los posteriores.

Inmutabilidad append-only: los eventos NO se modifican ni eliminan (salvo la
rutina de retención, que purga vencidos con backup verificado). Una corrección es
un NUEVO evento con `corrige_evento_id` apuntando al original.

Implementación física híbrida (doc 08):
  - Eventos críticos (F1/F2/F3/F7) → FalkorDB como :EventoFAT enlazado al DKG/DTM.
  - Eventos de alta frecuencia (F4/F5/F6/F9) → Supabase `audit_trail` extendido.
El hash chain es global por tenant: el FATExtendido pide `last_hash(tenant_id)` al
store antes de cada append, sin importar dónde se almacene físicamente. El store
híbrido entrelaza ambos lados por timestamp.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from app.audit.familias import FamiliaFAT

# Separador de campos en la base del hash. ASCII Unit Separator: jamás aparece en
# JSON serializado ni en UUIDs/timestamps ISO, así que ningún payload puede
# fabricar un límite de campo falso.
_SEP = "\x1f"

#: Valor de `hash_evento_anterior` del primer evento de un tenant (génesis).
GENESIS_HASH = ""


def _payload_canonico(payload: dict[str, Any]) -> str:
    """JSON canónico determinista del payload (orden estable, compacto)."""
    return json.dumps(
        payload or {},
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def compute_hash_evento(
    *,
    evento_id: str,
    timestamp: str,
    tipo_evento: str,
    payload: dict[str, Any],
    hash_evento_anterior: str,
) -> str:
    """
    Calcula el SHA-256 de un evento según el algoritmo exacto del doc 08.

    Es una función PURA: mismas entradas → mismo hash. El verificador de
    integridad la reusa para detectar alteraciones (recálculo ≠ almacenado).
    """
    base = _SEP.join(
        [
            evento_id,
            timestamp,
            tipo_evento,
            _payload_canonico(payload),
            hash_evento_anterior or GENESIS_HASH,
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _now_iso() -> str:
    """Timestamp ISO 8601 con tz (UTC). Aislado para inyección en tests."""
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class EventoFAT:
    """
    Un evento del FAT (nodo :EventoFAT del doc 08).

    `evento_id` mapea a `audit_trail.id`; `timestamp` a `created_at`; `tenant_id`
    a `org_id`; `actor_id` a `actor` en el store Supabase. `hash_evento` se
    calcula al construir vía `FATExtendido.registrar`.
    """

    evento_id: str
    tipo_evento: str
    familia: FamiliaFAT
    timestamp: str
    actor_tipo: str
    actor_id: str
    tenant_id: str
    payload: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    entidad_afectada_tipo: str | None = None
    entidad_afectada_id: str | None = None
    corrige_evento_id: str | None = None
    hash_evento: str = ""
    hash_evento_anterior: str = GENESIS_HASH

    def recompute_hash(self) -> str:
        """Recalcula el hash del evento desde sus campos (para verificación)."""
        return compute_hash_evento(
            evento_id=self.evento_id,
            timestamp=self.timestamp,
            tipo_evento=self.tipo_evento,
            payload=self.payload,
            hash_evento_anterior=self.hash_evento_anterior,
        )

    def hash_valido(self) -> bool:
        """True si el hash almacenado coincide con el recalculado (no alterado)."""
        return self.hash_evento == self.recompute_hash()

    def to_dict(self) -> dict[str, Any]:
        d = {
            "evento_id": self.evento_id,
            "tipo_evento": self.tipo_evento,
            "familia": self.familia.value,
            "timestamp": self.timestamp,
            "actor_tipo": self.actor_tipo,
            "actor_id": self.actor_id,
            "tenant_id": self.tenant_id,
            "payload": self.payload,
            "metadata": self.metadata,
            "entidad_afectada_tipo": self.entidad_afectada_tipo,
            "entidad_afectada_id": self.entidad_afectada_id,
            "corrige_evento_id": self.corrige_evento_id,
            "hash_evento": self.hash_evento,
            "hash_evento_anterior": self.hash_evento_anterior,
        }
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> EventoFAT:
        return cls(
            evento_id=d["evento_id"],
            tipo_evento=d["tipo_evento"],
            familia=FamiliaFAT(d["familia"]),
            timestamp=d["timestamp"],
            actor_tipo=d.get("actor_tipo", "sistema"),
            actor_id=d.get("actor_id", "system"),
            tenant_id=d["tenant_id"],
            payload=d.get("payload") or {},
            metadata=d.get("metadata") or {},
            entidad_afectada_tipo=d.get("entidad_afectada_tipo"),
            entidad_afectada_id=d.get("entidad_afectada_id"),
            corrige_evento_id=d.get("corrige_evento_id"),
            hash_evento=d.get("hash_evento", ""),
            hash_evento_anterior=d.get("hash_evento_anterior", GENESIS_HASH),
        )


class FATStore(Protocol):
    """
    Backend de persistencia del FAT. La cadena es GLOBAL por tenant: el store
    debe devolver el último hash y los eventos del tenant en orden cronológico,
    sin importar la implementación física (Supabase, FalkorDB o híbrido).
    """

    def append(self, evento: EventoFAT) -> None: ...

    def last_hash(self, tenant_id: str) -> str: ...

    def list_for_tenant(self, tenant_id: str) -> list[EventoFAT]: ...

    def delete_eventos(self, evento_ids: list[str]) -> int: ...


@dataclass
class InMemoryFATStore:
    """Backend en memoria para tests. La cadena por tenant se mantiene en orden."""

    _por_tenant: dict[str, list[EventoFAT]] = field(default_factory=dict)

    def append(self, evento: EventoFAT) -> None:
        self._por_tenant.setdefault(evento.tenant_id, []).append(evento)

    def last_hash(self, tenant_id: str) -> str:
        eventos = self._por_tenant.get(tenant_id) or []
        return eventos[-1].hash_evento if eventos else GENESIS_HASH

    def list_for_tenant(self, tenant_id: str) -> list[EventoFAT]:
        # Orden cronológico estable (timestamp; desempate por orden de inserción).
        eventos = list(self._por_tenant.get(tenant_id) or [])
        return sorted(eventos, key=lambda e: e.timestamp)

    def delete_eventos(self, evento_ids: list[str]) -> int:
        ids = set(evento_ids)
        borrados = 0
        for tenant_id, eventos in self._por_tenant.items():
            antes = len(eventos)
            self._por_tenant[tenant_id] = [e for e in eventos if e.evento_id not in ids]
            borrados += antes - len(self._por_tenant[tenant_id])
        return borrados

    # Helpers solo-tests para simular intrusión / huecos.
    def _replace(self, evento: EventoFAT) -> None:
        eventos = self._por_tenant.get(evento.tenant_id) or []
        for i, e in enumerate(eventos):
            if e.evento_id == evento.evento_id:
                eventos[i] = evento
                return


class FATExtendido:
    """
    Fachada del FAT extendido. Construye eventos con hash chain y los persiste.

    `registrar(...)` es el único punto de creación: genera `evento_id`/`timestamp`
    (inyectables para tests deterministas), encadena con `last_hash(tenant_id)`,
    calcula el SHA-256 y persiste. Inmutable: nunca edita; `corregir(...)` crea un
    nuevo evento que apunta al original.
    """

    def __init__(self, store: FATStore | None = None) -> None:
        self.store: FATStore = store or InMemoryFATStore()

    def registrar(
        self,
        *,
        tipo_evento: str,
        familia: FamiliaFAT,
        tenant_id: str,
        actor_tipo: str = "sistema",
        actor_id: str = "system",
        payload: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        entidad_afectada_tipo: str | None = None,
        entidad_afectada_id: str | None = None,
        corrige_evento_id: str | None = None,
        evento_id: str | None = None,
        timestamp: str | None = None,
    ) -> EventoFAT:
        """Crea, encadena y persiste un evento. Devuelve el evento con su hash."""
        eid = evento_id or str(uuid.uuid4())
        ts = timestamp or _now_iso()
        prev = self.store.last_hash(tenant_id)
        pl = payload or {}
        h = compute_hash_evento(
            evento_id=eid,
            timestamp=ts,
            tipo_evento=tipo_evento,
            payload=pl,
            hash_evento_anterior=prev,
        )
        evento = EventoFAT(
            evento_id=eid,
            tipo_evento=tipo_evento,
            familia=familia,
            timestamp=ts,
            actor_tipo=actor_tipo,
            actor_id=actor_id,
            tenant_id=tenant_id,
            payload=pl,
            metadata=metadata or {},
            entidad_afectada_tipo=entidad_afectada_tipo,
            entidad_afectada_id=entidad_afectada_id,
            corrige_evento_id=corrige_evento_id,
            hash_evento=h,
            hash_evento_anterior=prev,
        )
        self.store.append(evento)
        return evento

    def corregir(
        self,
        *,
        evento_original_id: str,
        tipo_evento: str,
        familia: FamiliaFAT,
        tenant_id: str,
        actor_tipo: str = "sistema",
        actor_id: str = "system",
        payload: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        timestamp: str | None = None,
    ) -> EventoFAT:
        """
        Registra una CORRECCIÓN: un evento nuevo apuntando al original vía
        `corrige_evento_id`. El original queda intacto (inmutabilidad).
        """
        return self.registrar(
            tipo_evento=tipo_evento,
            familia=familia,
            tenant_id=tenant_id,
            actor_tipo=actor_tipo,
            actor_id=actor_id,
            payload=payload,
            metadata=metadata,
            corrige_evento_id=evento_original_id,
            timestamp=timestamp,
        )

    def eventos(self, tenant_id: str) -> list[EventoFAT]:
        """Cadena cronológica del tenant."""
        return self.store.list_for_tenant(tenant_id)

    def reconstruir_estado_en(
        self, tenant_id: str, entidad_id: str, timestamp: str
    ) -> dict[str, Any]:
        """
        Reconstruye el estado de una entidad en un punto del tiempo recorriendo los
        eventos del FAT hasta `timestamp` (inclusive).

        Convención: un evento que afecta a la entidad puede traer en su payload una
        clave `estado_set` (dict) que se fusiona en orden cronológico. Las
        correcciones (`corrige_evento_id`) sobreescriben el estado del original. El
        resultado incluye el estado fusionado y la traza de eventos aplicados.
        """
        aplicados: list[dict[str, Any]] = []
        estado: dict[str, Any] = {}
        for ev in self.eventos(tenant_id):
            if ev.entidad_afectada_id != entidad_id:
                continue
            if ev.timestamp > timestamp:
                break
            delta = ev.payload.get("estado_set")
            if isinstance(delta, dict):
                estado.update(delta)
            aplicados.append(
                {
                    "evento_id": ev.evento_id,
                    "tipo_evento": ev.tipo_evento,
                    "timestamp": ev.timestamp,
                    "corrige": ev.corrige_evento_id,
                }
            )
        return {
            "tenant_id": tenant_id,
            "entidad_id": entidad_id,
            "timestamp": timestamp,
            "estado": estado,
            "eventos_aplicados": aplicados,
            "total_eventos_aplicados": len(aplicados),
        }
