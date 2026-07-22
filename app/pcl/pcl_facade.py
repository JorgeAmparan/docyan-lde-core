"""
Fachada unificada de la Capa de Contexto Persistente (CCP/PCL) (B8.5 §1.2).

DOCYAN LDE™ by XCID — doc CCP §6.

`PCL` es la interfaz ÚNICA que los pipelines (B8), el MO (B4) y las UIs (B9+)
consumen. NO reescribe los componentes existentes (FAT, consultas guardadas, EDB,
playbooks, caché): los ORQUESTA como estados de densidad creciente de un mismo
flujo (doc §3) —

  - **Memoria reactiva (bajo):** `consultar_o_cachear` (caché + pipeline + FAT),
    `historial_consultas` (FAT F4).
  - **Patrón detectado (medio):** `sugerencias_pendientes`,
    `evaluar_patrones_diario` (EDB Nivel C de B8).
  - **Playbook (alto):** `guardar_consulta`, `crear_playbook`,
    `disparar_playbook` (Niveles A/B de B8).
  - **Instrumentación:** `metricas` (lee `pcl_metrics_daily`).

Cache hit NO bypasea gobernanza (doc §5.4): la respuesta cacheada se re-evalúa
contra el Governance Gate antes de servirse; si bloquea, degradación graceful.

El MO y el pipeline son síncronos; la fachada se implementa síncrona (las firmas
`async` del doc/contrato se ajustan a esa realidad — CLAUDE.md §2.2).
"""
from __future__ import annotations

import logging
import os
import re
from time import perf_counter
from typing import Any, Callable

from app.pcl.modes import (
    ModoRespuesta,
    elegir_modo,
    navegacion_desde_envelope,
)
from app.pcl.pcl_cache import PCLCache, _entidades_de
from app.pcl.pcl_metrics import EVENTO_CONSULTA, PCLMetrics
from app.schemas.pcl_payloads import RespuestaCCP
from app.schemas.pipeline_payloads import ConsultaResuelta, ContextoRespuestaCCP

logger = logging.getLogger("docyan.pcl.facade")

#: Precio de referencia (centavos USD por 1k tokens) para estimar el costo de las
#: respuestas synthesis-first. Configurable; el dato real lo afina el piloto vía la
#: instrumentación (doc §4.4: las cifras se cierran con datos del primer cliente).
PRECIO_CENTAVOS_POR_1K = float(os.getenv("PCL_PRECIO_CENTAVOS_POR_1K", "0.04"))


def _puede_servir_cache(pregunta: str, contexto: dict | None) -> bool:
    """
    ¿Es seguro SERVIR una respuesta cacheada para esta consulta? (§3.3 guard PCL)

    NO se sirve caché cuando:
      · la consulta es CORTA/AMBIGUA (≤1 token de contenido o <6 chars, p. ej.
        "aceite?", "EPP?"): un match semántico de una sola palabra colisiona con
        entradas ajenas — se fuerza cómputo fresco; y
      · la consulta NO tiene SCOPE de documento (sin `documento_id`, `entidad_id`
        ni `token_qr`): sin scope, una respuesta cacheada de OTRO documento del
        mismo tenant puede servirse por cercanía (directiva de Jorge: exigir
        `documento_id` para servir caché).

    Es una compuerta de SERVIR, no de escribir: la respuesta fresca igual se cachea,
    de modo que una consulta acotada y no-corta idéntica sí aprovecha el caché.
    """
    ctx = contexto or {}
    tiene_scope = bool(ctx.get("documento_id") or ctx.get("entidad_id") or ctx.get("token_qr"))
    norm = re.sub(r"\s+", " ", (pregunta or "").strip().lower())
    tokens = [t for t in re.findall(r"[0-9a-záéíóúñü]+", norm) if len(t) >= 3]
    corta = len(norm) < 6 or len(tokens) <= 1
    return tiene_scope and not corta


