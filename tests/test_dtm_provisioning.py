"""
B3 §7 — Provisioning multi-tenant de los 5 grafos DTM + idempotencia.

Se SKIPEAN si no hay FalkorDB alcanzable.
"""
from app.graph.dtm_provisioning import provision_dtm_graphs_for_tenant
from app.graph.dtm_segregation import initial_graph_names
from tests.conftest import requires_falkordb

T = "dtm_provision_tenant"


@requires_falkordb
def test_provisioning_crea_cinco_grafos_vacios_con_schema(dtm):
    dtm.track_tenant(T)  # registra cualquier grafo preexistente para limpieza
    report = provision_dtm_graphs_for_tenant(T, client=dtm)
    for name in initial_graph_names(T):
        dtm.track_graph(name)

    assert len(report) == 5
    nombres = {r["graph_name"] for r in report}
    assert nombres == set(initial_graph_names(T))

    # Los 5 grafos existen en FalkorDB...
    existentes = set(dtm.list_dtm_graphs(T))
    assert set(initial_graph_names(T)).issubset(existentes)

    # ...con schema (índices creados) y SIN nodos de dominio (vacíos).
    for name in initial_graph_names(T):
        assert dtm.query_graph(name, "MATCH (n) RETURN count(n) AS c")[0]["c"] == 0
        idx = dtm.query_graph(name, "CALL db.indexes()")
        assert len(idx) >= 1, f"{name} sin índices (schema no aplicado)"


@requires_falkordb
def test_provisioning_idempotente(dtm):
    dtm.track_tenant(T)
    for name in initial_graph_names(T):
        dtm.track_graph(name)

    first = provision_dtm_graphs_for_tenant(T, client=dtm)
    second = provision_dtm_graphs_for_tenant(T, client=dtm)

    # Primera llamada crea índices; segunda los encuentra existentes (no-op).
    assert sum(len(r["created_indexes"]) for r in first) > 0
    assert all(r["created_indexes"] == [] for r in second), "2ª llamada no debe recrear"
    assert all(len(r["existing_indexes"]) > 0 for r in second)

    # No se duplicaron grafos.
    existentes = dtm.list_dtm_graphs(T)
    assert len(existentes) == len(set(existentes)) == 5
