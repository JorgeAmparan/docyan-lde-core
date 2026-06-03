"""
Tests de la heurística retrieval-first vs synthesis-first (B8.5 §modes, doc §4).

DOCYAN LDE™ by XCID.
"""
from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pcl.modes import (
    MODOS_RETRIEVAL_FIRST_DEFAULT,
    ModoRespuesta,
    elegir_modo,
    navegacion_desde_envelope,
)
from app.schemas.pipeline_payloads import (
    AlertaItem,
    AlertsDashboardPayload,
    ComparativeViewPayload,
    ConsultaResuelta,
    DiagnosticTreePayload,
    DiagramViewerPayload,
    EspecificacionItem,
    EventoTimeline,
    InfoCardPayload,
    ProcedureCardPayload,
    TimelinePayload,
    VideoPlayerPayload,
)


def _env(tipo: TipoIntencion, payload, degradado=False) -> ConsultaResuelta:
    return ConsultaResuelta(
        tipo_intencion=tipo.value, score=0.9, ruta="r", metodo="heuristico",
        payload=payload, degradado=degradado,
    )


def _decidir(tipo, payload, contexto=None, degradado=False):
    env = _env(tipo, payload, degradado=degradado)
    nav = navegacion_desde_envelope(env)
    return elegir_modo(tipo, contexto, nav)


def test_cinco_tipos_default_con_match_unico_son_retrieval():
    casos = {
        TipoIntencion.INFORMATIVA: InfoCardPayload(
            titulo="x", especificaciones=[EspecificacionItem(nombre="par", valor="40")]),
        TipoIntencion.GRAFICOS_DIAGRAMAS: DiagramViewerPayload(titulo="x", recurso_id="r1"),
        TipoIntencion.VIDEO: VideoPlayerPayload(titulo="x", recurso_id="r1"),
        TipoIntencion.HISTORIAL: TimelinePayload(
            titulo="x", eventos=[EventoTimeline(tipo="cal", descripcion="ok")]),
        TipoIntencion.ALERTAS: AlertsDashboardPayload(
            titulo="x", alertas=[AlertaItem(descripcion="vence")]),
    }
    for tipo, payload in casos.items():
        assert tipo in MODOS_RETRIEVAL_FIRST_DEFAULT
        assert _decidir(tipo, payload) == ModoRespuesta.RETRIEVAL_FIRST, tipo


def test_tipos_default_con_match_multiple_o_cero_escalan_a_synthesis():
    # Informativa ambigua (match múltiple) → synthesis.
    amb = InfoCardPayload(
        titulo="x", especificaciones=[EspecificacionItem(nombre="p", valor="1")],
        match_multiple=True)
    assert _decidir(TipoIntencion.INFORMATIVA, amb) == ModoRespuesta.SYNTHESIS_FIRST
    # Diagrama sin recurso (cero resultados) → synthesis.
    vacio = DiagramViewerPayload(titulo="x", recurso_id=None)
    assert _decidir(TipoIntencion.GRAFICOS_DIAGRAMAS, vacio) == ModoRespuesta.SYNTHESIS_FIRST


def test_tipos_de_sintesis_siempre_synthesis():
    casos = {
        TipoIntencion.GUIA_PASO_A_PASO: ProcedureCardPayload(titulo="x"),
        TipoIntencion.TROUBLESHOOTING: DiagnosticTreePayload(titulo="x"),
        TipoIntencion.COMPARATIVA: ComparativeViewPayload(
            titulo="x", estrategia="versiones_documento",
            referencia_izquierda="a", referencia_derecha="b"),
    }
    for tipo, payload in casos.items():
        assert tipo not in MODOS_RETRIEVAL_FIRST_DEFAULT
        assert _decidir(tipo, payload) == ModoRespuesta.SYNTHESIS_FIRST, tipo


def test_tipo1_unico_vs_ambiguo():
    unico = InfoCardPayload(
        titulo="x", especificaciones=[EspecificacionItem(nombre="par", valor="40")])
    assert _decidir(TipoIntencion.INFORMATIVA, unico) == ModoRespuesta.RETRIEVAL_FIRST
    ambiguo = InfoCardPayload(titulo="x", match_multiple=True,
                             desambiguacion=["A", "B"])
    assert _decidir(TipoIntencion.INFORMATIVA, ambiguo) == ModoRespuesta.SYNTHESIS_FIRST


def test_degradado_y_forzar_synthesis():
    # Grafo degradado → synthesis (no se puede afirmar retrieval).
    p = InfoCardPayload(titulo="x", especificaciones=[EspecificacionItem(nombre="a")])
    assert _decidir(TipoIntencion.INFORMATIVA, p, degradado=True) == ModoRespuesta.SYNTHESIS_FIRST
    # El cliente puede pedir explicación → synthesis aunque haya match único.
    assert _decidir(TipoIntencion.INFORMATIVA, p, contexto={"forzar_synthesis": True}) == (
        ModoRespuesta.SYNTHESIS_FIRST
    )
