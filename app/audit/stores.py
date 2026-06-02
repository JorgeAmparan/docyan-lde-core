"""
Backends de persistencia del FAT extendido (doc 08 — implementación híbrida, B7).

DOCYAN LDE™ by XCID.

  - SupabaseFATStore : eventos de ALTA FRECUENCIA (F4 consulta, F5 troubleshooting,
    F6 alertas, F9 sistema) → `audit_trail` extendido (migración 013).
  - FalkorFATStore   : eventos CRÍTICOS (F1/F2/F3/F7 — gobernanza y producción) →
    FalkorDB como nodos :EventoFAT enlazados al DKG/DTM.
  - HybridFATStore   : enruta el append por familia y ENTRELAZA ambos lados por
    timestamp para que la cadena de hashes sea GLOBAL por tenant.

El hash chain es global por tenant, no por almacenamiento: `last_hash(tenant_id)`
del híbrido mira el evento más reciente de AMBOS almacenes. El verificador
(integrity_checker) lee `list_for_tenant`, que ya viene entrelazado.

Estos stores hablan con red (Supabase/FalkorDB). Los tests de pura lógica usan
`InMemoryFATStore` (fat_extendido). Los clientes se inyectan para permitir fakes.
"""
from __future__ import annotations

import json
from typing import Any

from app.audit.familias import FAMILIAS_INERTES_MVP, FamiliaFAT
from app.audit.fat_extendido import GENESIS_HASH, EventoFAT, canon_timestamp

# Familias cuyo almacenamiento físico es FalkorDB (críticas, enlazadas al grafo).
# F7 gobernanza es crítica y activa; F1/F2/F3 son críticas e inertes en MVP.
FAMILIAS_CRITICAS_FALKOR: frozenset[FamiliaFAT] = frozenset(
    {FamiliaFAT.F7_GOBERNANZA} | set(FAMILIAS_INERTES_MVP)
)


def _row_from_evento(ev: EventoFAT) -> dict[str, Any]:
    """Mapea un EventoFAT a una fila de `audit_trail` (migración 013)."""
    return {
        "id": ev.evento_id,
        "org_id": ev.tenant_id,
        "created_at": ev.timestamp,
        "component": "FAT",
        "action": ev.tipo_evento,
        "actor": ev.actor_id,
        "tipo_evento": ev.tipo_evento,
        "familia": ev.familia.value,
        "actor_tipo": ev.actor_tipo,
        "entidad_afectada_tipo": ev.entidad_afectada_tipo,
        "entidad_afectada_id": ev.entidad_afectada_id,
        "payload": ev.payload,
        "metadata": ev.metadata,
        "corrige_evento_id": ev.corrige_evento_id,
        "hash_evento": ev.hash_evento,
        "hash_evento_anterior": ev.hash_evento_anterior,
    }


def _evento_from_row(row: dict[str, Any]) -> EventoFAT:
    payload = row.get("payload")
    if isinstance(payload, str):
        payload = json.loads(payload) if payload else {}
    metadata = row.get("metadata")
    if isinstance(metadata, str):
        metadata = json.loads(metadata) if metadata else {}
    return EventoFAT(
        evento_id=str(row.get("id") or row.get("evento_id")),
        tipo_evento=row.get("tipo_evento") or row.get("action") or "",
        familia=FamiliaFAT(row["familia"]),
        timestamp=row.get("created_at") or row.get("timestamp"),
        actor_tipo=row.get("actor_tipo") or "sistema",
        actor_id=row.get("actor") or row.get("actor_id") or "system",
        tenant_id=row.get("org_id") or row.get("tenant_id"),
        payload=payload or {},
        metadata=metadata or {},
        entidad_afectada_tipo=row.get("entidad_afectada_tipo"),
        entidad_afectada_id=row.get("entidad_afectada_id"),
        corrige_evento_id=row.get("corrige_evento_id"),
        hash_evento=row.get("hash_evento") or "",
        hash_evento_anterior=row.get("hash_evento_anterior") or GENESIS_HASH,
    )


class SupabaseFATStore:
    """
    Persistencia en `audit_trail` (Supabase) para familias de alta frecuencia.

    Acepta un cliente Supabase inyectado (testeable con un fake con la misma
    interfaz `.table(...).insert/select/eq/order/execute`). Sin cliente, lo
    construye perezosamente con service_role (igual que TraceabilityMatrix).
    """

    _TABLE = "audit_trail"

    def __init__(self, supabase: Any = None) -> None:
        self._supabase = supabase

    def _client(self) -> Any:
        if self._supabase is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("FAT", service=True)
            self._supabase = create_client(url, key)
        return self._supabase

    def append(self, evento: EventoFAT) -> None:
        self._client().table(self._TABLE).insert(_row_from_evento(evento)).execute()

    def last_hash(self, tenant_id: str) -> str:
        # Solo filas del FAT EXTENDIDO (component="FAT", con hash); las filas
        # legacy de logging plano del MO (component="MO") no entran a la cadena.
        res = (
            self._client()
            .table(self._TABLE)
            .select("hash_evento, created_at")
            .eq("org_id", tenant_id)
            .eq("component", "FAT")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0]["hash_evento"] if rows else GENESIS_HASH

    def list_for_tenant(self, tenant_id: str) -> list[EventoFAT]:
        res = (
            self._client()
            .table(self._TABLE)
            .select("*")
            .eq("org_id", tenant_id)
            .eq("component", "FAT")
            .order("created_at")
            .execute()
        )
        return [_evento_from_row(r) for r in (res.data or [])]

    def delete_eventos(self, evento_ids: list[str]) -> int:
        if not evento_ids:
            return 0
        res = (
            self._client()
            .table(self._TABLE)
            .delete()
            .in_("id", evento_ids)
            .execute()
        )
        return len(res.data or [])


