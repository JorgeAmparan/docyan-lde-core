"""
Modelo `:Solicitud` — persistencia operacional Supabase (ED-2 §2.2 / Adenda ED §3.1).

DOCYAN LDE™ by XCID.

Registro operacional de la solicitud para listados/bandeja, ruteo e inteligencia de
demanda (§2.7). La cara en el GRAFO (nodo `:Solicitud` + arista `:DERIVA_DE` al dato
de origen) la escribe `app.solicitudes.servicio`; aquí solo la fila Supabase (tabla
`solicitudes`, migración 027). Tests inyectan `InMemorySolicitudStore`.

La solicitud HEREDA EL PROVENANCE de la consulta que la originó (documento_id +
span_inicio/fin + fragmento verbatim). El destinatario_id resuelve SIEMPRE contra el
Directorio — jamás un email libre.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from app.eventos_dirigidos import ciclo_vida


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Solicitud:
    org_id: str
    destinatario_id: str
    tipo_id: str | None = None
    tipo_nombre: str | None = None
    etiqueta_libre: str | None = None
    estado: str = ciclo_vida.CREADO
    # Provenance heredado del dato de origen (§2.2).
    dato_origen_nodo_id: str | None = None
    documento_id: str | None = None
    span_inicio: int | None = None
    span_fin: int | None = None
    fragmento: str | None = None
    consulta_id: str | None = None
    # Actores / ruteo.
    solicitante_id: str | None = None
    solicitante_nombre: str | None = None
    solicitante_email: str | None = None
    mensaje: str | None = None
    campos_tipados: dict = field(default_factory=dict)
    entidad_id: str | None = None
    codo_id: str | None = None
    fecha_resolucion: str | None = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    fecha_creacion: str = field(default_factory=_now_iso)
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "org_id": self.org_id,
            "tipo_id": self.tipo_id,
            "tipo_nombre": self.tipo_nombre,
            "etiqueta_libre": self.etiqueta_libre,
            "estado": self.estado,
            "dato_origen_nodo_id": self.dato_origen_nodo_id,
            "documento_id": self.documento_id,
            "span_inicio": self.span_inicio,
            "span_fin": self.span_fin,
            "fragmento": self.fragmento,
            "consulta_id": self.consulta_id,
            "solicitante_id": self.solicitante_id,
            "solicitante_nombre": self.solicitante_nombre,
            "solicitante_email": self.solicitante_email,
            "destinatario_id": self.destinatario_id,
            "mensaje": self.mensaje,
            "campos_tipados": dict(self.campos_tipados),
            "entidad_id": self.entidad_id,
            "codo_id": self.codo_id,
            "fecha_creacion": self.fecha_creacion,
            "fecha_resolucion": self.fecha_resolucion,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class SolicitudStore(Protocol):
    def crear(self, s: Solicitud) -> Solicitud: ...
    def obtener(self, org_id: str, solicitud_id: str) -> Solicitud | None: ...
    def listar_enviadas(
        self,
        org_id: str,
        solicitante_id: str | None,
        *,
        estado: str | None = None,
        tipo_id: str | None = None,
        limit: int = 100,
    ) -> list[Solicitud]: ...
    def listar_recibidas(
        self,
        org_id: str,
        destinatario_ids: list[str],
        *,
        estado: str | None = None,
        tipo_id: str | None = None,
        limit: int = 100,
    ) -> list[Solicitud]: ...
    def actualizar_estado(
        self, org_id: str, solicitud_id: str, estado: str, *, fecha_resolucion: str | None = None
    ) -> Solicitud | None: ...
    def propuestas_promocion(self, org_id: str, umbral: int) -> list[dict]: ...


@dataclass
class InMemorySolicitudStore:
    _items: dict[str, Solicitud] = field(default_factory=dict)

    def crear(self, s: Solicitud) -> Solicitud:
        self._items[s.id] = s
        return s

    def obtener(self, org_id: str, solicitud_id: str) -> Solicitud | None:
        s = self._items.get(solicitud_id)
        return s if s and s.org_id == org_id else None

    def _scope(self, org_id: str) -> list[Solicitud]:
        return sorted(
            (s for s in self._items.values() if s.org_id == org_id),
            key=lambda s: s.fecha_creacion,
            reverse=True,
        )

    @staticmethod
    def _filtrar(items: list[Solicitud], estado, tipo_id) -> list[Solicitud]:
        if estado:
            items = [s for s in items if s.estado == estado]
        if tipo_id:
            items = [s for s in items if s.tipo_id == tipo_id]
        return items

    def listar_enviadas(self, org_id, solicitante_id, *, estado=None, tipo_id=None, limit=100):
        out = self._scope(org_id)
        if solicitante_id is not None:
            out = [s for s in out if s.solicitante_id == solicitante_id]
        return self._filtrar(out, estado, tipo_id)[:limit]

    def listar_recibidas(self, org_id, destinatario_ids, *, estado=None, tipo_id=None, limit=100):
        dset = set(destinatario_ids or [])
        out = [s for s in self._scope(org_id) if s.destinatario_id in dset]
        return self._filtrar(out, estado, tipo_id)[:limit]

    def actualizar_estado(self, org_id, solicitud_id, estado, *, fecha_resolucion=None):
        s = self.obtener(org_id, solicitud_id)
        if s is None:
            return None
        s.estado = estado
        if fecha_resolucion is not None:
            s.fecha_resolucion = fecha_resolucion
        s.updated_at = _now_iso()
        return s

    def propuestas_promocion(self, org_id, umbral):
        conteo: dict[str, int] = {}
        for s in self._scope(org_id):
            if s.etiqueta_libre:
                clave = s.etiqueta_libre.strip().lower()
                conteo[clave] = conteo.get(clave, 0) + 1
        return [
            {"etiqueta_libre": k, "conteo": v}
            for k, v in sorted(conteo.items(), key=lambda kv: kv[1], reverse=True)
            if v >= umbral
        ]


class SupabaseSolicitudStore:
    """Almacén de producción sobre la tabla `solicitudes` (service_role)."""

    def __init__(self, client: Any = None) -> None:
        self._sb = client

    def sb(self) -> Any:
        if self._sb is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("solicitudes", service=True)
            self._sb = create_client(url, key)
        return self._sb

    @staticmethod
    def _row(r: dict) -> Solicitud:
        return Solicitud(
            id=r["id"],
            org_id=r["org_id"],
            tipo_id=r.get("tipo_id"),
            tipo_nombre=r.get("tipo_nombre"),
            etiqueta_libre=r.get("etiqueta_libre"),
            estado=r.get("estado") or ciclo_vida.CREADO,
            dato_origen_nodo_id=r.get("dato_origen_nodo_id"),
            documento_id=r.get("documento_id"),
            span_inicio=r.get("span_inicio"),
            span_fin=r.get("span_fin"),
            fragmento=r.get("fragmento"),
            consulta_id=r.get("consulta_id"),
            solicitante_id=r.get("solicitante_id"),
            solicitante_nombre=r.get("solicitante_nombre"),
            solicitante_email=r.get("solicitante_email"),
            destinatario_id=r["destinatario_id"],
            mensaje=r.get("mensaje"),
            campos_tipados=dict(r.get("campos_tipados") or {}),
            entidad_id=r.get("entidad_id"),
            codo_id=r.get("codo_id"),
            fecha_creacion=r.get("fecha_creacion") or _now_iso(),
            fecha_resolucion=r.get("fecha_resolucion"),
            created_at=r.get("created_at") or _now_iso(),
            updated_at=r.get("updated_at") or _now_iso(),
        )

    def crear(self, s: Solicitud) -> Solicitud:
        payload = s.to_dict()
        payload.pop("id", None)
        res = self.sb().table("solicitudes").insert(payload).execute()
        return self._row(res.data[0])

    def obtener(self, org_id: str, solicitud_id: str) -> Solicitud | None:
        res = (
            self.sb()
            .table("solicitudes")
            .select("*")
            .eq("org_id", org_id)
            .eq("id", solicitud_id)
            .limit(1)
            .execute()
        )
        return self._row(res.data[0]) if res.data else None

    def listar_enviadas(self, org_id, solicitante_id, *, estado=None, tipo_id=None, limit=100):
        q = self.sb().table("solicitudes").select("*").eq("org_id", org_id)
        if solicitante_id is not None:
            q = q.eq("solicitante_id", solicitante_id)
        if estado:
            q = q.eq("estado", estado)
        if tipo_id:
            q = q.eq("tipo_id", tipo_id)
        res = q.order("fecha_creacion", desc=True).limit(limit).execute()
        return [self._row(r) for r in (res.data or [])]

    def listar_recibidas(self, org_id, destinatario_ids, *, estado=None, tipo_id=None, limit=100):
        if not destinatario_ids:
            return []
        q = (
            self.sb()
            .table("solicitudes")
            .select("*")
            .eq("org_id", org_id)
            .in_("destinatario_id", list(destinatario_ids))
        )
        if estado:
            q = q.eq("estado", estado)
        if tipo_id:
            q = q.eq("tipo_id", tipo_id)
        res = q.order("fecha_creacion", desc=True).limit(limit).execute()
        return [self._row(r) for r in (res.data or [])]

    def actualizar_estado(self, org_id, solicitud_id, estado, *, fecha_resolucion=None):
        payload: dict[str, Any] = {"estado": estado, "updated_at": _now_iso()}
        if fecha_resolucion is not None:
            payload["fecha_resolucion"] = fecha_resolucion
        res = (
            self.sb()
            .table("solicitudes")
            .update(payload)
            .eq("org_id", org_id)
            .eq("id", solicitud_id)
            .execute()
        )
        return self._row(res.data[0]) if res.data else None

    def propuestas_promocion(self, org_id, umbral):
        # Agregación de etiquetas libres repetidas (§2.1.3). PostgREST no agrupa;
        # se trae la columna y se cuenta en Python (volumen bajo: solo etiquetas libres).
        res = (
            self.sb()
            .table("solicitudes")
            .select("etiqueta_libre")
            .eq("org_id", org_id)
            .not_.is_("etiqueta_libre", "null")
            .execute()
        )
        conteo: dict[str, int] = {}
        for r in res.data or []:
            et = (r.get("etiqueta_libre") or "").strip().lower()
            if et:
                conteo[et] = conteo.get(et, 0) + 1
        return [
            {"etiqueta_libre": k, "conteo": v}
            for k, v in sorted(conteo.items(), key=lambda kv: kv[1], reverse=True)
            if v >= umbral
        ]
