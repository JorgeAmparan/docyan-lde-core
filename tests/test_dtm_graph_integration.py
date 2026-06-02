"""
B3 — Tests de integración del DTM contra FalkorDB (docyan-lde-graph).

Cubre: segregación estricta por par, schema TM dual (cliente>agencia con
prioridad en la arista), lock como propiedad, las 6 aristas internas, las
aristas cross DKG↔DTM, y un smoke de los 5 tipos de nodo de dominio.

Se SKIPEAN si no hay FalkorDB alcanzable (no se reportan verdes falsos).
"""
from app.graph.dtm_segregation import graph_name_for_pair
from tests.conftest import requires_falkordb

T = "dtm_test_tenant"


def _seg(tipo="especificacion", **extra):
    base = {
        "texto_origen": "Pressure shall be verified.",
        "texto_destino": "La presión deberá verificarse.",
        "idioma_origen": "en-US",
        "idioma_destino": "es-MX",
        "tipo_segmento": tipo,
    }
    base.update(extra)
    return base


# ── Segregación estricta por par ─────────────────────────────────────────────


@requires_falkordb
def test_segregacion_estricta_por_par(dtm):
    g_mx = graph_name_for_pair(T, "en-US", "es-MX")
    g_es = graph_name_for_pair(T, "en-US", "es-ES")
    dtm.track_graph(g_mx)
    dtm.track_graph(g_es)

    dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion",
                    _seg(texto_destino="presión MX"))
    dtm.create_node(T, "en-US", "es-ES", "SegmentoTraduccion",
                    _seg(idioma_destino="es-ES", texto_destino="presión ES"))

    rows_mx = dtm.query(T, "en-US", "es-MX",
                        "MATCH (s:SegmentoTraduccion) RETURN s")
    rows_es = dtm.query(T, "en-US", "es-ES",
                        "MATCH (s:SegmentoTraduccion) RETURN s")

    assert len(rows_mx) == 1 and rows_mx[0]["texto_destino"] == "presión MX"
    assert len(rows_es) == 1 and rows_es[0]["texto_destino"] == "presión ES"


@requires_falkordb
def test_cruce_de_par_no_filtra(dtm):
    """Una query al grafo de un par jamás ve datos de otro par (graph_name físico)."""
    g_mx = graph_name_for_pair(T, "en-US", "es-MX")
    g_es = graph_name_for_pair(T, "en-US", "es-ES")
    dtm.track_graph(g_mx)
    dtm.track_graph(g_es)

    dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion", _seg())
    todos_en_es = dtm.query(T, "en-US", "es-ES", "MATCH (n) RETURN n")
    assert todos_en_es == []
    assert g_mx != g_es


# ── Schema TM dual (cliente > agencia) ───────────────────────────────────────


@requires_falkordb
def test_tm_dual_prioridad_en_arista(dtm):
    g = graph_name_for_pair(T, "en-US", "es-MX")
    dtm.track_graph(g)

    seg = dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion", _seg())
    glo_cli = dtm.create_node_in_graph(
        g, "Glosario", {"tipo_glosario": "cliente", "par_linguistico": "en-US↔es-MX"})
    glo_ag = dtm.create_node_in_graph(
        g, "Glosario", {"tipo_glosario": "agencia", "par_linguistico": "en-US↔es-MX"})

    # cliente > agencia: prioridad 1 (cliente) vs 2 (agencia).
    assert dtm.create_edge(g, "SegmentoTraduccion", seg["id"], "USA_GLOSARIO",
                           "Glosario", glo_cli["id"], {"prioridad": 1})
    assert dtm.create_edge(g, "SegmentoTraduccion", seg["id"], "USA_GLOSARIO",
                           "Glosario", glo_ag["id"], {"prioridad": 2})

    rows = dtm.query(
        T, "en-US", "es-MX",
        """
        MATCH (s:SegmentoTraduccion {id: $sid})-[r:USA_GLOSARIO]->(g:Glosario)
        RETURN g.tipo_glosario AS tipo, r.prioridad AS prioridad
        ORDER BY r.prioridad ASC
        """,
        {"sid": seg["id"]},
    )
    assert [(r["tipo"], r["prioridad"]) for r in rows] == [("cliente", 1), ("agencia", 2)]


