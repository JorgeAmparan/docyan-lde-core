"""
Cliente DTM (Document Translation Memory) — fachada sobre FalkorDB.

DOCYAN LDE™ by XCID — B3 (Adenda MVP, solo cimientos).

Reutiliza la conexión FalkorDB de la fachada DKG de B1 (`DKGClient`) — **no
recrea la conexión** (nota B3 "Notas para Opus"): comparte el mismo driver
`falkordb` y, por tanto, la misma semántica de `graph_name`. Lo que añade es:

  - Resolución de grafos por **par lingüístico** (segregación B3 §2), nunca por
    `tenant_id` solo. Toda escritura/lectura va a un `docyan_dtm_{tenant}_{par}`.
  - Validación de nodos contra la ontología DTM (`dtm_ontology`) antes de escribir
    — incluido el enum cerrado de 23 `tipo_segmento`, que falla *loud*.

ALCANCE: cimientos. Este cliente crea/lee nodos y aristas del MODELO. El motor
de traducción (búsqueda priorizada, fuzzy, lock activo) NO vive aquí — es B5.
"""
from __future__ import annotations

import logging
import uuid

from app.graph.dkg_client import DKGClient
from app.graph.dtm_segregation import graph_name_for_pair
from app.graph.schemas.dtm_ontology import (
    DTM_GRAPH_PREFIX,
    validate_dtm_node,
)

logger = logging.getLogger("docyan.dtm")


class DTMClient:
    """Fachada del DTM segregada por par lingüístico sobre FalkorDB."""

    def __init__(self, dkg: DKGClient | None = None):
        # Reutiliza la conexión/pool/retry de la fachada DKG (B1). Un solo driver.
        self._dkg = dkg or DKGClient()

    # ── Conexión / resolución de grafo ─────────────────────────────────────────

    @property
    def query_timeout_ms(self) -> int:
        return self._dkg.query_timeout_ms

    def _graph_named(self, graph_name: str):
        """Selecciona un grafo DTM por nombre completo ya resuelto."""
        if not graph_name.startswith(DTM_GRAPH_PREFIX):
            raise ValueError(
                f"graph_name '{graph_name}' no es un grafo DTM "
                f"(debe empezar con '{DTM_GRAPH_PREFIX}')."
            )
        return self._dkg._connect().select_graph(graph_name)

    def _graph_for_pair(self, tenant_id: str, source_lang: str, target_lang: str):
        return self._graph_named(graph_name_for_pair(tenant_id, source_lang, target_lang))

    def health(self) -> bool:
        return self._dkg.health()

    # ── Query (segregada por par) ───────────────────────────────────────────────

    def query(
        self,
        tenant_id: str,
        source_lang: str,
        target_lang: str,
        cypher: str,
        params: dict | None = None,
    ) -> list[dict]:
        """Ejecuta Cypher SOBRE EL GRAFO DEL PAR. Confinamiento a nivel FalkorDB."""
        graph = self._graph_for_pair(tenant_id, source_lang, target_lang)
        logger.info(
            "DTM query | graph=%s | cypher=%s",
            graph_name_for_pair(tenant_id, source_lang, target_lang),
            cypher.strip().split("\n")[0][:200],
        )  # NO se loguean params.
        result = graph.query(cypher, params=params or {}, timeout=self.query_timeout_ms)
        return self._dkg._records(result)

    def query_graph(self, graph_name: str, cypher: str, params: dict | None = None) -> list[dict]:
        """Query por nombre de grafo ya resuelto (para provisioning / inspección)."""
        graph = self._graph_named(graph_name)
        result = graph.query(cypher, params=params or {}, timeout=self.query_timeout_ms)
        return self._dkg._records(result)

    # ── Escritura de nodos (validada) ───────────────────────────────────────────

    def create_node(
        self,
        tenant_id: str,
        source_lang: str,
        target_lang: str,
        label: str,
        props: dict,
    ) -> dict:
        """Crea un nodo DTM validado contra la ontología, en el grafo del par."""
        graph_name = graph_name_for_pair(tenant_id, source_lang, target_lang)
        return self.create_node_in_graph(graph_name, label, props)

    def create_node_in_graph(self, graph_name: str, label: str, props: dict) -> dict:
        """Crea un nodo DTM validado en un grafo ya resuelto."""
        validated = validate_dtm_node(label, props)
        if "id" not in validated:
            validated["id"] = uuid.uuid4().hex
        graph = self._graph_named(graph_name)
        result = graph.query(
            f"CREATE (n:{label}) SET n = $props RETURN n",
            params={"props": validated},
            timeout=self.query_timeout_ms,
        )
        logger.info("DTM create | graph=%s | label=%s", graph_name, label)
        return self._dkg._node_to_dict(result.result_set[0][0])

    def get_node(self, graph_name: str, label: str, node_id: str) -> dict | None:
        rows = self.query_graph(
            graph_name,
            f"MATCH (n:{label} {{id: $id}}) RETURN n",
            {"id": node_id},
        )
        return rows[0] if rows else None

    # ── Escritura de aristas internas (validada por catálogo) ───────────────────

    def create_edge(
        self,
        graph_name: str,
        src_label: str,
        src_id: str,
        edge_type: str,
        dst_label: str,
        dst_id: str,
        edge_props: dict | None = None,
    ) -> bool:
        """
        Crea una arista interna del DTM entre dos nodos del MISMO grafo del par.

        Las aristas no cruzan `graph_name` en FalkorDB; los vínculos cross DKG↔DTM
        se manejan aparte (ver dkg_dtm_bridge). Devuelve True si la arista se creó.
        """
        graph = self._graph_named(graph_name)
        result = graph.query(
            f"""
            MATCH (a:{src_label} {{id: $src_id}}), (b:{dst_label} {{id: $dst_id}})
            CREATE (a)-[r:{edge_type}]->(b)
            SET r = $eprops
            RETURN r
            """,
            params={
                "src_id": src_id,
                "dst_id": dst_id,
                "eprops": edge_props or {},
            },
            timeout=self.query_timeout_ms,
        )
        return bool(result.result_set)

    def drop_pair_graph(self, tenant_id: str, source_lang: str, target_lang: str) -> bool:
        """Elimina el grafo de un par (admin / cleanup de tests)."""
        try:
            self._graph_for_pair(tenant_id, source_lang, target_lang).delete()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("drop_pair_graph falló: %s", type(exc).__name__)
            return False

    def drop_graph_named(self, graph_name: str) -> bool:
        try:
            self._graph_named(graph_name).delete()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("drop_graph_named(%s) falló: %s", graph_name, type(exc).__name__)
            return False

    def list_dtm_graphs(self, tenant_id: str | None = None) -> list[str]:
        """Lista los grafos DTM existentes (opcionalmente filtrados por tenant)."""
        db = self._dkg._connect()
        prefix = f"{DTM_GRAPH_PREFIX}{tenant_id}_" if tenant_id else DTM_GRAPH_PREFIX
        return sorted(
            g for g in db.list_graphs()
            if isinstance(g, str) and g.startswith(prefix)
        )


# Singleton de módulo (mismo patrón que dkg_client / bge_client).
dtm_client = DTMClient()
