"""
Nivel B — Secuencia de consultas (recorrido) (B8 §B2).

DOCYAN LDE™ by XCID.

El usuario encadena dos o más consultas guardadas en el orden en que trabaja. NO
construye el motor: configura el orden sobre lo que ya guardó. Al disparar, el MO
ejecuta la secuencia re-evaluando cada paso contra el grafo actual y compone una
VISTA UNIFICADA con provenance por paso (cita + entidad + tipo de intención). Es
un recorrido razonado sobre el grafo, no consultas sueltas.
"""
from __future__ import annotations

from app.orchestrator.models import Canal, MORequest
from app.playbooks.models import PlaybookStore, TipoCreacionPlaybook, now_iso


class PlaybooksService:
    """Crea, lista, dispara y edita Playbooks formales (Nivel B)."""

    def __init__(self, store: PlaybookStore) -> None:
        self.store = store

    def crear(
        self,
        tenant_id: str,
        user_id: str,
        nombre: str,
        pasos: list[dict],
        descripcion: str | None = None,
        tipo_creacion: str = TipoCreacionPlaybook.usuario_manual.value,
        vertical: str | None = None,
    ) -> dict:
        """
        Crea un Playbook con `pasos` = lista ordenada de
        {consulta_guardada_id, nota_paso?}. Devuelve el Playbook con sus pasos.
        """
        playbook = self.store.crear_playbook(
            {
                "tenant_id": tenant_id,
                "creado_por_user_id": user_id,
                "nombre": nombre,
                "descripcion": descripcion,
                "tipo_creacion": tipo_creacion,
                "vertical": vertical,
            },
            self._normalizar_pasos(pasos, tenant_id),
        )
        playbook["pasos"] = self.store.listar_pasos(playbook["id"])
        return playbook

    @staticmethod
    def _normalizar_pasos(pasos: list[dict], tenant_id: str) -> list[dict]:
        norm = []
        for i, p in enumerate(pasos):
            norm.append(
                {
                    "tenant_id": tenant_id,  # denormalizado para RLS (playbook_pasos)
                    # `orden` puede venir None (no provisto); usar la posición.
                    "orden": p.get("orden") or (i + 1),
                    "consulta_guardada_id": p["consulta_guardada_id"],
                    "nota_paso": p.get("nota_paso"),
                }
            )
        return norm

    def listar(self, tenant_id: str) -> list[dict]:
        out = []
        for p in self.store.listar_playbooks(tenant_id):
            p["pasos"] = self.store.listar_pasos(p["id"])
            out.append(p)
        return out

    def obtener(self, tenant_id: str, playbook_id: str) -> dict | None:
        p = self.store.obtener_playbook(tenant_id, playbook_id)
        if p is None:
            return None
        p["pasos"] = self.store.listar_pasos(playbook_id)
        return p

    def disparar(
        self,
        tenant_id: str,
        playbook_id: str,
        mo,
        auth_ctx: dict,
        audit_logger=None,
        actor: str = "system",
    ) -> dict:
        """
        Ejecuta la secuencia. Cada paso re-evalúa su consulta guardada vía el MO y
        aporta provenance. Registra FAT por cada paso + un FAT padre del Playbook.
        """
        playbook = self.store.obtener_playbook(tenant_id, playbook_id)
        if playbook is None:
            raise KeyError("Playbook no encontrado.")
        pasos = self.store.listar_pasos(playbook_id)

        vista: list[dict] = []
        for paso in pasos:
            consulta = self.store.obtener_consulta(tenant_id, paso["consulta_guardada_id"])
            if consulta is None:
                vista.append({"orden": paso["orden"], "error": "consulta guardada ausente"})
                continue
            req = MORequest(
                auth=auth_ctx, canal=Canal.api, texto=consulta["consulta_original"],
                accion="consulta",
                payload={
                    "score_confianza": 0.95,
                    "entidad_id": consulta.get("entidad_referenciada_id"),
                    "tipo_documento": consulta.get("tipo_documento_origen"),
                },
            )
            resp = mo.handle_request(req)
            ts = now_iso()
            self.store.registrar_disparo_consulta(tenant_id, consulta["id"], ts)
            payload = (resp.data or {}).get("payload", {})
            vista.append(
                {
                    "orden": paso["orden"],
                    "consulta_guardada_id": consulta["id"],
                    "nombre": consulta["nombre"],
                    "nota_paso": paso.get("nota_paso"),
                    "tipo_intencion": (resp.data or {}).get("tipo_intencion"),
                    "entidad_id": consulta.get("entidad_referenciada_id"),
                    "provenance": payload.get("citas", []),
                    "resultado": resp.data,
                }
            )
            if audit_logger is not None:
                audit_logger.event(
                    tenant_id, "playbook_paso_disparado", actor,
                    {"playbook_id": playbook_id, "orden": paso["orden"],
                     "consulta_guardada_id": consulta["id"]},
                )

        ts = now_iso()
        self.store.registrar_disparo_playbook(tenant_id, playbook_id, ts)
        if audit_logger is not None:
            audit_logger.event(
                tenant_id, "playbook_disparado", actor,
                {"playbook_id": playbook_id, "pasos": len(pasos)},
            )
        return {
            "playbook": self.store.obtener_playbook(tenant_id, playbook_id),
            "vista_unificada": vista,
        }

    def actualizar(
        self,
        tenant_id: str,
        playbook_id: str,
        nombre: str | None = None,
        descripcion: str | None = None,
        pasos: list[dict] | None = None,
    ) -> dict | None:
        """Renombra, cambia descripción y/o reordena/agrega/quita pasos."""
        updates: dict = {}
        if nombre is not None:
            updates["nombre"] = nombre
        if descripcion is not None:
            updates["descripcion"] = descripcion
        if updates:
            if self.store.actualizar_playbook(tenant_id, playbook_id, updates) is None:
                return None
        if pasos is not None:
            self.store.reemplazar_pasos(
                playbook_id, self._normalizar_pasos(pasos, tenant_id)
            )
        return self.obtener(tenant_id, playbook_id)

    def borrar(self, tenant_id: str, playbook_id: str) -> bool:
        return self.store.soft_delete_playbook(tenant_id, playbook_id)
