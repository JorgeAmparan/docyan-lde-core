"""
Recorrido Núcleo Consultable — E2E a nivel MO (pasos 4 y 5 del criterio de cierre).

DOCYAN LDE™ by XCID.

Paso 4 — misma pregunta a dos documentos distintos del mismo tenant → respuestas
         DISTINTAS, sin colisión de caché (el fingerprint segrega por documento_id).
Paso 5 — conversación multi-turno sobre un documento → la sesión MANTIENE el
         historial (chat persistente: el MO acumula turnos por session_id).

Corre 100% en memoria (clasificador heurístico real + PCL en memoria), sin FalkorDB.
El aislamiento del RETRIEVAL contra grafo real lo cubre test_aislamiento_documental_e2e.
"""
from __future__ import annotations

from app.api.routers import mo as mo_router
from tests.conftest import EmptyPipelineReader, make_inmemory_mo

HEADERS = {"X-API-Key": "test-api-key-for-pytest"}  # → org=test-org, role=admin


class DocAwareReader(EmptyPipelineReader):
    """Reader sintético que responde según el `documento_id` consultado: docA y docB
    tienen valores distintos para la MISMA pregunta. Permite probar que el caché NO
    colisiona entre documentos (la respuesta cacheada de A no se sirve para B)."""

    _POR_DOC = {
        "docA": {"nombre": "Punto de inflamación", "valor": "60 °C", "documento_id": "docA",
                 "documento_nombre": "IB-111-RDA.pdf", "documento_tipo": "ficha"},
        "docB": {"nombre": "Punto de inflamación", "valor": "200 °C", "documento_id": "docB",
                 "documento_nombre": "MSDS AM002.pdf", "documento_tipo": "msds"},
    }

    def informativa(self, t, term, e, d=None):
        spec = self._POR_DOC.get(d)
        if spec is None:
            return {"especificaciones": [], "termino": None, "definicion": None}
        return {"especificaciones": [dict(spec)], "termino": spec["nombre"], "definicion": None}


def _consultar(client, *, documento_id, session_id=None, texto="cuál es el punto de inflamación"):
    body = {"texto": texto, "documento_id": documento_id, "score_confianza": 0.95}
    if session_id:
        body["session_id"] = session_id
    return client.post("/mo/query", headers=HEADERS, json=body)


def _setup(test_client, reader=None):
    from app.api.main import app

    mo, _ = make_inmemory_mo(reader=reader)
    app.dependency_overrides[mo_router.get_mo] = lambda: mo
    return test_client, mo


def _teardown():
    from app.api.main import app

    app.dependency_overrides.pop(mo_router.get_mo, None)


def _valores(resp):
    payload = resp.json()["resultado"]["payload"]
    return [(e.get("valor"), (e.get("cita") or {}).get("documento_id"))
            for e in payload.get("especificaciones", [])]


def test_paso4_cache_no_colisiona_entre_documentos(test_client):
    """Misma pregunta a docA y docB → respuestas distintas; B NO sirve la de A."""
    client, _mo = _setup(test_client, reader=DocAwareReader())
    try:
        rA = _consultar(client, documento_id="docA")
        assert rA.status_code == 200, rA.text
        ccpA = rA.json()["resultado"]["contexto_ccp"]
        assert ccpA["cache_hit"] is False
        valsA = _valores(rA)

        # Segunda consulta, MISMA pregunta pero OTRO documento → debe ser MISS y
        # devolver el dato de B, no el cacheado de A (sin colisión de fingerprint).
        rB = _consultar(client, documento_id="docB")
        ccpB = rB.json()["resultado"]["contexto_ccp"]
        assert ccpB["cache_hit"] is False, "colisión: B sirvió la entrada cacheada de A"
        valsB = _valores(rB)

        assert valsA != valsB, f"A y B devolvieron lo mismo: {valsA}"
        assert any(v == "60 °C" and d == "docA" for v, d in valsA)
        assert any(v == "200 °C" and d == "docB" for v, d in valsB)

        # Repetir A → ahora SÍ es cache hit (su propia entrada, no la de B).
        rA2 = _consultar(client, documento_id="docA")
        assert rA2.json()["resultado"]["contexto_ccp"]["cache_hit"] is True
    finally:
        _teardown()


def test_paso5_chat_multiturno_mantiene_contexto(test_client):
    """Dos turnos sobre el mismo documento en una sesión → el historial acumula
    ambos (chat persistente: el MO mantiene contexto por session_id)."""
    client, mo = _setup(test_client, reader=DocAwareReader())
    try:
        # Crea la sesión de consulta (lo que el frontend hace al abrir el CoDo).
        rs = client.post("/mo/sessions", headers=HEADERS,
                         json={"session_type": "consulta", "canal": "pwa"})
        assert rs.status_code == 200, rs.text
        sid = rs.json()["session_id"]

        _consultar(client, documento_id="docA", session_id=sid,
                   texto="cuál es el punto de inflamación")
        _consultar(client, documento_id="docA", session_id=sid,
                   texto="y a qué temperatura hierve")

        state = mo.session_manager.get_session(sid)
        assert state is not None
        turnos = mo.chat.historial(state)
        assert len(turnos) == 2, f"el historial debería tener 2 turnos: {turnos}"
        # El resumen para el clasificador refleja el primer turno al procesar el 2º.
        resumen = mo.chat.historial_resumen(state)
        assert resumen, "el resumen de historial no debería ser vacío con turnos previos"
    finally:
        _teardown()
