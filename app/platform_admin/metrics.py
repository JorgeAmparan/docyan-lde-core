"""
Agregación de métricas de plataforma (F2) — SOLO metadata.

Combina conteos del `PlatformStore` (Postgres) con el TAMAÑO del grafo (FalkorDB
vía dkg_client) como conteo de nodos/relaciones. NUNCA lee contenido: las consultas
de grafo son `count()`, jamás `RETURN n`/propiedades. Si FalkorDB no es alcanzable,
`grafo.reachable=False` y los conteos quedan en null (best-effort, no rompe).
"""
from __future__ import annotations

from typing import Any

from app.platform_admin.models import (
    BudgetMetrics,
    GraphMetrics,
    OrgList,
    OrgMetrics,
    OrgSummary,
    PlatformSummary,
)


class MetricsService:
    def __init__(self, store: Any, dkg: Any = None) -> None:
        self.store = store
        self._dkg = dkg

    def _dkg_client(self):
        if self._dkg is None:
            from app.graph.dkg_client import dkg_client

            self._dkg = dkg_client
        return self._dkg

    def graph_metrics(self, org_id: str) -> GraphMetrics:
        """Conteo de nodos/relaciones del grafo del tenant (metadata, no contenido)."""
        try:
            dkg = self._dkg_client()
            nodes = dkg.query(org_id, "MATCH (n) RETURN count(n) AS n")
            rels = dkg.query(org_id, "MATCH ()-[r]->() RETURN count(r) AS n")
            return GraphMetrics(
                nodes=int(nodes[0]["n"]) if nodes else 0,
                relationships=int(rels[0]["n"]) if rels else 0,
                reachable=True,
            )
        except Exception:  # noqa: BLE001 — FalkorDB no alcanzable: best-effort
            return GraphMetrics(nodes=None, relationships=None, reachable=False)

    def list_orgs(self) -> OrgList:
        rows = self.store.list_orgs()
        items = [OrgSummary(**r) for r in rows]
        return OrgList(items=items, total=len(items))

    def org_metrics(self, org_id: str, *, include_graph: bool = True) -> OrgMetrics:
        budget = self.store.get_budget(org_id)
        bm = BudgetMetrics(
            saldo_actual_usd=float(budget["saldo_actual_usd"]) if budget else None,
            hard_cap_por_documento=float(budget["hard_cap_por_documento"]) if budget else None,
            hard_cap_por_sesion=float(budget["hard_cap_por_sesion"]) if budget else None,
            moneda=(budget or {}).get("moneda", "USD"),
        )
        return OrgMetrics(
            org_id=org_id,
            users=self.store.count_users(org_id),
            documentos_ingeridos=self.store.count_documents(org_id),
            # almacenamiento_bytes / tiempos de ingesta: no instrumentados a nivel
            # de fila todavía (no hay columna de tamaño ni timestamps de job). Se
            # dejan en null — honesto — y se completan en un sprint posterior.
            almacenamiento_bytes=None,
            ingesta_tiempo_total_seg=None,
            ingesta_tiempo_promedio_seg=None,
            consultas_total=self.store.sum_consultas(org_id),
            grafo=self.graph_metrics(org_id) if include_graph else GraphMetrics(reachable=False),
            presupuesto=bm,
        )

    def summary(self, jobs_activos: int, ingresos_periodo: float, moneda: str = "MXN") -> PlatformSummary:
        return PlatformSummary(
            total_orgs=self.store.total_orgs(),
            total_usuarios=self.store.total_users(),
            almacenamiento_total_bytes=None,
            jobs_activos=jobs_activos,
            ingresos_periodo=round(ingresos_periodo, 2),
            ingresos_moneda=moneda,
        )
