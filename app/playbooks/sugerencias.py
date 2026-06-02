"""
Nivel C — Objeto vivo enriquecido por IA (el foso) (B8 §B3).

DOCYAN LDE™ by XCID.

El EDB observa patrones de uso ya registrados (consultas guardadas +
`:EventoOperativo` + disparos de Playbooks) y propone Playbooks nuevos. La
aparición de una `:SugerenciaPlaybook` exige la COMPUERTA DE TRES SEÑALES
SIMULTÁNEAS (doc de visión):

  1. Estructural — ≥2 consultas guardadas del usuario tocan la MISMA entidad
     operativa (detección por entidad: la conservadora del MVP1).
  2. Conductual — el usuario disparó ese patrón ≥3 veces en una ventana móvil de
     30 días (configurable por tenant).
  3. Permiso — `permiso_ia_proactiva = true` en el perfil del usuario.

Dos tipos que NO se colapsan:
  - **Pedagógica**: "existe algo llamado Playbook, ¿quieres crear uno?". Andamio
    de descubrimiento. CADUCA cuando el usuario ya tiene ≥1 Playbook formal.
  - **Inteligencia**: "detecté que repites esta secuencia, ¿la formalizo?". NO
    caduca; listón más alto (misma entidad operativa, no solo misma sesión).

Aprendizaje del rechazo LOCAL: al rechazar (o ignorar) una sugerencia, se sube el
listón de evidencia para ESE patrón (su firma), no para todos — así el sistema
deja de insistir con lo rechazado sin volverse sordo a patrones nuevos. El experto
es el techo: `silenciar_sugerencias` apaga las pedagógicas y eleva el listón de
las de inteligencia.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from app.playbooks.models import (
    EstadoSugerencia,
    PlaybookStore,
    TipoCreacionPlaybook,
    TipoSugerencia,
    now_iso,
)
from app.playbooks.perfil import PerfilProvider
from app.playbooks.playbooks_core import PlaybooksService

# Ventana móvil (días) y umbral conductual base de la compuerta.
VENTANA_DIAS = 30
DISPAROS_MIN = 3
# Penalización de evidencia por cada rechazo previo de ESE patrón (sube el listón).
RECHAZO_PENALIZACION = 2
# El experto silenciado eleva el listón de las de inteligencia.
INTELIGENCIA_SILENCIADO_EXTRA = 2
# Estados que indican que el patrón ya fue atendido (no re-proponer).
_ESTADOS_RESUELTOS = {EstadoSugerencia.aceptada.value, EstadoSugerencia.accion_aplicada.value}


def firma_patron(user_id: str, entidad_id: str, consulta_ids: list[str]) -> str:
    """Firma estable de un patrón (usuario + entidad + conjunto de consultas)."""
    base = f"{user_id}|{entidad_id}|{'|'.join(sorted(consulta_ids))}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:32]


class SugerenciasService:
    """Generador de Nivel C + ciclo de vida de las sugerencias."""

    def __init__(self, store: PlaybookStore, perfil: PerfilProvider) -> None:
        self.store = store
        self.perfil = perfil
        self.playbooks = PlaybooksService(store)

    # ── Generador (tarea programada `evaluacion_patrones_edb_para_n3`) ─────────

    def evaluar_tenant(self, tenant_id: str, ahora: datetime | None = None) -> list[dict]:
        """Evalúa la compuerta por usuario/patrón y emite sugerencias. Idempotente."""
        ahora = ahora or datetime.now(timezone.utc)
        desde_iso = (ahora - timedelta(days=VENTANA_DIAS)).isoformat()
        generadas: list[dict] = []

        for user_id in self.store.usuarios_con_consultas(tenant_id):
            # Caducidad pedagógica: si ya tiene Playbook formal, expira pendientes.
            self.caducar_pedagogicas(tenant_id, user_id)

            permiso = self.perfil.permiso_ia_proactiva(tenant_id, user_id)
            silenciado = self.perfil.silenciar_sugerencias(tenant_id, user_id)
            tiene_playbook = self.store.contar_playbooks_usuario(tenant_id, user_id) > 0

            for entidad_id, grupo in self._grupos_por_entidad(tenant_id, user_id).items():
                # 1. Señal estructural.
                if len(grupo) < 2:
                    continue
                consulta_ids = sorted(c["id"] for c in grupo)
                firma = firma_patron(user_id, entidad_id, consulta_ids)
                if self._ya_atendida(tenant_id, user_id, firma):
                    continue
                # 3. Señal de permiso (sin permiso, no hay sugerencia proactiva).
                if not permiso:
                    continue
                # 2. Señal conductual (≥ umbral, ajustado por rechazos y tipo).
                disparos = self.store.disparos_en_ventana(tenant_id, user_id, entidad_id, desde_iso)
                penal = RECHAZO_PENALIZACION * self.store.conteo_rechazos(tenant_id, user_id, firma)

                if not tiene_playbook and not silenciado:
                    tipo = TipoSugerencia.pedagogica
                    umbral = DISPAROS_MIN + penal
                else:
                    tipo = TipoSugerencia.inteligencia
                    umbral = DISPAROS_MIN + penal + (INTELIGENCIA_SILENCIADO_EXTRA if silenciado else 0)

                if disparos < umbral:
                    continue

                # Las tres señales se cumplen → se genera la sugerencia.
                sug = self.store.crear_sugerencia(
                    {
                        "tenant_id": tenant_id,
                        "user_id": user_id,
                        "tipo_sugerencia": tipo.value,
                        "consulta_guardada_ids": consulta_ids,
                        "evidencia_estructural": {
                            "entidad_id": entidad_id,
                            "firma": firma,
                            "consultas": consulta_ids,
                            "n_consultas": len(grupo),
                        },
                        "evidencia_conductual": {
                            "disparos_ventana": disparos,
                            "ventana_dias": VENTANA_DIAS,
                            "umbral_aplicado": umbral,
                        },
                    }
                )
                generadas.append(sug)
        return generadas

    def _grupos_por_entidad(self, tenant_id: str, user_id: str) -> dict[str, list[dict]]:
        grupos: dict[str, list[dict]] = {}
        for c in self.store.listar_consultas(tenant_id, user_id):
            eid = c.get("entidad_referenciada_id")
            if eid:
                grupos.setdefault(eid, []).append(c)
        return grupos

    def _ya_atendida(self, tenant_id: str, user_id: str, firma: str) -> bool:
        """True si hay una sugerencia PENDIENTE o ya RESUELTA con esa firma."""
        for s in self.store.listar_sugerencias(tenant_id, user_id):
            if (s.get("evidencia_estructural") or {}).get("firma") != firma:
                continue
            if s["estado"] == EstadoSugerencia.propuesta.value:
                return True
            if s["estado"] in _ESTADOS_RESUELTOS:
                return True
        return False

    def caducar_pedagogicas(self, tenant_id: str, user_id: str) -> int:
        """
        Caducidad pedagógica: si el usuario ya tiene ≥1 Playbook formal, las
        pedagógicas pendientes se marcan `ignorada` (caducadas). Devuelve cuántas.
        """
        if self.store.contar_playbooks_usuario(tenant_id, user_id) == 0:
            return 0
        caducadas = 0
        for s in self.store.listar_sugerencias(
            tenant_id, user_id, estado=EstadoSugerencia.propuesta.value
        ):
            if s["tipo_sugerencia"] == TipoSugerencia.pedagogica.value:
                self.store.actualizar_sugerencia(
                    tenant_id, s["id"],
                    {"estado": EstadoSugerencia.ignorada.value, "decidido_at": now_iso()},
                )
                caducadas += 1
        return caducadas

    # ── Ciclo de vida ─────────────────────────────────────────────────────────

    def listar_pendientes(self, tenant_id: str, user_id: str) -> list[dict]:
        return self.store.listar_sugerencias(
            tenant_id, user_id, estado=EstadoSugerencia.propuesta.value
        )

    def aceptar(self, tenant_id: str, sugerencia_id: str, user_id: str, nombre: str | None = None) -> dict:
        """Acepta: crea el Playbook con tipo_creacion='sugerencia_edb_aceptada'."""
        sug = self.store.obtener_sugerencia(tenant_id, sugerencia_id)
        if sug is None:
            raise KeyError("Sugerencia no encontrada.")
        consulta_ids = sug.get("consulta_guardada_ids") or []
        playbook = self.playbooks.crear(
            tenant_id=tenant_id,
            user_id=user_id,
            nombre=nombre or f"Playbook sugerido {sugerencia_id[:8]}",
            pasos=[{"consulta_guardada_id": cid, "orden": i + 1}
                   for i, cid in enumerate(consulta_ids)],
            tipo_creacion=TipoCreacionPlaybook.sugerencia_edb_aceptada.value,
        )
        self.store.actualizar_sugerencia(
            tenant_id, sugerencia_id,
            {"estado": EstadoSugerencia.aceptada.value, "decidido_at": now_iso()},
        )
        # Aceptar un Playbook hace caducar las pedagógicas pendientes del usuario.
        self.caducar_pedagogicas(tenant_id, user_id)
        return {"sugerencia_id": sugerencia_id, "playbook": playbook}

    def rechazar(self, tenant_id: str, sugerencia_id: str) -> dict:
        """Rechaza: registra el rechazo LOCAL del patrón (sube su listón)."""
        return self._decidir(
            tenant_id, sugerencia_id, EstadoSugerencia.rechazada.value
        )

    def ignorar(self, tenant_id: str, sugerencia_id: str) -> dict:
        """Ignora (timeout natural): cuenta como rechazo SUAVE para el listón."""
        return self._decidir(
            tenant_id, sugerencia_id, EstadoSugerencia.ignorada.value
        )

    def _decidir(self, tenant_id: str, sugerencia_id: str, estado: str) -> dict:
        sug = self.store.obtener_sugerencia(tenant_id, sugerencia_id)
        if sug is None:
            raise KeyError("Sugerencia no encontrada.")
        ts = now_iso()
        firma = (sug.get("evidencia_estructural") or {}).get("firma")
        if firma:
            # Aprendizaje del rechazo LOCAL: sube el listón SOLO de este patrón.
            self.store.registrar_rechazo(tenant_id, sug["user_id"], firma, ts)
        self.store.actualizar_sugerencia(
            tenant_id, sugerencia_id, {"estado": estado, "decidido_at": ts}
        )
        return self.store.obtener_sugerencia(tenant_id, sugerencia_id)
