"""
Intent Router del MO (B4 §1 responsabilidad 2 — router MÍNIMO).

DOCYAN LDE™ by XCID.

B4 entrega SOLO el router mínimo: detecta "consulta" vs "ingesta" vs
"configuración" vs "evento programado" y enruta al componente correcto. El
clasificador de intención COMPLETO (pipelines Tipos 1-8) llega en B8; este módulo
deja la INTERFAZ que B8 implementará por dentro, sin cambiar el contrato del MO.
"""
from __future__ import annotations

from app.orchestrator.models import MORequest, RequestKind

_INGESTA = {"ingesta", "ingest", "upload", "subir", "cargar_documento"}
_CONFIG = {"configuracion", "config", "onboarding", "setup", "ajustes"}
_EVENTO = {"evento", "evento_programado", "scheduled", "cron", "tarea_programada"}
_CONSULTA = {"consulta", "query", "pregunta", "buscar"}


class IntentRouter:
    """Clasifica el request en una de las clases gruesas que B4 sabe enrutar."""

    def classify(self, req: MORequest) -> RequestKind:
        # 1. Hint explícito en el payload (lo más fiable: lo pone el caller/API).
        kind_hint = (req.payload or {}).get("kind")
        if kind_hint:
            try:
                return RequestKind(kind_hint)
            except ValueError:
                pass

        accion = (req.accion or "").strip().lower()
        if accion in _INGESTA:
            return RequestKind.ingesta
        if accion in _CONFIG:
            return RequestKind.configuracion
        if accion in _EVENTO:
            return RequestKind.evento_programado
        if accion in _CONSULTA:
            return RequestKind.consulta

        # 2. Señales del payload: si trae documento/archivo a procesar → ingesta.
        payload = req.payload or {}
        if any(k in payload for k in ("documento", "documento_ref", "file", "archivo")):
            return RequestKind.ingesta

        # 3. Texto libre presente → consulta (caso más común del MVP consulta viva).
        if req.texto and req.texto.strip():
            return RequestKind.consulta

        return RequestKind.desconocido
