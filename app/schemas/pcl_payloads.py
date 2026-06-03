"""
Schemas Pydantic v2 de la Capa de Contexto Persistente (CCP/PCL) (B8.5 §7).

DOCYAN LDE™ by XCID.

Tipados estrictos exportados a OpenAPI 3.1 (B9 genera los tipos TS con
`openapi-typescript`). Cubren:
  - `RespuestaCCP` — lo que devuelve `PCL.consultar_o_cachear` (payload tipado del
    pipeline + metadatos de modo/costo/caché).
  - `MetricasDiaCCP` / `MetricasCCPTotales` / `MetricasCCP` — la salida del
    endpoint admin `GET /admin/pcl/metrics` sobre `pcl_metrics_daily`.

La nomenclatura de cliente se mantiene en `tenant_id` (el rename a `doco_id` es
trabajo aparte, doc §2.1 / contrato §"Lo que NO se construye").
"""
from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pipeline_payloads import ConsultaResuelta


class ModoRespuesta(str, Enum):
    """
    Modo con el que se resolvió/servirá una consulta (se registra en FAT F4).

    Vive en la capa de schemas (no en `app/pcl`) para que tanto los payloads como
    la heurística `app/pcl/modes.py` lo compartan sin ciclo de importación.
    """

    RETRIEVAL_FIRST = "retrieval_first"
    SYNTHESIS_FIRST = "synthesis_first"
    CACHE_HIT = "cache_hit"


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RespuestaCCP(_Base):
    """
    Respuesta unificada de la memoria reactiva (doc §6.1). Envuelve el envelope
    tipado del pipeline (`payload`) con los metadatos de la CCP.
    """

    payload: ConsultaResuelta
    modo_respuesta: ModoRespuesta
    costo_estimado_centavos: float = 0.0
    latencia_ms: int = 0
    cache_hit: bool = False
    similitud_cache: float | None = None
    dkg_state_hash: str | None = None


class MetricasDiaCCP(_Base):
    """Una fila de `pcl_metrics_daily` (un DoCo, un día). Doc §7.2."""

    fecha: date
    consultas_totales: int = 0
    consultas_cache_hit: int = 0
    consultas_retrieval_first: int = 0
    consultas_synthesis_first: int = 0
    costo_total_centavos: float = 0.0
    costo_promedio_por_consulta: float = 0.0
    costo_promedio_por_consulta_unica: float = 0.0
    latencia_p50_ms: int = 0
    latencia_p95_ms: int = 0
    top_patrones_detectados: list[dict] = Field(default_factory=list)
    sugerencias_emitidas: int = 0
    sugerencias_aceptadas: int = 0
    sugerencias_rechazadas: int = 0


class MetricasCCPTotales(_Base):
    """Agregado de toda la ventana (suma/promedio sobre los días). Para pricing."""

    consultas_totales: int = 0
    consultas_cache_hit: int = 0
    consultas_retrieval_first: int = 0
    consultas_synthesis_first: int = 0
    costo_total_centavos: float = 0.0
    costo_promedio_por_consulta: float = 0.0
    cache_hit_ratio: float = 0.0
    retrieval_first_ratio: float = 0.0
    synthesis_first_ratio: float = 0.0


class MetricasCCP(_Base):
    """Respuesta de `GET /admin/pcl/metrics` (doc §7.3)."""

    tenant_id: str
    ventana: tuple[date, date]
    dias: list[MetricasDiaCCP] = Field(default_factory=list)
    totales: MetricasCCPTotales = Field(default_factory=MetricasCCPTotales)
