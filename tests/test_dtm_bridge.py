"""
B3 §5 / §6 — Puente DKG↔DTM: registro en schema + arista cross navegable.

VERDAD OPERACIONAL: una arista no cruza graph_name en FalkorDB; el puente la
realiza con un nodo `:ReferenciaDKG` dentro del grafo DTM (ver dkg_dtm_bridge).
"""
import pytest

from app.graph.dkg_dtm_bridge import (
    BridgeError,
    link_dkg_to_dtm,
    navigate_translations,
    register_cross_edges,
    supports_cross_edge,
)
from app.graph.dtm_segregation import graph_name_for_pair
from tests.conftest import requires_falkordb

T = "dtm_bridge_tenant"


def _seg(**extra):
    base = {
        "texto_origen": "Pressure shall be verified.",
        "texto_destino": "La presión deberá verificarse.",
        "idioma_origen": "en-US",
        "idioma_destino": "es-MX",
        "tipo_segmento": "especificacion",
    }
    base.update(extra)
    return base


# ── Registro en schema (lógica pura) ─────────────────────────────────────────


def test_cross_edges_registradas_en_schema():
    reg = register_cross_edges()
    assert set(reg["cross_edge_types"]) == {"TRADUCIDA_VIA", "TRADUCIDO_DESDE"}
    assert "Especificacion" in reg["dkg_translatable_labels"]
    assert reg["dtm_target_label"] == "SegmentoTraduccion"


def test_supports_cross_edge():
    assert supports_cross_edge("Especificacion", "TRADUCIDA_VIA") is True
    assert supports_cross_edge("Especificacion", "TRADUCIDO_DESDE") is True
    # Label DKG no traducible.
    assert supports_cross_edge("Tenant", "TRADUCIDA_VIA") is False
    # Tipo de arista no cross.
    assert supports_cross_edge("Especificacion", "CONTIENE") is False


def test_link_label_no_traducible_falla_loud():
    with pytest.raises(BridgeError):
        link_dkg_to_dtm(T, "Tenant", "x", "en-US", "es-MX", "seg-1")


# ── Arista cross navegable (FalkorDB) ────────────────────────────────────────


@requires_falkordb
def test_arista_cross_persiste_y_es_navegable(dtm):
    """
    Crea un :Especificacion en el DKG y un :SegmentoTraduccion en el DTM del
    mismo tenant; vincula vía :TRADUCIDA_VIA; verifica que la arista persiste y
    es navegable (resuelve las coordenadas del nodo DKG de origen).
    """
    from app.graph.dkg_client import DKGClient

    dkg = DKGClient()
    g_dtm = graph_name_for_pair(T, "en-US", "es-MX")
    dtm.track_graph(g_dtm)

    try:
        # 1) :Especificacion en el DKG (grafo docyan_tenant_<T>).
        espec = dkg.create_node(T, "Especificacion", {"nombre": "Presión máxima", "valor": "10 bar"})
        # 2) :SegmentoTraduccion en el DTM del par.
        seg = dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion", _seg())

        # 3) Vincular vía :TRADUCIDA_VIA (nodo puente :ReferenciaDKG en el DTM).
        result = link_dkg_to_dtm(
            T, "Especificacion", espec["id"], "en-US", "es-MX", seg["id"], dtm=dtm)
        assert result["linked"] is True
        assert result["dkg_graph_name"] == "docyan_tenant_" + T

        # 4) Navegable: desde el id del nodo DKG llego al segmento + coordenadas.
        nav = navigate_translations(T, espec["id"], "en-US", "es-MX", dtm=dtm)
        assert len(nav) == 1
        assert nav[0]["dkg_label"] == "Especificacion"
        assert nav[0]["dkg_node_id"] == espec["id"]
        assert nav[0]["dkg_graph_name"] == "docyan_tenant_" + T
        assert nav[0]["segmento"]["texto_origen"] == "Pressure shall be verified."
    finally:
        dkg.drop_tenant_graph(T)


@requires_falkordb
def test_arista_traducido_desde_tambien_funciona(dtm):
    from app.graph.dkg_client import DKGClient

    dkg = DKGClient()
    dtm.track_graph(graph_name_for_pair(T, "en-US", "es-MX"))
    try:
        sub = dkg.create_node(T, "Subtitulo", {"bcp47": "en-US", "forma": "Open the valve"})
        seg = dtm.create_node(T, "en-US", "es-MX", "SegmentoTraduccion",
                              _seg(tipo_segmento="subtitulo"))
        result = link_dkg_to_dtm(
            T, "Subtitulo", sub["id"], "en-US", "es-MX", seg["id"],
            edge_type="TRADUCIDO_DESDE", dtm=dtm)
        assert result["linked"] is True

        nav = navigate_translations(
            T, sub["id"], "en-US", "es-MX", edge_type="TRADUCIDO_DESDE", dtm=dtm)
        assert len(nav) == 1 and nav[0]["dkg_label"] == "Subtitulo"
    finally:
        dkg.drop_tenant_graph(T)
