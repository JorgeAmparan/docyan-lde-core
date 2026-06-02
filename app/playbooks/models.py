"""
Modelos y almacén de la mecánica de Playbooks (B8 §B).

DOCYAN LDE™ by XCID.

Define los enums del dominio, el `PlaybookStore` (Protocol) y dos backends con la
disciplina del repo (budget_manager/session_manager): `InMemoryPlaybookStore`
(tests) y `SupabasePlaybookStore` (producción, RLS por tenant, SERVICE_KEY).

El almacén cubre las 5 tablas de la migración 014 (`consultas_guardadas`,
`playbooks`, `playbook_pasos`, `sugerencias_playbook`,
`patrones_rechazados_por_usuario`) más las señales que el generador de Nivel C
necesita. La señal conductual (≥3 disparos en ventana móvil) se deriva de un log
de disparos guardado en `consultas_guardadas.metadata.disparos_log` (jsonb) — sin
tabla extra, idéntico en ambos backends.
"""
from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Protocol


class TipoCreacionPlaybook(str, Enum):
    usuario_manual = "usuario_manual"
    precargado_vertical = "precargado_vertical"
    sugerencia_edb_aceptada = "sugerencia_edb_aceptada"


class TipoSugerencia(str, Enum):
    pedagogica = "pedagogica"
    inteligencia = "inteligencia"


class EstadoSugerencia(str, Enum):
    propuesta = "propuesta"
    aceptada = "aceptada"
    rechazada = "rechazada"
    ignorada = "ignorada"
    accion_aplicada = "accion_aplicada"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


# Tope del log de disparos guardado en metadata (suficiente para una ventana 30d).
DISPAROS_LOG_MAX = 200


class PlaybookStore(Protocol):
    # Consultas guardadas (Nivel A)
    def crear_consulta(self, row: dict) -> dict: ...
    def obtener_consulta(self, tenant_id: str, consulta_id: str) -> dict | None: ...
    def listar_consultas(self, tenant_id: str, user_id: str) -> list[dict]: ...
    def actualizar_consulta(self, tenant_id: str, consulta_id: str, updates: dict) -> dict | None: ...
    def soft_delete_consulta(self, tenant_id: str, consulta_id: str) -> bool: ...
    def registrar_disparo_consulta(self, tenant_id: str, consulta_id: str, ts: str) -> dict | None: ...

    # Playbooks (Nivel B)
    def crear_playbook(self, row: dict, pasos: list[dict]) -> dict: ...
    def obtener_playbook(self, tenant_id: str, playbook_id: str) -> dict | None: ...
    def listar_playbooks(self, tenant_id: str) -> list[dict]: ...
    def listar_pasos(self, playbook_id: str) -> list[dict]: ...
    def reemplazar_pasos(self, playbook_id: str, pasos: list[dict]) -> list[dict]: ...
    def actualizar_playbook(self, tenant_id: str, playbook_id: str, updates: dict) -> dict | None: ...
    def soft_delete_playbook(self, tenant_id: str, playbook_id: str) -> bool: ...
    def registrar_disparo_playbook(self, tenant_id: str, playbook_id: str, ts: str) -> dict | None: ...
    def pasos_usando_consulta(self, consulta_id: str) -> list[dict]: ...
    def contar_playbooks_usuario(self, tenant_id: str, user_id: str) -> int: ...

    # Sugerencias (Nivel C)
    def crear_sugerencia(self, row: dict) -> dict: ...
    def obtener_sugerencia(self, tenant_id: str, sugerencia_id: str) -> dict | None: ...
    def listar_sugerencias(self, tenant_id: str, user_id: str, estado: str | None = None) -> list[dict]: ...
    def actualizar_sugerencia(self, tenant_id: str, sugerencia_id: str, updates: dict) -> dict | None: ...

    # Aprendizaje del rechazo (Nivel C)
    def registrar_rechazo(self, tenant_id: str, user_id: str, firma: str, ts: str) -> dict: ...
    def conteo_rechazos(self, tenant_id: str, user_id: str, firma: str) -> int: ...

    # Señales para el generador
    def usuarios_con_consultas(self, tenant_id: str) -> list[str]: ...
    def disparos_en_ventana(self, tenant_id: str, user_id: str, entidad_id: str, desde_iso: str) -> int: ...


