"""
Puente DKG ↔ DTM — DOCYAN LDE™ by XCID.

B3 §5 / §6 (Adenda MVP, cimientos). Registra y materializa el vínculo entre un
nodo de contenido del DKG (`:Especificacion`, `:Paso`, `:Advertencia`,
`:Subtitulo`, `:Transcripcion`, ...) y su `:SegmentoTraduccion` en el DTM, vía
las aristas `:TRADUCIDA_VIA` y `:TRADUCIDO_DESDE`.

VERDAD OPERACIONAL — restricción real de FalkorDB
--------------------------------------------------
FalkorDB aísla cada grafo por `graph_name`: **una arista no puede unir nodos de
dos grafos distintos**. El DKG vive en `docyan_tenant_<id>` y el DTM en
`docyan_dtm_<id>_<par>` (segregación inviolable). Por tanto, una arista cross
*literal* entre ambos grafos es imposible — no es una decisión de diseño, es el
motor.

El puente la realiza de la forma fiel posible respetando el aislamiento: dentro
del grafo DTM del par se crea un **nodo puente** `:ReferenciaDKG` que lleva las
coordenadas del nodo DKG de origen (`dkg_node_id`, `dkg_label`, `dkg_graph_name`)
y una arista REAL `(:ReferenciaDKG)-[:TRADUCIDA_VIA|:TRADUCIDO_DESDE]->(:SegmentoTraduccion)`.
La arista persiste y es navegable dentro del grafo DTM; la resolución completa
hacia el DKG se hace por coordenadas (la única vía dado el aislamiento).

ALCANCE B3: el TIPO de arista queda registrado en el schema del DKG
(`dkg_ontology.EdgeType.TRADUCIDA_VIA/TRADUCIDO_DESDE` + `DKG_TRANSLATABLE_LABELS`)
y el puente expone `link_dkg_to_dtm` / `navigate_translations` para demostrar
que la estructura soporta el vínculo. El **flujo de creación en runtime** durante
la ingesta bilingüe es B6; la **lectura por el motor de traducción** es B5.
"""
from __future__ import annotations

import logging

from app.graph.dtm_client import DTMClient
from app.graph.dtm_segregation import graph_name_for_pair
from app.graph.schemas.dkg_ontology import (
    DKG_TRANSLATABLE_LABELS,
    EdgeType,
)
from app.graph.schemas.dkg_ontology import (
    graph_name_for as dkg_graph_name_for,
)
from app.graph.schemas.dtm_ontology import DTMNodeLabel

logger = logging.getLogger("docyan.dtm.bridge")

# Tipos de arista cross válidos (registrados en el schema del DKG en B3 §6).
CROSS_EDGE_TYPES: tuple[str, ...] = (
    EdgeType.TRADUCIDA_VIA.value,
    EdgeType.TRADUCIDO_DESDE.value,
)


class BridgeError(ValueError):
    """Uso inválido del puente DKG↔DTM (label no traducible, arista no soportada)."""


def register_cross_edges() -> dict:
    """
    Introspección del registro de aristas cross en el schema (prueba de §6: que
    los tipos y los labels DKG traducibles están declarados, sin ejercitarlos).
    """
    return {
        "cross_edge_types": list(CROSS_EDGE_TYPES),
        "dkg_translatable_labels": list(DKG_TRANSLATABLE_LABELS),
        "dtm_target_label": DTMNodeLabel.SEGMENTO_TRADUCCION.value,
        "bridge_node_label": DTMNodeLabel.REFERENCIA_DKG.value,
    }


def supports_cross_edge(dkg_label: str, edge_type: str) -> bool:
    """True si `dkg_label` puede ser origen de `edge_type` hacia el DTM."""
    return dkg_label in DKG_TRANSLATABLE_LABELS and edge_type in CROSS_EDGE_TYPES


