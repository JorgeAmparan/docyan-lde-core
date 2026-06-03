"""
Tests de la fachada PCL — consultar_o_cachear: hit/miss, gobernanza en hit,
instrumentación FAT F4 (B8.5 §1.2, doc §6).

DOCYAN LDE™ by XCID.
"""
from app.audit.familias import FamiliaFAT
from app.orchestrator.clasificacion.tipos import (
    RUTA_POR_TIPO,
    ResultadoClasificacion,
    TipoIntencion,
)
from app.orchestrator.governance_gate import GateDecision
from app.pcl.modes import ModoRespuesta
from app.schemas.pipeline_payloads import (
    ConsultaResuelta,
    EspecificacionItem,
    InfoCardPayload,
)
from tests.conftest import make_inmemory_mo, make_inmemory_pcl

TENANT = "test-org"
CTX = {"entidad_id": "e1", "tipo_documento": "NOM"}


def _clasif(tipo=TipoIntencion.INFORMATIVA):
    return ResultadoClasificacion(
        tipo=tipo, score=0.9, ruta=RUTA_POR_TIPO[tipo], metodo="heuristico")


def _envelope(tipo=TipoIntencion.INFORMATIVA, specs=1):
    payload = InfoCardPayload(
        titulo="Par de apriete",
        especificaciones=[EspecificacionItem(nombre=f"p{i}", valor="40") for i in range(specs)],
    )
    return ConsultaResuelta(
        tipo_intencion=tipo.value, score=0.9, ruta=RUTA_POR_TIPO[tipo],
        metodo="heuristico", payload=payload)


def _ejecutor(contador, tipo=TipoIntencion.INFORMATIVA, specs=1):
    def _run():
        contador.append(1)
        return _envelope(tipo, specs), {"alertas_cuarentena": []}
    return _run


def test_miss_ejecuta_pipeline_cachea_y_registra_fat():
    pcl, fat = make_inmemory_pcl()
    contador = []
    resp, extras = pcl.consultar_o_cachear(
        tenant_id=TENANT, user_id="u1", pregunta="par de apriete del perno B",
        contexto=CTX, clasificacion=_clasif(), ejecutar=_ejecutor(contador),
    )
    assert len(contador) == 1  # ejecutó el pipeline
    assert resp.cache_hit is False
    assert resp.modo_respuesta == ModoRespuesta.RETRIEVAL_FIRST  # info_card 1 spec
    assert resp.payload.contexto_ccp.cache_hit is False
    # FAT F4 consulta_servida registrado.
    eventos = [e for e in fat.eventos(TENANT)
               if e.tipo_evento == "consulta_servida" and e.familia == FamiliaFAT.F4_CONSULTA]
    assert len(eventos) == 1
    assert eventos[0].payload["modo_respuesta"] == "retrieval_first"


def test_segunda_consulta_es_cache_hit_y_no_ejecuta_pipeline():
    pcl, fat = make_inmemory_pcl()
    contador = []
    args = dict(tenant_id=TENANT, user_id="u1", pregunta="par de apriete del perno B",
                contexto=CTX, clasificacion=_clasif())
    pcl.consultar_o_cachear(ejecutar=_ejecutor(contador), **args)
    resp2, _ = pcl.consultar_o_cachear(ejecutar=_ejecutor(contador), **args)

    assert len(contador) == 1  # el pipeline NO se ejecutó la segunda vez
    assert resp2.cache_hit is True
    assert resp2.modo_respuesta == ModoRespuesta.CACHE_HIT
    assert resp2.similitud_cache >= 0.92
    assert resp2.payload.contexto_ccp.cache_hit is True
    eventos = [e for e in fat.eventos(TENANT) if e.tipo_evento == "consulta_servida"]
    assert len(eventos) == 2
    assert eventos[1].payload["modo_respuesta"] == "cache_hit"


def test_cache_hit_reevalua_gobernanza_sin_ejecutar_pipeline():
    pcl, _ = make_inmemory_pcl()
    contador = []
    args = dict(tenant_id=TENANT, user_id="u1", pregunta="vigencia certificado",
                contexto=CTX, clasificacion=_clasif())
    pcl.consultar_o_cachear(ejecutar=_ejecutor(contador), **args)

    llamado = {"n": 0}

    def gob_ok():
        llamado["n"] += 1
        return GateDecision(servir=True, motivo="ok")

    resp, _ = pcl.consultar_o_cachear(ejecutar=_ejecutor(contador), gobernanza=gob_ok, **args)
    assert resp.cache_hit is True
    assert llamado["n"] == 1  # se re-evaluó gobernanza en el hit
    assert len(contador) == 1  # sin re-ejecutar pipeline