class InMemoryPlaybookStore:
    """Backend en memoria (tests). Mantiene las 5 colecciones + log de disparos."""

    def __init__(self) -> None:
        self._consultas: list[dict] = []
        self._playbooks: list[dict] = []
        self._pasos: list[dict] = []
        self._sugerencias: list[dict] = []
        self._rechazos: list[dict] = []

    # ── Consultas ─────────────────────────────────────────────────────────────
    def crear_consulta(self, row: dict) -> dict:
        rec = copy.deepcopy(row)
        rec.setdefault("id", new_id())
        rec.setdefault("metadata", {})
        rec.setdefault("disparos_totales", 0)
        rec.setdefault("ultimo_disparo_at", None)
        rec.setdefault("deleted_at", None)
        rec.setdefault("created_at", now_iso())
        rec.setdefault("updated_at", rec["created_at"])
        self._consultas.append(rec)
        return copy.deepcopy(rec)

    def _find_consulta(self, tenant_id: str, consulta_id: str) -> dict | None:
        for c in self._consultas:
            if c["id"] == consulta_id and c["tenant_id"] == tenant_id and not c["deleted_at"]:
                return c
        return None

    def obtener_consulta(self, tenant_id: str, consulta_id: str) -> dict | None:
        c = self._find_consulta(tenant_id, consulta_id)
        return copy.deepcopy(c) if c else None

    def listar_consultas(self, tenant_id: str, user_id: str) -> list[dict]:
        return [
            copy.deepcopy(c) for c in self._consultas
            if c["tenant_id"] == tenant_id and c["user_id"] == user_id and not c["deleted_at"]
        ]

    def actualizar_consulta(self, tenant_id: str, consulta_id: str, updates: dict) -> dict | None:
        c = self._find_consulta(tenant_id, consulta_id)
        if c is None:
            return None
        for k, v in updates.items():
            if k not in ("id", "tenant_id"):
                c[k] = v
        c["updated_at"] = now_iso()
        return copy.deepcopy(c)

    def soft_delete_consulta(self, tenant_id: str, consulta_id: str) -> bool:
        c = self._find_consulta(tenant_id, consulta_id)
        if c is None:
            return False
        c["deleted_at"] = now_iso()
        return True

    def registrar_disparo_consulta(self, tenant_id: str, consulta_id: str, ts: str) -> dict | None:
        c = self._find_consulta(tenant_id, consulta_id)
        if c is None:
            return None
        c["disparos_totales"] = (c.get("disparos_totales") or 0) + 1
        c["ultimo_disparo_at"] = ts
        log = list((c.get("metadata") or {}).get("disparos_log", []))
        log.append(ts)
        c.setdefault("metadata", {})["disparos_log"] = log[-DISPAROS_LOG_MAX:]
        return copy.deepcopy(c)

    # ── Playbooks ─────────────────────────────────────────────────────────────
    def crear_playbook(self, row: dict, pasos: list[dict]) -> dict:
        rec = copy.deepcopy(row)
        rec.setdefault("id", new_id())
        rec.setdefault("disparos_totales", 0)
        rec.setdefault("ultimo_disparo_at", None)
        rec.setdefault("deleted_at", None)
        rec.setdefault("created_at", now_iso())
        self._playbooks.append(rec)
        self.reemplazar_pasos(rec["id"], pasos)
        return copy.deepcopy(rec)

    def _find_playbook(self, tenant_id: str, playbook_id: str) -> dict | None:
        for p in self._playbooks:
            if p["id"] == playbook_id and p["tenant_id"] == tenant_id and not p["deleted_at"]:
                return p
        return None

    def obtener_playbook(self, tenant_id: str, playbook_id: str) -> dict | None:
        p = self._find_playbook(tenant_id, playbook_id)
        return copy.deepcopy(p) if p else None

    def listar_playbooks(self, tenant_id: str) -> list[dict]:
        return [copy.deepcopy(p) for p in self._playbooks
                if p["tenant_id"] == tenant_id and not p["deleted_at"]]

    def listar_pasos(self, playbook_id: str) -> list[dict]:
        pasos = [copy.deepcopy(s) for s in self._pasos if s["playbook_id"] == playbook_id]
        return sorted(pasos, key=lambda s: s["orden"])

    def reemplazar_pasos(self, playbook_id: str, pasos: list[dict]) -> list[dict]:
        self._pasos = [s for s in self._pasos if s["playbook_id"] != playbook_id]
        nuevos: list[dict] = []
        for s in pasos:
            rec = copy.deepcopy(s)
            rec.setdefault("id", new_id())
            rec["playbook_id"] = playbook_id
            self._pasos.append(rec)
            nuevos.append(copy.deepcopy(rec))
        return sorted(nuevos, key=lambda s: s["orden"])

    def actualizar_playbook(self, tenant_id: str, playbook_id: str, updates: dict) -> dict | None:
        p = self._find_playbook(tenant_id, playbook_id)
        if p is None:
            return None
        for k, v in updates.items():
            if k not in ("id", "tenant_id"):
                p[k] = v
        return copy.deepcopy(p)

    def soft_delete_playbook(self, tenant_id: str, playbook_id: str) -> bool:
        p = self._find_playbook(tenant_id, playbook_id)
        if p is None:
            return False
        p["deleted_at"] = now_iso()
        return True

    def registrar_disparo_playbook(self, tenant_id: str, playbook_id: str, ts: str) -> dict | None:
        p = self._find_playbook(tenant_id, playbook_id)
        if p is None:
            return None
        p["disparos_totales"] = (p.get("disparos_totales") or 0) + 1
        p["ultimo_disparo_at"] = ts
        return copy.deepcopy(p)

    def pasos_usando_consulta(self, consulta_id: str) -> list[dict]:
        activos = {p["id"] for p in self._playbooks if not p["deleted_at"]}
        return [copy.deepcopy(s) for s in self._pasos
                if s["consulta_guardada_id"] == consulta_id and s["playbook_id"] in activos]

    def contar_playbooks_usuario(self, tenant_id: str, user_id: str) -> int:
        return len([p for p in self._playbooks
                    if p["tenant_id"] == tenant_id and p.get("creado_por_user_id") == user_id
                    and not p["deleted_at"]])

    # ── Sugerencias ───────────────────────────────────────────────────────────
    def crear_sugerencia(self, row: dict) -> dict:
        rec = copy.deepcopy(row)
        rec.setdefault("id", new_id())
        rec.setdefault("estado", EstadoSugerencia.propuesta.value)
        rec.setdefault("created_at", now_iso())
        rec.setdefault("decidido_at", None)
        self._sugerencias.append(rec)
        return copy.deepcopy(rec)

    def _find_sugerencia(self, tenant_id: str, sugerencia_id: str) -> dict | None:
        for s in self._sugerencias:
            if s["id"] == sugerencia_id and s["tenant_id"] == tenant_id:
                return s
        return None

    def obtener_sugerencia(self, tenant_id: str, sugerencia_id: str) -> dict | None:
        s = self._find_sugerencia(tenant_id, sugerencia_id)
        return copy.deepcopy(s) if s else None

    def listar_sugerencias(self, tenant_id: str, user_id: str, estado: str | None = None) -> list[dict]:
        out = [copy.deepcopy(s) for s in self._sugerencias
               if s["tenant_id"] == tenant_id and s["user_id"] == user_id
               and (estado is None or s["estado"] == estado)]
        return out

    def actualizar_sugerencia(self, tenant_id: str, sugerencia_id: str, updates: dict) -> dict | None:
        s = self._find_sugerencia(tenant_id, sugerencia_id)
        if s is None:
            return None
        for k, v in updates.items():
            if k not in ("id", "tenant_id"):
                s[k] = v
        return copy.deepcopy(s)

    # ── Rechazos ──────────────────────────────────────────────────────────────
    def registrar_rechazo(self, tenant_id: str, user_id: str, firma: str, ts: str) -> dict:
        for r in self._rechazos:
            if r["tenant_id"] == tenant_id and r["user_id"] == user_id and r["firma_patron"] == firma:
                r["conteo_rechazos"] += 1
                r["ultimo_rechazo_at"] = ts
                return copy.deepcopy(r)
        rec = {
            "id": new_id(), "tenant_id": tenant_id, "user_id": user_id,
            "firma_patron": firma, "conteo_rechazos": 1, "ultimo_rechazo_at": ts,
        }
        self._rechazos.append(rec)
        return copy.deepcopy(rec)

    def conteo_rechazos(self, tenant_id: str, user_id: str, firma: str) -> int:
        for r in self._rechazos:
            if r["tenant_id"] == tenant_id and r["user_id"] == user_id and r["firma_patron"] == firma:
                return r["conteo_rechazos"]
        return 0

    # ── Señales ───────────────────────────────────────────────────────────────
    def usuarios_con_consultas(self, tenant_id: str) -> list[str]:
        return sorted({c["user_id"] for c in self._consultas
                       if c["tenant_id"] == tenant_id and not c["deleted_at"] and c.get("user_id")})

    def disparos_en_ventana(self, tenant_id: str, user_id: str, entidad_id: str, desde_iso: str) -> int:
        total = 0
        for c in self._consultas:
            if (c["tenant_id"] == tenant_id and c["user_id"] == user_id
                    and not c["deleted_at"] and c.get("entidad_referenciada_id") == entidad_id):
                for ts in (c.get("metadata") or {}).get("disparos_log", []):
                    if ts >= desde_iso:
                        total += 1
        return total


