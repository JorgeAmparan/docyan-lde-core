"""
Tests del chat persistente multi-turno (B8 §A3) y del /mo/query profundizado.

El historial vive en la sesión del MO; al cerrar, el spillover preserva la
conversación completa. La consulta se clasifica y se sirve el envelope tipado.
"""
from app.orchestrator.models import Canal, MORequest, SessionType
from tests.conftest import make_inmemory_mo

AUTH = {"org_id": "test-org", "user_id": "u1", "role": "admin", "email": "a@t.com"}


def test_query_clasifica_y_devuelve_envelope_tipado():
    mo, sink = make_inmemory_mo()
    resp = mo.handle_request(
        MORequest(auth=AUTH, accion="consulta",
                  texto="cuál es el valor de presión nominal",
                  payload={"score_confianza": 0.95})
    )
    assert resp.servido is True
    assert resp.data["tipo_intencion"] == "INFORMATIVA"
    assert resp.data["payload"]["kind"] == "info_card"
    assert any(e["action"] == "intent_classified" for e in sink.entries)


def test_chat_multiturno_conserva_historial():
    mo, _ = make_inmemory_mo()
    sid = mo.iniciar_sesion(AUTH, SessionType.consulta, Canal.pwa)
    preguntas = [
        "cómo se instala la bomba",
        "muéstrame el diagrama del tablero",
        "qué certificados están por vencer",
    ]
    for q in preguntas:
        mo.handle_request(
            MORequest(auth=AUTH, accion="consulta", texto=q,
                      session_id=sid, payload={"score_confianza": 0.95})
        )
    state = mo.session_manager.get_session(sid)
    historial = state.state["historial_chat"]
    assert len(historial) == 3
    assert historial[0]["tipo"] == "GUIA_PASO_A_PASO"
    assert historial[2]["tipo"] == "ALERTAS"


def test_cierre_de_sesion_spillover_con_historial_completo():
    mo, _ = make_inmemory_mo()
    sid = mo.iniciar_sesion(AUTH, SessionType.consulta, Canal.pwa)
    mo.handle_request(
        MORequest(auth=AUTH, accion="consulta", texto="procedimiento de montaje",
                  session_id=sid, payload={"score_confianza": 0.95})
    )
    completed = mo.cerrar_sesion(sid, reason="fin")
    assert completed is not None
    assert len(completed["state"]["historial_chat"]) == 1
    assert completed["state"]["historial_chat"][0]["ruta"] == "tipo2_guia_paso_a_paso"
    assert mo.session_manager.get_session(sid) is None


def test_historial_resumen_alimenta_contexto_del_clasificador():
    from app.orchestrator.chat_persistente import ChatPersistente

    mo, _ = make_inmemory_mo()
    sid = mo.iniciar_sesion(AUTH, SessionType.consulta, Canal.pwa)
    mo.handle_request(
        MORequest(auth=AUTH, accion="consulta", texto="historial de calibraciones",
                  session_id=sid, payload={"score_confianza": 0.95})
    )
    chat = ChatPersistente(mo.session_manager)
    resumen = chat.historial_resumen(mo.session_manager.get_session(sid))
    assert "HISTORIAL" in resumen
