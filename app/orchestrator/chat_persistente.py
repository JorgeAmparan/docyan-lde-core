"""
Chat persistente multi-turno (B8 §A3).

DOCYAN LDE™ by XCID.

El estado conversacional vive en la sesión del MO (Redis TTL diferenciado,
decisión #6) — NO se crea un sistema paralelo. Cada turno acumula:
pregunta + clasificación (tipo/ruta/score) + referencia del payload. Al cerrar la
sesión, el spillover a `sessions_completed` ya persiste el estado completo
(incluido el historial), de modo que la conversación queda para análisis y FAT.

El historial alimenta al clasificador en turnos posteriores (`historial_resumen`):
una pregunta de seguimiento ("¿y su par de apriete?") se interpreta con el
contexto del turno previo. El multi-turno nativo del SDK GraphRAG (`completion()`
con `history`) se construye sobre `historial_para_completion`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.orchestrator.session_manager import SessionManager, SessionState

# Cuántos turnos previos se resumen como contexto del clasificador.
TURNOS_CONTEXTO = 5
# Tope de turnos guardados en la sesión (evita crecer sin límite).
MAX_TURNOS = 50


class ChatPersistente:
    """Gestiona el historial conversacional dentro de la sesión del MO."""

    def __init__(self, session_manager: SessionManager) -> None:
        self.session_manager = session_manager

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def historial(self, session: SessionState | None) -> list[dict]:
        """Lista de turnos previos de la sesión (vacía si no hay sesión)."""
        if session is None:
            return []
        return list(session.state.get("historial_chat", []))

    def historial_resumen(self, session: SessionState | None) -> str:
        """
        Resumen textual de los últimos turnos para dar contexto al clasificador.
        Formato compacto: "pregunta → TIPO" por línea.
        """
        turnos = self.historial(session)[-TURNOS_CONTEXTO:]
        return "\n".join(f"{t.get('pregunta', '')} → {t.get('tipo', '')}" for t in turnos)

    def historial_para_completion(self, session: SessionState | None) -> list[dict]:
        """
        Historial en el formato `messages` que consume `completion()` del SDK
        GraphRAG (multi-turno nativo): alterna user/assistant por turno.
        """
        mensajes: list[dict] = []
        for t in self.historial(session):
            mensajes.append({"role": "user", "content": t.get("pregunta", "")})
            mensajes.append(
                {"role": "assistant", "content": f"[{t.get('tipo', '')}] {t.get('resumen', '')}"}
            )
        return mensajes

    def registrar_turno(
        self,
        session_id: str | None,
        pregunta: str,
        tipo: str,
        ruta: str,
        score: float,
        resumen: str = "",
    ) -> SessionState | None:
        """
        Anexa un turno al historial de la sesión y refresca su TTL (ventana
        deslizante). Sin `session_id` no hay persistencia de chat (consulta suelta).
        """
        if not session_id:
            return None
        session = self.session_manager.get_session(session_id)
        if session is None:
            return None
        historial = list(session.state.get("historial_chat", []))
        historial.append(
            {
                "pregunta": pregunta,
                "tipo": tipo,
                "ruta": ruta,
                "score": round(score, 4),
                "resumen": resumen[:500],
                "timestamp": self._now_iso(),
            }
        )
        if len(historial) > MAX_TURNOS:
            historial = historial[-MAX_TURNOS:]
        return self.session_manager.update_session(
            session_id, {"historial_chat": historial}
        )