class FalkorFATStore:
    """
    Persistencia en FalkorDB de los eventos críticos como nodos :EventoFAT
    enlazados al DKG/DTM. Usa el DKGClient (multi-tenant por graph_name).

    Las aristas de vinculación (:AFECTA_DOCUMENTO, :AFECTA_SEGMENTO, etc.) se
    crean cuando la entidad afectada existe en el grafo del tenant; las de
    traducción (:AFECTA_SEGMENTO sobre el DTM) se activan con B5.
    """

    _LABEL = "EventoFAT"

    def __init__(self, dkg: Any = None) -> None:
        self._dkg = dkg

    def _client(self) -> Any:
        if self._dkg is None:
            from app.graph.dkg_client import dkg_client

            self._dkg = dkg_client
        return self._dkg

    def append(self, evento: EventoFAT) -> None:
        props = {
            "id": evento.evento_id,
            "tipo_evento": evento.tipo_evento,
            "familia": evento.familia.value,
            "timestamp": evento.timestamp,
            "actor_tipo": evento.actor_tipo,
            "actor_id": evento.actor_id,
            "payload_json": json.dumps(evento.payload, ensure_ascii=False, sort_keys=True),
            "metadata_json": json.dumps(evento.metadata, ensure_ascii=False, sort_keys=True),
            "entidad_afectada_tipo": evento.entidad_afectada_tipo or "",
            "entidad_afectada_id": evento.entidad_afectada_id or "",
            "corrige_evento_id": evento.corrige_evento_id or "",
            "hash_evento": evento.hash_evento,
            "hash_evento_anterior": evento.hash_evento_anterior,
        }
        # :EventoFAT es un nodo de AUDITORÍA, no una entidad de dominio: se escribe
        # con Cypher crudo (confinado al grafo del tenant por `query`), sin pasar
        # por la validación de la ontología DKG (que solo conoce labels de negocio).
        self._client().query(
            evento.tenant_id,
            f"CREATE (e:{self._LABEL}) SET e = $props RETURN e",
            {"props": props},
        )

    def last_hash(self, tenant_id: str) -> str:
        rows = self._client().query(
            tenant_id,
            f"MATCH (e:{self._LABEL}) RETURN e.hash_evento AS h, e.timestamp AS t "
            "ORDER BY t DESC LIMIT 1",
        )
        return rows[0]["h"] if rows else GENESIS_HASH

    def list_for_tenant(self, tenant_id: str) -> list[EventoFAT]:
        rows = self._client().query(
            tenant_id,
            f"MATCH (e:{self._LABEL}) RETURN e AS e ORDER BY e.timestamp",
        )
        eventos: list[EventoFAT] = []
        for r in rows:
            node = r.get("e", r)
            eventos.append(
                EventoFAT(
                    evento_id=node.get("id"),
                    tipo_evento=node.get("tipo_evento", ""),
                    familia=FamiliaFAT(node["familia"]),
                    timestamp=node.get("timestamp"),
                    actor_tipo=node.get("actor_tipo", "sistema"),
                    actor_id=node.get("actor_id", "system"),
                    tenant_id=tenant_id,
                    payload=json.loads(node.get("payload_json") or "{}"),
                    metadata=json.loads(node.get("metadata_json") or "{}"),
                    entidad_afectada_tipo=node.get("entidad_afectada_tipo") or None,
                    entidad_afectada_id=node.get("entidad_afectada_id") or None,
                    corrige_evento_id=node.get("corrige_evento_id") or None,
                    hash_evento=node.get("hash_evento", ""),
                    hash_evento_anterior=node.get("hash_evento_anterior", GENESIS_HASH),
                )
            )
        return eventos

    def delete_eventos(self, evento_ids: list[str]) -> int:
        # Borrado por retención: solo familias críticas con retención cumplida.
        # No implementado en MVP (F7 retención 7 años; nada vence aún). Append-only.
        return 0


class HybridFATStore:
    """
    Store híbrido: enruta el append por familia y entrelaza ambos lados por
    timestamp. La cadena de hashes es GLOBAL por tenant.
    """

    def __init__(self, supabase_store: Any = None, falkor_store: Any = None) -> None:
        self.supabase = supabase_store or SupabaseFATStore()
        self.falkor = falkor_store or FalkorFATStore()

    def _store_for(self, familia: FamiliaFAT) -> Any:
        return self.falkor if familia in FAMILIAS_CRITICAS_FALKOR else self.supabase

    def append(self, evento: EventoFAT) -> None:
        self._store_for(evento.familia).append(evento)

    def last_hash(self, tenant_id: str) -> str:
        eventos = self.list_for_tenant(tenant_id)
        return eventos[-1].hash_evento if eventos else GENESIS_HASH

    def list_for_tenant(self, tenant_id: str) -> list[EventoFAT]:
        eventos = self.supabase.list_for_tenant(tenant_id) + self.falkor.list_for_tenant(
            tenant_id
        )
        # Orden cronológico por INSTANTE canónico (no por string), porque Supabase y
        # FalkorDB pueden devolver el timestamp con formatos distintos del mismo
        # instante. La cadena de hashes se construyó en orden de inserción; leerla
        # en ese mismo orden es lo que valida el verificador de integridad.
        return sorted(eventos, key=lambda e: canon_timestamp(e.timestamp))

    def delete_eventos(self, evento_ids: list[str]) -> int:
        return self.supabase.delete_eventos(evento_ids) + self.falkor.delete_eventos(
            evento_ids
        )
