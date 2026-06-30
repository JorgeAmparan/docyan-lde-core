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
    GraphMetrics,
    OrgList,
    OrgMetrics,
    OrgSummary,
    PlatformSummary,
    PlatformTrends,
    TrendPoint,
)


def _ym(value) -> str | None:
    """Mes 'YYYY-MM' a partir de un timestamp ISO/str; None si no se puede parsear."""
    if not value:
        return None
    s = str(value)
    return s[:7] if len(s) >= 7 and s[4] == "-" else None


class MetricsService:
    def __init__(self, store: Any, dkg: Any = None, jobs_backend: Any = None) -> None:
        self.store = store
        self._dkg = dkg
        # F1.5: fuente viva de peso/tiempo de ingesta del flujo GraphRAG-SDK son
        # los IngestJob (Redis), que la plataforma ya lee cross-org. La tabla
        # `documents` (size_bytes) aporta el peso del camino Postgres (DII/legacy)
        # de forma aditiva. Si jobs_backend es None, esa parte queda en null.
        self._jobs_backend = jobs_backend

    def _dkg_client(self):
        if self._dkg is None:
            from app.graph.dkg_client import dkg_client

            self._dkg = dkg_client
        return self._dkg

    def _completed_jobs(self, org_id: str | None = None) -> list:
        """Jobs COMPLETADOS (no idempotentes) del org, o de todos si org_id None."""
        if self._jobs_backend is None:
            return []
        try:
            jobs = self._jobs_backend.list_all_jobs()
        except Exception:  # noqa: BLE001 — Redis no alcanzable: best-effort
            return []
        out = []
        for j in jobs:
            if j.status.value != "completed":
                continue
            if org_id is not None and j.tenant_id != org_id:
                continue
            out.append(j)
        return out

    def _ingesta_storage_y_tiempos(self, org_id: str):
        """
        Agrega peso (bytes) y tiempos de ingesta por org desde los IngestJob
        completados (+ documents.size_bytes del camino Postgres). Devuelve
        (almacenamiento_bytes, tiempo_total_seg, tiempo_promedio_seg). Cualquiera
        en null si no hay nada que instrumentar (honesto, no 0 inventado)."""
        jobs = self._completed_jobs(org_id)

        # Peso: bytes del resultado almacenado si está; si no, del archivo original.
        job_bytes = sum(
            int(j.bytes_resultado or j.bytes_originales or 0) for j in jobs
        )
        docs_bytes = 0
        if hasattr(self.store, "sum_storage_bytes"):
            try:
                docs_bytes = int(self.store.sum_storage_bytes(org_id) or 0)
            except Exception:  # noqa: BLE001
                docs_bytes = 0
        total_bytes = job_bytes + docs_bytes
        almacenamiento = total_bytes if (jobs or docs_bytes) else None

        # Tiempos: duración real por job completado.
        duraciones = [j.duracion_seg for j in jobs if j.duracion_seg is not None]
        if duraciones:
            total_seg = round(sum(duraciones), 3)
            promedio_seg = round(total_seg / len(duraciones), 3)
        else:
            total_seg = promedio_seg = None
        return almacenamiento, total_seg, promedio_seg

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
        # F1.5: peso y tiempos reales de ingesta (antes null) — metadata, no contenido.
        almacenamiento, tiempo_total, tiempo_prom = self._ingesta_storage_y_tiempos(org_id)
        return OrgMetrics(
            org_id=org_id,
            users=self.store.count_users(org_id),
            documentos_ingeridos=self.store.count_documents(org_id),
            almacenamiento_bytes=almacenamiento,
            ingesta_tiempo_total_seg=tiempo_total,
            ingesta_tiempo_promedio_seg=tiempo_prom,
            consultas_total=self.store.sum_consultas(org_id),
            grafo=self.graph_metrics(org_id) if include_graph else GraphMetrics(reachable=False),
        )

    def trends(self, moneda: str = "MXN") -> PlatformTrends:
        """
        Series temporales REALES (no canned) para las gráficas de Resumen:
          · orgs_acumuladas — altas por mes (created_at de orgs), acumulado.
          · ingresos_por_mes — suma de manual_payments por mes en `moneda`.
          · consultas_por_mes — pcl_metrics_daily agregado por mes (cross-org).
        Series vacías si la fuente no tiene datos (honesto). Todo es metadata.
        """
        # Ingresos por mes (de pagos manuales reales en la moneda pedida).
        ingresos: dict[str, float] = {}
        for p in self.store.list_payments():
            if p.get("moneda") != moneda:
                continue
            ym = _ym(p.get("fecha") or p.get("created_at"))
            if ym:
                ingresos[ym] = round(ingresos.get(ym, 0.0) + float(p["monto"]), 2)

        # Altas de orgs por mes → acumulado.
        altas: dict[str, int] = {}
        for o in self.store.list_orgs():
            ym = _ym(o.get("created_at"))
            if ym:
                altas[ym] = altas.get(ym, 0) + 1
        orgs_acumuladas: list[TrendPoint] = []
        running = 0
        for ym in sorted(altas):
            running += altas[ym]
            orgs_acumuladas.append(TrendPoint(label=ym, value=float(running)))

        # Consultas por mes (pcl_metrics_daily agregado cross-org).
        consultas: dict[str, float] = {}
        for r in self.store.list_consultas_daily():
            ym = _ym(r.get("fecha"))
            if ym:
                consultas[ym] = consultas.get(ym, 0.0) + float(r.get("consultas_totales", 0))

        return PlatformTrends(
            orgs_acumuladas=orgs_acumuladas,
            ingresos_por_mes=[TrendPoint(label=ym, value=ingresos[ym]) for ym in sorted(ingresos)],
            consultas_por_mes=[TrendPoint(label=ym, value=consultas[ym]) for ym in sorted(consultas)],
            moneda=moneda,
        )

    def summary(self, jobs_activos: int, ingresos_periodo: float, moneda: str = "MXN") -> PlatformSummary:
        # Almacenamiento total = peso de jobs completados (todas las orgs) + documents.
        jobs = self._completed_jobs(None)
        job_bytes = sum(int(j.bytes_resultado or j.bytes_originales or 0) for j in jobs)
        docs_bytes = 0
        if hasattr(self.store, "total_storage_bytes"):
            try:
                docs_bytes = int(self.store.total_storage_bytes() or 0)
            except Exception:  # noqa: BLE001
                docs_bytes = 0
        total_bytes = job_bytes + docs_bytes
        almacenamiento_total = total_bytes if (jobs or docs_bytes) else None
        return PlatformSummary(
            total_orgs=self.store.total_orgs(),
            total_usuarios=self.store.total_users(),
            almacenamiento_total_bytes=almacenamiento_total,
            jobs_activos=jobs_activos,
            ingresos_periodo=round(ingresos_periodo, 2),
            ingresos_moneda=moneda,
        )