def test_cache_hit_con_gobernanza_que_bloquea_degrada_graceful():
    pcl, fat = make_inmemory_pcl()
    contador = []
    args = dict(tenant_id=TENANT, user_id="u1", pregunta="dato sensible",
                contexto=CTX, clasificacion=_clasif())
    pcl.consultar_o_cachear(ejecutar=_ejecutor(contador), **args)

    def gob_bloquea():
        return GateDecision(servir=False, motivo="Sin permiso ahora.",
                            razon_codigo="sin_permiso")

    resp, extras = pcl.consultar_o_cachear(
        ejecutar=_ejecutor(contador), gobernanza=gob_bloquea, **args)
    assert resp.payload.degradado is True
    assert "Sin permiso" in (resp.payload.nota or "")
    assert "gobernanza_bloqueo" in extras
    assert len(contador) == 1  # no se re-ejecutó el pipeline
    # Se registró el bloqueo en FAT.
    ultimo = [e for e in fat.eventos(TENANT) if e.tipo_evento == "consulta_servida"][-1]
    assert ultimo.payload["bloqueado_gobernanza"] is True


def test_synthesis_first_estima_costo_no_cero():
    pcl, _ = make_inmemory_pcl()
    # Match múltiple → synthesis → costo > 0.
    resp, _ = pcl.consultar_o_cachear(
        tenant_id=TENANT, user_id="u1", pregunta="explica la diferencia entre normas",
        contexto=CTX, clasificacion=_clasif(),
        ejecutar=lambda: (_envelope_ambiguo(), {"alertas_cuarentena": []}),
    )
    assert resp.modo_respuesta == ModoRespuesta.SYNTHESIS_FIRST
    assert resp.costo_estimado_centavos > 0


def _envelope_ambiguo():
    payload = InfoCardPayload(titulo="x", match_multiple=True, desambiguacion=["A", "B"])
    return ConsultaResuelta(
        tipo_intencion="INFORMATIVA", score=0.9, ruta="tipo1_informativa",
        metodo="heuristico", payload=payload)


def test_historial_consultas_lee_fat_f4():
    pcl, _ = make_inmemory_pcl()
    contador = []
    pcl.consultar_o_cachear(
        tenant_id=TENANT, user_id="u1", pregunta="par de apriete",
        contexto=CTX, clasificacion=_clasif(), ejecutar=_ejecutor(contador),
    )
    hist = pcl.historial_consultas(TENANT)
    assert len(hist) == 1
    assert hist[0]["tipo_intencion"] == "INFORMATIVA"
    assert hist[0]["entidad_id"] == "e1"


def _bundle():
    from app.playbooks.consultas_guardadas import ConsultasGuardadasService
    from app.playbooks.models import InMemoryPlaybookStore
    from app.playbooks.perfil import InMemoryPerfilProvider
    from app.playbooks.playbooks_core import PlaybooksService
    from app.playbooks.sugerencias import SugerenciasService

    store = InMemoryPlaybookStore()
    perfil = InMemoryPerfilProvider()
    perfil.set_perfil(TENANT, "u1", permiso_ia_proactiva=True)
    return {
        "store": store, "perfil": perfil,
        "consultas": ConsultasGuardadasService(store),
        "playbooks": PlaybooksService(store),
        "sugerencias": SugerenciasService(store, perfil),
    }


def test_facade_orquesta_playbooks_niveles_a_b_c():
    pcl, _ = make_inmemory_pcl()
    pcl._playbooks = _bundle()

    # Nivel A — guardar consulta.
    c1 = pcl.guardar_consulta(
        TENANT, "u1", "Par de apriete", consulta_original="par de apriete",
        tipo_intencion="INFORMATIVA", entidad_referenciada_id="e1")
    c2 = pcl.guardar_consulta(
        TENANT, "u1", "Historial", consulta_original="historial del equipo",
        tipo_intencion="HISTORIAL", entidad_referenciada_id="e1")
    assert c1["id"] and c2["id"]

    # Nivel B — crear playbook con los dos pasos.
    pb = pcl.crear_playbook(
        TENANT, "u1", "Rutina equipo",
        pasos=[{"consulta_guardada_id": c1["id"]}, {"consulta_guardada_id": c2["id"]}])
    assert len(pb["pasos"]) == 2

    # Disparo del playbook vía el MO en memoria.
    mo, _ = make_inmemory_mo()
    auth = {"org_id": TENANT, "user_id": "u1", "role": "admin",
            "permisos": ["consulta"]}
    vista = pcl.disparar_playbook(TENANT, pb["id"], mo, auth)
    assert len(vista["vista_unificada"]) == 2

    # Nivel C — evaluar patrones y listar pendientes.
    res = pcl.evaluar_patrones_diario(TENANT)
    assert res["tenant_id"] == TENANT
    assert isinstance(pcl.sugerencias_pendientes(TENANT, "u1"), list)


def test_facade_metricas_delega_en_metrics():
    from datetime import datetime, timezone

    pcl, _ = make_inmemory_pcl()
    hoy = datetime.now(timezone.utc).date()
    m = pcl.metricas(TENANT, (hoy, hoy))
    assert m.tenant_id == TENANT
    assert m.ventana == (hoy, hoy)