def _contar_tokens(texto: str) -> int:
    """Cuenta tokens con tiktoken (ya presente por el cotizador); fallback len/4."""
    if not texto:
        return 0
    try:
        import tiktoken

        return len(tiktoken.get_encoding("cl100k_base").encode(texto))
    except Exception:  # noqa: BLE001
        return max(1, len(texto) // 4)


def estimar_costo_centavos(modo: ModoRespuesta, pregunta: str, envelope) -> float:
    """
    Retrieval-first y cache_hit cuestan ~0 (span directo, sin LLM). Synthesis-first
    paga inferencia: se estima por tokens de entrada + salida (doc §4.1/§4.2).
    """
    if modo != ModoRespuesta.SYNTHESIS_FIRST:
        return 0.0
    salida = envelope.payload.model_dump_json() if hasattr(envelope, "payload") else ""
    tokens = _contar_tokens(pregunta) + _contar_tokens(salida)
    return round(tokens / 1000 * PRECIO_CENTAVOS_POR_1K, 4)


class PCL:
    """Fachada de la CCP. Orquesta; no reescribe (doc §6.3)."""

    def __init__(
        self,
        cache: PCLCache | None = None,
        metrics: PCLMetrics | None = None,
        audit=None,
        playbook_services: dict | None = None,
        fat=None,
    ) -> None:
        self.cache = cache or PCLCache()
        self.metrics = metrics or PCLMetrics()
        self._audit = audit
        self._playbooks = playbook_services
        self._fat = fat

    # ── infra perezosa ──────────────────────────────────────────────────────────
    def _audit_logger(self):
        if self._audit is None:
            from app.orchestrator.audit_logger import AuditLogger, FATAuditSink

            self._audit = AuditLogger(sink=FATAuditSink())
        return self._audit

    def _servicios(self) -> dict:
        if self._playbooks is None:
            from app.orchestrator import providers

            self._playbooks = providers.get_playbook_services()
        return self._playbooks

    def _fat_extendido(self):
        if self._fat is None:
            from app.audit.fat_extendido import FATExtendido
            from app.audit.stores import HybridFATStore

            self._fat = FATExtendido(HybridFATStore())
        return self._fat

    # ── Memoria reactiva (estado bajo) ──────────────────────────────────────────
    def consultar_o_cachear(
        self,
        *,
        tenant_id: str,
        user_id: str | None,
        pregunta: str,
        contexto: dict | None,
        clasificacion,
        ejecutar: Callable[[], tuple],
        gobernanza: Callable[[], Any] | None = None,
        actor: str = "system",
    ) -> tuple[RespuestaCCP, dict]:
        """
        Lookup en caché → si hit válido, re-evalúa gobernanza y sirve; si miss,
        ejecuta el pipeline (`ejecutar`), elige modo, cachea y registra FAT F4.

        `ejecutar()` devuelve `(ConsultaResuelta, extras)` del pipeline coordinator.
        `gobernanza()` devuelve una GateDecision para re-evaluar en cache hit.
        Devuelve `(RespuestaCCP, extras)`.
        """
        t0 = perf_counter()
        # §3.3 — guard de servicio: consultas cortas/ambiguas o sin scope de documento
        # NO se sirven de caché (se fuerza cómputo fresco). Evita que "aceite?" sirva
        # una respuesta cacheada ajena por colisión semántica de una sola palabra.
        hit = self.cache.lookup(tenant_id, pregunta, contexto) \
            if _puede_servir_cache(pregunta, contexto) else None

        if hit is not None:
            # Doc §5.4: el hit NO bypasea gobernanza.
            if gobernanza is not None:
                decision = gobernanza()
                if getattr(decision, "bloqueado", False):
                    return self._degradado_por_gobernanza(
                        tenant_id, user_id, actor, clasificacion, contexto, pregunta, t0,
                        getattr(decision, "motivo", "Gobernanza bloqueó la respuesta."),
                    )
            envelope = ConsultaResuelta.model_validate(hit.entry["respuesta"])
            latencia = self._ms(t0)
            ctx_ccp = ContextoRespuestaCCP(
                modo_respuesta=ModoRespuesta.CACHE_HIT.value,
                costo_estimado_centavos=0.0,
                latencia_ms=latencia,
                cache_hit=True,
                similitud_cache=round(hit.similitud, 4),
                dkg_state_hash=hit.entry.get("dkg_state_hash"),
            )
            envelope = envelope.model_copy(update={"contexto_ccp": ctx_ccp})
            resp = RespuestaCCP(
                payload=envelope,
                modo_respuesta=ModoRespuesta.CACHE_HIT,
                costo_estimado_centavos=0.0,
                latencia_ms=latencia,
                cache_hit=True,
                similitud_cache=round(hit.similitud, 4),
                dkg_state_hash=hit.entry.get("dkg_state_hash"),
            )
            self._instrumentar(tenant_id, user_id, actor, clasificacion, contexto, resp)
            return resp, {}

        # Miss → ejecutar el pipeline existente (no se toca su código).
        envelope, extras = ejecutar()
        nav = navegacion_desde_envelope(envelope)
        modo = elegir_modo(clasificacion.tipo, contexto, nav)
        costo = estimar_costo_centavos(modo, pregunta, envelope)
        latencia = self._ms(t0)
        entidades = _entidades_de(contexto, envelope.model_dump())
        state_hash = self.cache.state_hasher(tenant_id, entidades)

        ctx_ccp = ContextoRespuestaCCP(
            modo_respuesta=modo.value,
            costo_estimado_centavos=costo,
            latencia_ms=latencia,
            cache_hit=False,
            similitud_cache=None,
            dkg_state_hash=state_hash,
        )
        envelope = envelope.model_copy(update={"contexto_ccp": ctx_ccp})

        # Solo se cachea una respuesta NO degradada (no se cachea un fallo del grafo).
        if not envelope.degradado:
            self.cache.write(
                tenant_id, pregunta, contexto, envelope.model_dump(),
                modo.value, costo, dkg_state_hash=state_hash,
            )

        resp = RespuestaCCP(
            payload=envelope,
            modo_respuesta=modo,
            costo_estimado_centavos=costo,
            latencia_ms=latencia,
            cache_hit=False,
            similitud_cache=None,
            dkg_state_hash=state_hash,
        )
        self._instrumentar(tenant_id, user_id, actor, clasificacion, contexto, resp)
        return resp, extras

    def _degradado_por_gobernanza(
        self, tenant_id, user_id, actor, clasificacion, contexto, pregunta, t0, motivo
    ) -> tuple[RespuestaCCP, dict]:
        """Cache hit + gobernanza bloquea → payload vacío válido + nota honesta."""
        from app.pipelines.registry import payload_vacio

        latencia = self._ms(t0)
        envelope = ConsultaResuelta(
            tipo_intencion=clasificacion.tipo.value,
            score=clasificacion.score,
            ruta=clasificacion.ruta,
            metodo=clasificacion.metodo,
            cruces=[],
            payload=payload_vacio(clasificacion.tipo, pregunta or "Consulta"),
            degradado=True,
            nota=motivo,
            contexto_ccp=ContextoRespuestaCCP(
                modo_respuesta=ModoRespuesta.CACHE_HIT.value,
                latencia_ms=latencia,
                cache_hit=True,
            ),
        )
        resp = RespuestaCCP(
            payload=envelope,
            modo_respuesta=ModoRespuesta.CACHE_HIT,
            latencia_ms=latencia,
            cache_hit=True,
        )
        self._instrumentar(tenant_id, user_id, actor, clasificacion, contexto, resp,
                           bloqueado=True)
        return resp, {"gobernanza_bloqueo": motivo}

    def _instrumentar(
        self, tenant_id, user_id, actor, clasificacion, contexto, resp: RespuestaCCP,
        bloqueado: bool = False,
    ) -> None:
        """Registra el evento de consulta en FAT F4 + buffer de métricas (doc §7.1)."""
        payload = {
            "tipo_intencion": clasificacion.tipo.value,
            "modo_respuesta": resp.modo_respuesta.value,
            "costo_estimado_centavos": resp.costo_estimado_centavos,
            "latencia_ms": resp.latencia_ms,
            "similitud_cache": resp.similitud_cache,
            "dkg_state_hash": resp.dkg_state_hash,
            "cache_hit": resp.cache_hit,
            "entidad_id": (contexto or {}).get("entidad_id"),
            "bloqueado_gobernanza": bloqueado,
        }
        try:
            self._audit_logger().event(
                tenant_id, EVENTO_CONSULTA, actor or user_id or "system", payload
            )
        except Exception:  # noqa: BLE001 — el FAT es best-effort desde la fachada
            logger.debug("no se pudo registrar consulta_servida en FAT")
        self.metrics.registrar_consulta(tenant_id, payload)

    @staticmethod
    def _ms(t0: float) -> int:
        return int((perf_counter() - t0) * 1000)

    # ── Memoria reactiva: historial (FAT F4) ────────────────────────────────────
    def historial_consultas(
        self, tenant_id: str, user_id: str | None = None, filtros: dict | None = None
    ) -> list[dict]:
        """Consultas registradas del DoCo (FAT familia F4, `consulta_servida`)."""
        from app.audit.familias import FamiliaFAT

        filtros = filtros or {}
        eventos = self._fat_extendido().eventos(tenant_id)
        out = []
        for e in eventos:
            if e.familia != FamiliaFAT.F4_CONSULTA or e.tipo_evento != EVENTO_CONSULTA:
                continue
            if user_id and e.actor_id not in (user_id, "system"):
                continue
            out.append(
                {
                    "evento_id": e.evento_id,
                    "timestamp": e.timestamp,
                    "tipo_intencion": (e.payload or {}).get("tipo_intencion"),
                    "modo_respuesta": (e.payload or {}).get("modo_respuesta"),
                    "entidad_id": (e.payload or {}).get("entidad_id"),
                }
            )
        return out

    # ── Patrón detectado (estado medio) ─────────────────────────────────────────
    def sugerencias_pendientes(self, tenant_id: str, user_id: str) -> list[dict]:
        return self._servicios()["sugerencias"].listar_pendientes(tenant_id, user_id)

    def evaluar_patrones_diario(self, tenant_id: str) -> dict:
        generadas = self._servicios()["sugerencias"].evaluar_tenant(tenant_id)
        return {"tenant_id": tenant_id, "sugerencias_generadas": len(generadas),
                "sugerencias": generadas}

    # ── Playbook (estado alto) ──────────────────────────────────────────────────
    def guardar_consulta(
        self, tenant_id: str, user_id: str, nombre: str, **kwargs
    ) -> dict:
        return self._servicios()["consultas"].guardar(
            tenant_id=tenant_id, user_id=user_id, nombre=nombre, **kwargs
        )

    def crear_playbook(
        self, tenant_id: str, user_id: str, nombre: str, pasos: list[dict], **kwargs
    ) -> dict:
        return self._servicios()["playbooks"].crear(
            tenant_id=tenant_id, user_id=user_id, nombre=nombre, pasos=pasos, **kwargs
        )

    def disparar_playbook(
        self, tenant_id: str, playbook_id: str, mo, auth_ctx: dict, **kwargs
    ) -> dict:
        return self._servicios()["playbooks"].disparar(
            tenant_id, playbook_id, mo, auth_ctx, **kwargs
        )

    # ── Instrumentación ─────────────────────────────────────────────────────────
    def metricas(self, tenant_id: str, ventana):
        return self.metrics.metricas(tenant_id, ventana)
