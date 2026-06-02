"""
Nivel A — Consulta guardada (átomo del Playbook) (B8 §B1).

DOCYAN LDE™ by XCID.

Vive arriba de los pipelines del clasificador. Cuando una consulta es útil, el
usuario la guarda POR NOMBRE; la consulta queda VIVA: al dispararse se re-evalúa
contra el grafo actual (no es snapshot). Naming progresivo: en código y en las
respuestas API de Nivel A NO aparece la palabra "Playbook" — el modelo se llama
`consultas_guardadas`. El término se habilita solo cuando el comportamiento lo
justifica (≥2 consultas guardadas relacionadas → `termino_playbook_disponible`).
"""
from __future__ import annotations

from app.orchestrator.models import Canal, MORequest
from app.playbooks.models import PlaybookStore, now_iso

# Mínimo de consultas guardadas que tocan la MISMA entidad para que el término
# "Playbook" se habilite ante el usuario (disciplina de naming progresivo).
RELACIONADAS_PARA_PLAYBOOK = 2


class ConsultasGuardadasService:
    """CRUD + disparo de consultas guardadas vivas (Nivel A)."""

    def __init__(self, store: PlaybookStore) -> None:
        self.store = store

    def guardar(
        self,
        tenant_id: str,
        user_id: str,
        nombre: str,
        consulta_original: str,
        tipo_intencion: str,
        tipo_documento_origen: str | None = None,
        entidad_referenciada_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """Persiste una consulta guardada. El FAT (F4 `consulta_guardada`) lo registra el caller."""
        return self.store.crear_consulta(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "nombre": nombre,
                "consulta_original": consulta_original,
                "tipo_intencion": tipo_intencion,
                "tipo_documento_origen": tipo_documento_origen,
                "entidad_referenciada_id": entidad_referenciada_id,
                "metadata": metadata or {},
            }
        )

    def listar(self, tenant_id: str, user_id: str) -> list[dict]:
        return self.store.listar_consultas(tenant_id, user_id)

    def obtener(self, tenant_id: str, consulta_id: str) -> dict | None:
        return self.store.obtener_consulta(tenant_id, consulta_id)

    def renombrar(self, tenant_id: str, consulta_id: str, nuevo_nombre: str) -> dict | None:
        return self.store.actualizar_consulta(tenant_id, consulta_id, {"nombre": nuevo_nombre})

    def borrar(self, tenant_id: str, consulta_id: str) -> bool:
        """
        Soft delete (trazabilidad FAT). Cascade protection (B8 §B2): si la consulta
        está en uso por algún paso de un Playbook activo, se BLOQUEA (no se
        huérfana el recorrido). Política definida en código: bloquear, no detach.
        """
        en_uso = self.store.pasos_usando_consulta(consulta_id)
        if en_uso:
            raise ValueError(
                "La consulta guardada está en uso por uno o más Playbooks; "
                "quítala de ellos antes de borrarla (política: bloquear)."
            )
        return self.store.soft_delete_consulta(tenant_id, consulta_id)

    def disparar(
        self,
        tenant_id: str,
        consulta_id: str,
        mo,
        auth_ctx: dict,
    ) -> dict:
        """
        Dispara la consulta guardada: la re-evalúa contra el grafo ACTUAL vía el MO
        (no snapshot), incrementa `disparos_totales` y actualiza `ultimo_disparo_at`.
        Devuelve {consulta, resultado} donde `resultado` es el envelope tipado.
        """
        consulta = self.store.obtener_consulta(tenant_id, consulta_id)
        if consulta is None:
            raise KeyError("Consulta guardada no encontrada.")

        req = MORequest(
            auth=auth_ctx,
            canal=Canal.api,
            texto=consulta["consulta_original"],
            accion="consulta",
            payload={
                "score_confianza": 0.95,
                "entidad_id": consulta.get("entidad_referenciada_id"),
                "tipo_documento": consulta.get("tipo_documento_origen"),
            },
        )
        resp = mo.handle_request(req)
        ts = now_iso()
        self.store.registrar_disparo_consulta(tenant_id, consulta_id, ts)
        return {"consulta": self.store.obtener_consulta(tenant_id, consulta_id),
                "resultado": resp.data, "servido": resp.servido}

    def termino_playbook_disponible(self, tenant_id: str, user_id: str) -> bool:
        """
        True si el usuario tiene ≥2 consultas guardadas RELACIONADAS (misma entidad
        operativa). Habilita exponer la palabra "Playbook" (naming progresivo).
        """
        consultas = self.store.listar_consultas(tenant_id, user_id)
        por_entidad: dict[str, int] = {}
        for c in consultas:
            eid = c.get("entidad_referenciada_id")
            if eid:
                por_entidad[eid] = por_entidad.get(eid, 0) + 1
        return any(n >= RELACIONADAS_PARA_PLAYBOOK for n in por_entidad.values())
