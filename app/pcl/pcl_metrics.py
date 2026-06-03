"""
Instrumentación de la CCP/PCL — métricas por consulta + agregado diario (B8.5 §1.4).

DOCYAN LDE™ by XCID — doc CCP §7.

Sin métricas, el modelo de pricing no se puede defender empíricamente (doc §7.4).
Dos planos:

  - **Por consulta (FAT familia F4):** la fachada registra cada `consulta_servida`
    con `modo_respuesta`, `costo_estimado_centavos`, `latencia_ms`,
    `similitud_cache` y `dkg_state_hash`. Es la fuente de verdad (la verdad
    operativa vive en FAT, no en Redis — doc §11).
  - **Agregado por DoCo/día (`pcl_metrics_daily`):** la tarea programada de las
    03:00h lee los eventos FAT del día y materializa conteos, costos, percentiles
    de latencia y conteos de sugerencias. El endpoint admin lee de esta tabla.

`registrar_consulta` mantiene además un buffer en memoria del proceso (para
métricas "del día en curso" sin esperar al agregado); el agregado diario NO
depende del buffer: relee FAT, que sobrevive reinicios.
"""
from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Protocol

from app.audit.familias import FamiliaFAT
from app.pcl.modes import ModoRespuesta
from app.schemas.pcl_payloads import (
    MetricasCCP,
    MetricasCCPTotales,
    MetricasDiaCCP,
)

logger = logging.getLogger("docyan.pcl.metrics")

#: tipo_evento FAT (familia F4) que la fachada emite por cada consulta servida.
EVENTO_CONSULTA = "consulta_servida"


# ── Store de `pcl_metrics_daily` ────────────────────────────────────────────────


class PCLMetricsStore(Protocol):
    def upsert_dia(self, fila: dict) -> dict: ...
    def consultar(self, tenant_id: str, desde: date, hasta: date) -> list[dict]: ...


class InMemoryPCLMetricsStore:
    """Backend en memoria (tests). Clave única (tenant_id, fecha)."""

    def __init__(self) -> None:
        self._filas: dict[tuple[str, str], dict] = {}

    def upsert_dia(self, fila: dict) -> dict:
        key = (fila["tenant_id"], str(fila["fecha"]))
        self._filas[key] = dict(fila)
        return dict(fila)

    def consultar(self, tenant_id: str, desde: date, hasta: date) -> list[dict]:
        out = [
            dict(f)
            for (tid, fecha), f in self._filas.items()
            if tid == tenant_id and str(desde) <= fecha <= str(hasta)
        ]
        return sorted(out, key=lambda f: str(f["fecha"]))


class SupabasePCLMetricsStore:
    """Backend real sobre `pcl_metrics_daily` (RLS por tenant, SERVICE_KEY)."""

    TABLE = "pcl_metrics_daily"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("pcl_metrics", service=True)
            self._client = create_client(url, key)
        return self._client

    def upsert_dia(self, fila: dict) -> dict:
        rec = dict(fila)
        rec["fecha"] = str(rec["fecha"])
        res = (
            self._sb()
            .table(self.TABLE)
            .upsert(rec, on_conflict="tenant_id,fecha")
            .execute()
        )
        return res.data[0] if res.data else rec

    def consultar(self, tenant_id: str, desde: date, hasta: date) -> list[dict]:
        res = (
            self._sb()
            .table(self.TABLE)
            .select("*")
            .eq("tenant_id", tenant_id)
            .gte("fecha", str(desde))
            .lte("fecha", str(hasta))
            .order("fecha")
            .execute()
        )
        return res.data or []


# ── Utilidades de agregación ────────────────────────────────────────────────────


def _percentil(valores: list[int], p: float) -> int:
    if not valores:
        return 0
    s = sorted(valores)
    if len(s) == 1:
        return int(s[0])
    rank = p * (len(s) - 1)
    lo = int(rank)
    hi = min(lo + 1, len(s) - 1)
    frac = rank - lo
    return int(round(s[lo] + (s[hi] - s[lo]) * frac))