def link_dkg_to_dtm(
    tenant_id: str,
    dkg_label: str,
    dkg_node_id: str,
    source_lang: str,
    target_lang: str,
    segmento_id: str,
    edge_type: str = EdgeType.TRADUCIDA_VIA.value,
    dtm: DTMClient | None = None,
) -> dict:
    """
    Materializa el vínculo cross DKG↔DTM para un par lingüístico.

    Crea (o reutiliza) el nodo puente `:ReferenciaDKG` en el grafo DTM del par,
    con las coordenadas del nodo DKG, y la arista `edge_type` REAL desde el puente
    hacia el `:SegmentoTraduccion` indicado. Idempotente sobre el nodo puente
    (MERGE por coordenadas) — múltiples segmentos pueden colgar del mismo origen.

    Devuelve `{"linked": bool, "dtm_graph_name", "dkg_graph_name", "edge_type",
    "dkg_node_id", "segmento_id"}`. `linked=False` si el segmento no existe.

    NOTA B3: no es el flujo de ingesta (B6); es la API que demuestra el modelo.
    """
    if not supports_cross_edge(dkg_label, edge_type):
        raise BridgeError(
            f"Arista cross no soportada: ({dkg_label})-[:{edge_type}]->"
            f"(:SegmentoTraduccion). Labels traducibles: {DKG_TRANSLATABLE_LABELS}; "
            f"tipos: {CROSS_EDGE_TYPES}."
        )
    cli = dtm or DTMClient()
    dtm_graph = graph_name_for_pair(tenant_id, source_lang, target_lang)
    dkg_graph = dkg_graph_name_for(tenant_id)

    graph = cli._graph_named(dtm_graph)
    result = graph.query(
        f"""
        MATCH (s:{DTMNodeLabel.SEGMENTO_TRADUCCION.value} {{id: $segmento_id}})
        MERGE (ref:{DTMNodeLabel.REFERENCIA_DKG.value} {{
            dkg_node_id: $dkg_node_id,
            dkg_label: $dkg_label,
            dkg_graph_name: $dkg_graph
        }})
        ON CREATE SET ref.tenant_id = $tenant_id
        CREATE (ref)-[r:{edge_type}]->(s)
        RETURN ref, r
        """,
        params={
            "segmento_id": segmento_id,
            "dkg_node_id": dkg_node_id,
            "dkg_label": dkg_label,
            "dkg_graph": dkg_graph,
            "tenant_id": tenant_id,
        },
        timeout=cli.query_timeout_ms,
    )
    linked = bool(result.result_set)
    logger.info(
        "DTM bridge link | dtm_graph=%s | %s -[:%s]-> segmento=%s | linked=%s",
        dtm_graph, dkg_label, edge_type, segmento_id, linked,
    )
    return {
        "linked": linked,
        "dtm_graph_name": dtm_graph,
        "dkg_graph_name": dkg_graph,
        "edge_type": edge_type,
        "dkg_node_id": dkg_node_id,
        "segmento_id": segmento_id,
    }


def navigate_translations(
    tenant_id: str,
    dkg_node_id: str,
    source_lang: str,
    target_lang: str,
    edge_type: str = EdgeType.TRADUCIDA_VIA.value,
    dtm: DTMClient | None = None,
) -> list[dict]:
    """
    Navega el vínculo cross: dado el id del nodo DKG de origen, devuelve los
    `:SegmentoTraduccion` vinculados en el grafo DTM del par (con las coordenadas
    DKG del nodo puente). Prueba que la arista es navegable (B3 test cross).
    """
    cli = dtm or DTMClient()
    rows = cli.query(
        tenant_id,
        source_lang,
        target_lang,
        f"""
        MATCH (ref:{DTMNodeLabel.REFERENCIA_DKG.value} {{dkg_node_id: $dkg_node_id}})
              -[:{edge_type}]->(s:{DTMNodeLabel.SEGMENTO_TRADUCCION.value})
        RETURN s AS segmento, ref.dkg_label AS dkg_label,
               ref.dkg_graph_name AS dkg_graph_name, ref.dkg_node_id AS dkg_node_id
        """,
        {"dkg_node_id": dkg_node_id},
    )
    return rows