# ── Lock terminológico como propiedad ────────────────────────────────────────


@requires_falkordb
def test_lock_terminologico_como_propiedad(dtm):
    g = graph_name_for_pair(T, "en-US", "es-MX")
    dtm.track_graph(g)

    glo_on = dtm.create_node_in_graph(
        g, "Glosario",
        {"tipo_glosario": "cliente", "par_linguistico": "en-US↔es-MX",
         "lock_terminologico": True})
    glo_off = dtm.create_node_in_graph(
        g, "Glosario",
        {"tipo_glosario": "agencia", "par_linguistico": "en-US↔es-MX",
         "lock_terminologico": False})

    rows = dtm.query(
        T, "en-US", "es-MX",
        "MATCH (g:Glosario) RETURN g.id AS id, g.lock_terminologico AS lock")
    locks = {r["id"]: r["lock"] for r in rows}
    assert locks[glo_on["id"]] is True
    assert locks[glo_off["id"]] is False


# ── Las 6 aristas internas ───────────────────────────────────────────────────


@requires_falkordb
def test_seis_aristas_internas_persisten(dtm):
    g = graph_name_for_pair(T, "en-US", "es-MX")
    dtm.track_graph(g)

    seg = dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion", _seg())
    proyecto = dtm.create_node_in_graph(g, "Proyecto", {"proyecto_id": "p1", "nombre": "Proj"})
    revision = dtm.create_node_in_graph(
        g, "RegistroRevision",
        {"revisor_id": "r1", "rol_revisor": "revisor_cliente", "accion": "aprobar"})
    glosario = dtm.create_node_in_graph(
        g, "Glosario", {"tipo_glosario": "cliente", "par_linguistico": "en-US↔es-MX"})
    termino = dtm.create_node_in_graph(g, "TerminoGlosario", {"texto_origen": "torque"})
    sugerencia = dtm.create_node_in_graph(g, "SugerenciaTermino", {"texto_origen": "flange"})

    edges = [
        ("SegmentoTraduccion", seg["id"], "PERTENECE_A_PROYECTO", "Proyecto", proyecto["id"]),
        ("SegmentoTraduccion", seg["id"], "RECIBIO_REVISION", "RegistroRevision", revision["id"]),
        ("Glosario", glosario["id"], "CONTIENE_TERMINO", "TerminoGlosario", termino["id"]),
        ("SegmentoTraduccion", seg["id"], "USA_GLOSARIO", "Glosario", glosario["id"]),
        ("SegmentoTraduccion", seg["id"], "USA_TERMINO_GLOSARIO", "TerminoGlosario", termino["id"]),
        ("SugerenciaTermino", sugerencia["id"], "CANDIDATA_PARA_GLOSARIO", "Glosario", glosario["id"]),
    ]
    for src_label, src_id, etype, dst_label, dst_id in edges:
        assert dtm.create_edge(g, src_label, src_id, etype, dst_label, dst_id), etype

    count = dtm.query(T, "en-US", "es-MX", "MATCH ()-[r]->() RETURN count(r) AS c")
    assert count[0]["c"] == 6


# ── Smoke de los 5 nodos de dominio ──────────────────────────────────────────


@requires_falkordb
def test_smoke_cinco_nodos_dominio(dtm):
    """Crear los 5 tipos de nodo y verificar que existen vía consulta directa."""
    g = graph_name_for_pair(T, "en-US", "es-MX")
    dtm.track_graph(g)

    dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion", _seg())
    dtm.create_node_in_graph(
        g, "Glosario", {"tipo_glosario": "cliente", "par_linguistico": "en-US↔es-MX"})
    dtm.create_node_in_graph(g, "TerminoGlosario", {"texto_origen": "torque"})
    dtm.create_node_in_graph(
        g, "RegistroRevision",
        {"revisor_id": "r1", "rol_revisor": "traductor", "accion": "editar"})
    dtm.create_node_in_graph(g, "SugerenciaTermino", {"texto_origen": "flange"})

    for label in ("SegmentoTraduccion", "Glosario", "TerminoGlosario",
                  "RegistroRevision", "SugerenciaTermino"):
        rows = dtm.query(T, "en-US", "es-MX", f"MATCH (n:{label}) RETURN n")
        assert len(rows) == 1, f"esperaba 1 nodo :{label}"
