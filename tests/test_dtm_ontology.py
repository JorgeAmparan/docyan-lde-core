"""
B3 §1 / §1.1 — Ontología DTM: validación de nodos y enum cerrado de 23 tipos.

Tests de lógica pura (no requieren FalkorDB).
"""
import pytest

from app.graph.schemas.dtm_ontology import (
    DOMAIN_NODE_LABELS,
    DTM_CROSS_EDGES,
    DTM_INTERNAL_EDGES,
    TIPOS_SEGMENTO,
    DTMValidationError,
    dtm_ontology_summary,
    validate_dtm_node,
)


def test_hay_exactamente_23_tipos_segmento():
    assert len(TIPOS_SEGMENTO) == 23
    assert len(set(TIPOS_SEGMENTO)) == 23  # sin duplicados


@pytest.mark.parametrize("tipo", TIPOS_SEGMENTO)
def test_cada_tipo_segmento_valido_es_aceptado(tipo):
    """Los 23 valores del enum son aceptados en un :SegmentoTraduccion."""
    node = validate_dtm_node(
        "SegmentoTraduccion",
        {
            "texto_origen": "Pressure shall be checked.",
            "idioma_origen": "en-US",
            "idioma_destino": "es-MX",
            "tipo_segmento": tipo,
        },
    )
    assert node["tipo_segmento"] == tipo


def test_tipo_segmento_fuera_de_enum_falla_loud():
    """Un valor fuera de los 23 → DTMValidationError (no se inserta silenciosamente)."""
    with pytest.raises(DTMValidationError):
        validate_dtm_node(
            "SegmentoTraduccion",
            {
                "texto_origen": "x",
                "idioma_origen": "en-US",
                "idioma_destino": "es-MX",
                "tipo_segmento": "tipo_que_no_existe",
            },
        )


def test_label_desconocido_falla_loud():
    with pytest.raises(DTMValidationError):
        validate_dtm_node("NodoInventado", {"foo": "bar"})


def test_glosario_lock_terminologico_default_false():
    node = validate_dtm_node(
        "Glosario",
        {"tipo_glosario": "cliente", "par_linguistico": "en-US↔es-MX"},
    )
    assert node["lock_terminologico"] is False
    assert node["tipo_glosario"] == "cliente"


def test_glosario_lock_terminologico_true_se_conserva():
    node = validate_dtm_node(
        "Glosario",
        {"tipo_glosario": "agencia", "par_linguistico": "en-US↔es-MX",
         "lock_terminologico": True},
    )
    assert node["lock_terminologico"] is True


def test_glosario_tipo_invalido_falla():
    with pytest.raises(DTMValidationError):
        validate_dtm_node(
            "Glosario",
            {"tipo_glosario": "no_existe", "par_linguistico": "en-US↔es-MX"},
        )


def test_registro_revision_enums():
    node = validate_dtm_node(
        "RegistroRevision",
        {"revisor_id": "r1", "rol_revisor": "revisor_cliente", "accion": "aprobar"},
    )
    assert node["rol_revisor"] == "revisor_cliente"
    assert node["accion"] == "aprobar"

    with pytest.raises(DTMValidationError):
        validate_dtm_node(
            "RegistroRevision",
            {"revisor_id": "r1", "rol_revisor": "jefe", "accion": "aprobar"},
        )


def test_sugerencia_estado_default_propuesta():
    node = validate_dtm_node("SugerenciaTermino", {"texto_origen": "torque"})
    assert node["estado"] == "propuesta"


def test_domain_node_labels_son_cinco():
    assert len(DOMAIN_NODE_LABELS) == 5
    assert "SegmentoTraduccion" in DOMAIN_NODE_LABELS


def test_aristas_internas_son_seis():
    tipos = {e[1] for e in DTM_INTERNAL_EDGES}
    assert tipos == {
        "PERTENECE_A_PROYECTO",
        "RECIBIO_REVISION",
        "CONTIENE_TERMINO",
        "USA_GLOSARIO",
        "USA_TERMINO_GLOSARIO",
        "CANDIDATA_PARA_GLOSARIO",
    }


def test_aristas_cross_definidas():
    tipos = {e[1] for e in DTM_CROSS_EDGES}
    assert tipos == {"TRADUCIDA_VIA", "TRADUCIDO_DESDE"}


def test_ontology_summary_introspectable():
    summary = dtm_ontology_summary()
    assert summary["graph_name_prefix"] == "docyan_dtm_"
    assert len(summary["tipos_segmento"]) == 23
    assert "SegmentoTraduccion" in summary["validated_nodes"]
