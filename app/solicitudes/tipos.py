"""
Catálogo `:TipoSolicitud` por tenant (ED-2 §2.1 / Adenda ED §3.1.1).

DOCYAN LDE™ by XCID.

Tipado ABIERTO: los cinco tipos base son semilla, no un catálogo cerrado. El admin
agrega los propios; la opción "Otra" con `etiqueta_libre` convive con los formales
y las etiquetas repetidas se **proponen** al admin para promoverse a un tipo
(taxonomía emergente del uso real — *propone el tipo, jamás la acción*).

Persistencia: tabla Supabase `tipos_solicitud` (migración 026), operada con
service_role (scope por `org_id` en la query). Tests inyectan
`InMemoryTipoSolicitudStore`. Mismo patrón que el Directorio (`directorio.py`).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

#: Umbral de repeticiones de una etiqueta libre para proponerla como tipo (§2.1.3).
UMBRAL_PROMOCION = 3


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TipoSolicitudError(ValueError):
    """Error de validación del catálogo de tipos de solicitud."""


@dataclass
class TipoSolicitud:
    org_id: str
    nombre: str
    #: Slug estable de los tipos semilla; None para los que agrega el admin.
    clave: str | None = None
    #: Campos tipados opcionales: [{clave, etiqueta, tipo, requerido}].
    campos: list[dict] = field(default_factory=list)
    #: Tipos de destinatario sugeridos (proveedor_externo, departamento_interno, colaborador).
    destinatarios_sugeridos: list[str] = field(default_factory=list)
    es_base: bool = False
    activo: bool = True
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "org_id": self.org_id,
            "clave": self.clave,
            "nombre": self.nombre,
            "campos": list(self.campos),
            "destinatarios_sugeridos": list(self.destinatarios_sugeridos),
            "es_base": self.es_base,
            "activo": self.activo,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


# ── Semilla de cinco (§2.1 / Adenda §3.1.1) ───────────────────────────────────
#: `campos` = JSON schema ligero por tipo. `tipo` ∈ text | number | date | textarea.
SEMILLA_BASE: tuple[dict, ...] = (
    {
        "clave": "cotizacion",
        "nombre": "Cotización",
        "campos": [
            {"clave": "cantidad", "etiqueta": "Cantidad", "tipo": "number", "requerido": False},
            {
                "clave": "numero_parte",
                "etiqueta": "Número de parte",
                "tipo": "text",
                "requerido": False,
            },
        ],
        "destinatarios_sugeridos": ["proveedor_externo"],
    },
    {
        "clave": "servicio",
        "nombre": "Servicio",
        "campos": [
            {
                "clave": "fecha_deseada",
                "etiqueta": "Fecha deseada",
                "tipo": "date",
                "requerido": False,
            },
        ],
        "destinatarios_sugeridos": ["proveedor_externo"],
    },
    {
        "clave": "mantenimiento",
        "nombre": "Mantenimiento",
        "campos": [
            {
                "clave": "fecha_deseada",
                "etiqueta": "Fecha deseada",
                "tipo": "date",
                "requerido": False,
            },
        ],
        "destinatarios_sugeridos": ["departamento_interno", "proveedor_externo"],
    },
    {
        "clave": "revision",
        "nombre": "Revisión",
        "campos": [],
        "destinatarios_sugeridos": ["colaborador", "departamento_interno"],
    },
    {
        "clave": "tarea",
        "nombre": "Tarea",
        "campos": [
            {
                "clave": "fecha_limite",
                "etiqueta": "Fecha límite",
                "tipo": "date",
                "requerido": False,
            },
        ],
        "destinatarios_sugeridos": ["departamento_interno", "colaborador"],
    },
)

CLAVES_SEMILLA: frozenset[str] = frozenset(s["clave"] for s in SEMILLA_BASE)


def validar_tipo(nombre: str, campos: list[dict] | None) -> None:
    if not (nombre or "").strip():
        raise TipoSolicitudError("El nombre del tipo es obligatorio.")
    for campo in campos or []:
        if not campo.get("clave") or not campo.get("etiqueta"):
            raise TipoSolicitudError("Cada campo tipado requiere 'clave' y 'etiqueta'.")
        if campo.get("tipo") not in (None, "text", "number", "date", "textarea"):
            raise TipoSolicitudError(f"Tipo de campo inválido: {campo.get('tipo')!r}.")


# ── Almacenes ─────────────────────────────────────────────────────────────────


class TipoSolicitudStore(Protocol):
    def crear(self, t: TipoSolicitud) -> TipoSolicitud: ...
    def listar(self, org_id: str, *, solo_activos: bool = False) -> list[TipoSolicitud]: ...
    def obtener(self, org_id: str, tipo_id: str) -> TipoSolicitud | None: ...
    def obtener_por_clave(self, org_id: str, clave: str) -> TipoSolicitud | None: ...
    def actualizar(self, org_id: str, tipo_id: str, cambios: dict) -> TipoSolicitud | None: ...
    def borrar(self, org_id: str, tipo_id: str) -> bool: ...


@dataclass
class InMemoryTipoSolicitudStore:
    _items: dict[str, TipoSolicitud] = field(default_factory=dict)

    def crear(self, t: TipoSolicitud) -> TipoSolicitud:
        validar_tipo(t.nombre, t.campos)
        self._items[t.id] = t
        return t

    def listar(self, org_id: str, *, solo_activos: bool = False) -> list[TipoSolicitud]:
        out = [t for t in self._items.values() if t.org_id == org_id]
        if solo_activos:
            out = [t for t in out if t.activo]
        return sorted(out, key=lambda t: t.created_at)

    def obtener(self, org_id: str, tipo_id: str) -> TipoSolicitud | None:
        t = self._items.get(tipo_id)
        return t if t and t.org_id == org_id else None

    def obtener_por_clave(self, org_id: str, clave: str) -> TipoSolicitud | None:
        for t in sorted(self._items.values(), key=lambda x: x.created_at):
            if t.org_id == org_id and t.clave == clave:
                return t
        return None

    def actualizar(self, org_id: str, tipo_id: str, cambios: dict) -> TipoSolicitud | None:
        t = self.obtener(org_id, tipo_id)
        if t is None:
            return None
        for k, v in cambios.items():
            if hasattr(t, k) and k not in ("id", "org_id", "created_at", "clave", "es_base"):
                setattr(t, k, v)
        validar_tipo(t.nombre, t.campos)
        t.updated_at = _now_iso()
        return t

    def borrar(self, org_id: str, tipo_id: str) -> bool:
        t = self.obtener(org_id, tipo_id)
        if t is None:
            return False
        del self._items[tipo_id]
        return True


class SupabaseTipoSolicitudStore:
    """Almacén de producción sobre la tabla `tipos_solicitud` (service_role)."""

    def __init__(self, client: Any = None) -> None:
        self._sb = client

    def sb(self) -> Any:
        if self._sb is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("tipos_solicitud", service=True)
            self._sb = create_client(url, key)
        return self._sb

    @staticmethod
    def _row(r: dict) -> TipoSolicitud:
        return TipoSolicitud(
            id=r["id"],
            org_id=r["org_id"],
            clave=r.get("clave"),
            nombre=r["nombre"],
            campos=list(r.get("campos") or []),
            destinatarios_sugeridos=list(r.get("destinatarios_sugeridos") or []),
            es_base=bool(r.get("es_base", False)),
            activo=bool(r.get("activo", True)),
            created_at=r.get("created_at") or _now_iso(),
            updated_at=r.get("updated_at") or _now_iso(),
        )

    def crear(self, t: TipoSolicitud) -> TipoSolicitud:
        validar_tipo(t.nombre, t.campos)
        payload = t.to_dict()
        payload.pop("id", None)
        res = self.sb().table("tipos_solicitud").insert(payload).execute()
        return self._row(res.data[0])

    def listar(self, org_id: str, *, solo_activos: bool = False) -> list[TipoSolicitud]:
        q = self.sb().table("tipos_solicitud").select("*").eq("org_id", org_id)
        if solo_activos:
            q = q.eq("activo", True)
        res = q.order("created_at").execute()
        return [self._row(r) for r in (res.data or [])]

    def obtener(self, org_id: str, tipo_id: str) -> TipoSolicitud | None:
        res = (
            self.sb()
            .table("tipos_solicitud")
            .select("*")
            .eq("org_id", org_id)
            .eq("id", tipo_id)
            .limit(1)
            .execute()
        )
        return self._row(res.data[0]) if res.data else None

    def obtener_por_clave(self, org_id: str, clave: str) -> TipoSolicitud | None:
        res = (
            self.sb()
            .table("tipos_solicitud")
            .select("*")
            .eq("org_id", org_id)
            .eq("clave", clave)
            .order("created_at")
            .limit(1)
            .execute()
        )
        return self._row(res.data[0]) if res.data else None

    def actualizar(self, org_id: str, tipo_id: str, cambios: dict) -> TipoSolicitud | None:
        actual = self.obtener(org_id, tipo_id)
        if actual is None:
            return None
        permitido = {
            k: v
            for k, v in cambios.items()
            if k in ("nombre", "campos", "destinatarios_sugeridos", "activo")
        }
        merged = {**actual.to_dict(), **permitido}
        validar_tipo(merged["nombre"], merged.get("campos"))
        permitido["updated_at"] = _now_iso()
        res = (
            self.sb()
            .table("tipos_solicitud")
            .update(permitido)
            .eq("org_id", org_id)
            .eq("id", tipo_id)
            .execute()
        )
        return self._row(res.data[0]) if res.data else None

    def borrar(self, org_id: str, tipo_id: str) -> bool:
        res = (
            self.sb()
            .table("tipos_solicitud")
            .delete()
            .eq("org_id", org_id)
            .eq("id", tipo_id)
            .execute()
        )
        return bool(res.data)


# ── Semilla + backfill (§2.1) ─────────────────────────────────────────────────


def asegurar_semilla(store: TipoSolicitudStore, org_id: str) -> int:
    """
    Siembra los 5 tipos base para el tenant si faltan. Idempotente por (org, clave):
    sirve tanto al onboarding (tenant nuevo) como al backfill de tenants existentes
    (los que ya tienen algunas claves no se duplican). Devuelve cuántas se crearon.
    """
    existentes = {t.clave for t in store.listar(org_id) if t.clave}
    creadas = 0
    for base in SEMILLA_BASE:
        if base["clave"] in existentes:
            continue
        store.crear(
            TipoSolicitud(
                org_id=org_id,
                clave=base["clave"],
                nombre=base["nombre"],
                campos=list(base["campos"]),
                destinatarios_sugeridos=list(base["destinatarios_sugeridos"]),
                es_base=True,
            )
        )
        creadas += 1
    return creadas