def _fecha_de(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts).date().isoformat()
    except (ValueError, TypeError):
        return (ts or "")[:10]


@dataclass
class PCLMetrics:
    """Registro por consulta + agregación diaria + lectura para el endpoint admin."""

    store: PCLMetricsStore = field(default_factory=InMemoryPCLMetricsStore)
    fat: Any = None  # FATExtendido — fuente de los eventos F4
    _buffer: dict[str, list[dict]] = field(default_factory=dict)

    def registrar_consulta(self, tenant_id: str, evento: dict) -> None:
        """Agrega un evento de consulta al buffer del proceso (métricas en vivo)."""
        self._buffer.setdefault(tenant_id, []).append(evento)

    def buffer_de(self, tenant_id: str) -> list[dict]:
        return list(self._buffer.get(tenant_id, []))

    def _fat(self):
        if self.fat is None:
            from app.audit.fat_extendido import FATExtendido
            from app.audit.stores import HybridFATStore

            self.fat = FATExtendido(HybridFATStore())
        return self.fat

    def agregar_diario(
        self, tenant_id: str, fecha: date, sugerencias_store: Any = None
    ) -> dict:
        """
        Lee los eventos FAT F4 `consulta_servida` del día y materializa la fila de
        `pcl_metrics_daily` (doc §7.2). Invocado por el scheduler a las 03:00h.
        """
        objetivo = str(fecha)
        eventos = [
            e
            for e in self._fat().eventos(tenant_id)
            if e.familia == FamiliaFAT.F4_CONSULTA
            and e.tipo_evento == EVENTO_CONSULTA
            and _fecha_de(e.timestamp) == objetivo
        ]

        total = len(eventos)
        cache_hit = retrieval = synthesis = 0
        costo_total = 0.0
        latencias: list[int] = []
        entidades: Counter = Counter()
        costos_unicas: list[float] = []

        for e in eventos:
            pl = e.payload or {}
            modo = pl.get("modo_respuesta")
            if modo == ModoRespuesta.CACHE_HIT.value:
                cache_hit += 1
            elif modo == ModoRespuesta.RETRIEVAL_FIRST.value:
                retrieval += 1
                costos_unicas.append(float(pl.get("costo_estimado_centavos") or 0.0))
            elif modo == ModoRespuesta.SYNTHESIS_FIRST.value:
                synthesis += 1
                costos_unicas.append(float(pl.get("costo_estimado_centavos") or 0.0))
            costo_total += float(pl.get("costo_estimado_centavos") or 0.0)
            latencias.append(int(pl.get("latencia_ms") or 0))
            if pl.get("entidad_id"):
                entidades[str(pl["entidad_id"])] += 1

        emitidas, aceptadas, rechazadas = self._contar_sugerencias(
            sugerencias_store, tenant_id, objetivo
        )

        fila = {
            "tenant_id": tenant_id,
            "fecha": objetivo,
            "consultas_totales": total,
            "consultas_cache_hit": cache_hit,
            "consultas_retrieval_first": retrieval,
            "consultas_synthesis_first": synthesis,
            "costo_total_centavos": round(costo_total, 4),
            "costo_promedio_por_consulta": round(costo_total / total, 4) if total else 0.0,
            "costo_promedio_por_consulta_unica": (
                round(sum(costos_unicas) / len(costos_unicas), 4) if costos_unicas else 0.0
            ),
            "latencia_p50_ms": _percentil(latencias, 0.50),
            "latencia_p95_ms": _percentil(latencias, 0.95),
            "top_patrones_detectados": [
                {"entidad_id": eid, "consultas": n} for eid, n in entidades.most_common(5)
            ],
            "sugerencias_emitidas": emitidas,
            "sugerencias_aceptadas": aceptadas,
            "sugerencias_rechazadas": rechazadas,
        }
        return self.store.upsert_dia(fila)

    @staticmethod
    def _contar_sugerencias(
        sugerencias_store: Any, tenant_id: str, fecha: str
    ) -> tuple[int, int, int]:
        """
        Cuenta sugerencias emitidas/aceptadas/rechazadas del día desde el almacén de
        Playbooks (Nivel C). Usa solo la API pública del store; sin store → ceros.
        """
        if sugerencias_store is None:
            return (0, 0, 0)
        emitidas = aceptadas = rechazadas = 0
        try:
            usuarios = sugerencias_store.usuarios_con_consultas(tenant_id)
            for user_id in usuarios:
                for s in sugerencias_store.listar_sugerencias(tenant_id, user_id):
                    if _fecha_de(s.get("created_at", "")) == fecha:
                        emitidas += 1
                    if s.get("decidido_at") and _fecha_de(s["decidido_at"]) == fecha:
                        if s.get("estado") == "aceptada":
                            aceptadas += 1
                        elif s.get("estado") in ("rechazada", "ignorada"):
                            rechazadas += 1
        except Exception:  # noqa: BLE001 — métricas de sugerencias best-effort
            logger.debug("no se pudieron contar sugerencias para %s", tenant_id)
        return (emitidas, aceptadas, rechazadas)

    # ── Lectura para el endpoint admin ──────────────────────────────────────────
    def consultar(self, tenant_id: str, desde: date, hasta: date) -> list[MetricasDiaCCP]:
        filas = self.store.consultar(tenant_id, desde, hasta)
        return [self._to_dia(f) for f in filas]

    def metricas(self, tenant_id: str, ventana: tuple[date, date]) -> MetricasCCP:
        desde, hasta = ventana
        dias = self.consultar(tenant_id, desde, hasta)
        return MetricasCCP(
            tenant_id=tenant_id,
            ventana=(desde, hasta),
            dias=dias,
            totales=self._totales(dias),
        )

    @staticmethod
    def _to_dia(f: dict) -> MetricasDiaCCP:
        fecha = f["fecha"]
        if isinstance(fecha, str):
            fecha = date.fromisoformat(fecha)
        return MetricasDiaCCP(
            fecha=fecha,
            consultas_totales=f.get("consultas_totales", 0),
            consultas_cache_hit=f.get("consultas_cache_hit", 0),
            consultas_retrieval_first=f.get("consultas_retrieval_first", 0),
            consultas_synthesis_first=f.get("consultas_synthesis_first", 0),
            costo_total_centavos=float(f.get("costo_total_centavos", 0) or 0),
            costo_promedio_por_consulta=float(f.get("costo_promedio_por_consulta", 0) or 0),
            costo_promedio_por_consulta_unica=float(
                f.get("costo_promedio_por_consulta_unica", 0) or 0
            ),
            latencia_p50_ms=f.get("latencia_p50_ms", 0),
            latencia_p95_ms=f.get("latencia_p95_ms", 0),
            top_patrones_detectados=f.get("top_patrones_detectados", []) or [],
            sugerencias_emitidas=f.get("sugerencias_emitidas", 0),
            sugerencias_aceptadas=f.get("sugerencias_aceptadas", 0),
            sugerencias_rechazadas=f.get("sugerencias_rechazadas", 0),
        )

    @staticmethod
    def _totales(dias: list[MetricasDiaCCP]) -> MetricasCCPTotales:
        total = sum(d.consultas_totales for d in dias)
        hit = sum(d.consultas_cache_hit for d in dias)
        retr = sum(d.consultas_retrieval_first for d in dias)
        synth = sum(d.consultas_synthesis_first for d in dias)
        costo = sum(d.costo_total_centavos for d in dias)
        return MetricasCCPTotales(
            consultas_totales=total,
            consultas_cache_hit=hit,
            consultas_retrieval_first=retr,
            consultas_synthesis_first=synth,
            costo_total_centavos=round(costo, 4),
            costo_promedio_por_consulta=round(costo / total, 4) if total else 0.0,
            cache_hit_ratio=round(hit / total, 4) if total else 0.0,
            retrieval_first_ratio=round(retr / total, 4) if total else 0.0,
            synthesis_first_ratio=round(synth / total, 4) if total else 0.0,
        )
