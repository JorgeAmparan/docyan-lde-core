"""
Provisioning de grafos DTM por tenant — DOCYAN LDE™ by XCID.

B3 §7 (Adenda MVP). Instancia los 5 grafos DTM iniciales de un tenant (uno por
par lingüístico, §2) **vacíos y con el schema aplicado**, de forma **idempotente**.

Qué significa "schema aplicado" en FalkorDB: el grafo es *schemaless* a nivel de
nodos (se crean dinámicamente), pero sí soporta **índices por etiqueta+propiedad**.
Aplicar el schema = crear los índices del catálogo (`DTM_INDEXED_PROPERTIES`)
para cada etiqueta de dominio. Esto:

  - **Materializa** el grafo en `GRAPH.LIST` aunque no tenga datos (queda vacío
    de nodos de dominio pero existente y listo).
  - Deja los índices que B5/B6 necesitarán (lookup por par/tipo/cliente/estado)
    sin retrabajo ni migración al reactivarse traducción.

Idempotencia: FalkorDB lanza `ResponseError: Attribute '<x>' is already indexed`
si el índice ya existe; se captura y se trata como no-op. Llamar dos veces no
duplica ni rompe (B3 test de idempotencia).

Para tenants nuevos, el onboarding (B13) invocará `provision_dtm_graphs_for_tenant`;
B3 expone la función. No hay flujo de traducción aquí — solo cimientos.
"""
from __future__ import annotations

import logging

from app.graph.dtm_client import DTMClient
from app.graph.dtm_segregation import INITIAL_PAIRS, graph_name_for_pair
from app.graph.schemas.dtm_ontology import DTM_INDEXED_PROPERTIES

logger = logging.getLogger("docyan.dtm.provisioning")

_ALREADY_INDEXED_MARKERS = ("already indexed", "already been indexed")


def _apply_schema_to_graph(client: DTMClient, graph_name: str) -> dict:
    """
    Aplica el schema (índices del catálogo) a un grafo DTM. Idempotente.

    Devuelve `{"created": [..], "existing": [..]}` con las claves
    `"<Label>.<prop>"` de los índices creados vs. ya existentes.
    """
    graph = client._graph_named(graph_name)
    created: list[str] = []
    existing: list[str] = []
    for label, props in DTM_INDEXED_PROPERTIES.items():
        for prop in props:
            key = f"{label}.{prop}"
            try:
                graph.query(
                    f"CREATE INDEX FOR (n:{label}) ON (n.{prop})",
                    timeout=client.query_timeout_ms,
                )
                created.append(key)
            except Exception as exc:  # noqa: BLE001
                msg = str(exc).lower()
                if any(marker in msg for marker in _ALREADY_INDEXED_MARKERS):
                    existing.append(key)  # idempotencia: ya estaba → no-op.
                else:
                    raise
    return {"created": created, "existing": existing}


def provision_dtm_graphs_for_tenant(
    tenant_id: str,
    client: DTMClient | None = None,
) -> list[dict]:
    """
    Crea (o asegura) los 5 grafos DTM iniciales del tenant con schema aplicado.

    Idempotente: re-ejecutar no duplica grafos ni índices. Devuelve una lista de
    `{"graph_name", "pair", "created_indexes", "existing_indexes"}`, uno por par.
    """
    tid = (tenant_id or "").strip()
    if not tid:
        raise ValueError("tenant_id no puede ser vacío.")
    cli = client or DTMClient()

    report: list[dict] = []
    for source_lang, target_lang in INITIAL_PAIRS:
        graph_name = graph_name_for_pair(tid, source_lang, target_lang)
        schema_result = _apply_schema_to_graph(cli, graph_name)
        report.append(
            {
                "graph_name": graph_name,
                "pair": f"{source_lang}->{target_lang}",
                "created_indexes": schema_result["created"],
                "existing_indexes": schema_result["existing"],
            }
        )
        logger.info(
            "DTM provisioning | graph=%s | created=%d existing=%d",
            graph_name,
            len(schema_result["created"]),
            len(schema_result["existing"]),
        )
    return report
