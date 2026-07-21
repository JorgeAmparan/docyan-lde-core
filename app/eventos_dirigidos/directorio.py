"""
Directorio de Destinatarios del tenant (ED-1 §2.5 / Adenda ED §5).

DOCYAN LDE™ by XCID.

Guardrail canónico: **el admin da de alta, el operador solo selecciona.** Ningún
path de envío acepta un email libre — solo un `destinatario_id` que resuelve contra
este directorio. Alimenta `ReglaAlerta` (alertas) y, en ED-2, el selector de
solicitudes.

Persistencia: tabla Supabase `destinatarios` (migración 023), operada con
service_role (scope por `org_id` en la query, no por RLS). Tests inyectan
`InMemoryDirectorioStore`.

La RESOLUCIÓN (destinatario_id → destinos concretos por canal) expande:
- `proveedor_externo`   → un destino con email (sin cuenta DOCYAN → sin in-app).
- `colaborador`         → un destino con email + usuario_id (email + in-app).
- `departamento_interno`→ N destinos, uno por usuario miembro (email + in-app).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

TIPOS_VALIDOS: frozenset[str] = frozenset(
    {"proveedor_externo", "departamento_interno", "colaborador"}
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DirectorioError(ValueError):
    """Error de validación del directorio (tipo/email inválido, etc.)."""


@dataclass
class Destinatario:
    org_id: str
    tipo: str
    nombre: str
    email: str | None = None
    empresa: str | None = None
    usuario_id: str | None = None
    miembros: list[str] = field(default_factory=list)
    categorias: list[str] = field(default_factory=list)
    activo: bool = True
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "org_id": self.org_id,
            "tipo": self.tipo,
            "nombre": self.nombre,
            "email": self.email,
            "empresa": self.empresa,
            "usuario_id": self.usuario_id,
            "miembros": list(self.miembros),
            "categorias": list(self.categorias),
            "activo": self.activo,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class Destino:
    """Un endpoint concreto de notificación tras resolver un destinatario."""

    destinatario_id: str
    nombre: str
    email: str | None = None
    usuario_id: str | None = None
    idioma: str = "es"


def validar_destinatario(tipo: str, email: str | None, usuario_id: str | None) -> None:
    """Valida coherencia tipo↔campos. Lanza `DirectorioError`."""
    if tipo not in TIPOS_VALIDOS:
        raise DirectorioError(
            f"tipo inválido: {tipo!r} (válidos: {', '.join(sorted(TIPOS_VALIDOS))})"
        )
    if tipo == "proveedor_externo":
        if not (email or "").strip():
            raise DirectorioError("proveedor_externo requiere email.")
        if "@" not in email:
            raise DirectorioError(f"email inválido: {email!r}")
    if tipo == "colaborador" and not (usuario_id or "").strip():
        raise DirectorioError("colaborador requiere usuario_id.")


# ── Resolución de usuarios (user_id → email/idioma) ───────────────────────────


class UsuarioResolver(Protocol):
    def resolver(self, org_id: str, usuario_id: str) -> tuple[str | None, str] | None:
        """Devuelve (email, idioma) del usuario, o None si no existe en el tenant."""
        ...


@dataclass
class InMemoryUsuarioResolver:
    #: {(org_id, usuario_id): (email, idioma)}
    usuarios: dict[tuple[str, str], tuple[str | None, str]] = field(default_factory=dict)

    def resolver(self, org_id: str, usuario_id: str) -> tuple[str | None, str] | None:
        return self.usuarios.get((org_id, usuario_id))


class SupabaseUsuarioResolver:
    """Resuelve user_id → (email, idioma) desde la tabla `users` (service_role)."""

    def __init__(self, client: Any = None) -> None:
        self._sb = client

    def sb(self) -> Any:
        if self._sb is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("directorio", service=True)
            self._sb = create_client(url, key)
        return self._sb

    def resolver(self, org_id: str, usuario_id: str) -> tuple[str | None, str] | None:
        res = (
            self.sb()
            .table("users")
            .select("email, idioma")
            .eq("id", usuario_id)
            .eq("org_id", org_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        row = res.data[0]
        return row.get("email"), (row.get("idioma") or "es")


# ── Almacenes ─────────────────────────────────────────────────────────────────


class DirectorioStore(Protocol):
    def crear(self, d: Destinatario) -> Destinatario: ...
    def listar(self, org_id: str, *, solo_activos: bool = False) -> list[Destinatario]: ...
    def obtener(self, org_id: str, destinatario_id: str) -> Destinatario | None: ...
    def actualizar(self, org_id: str, destinatario_id: str, cambios: dict) -> Destinatario | None: ...
    def borrar(self, org_id: str, destinatario_id: str) -> bool: ...


@dataclass
class InMemoryDirectorioStore:
    _items: dict[str, Destinatario] = field(default_factory=dict)

    def crear(self, d: Destinatario) -> Destinatario:
        validar_destinatario(d.tipo, d.email, d.usuario_id)
        self._items[d.id] = d
        return d

    def listar(self, org_id: str, *, solo_activos: bool = False) -> list[Destinatario]:
        out = [d for d in self._items.values() if d.org_id == org_id]
        if solo_activos:
            out = [d for d in out if d.activo]
        return sorted(out, key=lambda d: d.created_at)

    def obtener(self, org_id: str, destinatario_id: str) -> Destinatario | None:
        d = self._items.get(destinatario_id)
        return d if d and d.org_id == org_id else None

    def actualizar(self, org_id: str, destinatario_id: str, cambios: dict) -> Destinatario | None:
        d = self.obtener(org_id, destinatario_id)
        if d is None:
            return None
        for k, v in cambios.items():
            if hasattr(d, k) and k not in ("id", "org_id", "created_at"):
                setattr(d, k, v)
        validar_destinatario(d.tipo, d.email, d.usuario_id)
        d.updated_at = _now_iso()
        return d

    def borrar(self, org_id: str, destinatario_id: str) -> bool:
        d = self.obtener(org_id, destinatario_id)
        if d is None:
            return False
        del self._items[destinatario_id]
        return True


class SupabaseDirectorioStore:
    """Almacén de producción sobre la tabla `destinatarios` (service_role)."""

    def __init__(self, client: Any = None) -> None:
        self._sb = client

    def sb(self) -> Any:
        if self._sb is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("directorio", service=True)
            self._sb = create_client(url, key)
        return self._sb

    @staticmethod
    def _row_to_dest(row: dict) -> Destinatario:
        return Destinatario(
            id=row["id"],
            org_id=row["org_id"],
            tipo=row["tipo"],
            nombre=row["nombre"],
            email=row.get("email"),
            empresa=row.get("empresa"),
            usuario_id=row.get("usuario_id"),
            miembros=list(row.get("miembros") or []),
            categorias=list(row.get("categorias") or []),
            activo=bool(row.get("activo", True)),
            created_at=row.get("created_at") or _now_iso(),
            updated_at=row.get("updated_at") or _now_iso(),
        )

    def crear(self, d: Destinatario) -> Destinatario:
        validar_destinatario(d.tipo, d.email, d.usuario_id)
        payload = d.to_dict()
        payload.pop("id", None)  # deja que Postgres genere el uuid
        res = self.sb().table("destinatarios").insert(payload).execute()
        return self._row_to_dest(res.data[0])

    def listar(self, org_id: str, *, solo_activos: bool = False) -> list[Destinatario]:
        q = self.sb().table("destinatarios").select("*").eq("org_id", org_id)
        if solo_activos:
            q = q.eq("activo", True)
        res = q.order("created_at").execute()
        return [self._row_to_dest(r) for r in (res.data or [])]

    def obtener(self, org_id: str, destinatario_id: str) -> Destinatario | None:
        res = (
            self.sb()
            .table("destinatarios")
            .select("*")
            .eq("org_id", org_id)
            .eq("id", destinatario_id)
            .limit(1)
            .execute()
        )
        return self._row_to_dest(res.data[0]) if res.data else None

    def actualizar(self, org_id: str, destinatario_id: str, cambios: dict) -> Destinatario | None:
        actual = self.obtener(org_id, destinatario_id)
        if actual is None:
            return None
        permitido = {
            k: v
            for k, v in cambios.items()
            if k in ("tipo", "nombre", "email", "empresa", "usuario_id", "miembros", "categorias", "activo")
        }
        merged = {**actual.to_dict(), **permitido}
        validar_destinatario(merged["tipo"], merged.get("email"), merged.get("usuario_id"))
        permitido["updated_at"] = _now_iso()
        res = (
            self.sb()
            .table("destinatarios")
            .update(permitido)
            .eq("org_id", org_id)
            .eq("id", destinatario_id)
            .execute()
        )
        return self._row_to_dest(res.data[0]) if res.data else None

    def borrar(self, org_id: str, destinatario_id: str) -> bool:
        res = (
            self.sb()
            .table("destinatarios")
            .delete()
            .eq("org_id", org_id)
            .eq("id", destinatario_id)
            .execute()
        )
        return bool(res.data)


# ── Resolución destinatario_id → destinos concretos ───────────────────────────


def resolver_destinos(
    store: DirectorioStore,
    org_id: str,
    destinatario_ids: list[str],
    *,
    usuario_resolver: UsuarioResolver | None = None,
    idioma_default: str = "es",
) -> list[Destino]:
    """
    Expande una lista de `destinatario_id` a destinos concretos por persona.

    Un departamento se expande a un destino por miembro. Un colaborador/proveedor a
    uno. Los `destinatario_id` que no existen en el tenant se ignoran (el ruteo no
    inventa destinos). Nunca acepta ni produce un email fuera del directorio.
    """
    destinos: list[Destino] = []
    vistos: set[tuple[str | None, str | None]] = set()

    def _add(dest: Destino) -> None:
        clave = (dest.email, dest.usuario_id)
        if clave in vistos or (dest.email is None and dest.usuario_id is None):
            return
        vistos.add(clave)
        destinos.append(dest)

    for did in destinatario_ids:
        d = store.obtener(org_id, did)
        if d is None or not d.activo:
            continue
        if d.tipo == "proveedor_externo":
            _add(Destino(destinatario_id=d.id, nombre=d.nombre, email=d.email, idioma=idioma_default))
        elif d.tipo == "colaborador":
            email, idioma = d.email, idioma_default
            if usuario_resolver and d.usuario_id:
                resuelto = usuario_resolver.resolver(org_id, d.usuario_id)
                if resuelto is not None:
                    email = resuelto[0] or email
                    idioma = resuelto[1] or idioma
            _add(Destino(destinatario_id=d.id, nombre=d.nombre, email=email, usuario_id=d.usuario_id, idioma=idioma))
        elif d.tipo == "departamento_interno":
            for uid in d.miembros:
                email, idioma = None, idioma_default
                if usuario_resolver:
                    resuelto = usuario_resolver.resolver(org_id, uid)
                    if resuelto is not None:
                        email, idioma = resuelto[0], (resuelto[1] or idioma_default)
                _add(Destino(destinatario_id=d.id, nombre=f"{d.nombre}:{uid}", email=email, usuario_id=uid, idioma=idioma))
    return destinos