# ── Backend Supabase (producción) ──────────────────────────────────────────────


class SupabasePlaybookStore:
    """
    Backend real sobre Supabase (RLS por tenant, SUPABASE_SERVICE_KEY). Mismo
    contrato que InMemoryPlaybookStore. Construcción perezosa del cliente.
    """

    T_CONSULTAS = "consultas_guardadas"
    T_PLAYBOOKS = "playbooks"
    T_PASOS = "playbook_pasos"
    T_SUGERENCIAS = "sugerencias_playbook"
    T_RECHAZOS = "patrones_rechazados_por_usuario"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("playbooks", service=True)
            self._client = create_client(url, key)
        return self._client

    # ── Consultas ─────────────────────────────────────────────────────────────
    def crear_consulta(self, row: dict) -> dict:
        rec = dict(row)
        rec.setdefault("id", new_id())
        res = self._sb().table(self.T_CONSULTAS).insert(rec).execute()
        return res.data[0] if res.data else rec

    def obtener_consulta(self, tenant_id: str, consulta_id: str) -> dict | None:
        res = (self._sb().table(self.T_CONSULTAS).select("*")
               .eq("id", consulta_id).eq("tenant_id", tenant_id)
               .is_("deleted_at", "null").limit(1).execute())
        return res.data[0] if res.data else None

    def listar_consultas(self, tenant_id: str, user_id: str) -> list[dict]:
        res = (self._sb().table(self.T_CONSULTAS).select("*")
               .eq("tenant_id", tenant_id).eq("user_id", user_id)
               .is_("deleted_at", "null").order("created_at").execute())
        return res.data or []

    def actualizar_consulta(self, tenant_id: str, consulta_id: str, updates: dict) -> dict | None:
        upd = {**updates, "updated_at": now_iso()}
        res = (self._sb().table(self.T_CONSULTAS).update(upd)
               .eq("id", consulta_id).eq("tenant_id", tenant_id).execute())
        return res.data[0] if res.data else None

    def soft_delete_consulta(self, tenant_id: str, consulta_id: str) -> bool:
        res = (self._sb().table(self.T_CONSULTAS).update({"deleted_at": now_iso()})
               .eq("id", consulta_id).eq("tenant_id", tenant_id).execute())
        return bool(res.data)

    def registrar_disparo_consulta(self, tenant_id: str, consulta_id: str, ts: str) -> dict | None:
        c = self.obtener_consulta(tenant_id, consulta_id)
        if c is None:
            return None
        log = list((c.get("metadata") or {}).get("disparos_log", []))
        log.append(ts)
        metadata = {**(c.get("metadata") or {}), "disparos_log": log[-DISPAROS_LOG_MAX:]}
        return self.actualizar_consulta(tenant_id, consulta_id, {
            "disparos_totales": (c.get("disparos_totales") or 0) + 1,
            "ultimo_disparo_at": ts, "metadata": metadata,
        })

    # ── Playbooks ─────────────────────────────────────────────────────────────
    def crear_playbook(self, row: dict, pasos: list[dict]) -> dict:
        rec = dict(row)
        rec.setdefault("id", new_id())
        res = self._sb().table(self.T_PLAYBOOKS).insert(rec).execute()
        created = res.data[0] if res.data else rec
        self.reemplazar_pasos(created["id"], pasos)
        return created

    def obtener_playbook(self, tenant_id: str, playbook_id: str) -> dict | None:
        res = (self._sb().table(self.T_PLAYBOOKS).select("*")
               .eq("id", playbook_id).eq("tenant_id", tenant_id)
               .is_("deleted_at", "null").limit(1).execute())
        return res.data[0] if res.data else None

    def listar_playbooks(self, tenant_id: str) -> list[dict]:
        res = (self._sb().table(self.T_PLAYBOOKS).select("*")
               .eq("tenant_id", tenant_id).is_("deleted_at", "null").order("created_at").execute())
        return res.data or []

    def listar_pasos(self, playbook_id: str) -> list[dict]:
        res = (self._sb().table(self.T_PASOS).select("*")
               .eq("playbook_id", playbook_id).order("orden").execute())
        return res.data or []

    def reemplazar_pasos(self, playbook_id: str, pasos: list[dict]) -> list[dict]:
        self._sb().table(self.T_PASOS).delete().eq("playbook_id", playbook_id).execute()
        filas = []
        for s in pasos:
            rec = dict(s)
            rec.setdefault("id", new_id())
            rec["playbook_id"] = playbook_id
            filas.append(rec)
        if filas:
            res = self._sb().table(self.T_PASOS).insert(filas).execute()
            return sorted(res.data or filas, key=lambda s: s["orden"])
        return []

    def actualizar_playbook(self, tenant_id: str, playbook_id: str, updates: dict) -> dict | None:
        res = (self._sb().table(self.T_PLAYBOOKS).update(dict(updates))
               .eq("id", playbook_id).eq("tenant_id", tenant_id).execute())
        return res.data[0] if res.data else None

    def soft_delete_playbook(self, tenant_id: str, playbook_id: str) -> bool:
        res = (self._sb().table(self.T_PLAYBOOKS).update({"deleted_at": now_iso()})
               .eq("id", playbook_id).eq("tenant_id", tenant_id).execute())
        return bool(res.data)

    def registrar_disparo_playbook(self, tenant_id: str, playbook_id: str, ts: str) -> dict | None:
        p = self.obtener_playbook(tenant_id, playbook_id)
        if p is None:
            return None
        return self.actualizar_playbook(tenant_id, playbook_id, {
            "disparos_totales": (p.get("disparos_totales") or 0) + 1, "ultimo_disparo_at": ts,
        })

    def pasos_usando_consulta(self, consulta_id: str) -> list[dict]:
        res = (self._sb().table(self.T_PASOS).select("*, playbooks!inner(deleted_at)")
               .eq("consulta_guardada_id", consulta_id).execute())
        return [r for r in (res.data or [])
                if not (r.get("playbooks") or {}).get("deleted_at")]

    def contar_playbooks_usuario(self, tenant_id: str, user_id: str) -> int:
        res = (self._sb().table(self.T_PLAYBOOKS).select("id", count="exact")
               .eq("tenant_id", tenant_id).eq("creado_por_user_id", user_id)
               .is_("deleted_at", "null").execute())
        return res.count or 0

    # ── Sugerencias ───────────────────────────────────────────────────────────
    def crear_sugerencia(self, row: dict) -> dict:
        rec = dict(row)
        rec.setdefault("id", new_id())
        res = self._sb().table(self.T_SUGERENCIAS).insert(rec).execute()
        return res.data[0] if res.data else rec

    def obtener_sugerencia(self, tenant_id: str, sugerencia_id: str) -> dict | None:
        res = (self._sb().table(self.T_SUGERENCIAS).select("*")
               .eq("id", sugerencia_id).eq("tenant_id", tenant_id).limit(1).execute())
        return res.data[0] if res.data else None

    def listar_sugerencias(self, tenant_id: str, user_id: str, estado: str | None = None) -> list[dict]:
        q = (self._sb().table(self.T_SUGERENCIAS).select("*")
             .eq("tenant_id", tenant_id).eq("user_id", user_id))
        if estado:
            q = q.eq("estado", estado)
        return q.order("created_at").execute().data or []

    def actualizar_sugerencia(self, tenant_id: str, sugerencia_id: str, updates: dict) -> dict | None:
        res = (self._sb().table(self.T_SUGERENCIAS).update(dict(updates))
               .eq("id", sugerencia_id).eq("tenant_id", tenant_id).execute())
        return res.data[0] if res.data else None

    # ── Rechazos ──────────────────────────────────────────────────────────────
    def registrar_rechazo(self, tenant_id: str, user_id: str, firma: str, ts: str) -> dict:
        existing = (self._sb().table(self.T_RECHAZOS).select("*")
                    .eq("tenant_id", tenant_id).eq("user_id", user_id)
                    .eq("firma_patron", firma).limit(1).execute())
        if existing.data:
            row = existing.data[0]
            res = (self._sb().table(self.T_RECHAZOS).update({
                "conteo_rechazos": (row.get("conteo_rechazos") or 0) + 1, "ultimo_rechazo_at": ts,
            }).eq("id", row["id"]).execute())
            return res.data[0] if res.data else row
        rec = {"id": new_id(), "tenant_id": tenant_id, "user_id": user_id,
               "firma_patron": firma, "conteo_rechazos": 1, "ultimo_rechazo_at": ts}
        res = self._sb().table(self.T_RECHAZOS).insert(rec).execute()
        return res.data[0] if res.data else rec

    def conteo_rechazos(self, tenant_id: str, user_id: str, firma: str) -> int:
        res = (self._sb().table(self.T_RECHAZOS).select("conteo_rechazos")
               .eq("tenant_id", tenant_id).eq("user_id", user_id)
               .eq("firma_patron", firma).limit(1).execute())
        return (res.data[0]["conteo_rechazos"] if res.data else 0)

    # ── Señales ───────────────────────────────────────────────────────────────
    def usuarios_con_consultas(self, tenant_id: str) -> list[str]:
        res = (self._sb().table(self.T_CONSULTAS).select("user_id")
               .eq("tenant_id", tenant_id).is_("deleted_at", "null").execute())
        return sorted({r["user_id"] for r in (res.data or []) if r.get("user_id")})

    def disparos_en_ventana(self, tenant_id: str, user_id: str, entidad_id: str, desde_iso: str) -> int:
        res = (self._sb().table(self.T_CONSULTAS).select("metadata")
               .eq("tenant_id", tenant_id).eq("user_id", user_id)
               .eq("entidad_referenciada_id", entidad_id).is_("deleted_at", "null").execute())
        total = 0
        for r in (res.data or []):
            for ts in ((r.get("metadata") or {}).get("disparos_log", [])):
                if ts >= desde_iso:
                    total += 1
        return total
