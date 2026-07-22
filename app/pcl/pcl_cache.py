"""
Caché semántico de consultas — BGE-M3 sobre Redis con invalidación viva (B8.5 §1.3).

DOCYAN LDE™ by XCID — doc CCP §5.

La segunda consulta semánticamente equivalente NO paga inferencia. Diseño (doc §5):

  - **Indexación** por clave compuesta
    `pcl:cache:{tenant_id}:{embedding_hash}:{contexto_fingerprint}`. El valor
    guarda el payload de respuesta + el `dkg_state_hash` del momento + modo +
    costo + el propio embedding (para la búsqueda por similitud).
  - **Lookup por similitud**: embedding BGE-M3 de la pregunta normalizada,
    búsqueda entre las entradas del mismo `tenant_id` + `contexto_fingerprint`,
    coseno ≥ umbral (default 0.92, configurable por DoCo). Hit válido solo si el
    `dkg_state_hash` sigue coincidiendo con el estado actual del DKG.
  - **Invalidación viva**: cuando el worker termina una ingesta/actualización,
    `invalidate_by_entities` elimina SOLO las entradas que apuntaban al estado
    anterior de las entidades modificadas — no el caché entero (doc §5.3).

Multi-tenant ABSOLUTO: la clave lleva `tenant_id`; jamás se cruzan DoCos (doc §2.3).

Robustez (doc §11): el caché es una optimización, NO una dependencia dura. La
verdad operativa vive en FAT. Si Redis o el embedder no responden, el lookup
degrada a *miss* y el write es best-effort — la consulta se sirve igual.

Nota de implementación: se usa Redis estándar (SET/GET + sorted/plain sets de
índice), no RedisJSON, para no acoplar la imagen del backend a un módulo opcional
del contenedor Redis (contrato §1.3 deja ambas vías abiertas; se elige la
portable). El MO y el pipeline son SÍNCRONOS, así que la fachada y el caché se
implementan síncronos (las firmas `async` del doc se ajustan a esa realidad —
ajuste documentado, CLAUDE.md §2.2).
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import time
from dataclasses import dataclass
from typing import Callable, Protocol

logger = logging.getLogger("docyan.pcl.cache")

DEFAULT_UMBRAL_SIMILITUD = 0.92
DEFAULT_TTL_SEGUNDOS = 2592000  # 30 días (doc §5.5)


# ── Backend de almacenamiento (Redis o memoria) ───────────────────────────────


class CacheBackend(Protocol):
    """Subconjunto de Redis que el caché usa (KV con TTL + sets de índice)."""

    def get(self, key: str) -> str | None: ...
    def setex(self, key: str, ttl: int, value: str) -> None: ...
    def delete(self, *keys: str) -> int: ...
    def sadd(self, key: str, *members: str) -> int: ...
    def smembers(self, key: str) -> set[str]: ...
    def srem(self, key: str, *members: str) -> int: ...
    def expire(self, key: str, ttl: int) -> None: ...
    def scan(self, match: str) -> list[str]: ...


class InMemoryCacheBackend:
    """Backend en memoria con TTL para tests (mismo contrato que Redis)."""

    def __init__(self) -> None:
        self._kv: dict[str, tuple[float | None, str]] = {}
        self._sets: dict[str, set[str]] = {}

    def _vivo(self, key: str) -> bool:
        item = self._kv.get(key)
        if item is None:
            return False
        exp, _ = item
        if exp is not None and exp <= time.time():
            del self._kv[key]
            return False
        return True

    def get(self, key: str) -> str | None:
        return self._kv[key][1] if self._vivo(key) else None

    def setex(self, key: str, ttl: int, value: str) -> None:
        self._kv[key] = (time.time() + ttl if ttl else None, value)

    def delete(self, *keys: str) -> int:
        n = 0
        for k in keys:
            if k in self._kv:
                del self._kv[k]
                n += 1
            if k in self._sets:
                del self._sets[k]
        return n

    def sadd(self, key: str, *members: str) -> int:
        s = self._sets.setdefault(key, set())
        antes = len(s)
        s.update(members)
        return len(s) - antes

    def smembers(self, key: str) -> set[str]:
        return set(self._sets.get(key, set()))

    def srem(self, key: str, *members: str) -> int:
        s = self._sets.get(key)
        if not s:
            return 0
        antes = len(s)
        s.difference_update(members)
        return antes - len(s)

    def expire(self, key: str, ttl: int) -> None:  # noqa: D401 - los sets de índice
        return None  # no expiran por sí solos; se limpian al invalidar.

    def scan(self, match: str) -> list[str]:
        import fnmatch

        claves = set(self._kv) | set(self._sets)
        return [k for k in claves if fnmatch.fnmatch(k, match)]


class RedisCacheBackend:
    """Backend real sobre el cliente Redis del repo (`app/cache/redis_client`)."""

    def __init__(self, redis_client=None) -> None:
        self._rc = redis_client

    def _c(self):
        if self._rc is None:
            from app.cache.redis_client import redis_client

            self._rc = redis_client
        return self._rc._get_client()

    def get(self, key: str) -> str | None:
        return self._c().get(key)

    def setex(self, key: str, ttl: int, value: str) -> None:
        self._c().setex(key, ttl, value)

    def delete(self, *keys: str) -> int:
        return self._c().delete(*keys) if keys else 0

    def sadd(self, key: str, *members: str) -> int:
        return self._c().sadd(key, *members)

    def smembers(self, key: str) -> set[str]:
        return set(self._c().smembers(key))

    def srem(self, key: str, *members: str) -> int:
        return self._c().srem(key, *members)

    def expire(self, key: str, ttl: int) -> None:
        self._c().expire(key, ttl)

    def scan(self, match: str) -> list[str]:
        out = []
        for k in self._c().scan_iter(match=match, count=500):
            out.append(k.decode() if isinstance(k, bytes) else k)
        return out


# ── Configuración por DoCo (umbral + TTL) ──────────────────────────────────────


@dataclass(frozen=True)
class CacheConfig:
    umbral_similitud: float = DEFAULT_UMBRAL_SIMILITUD
    ttl_segundos: int = DEFAULT_TTL_SEGUNDOS


class CacheConfigProvider(Protocol):
    def get(self, tenant_id: str) -> CacheConfig: ...


class DefaultCacheConfigProvider:
    """Defaults del doc (0.92 / 30 días). Producción puede leer `pcl_cache_config`."""

    def get(self, tenant_id: str) -> CacheConfig:
        return CacheConfig()


class SupabaseCacheConfigProvider:
    """Lee `pcl_cache_config` por tenant; cae a defaults si no hay fila/cliente."""

    def __init__(self, client=None) -> None:
        self._client = client

    def _sb(self):
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("pcl_cache_config", service=True)
            self._client = create_client(url, key)
        return self._client

    def get(self, tenant_id: str) -> CacheConfig:
        try:
            res = (
                self._sb()
                .table("pcl_cache_config")
                .select("umbral_similitud,ttl_segundos")
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                return CacheConfig(
                    umbral_similitud=float(row.get("umbral_similitud") or DEFAULT_UMBRAL_SIMILITUD),
                    ttl_segundos=int(row.get("ttl_segundos") or DEFAULT_TTL_SEGUNDOS),
                )
        except Exception:  # noqa: BLE001 — sin config → defaults (degradación)
            logger.debug("pcl_cache_config no disponible para %s; defaults", tenant_id)
        return CacheConfig()


# ── Hit ────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CacheHit:
    key: str
    entry: dict
    similitud: float


# ── Utilidades ──────────────────────────────────────────────────────────────────


def normalizar_pregunta(texto: str) -> str:
    """Normaliza para identidad estable: minúsculas, espacios colapsados, sin bordes."""
    return re.sub(r"\s+", " ", (texto or "").strip().lower())


def _sha(texto: str, n: int = 16) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:n]


def coseno(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def contexto_fingerprint(contexto: dict | None) -> str:
    """
    Hash determinista del contexto que segrega el caché (doc §5.1): token QR,
    entidad referenciada, tipo de documento origen y par lingüístico activo.

    El MODO (retrieval/synthesis) NO entra: es un RESULTADO de ejecutar la
    consulta, no una entrada conocida en el lookup; incluirlo impediría todo hit.
    El doc de arquitectura §5.1 enumera solo las cuatro claves de contexto; se
    sigue esa fuente sobre el listado del contrato (CLAUDE.md §15: gana la
    arquitectura). Ajuste documentado.
    """
    ctx = contexto or {}
    base = "|".join(
        [
            f"qr={ctx.get('token_qr') or ''}",
            f"ent={ctx.get('entidad_id') or ''}",
            # `documento_id` segrega el caché por DOCUMENTO consultado. Sin esto, dos
            # documentos sueltos del mismo tenant (entidad_id vacío, mismo tipo)
            # comparten fingerprint → la misma pregunta sobre el doc B sirve la
            # respuesta cacheada del doc A (colisión observada en el recorrido
            # multi-documento, 15-jun). Es entrada conocida del lookup, no resultado.
            f"doc={ctx.get('documento_id') or ''}",
            f"tipo={ctx.get('tipo_documento') or ''}",
            f"par={ctx.get('par_linguistico') or ''}",
        ]
    )
    return _sha(base, 16)


def _entidades_de(contexto: dict | None, respuesta: dict | None) -> list[str]:
    """
    Entidades a las que una entrada de caché queda atada (para invalidación viva).

    La entidad de contexto + los documentos citados en el payload (cada documento
    es una entidad del DKG cuyo cambio debe invalidar la respuesta que lo cita).
    """
    ids: set[str] = set()
    ctx = contexto or {}
    if ctx.get("entidad_id"):
        ids.add(str(ctx["entidad_id"]))
    payload = ((respuesta or {}).get("payload") or {})
    for cita in payload.get("citas", []) or []:
        doc = cita.get("documento_id") if isinstance(cita, dict) else None
        if doc:
            ids.add(str(doc))
    return sorted(ids)


def default_state_hasher(tenant_id: str, entidad_ids: list[str]) -> str:
    """
    `dkg_state_hash` por entidades (doc §5.2): hash del estado actual de las
    entidades en el DKG. Si el grafo no responde o no hay entidades, devuelve un
    centinela estable — la invalidación por entidad (`invalidate_by_entities`)
    sigue cubriendo el caso de ingesta; el state hash es la segunda barrera.
    """
    if not entidad_ids:
        return "no-entities"
    try:
        from app.graph.dkg_client import dkg_client

        partes: list[str] = []
        for eid in sorted(entidad_ids):
            nodo = dkg_client.get_entity(tenant_id, eid) or {}
            estado = {k: v for k, v in nodo.items() if not str(k).startswith("_")}
            partes.append(eid + "=" + json.dumps(estado, sort_keys=True, ensure_ascii=False))
        return _sha("||".join(partes), 32)
    except Exception:  # noqa: BLE001 — sin DKG → centinela (no rompe el caché)
        return "dkg-unavailable"


# ── Caché ────────────────────────────────────────────────────────────────────────


class PCLCache:
    """Caché semántico vivo por DoCo (doc §5)."""

    def __init__(
        self,
        backend: CacheBackend | None = None,
        embedder=None,
        config_provider: CacheConfigProvider | None = None,
        state_hasher: Callable[[str, list[str]], str] | None = None,
    ) -> None:
        self.backend = backend or RedisCacheBackend()
        self._embedder = embedder
        self.config_provider = config_provider or DefaultCacheConfigProvider()
        self.state_hasher = state_hasher or default_state_hasher

    # ── claves ────────────────────────────────────────────────────────────────
    @staticmethod
    def cache_key(tenant_id: str, embedding_hash: str, ctx_fp: str) -> str:
        return f"pcl:cache:{tenant_id}:{embedding_hash}:{ctx_fp}"

    @staticmethod
    def _idx_key(tenant_id: str, ctx_fp: str) -> str:
        return f"pcl:idx:{tenant_id}:{ctx_fp}"

    @staticmethod
    def _ent_key(tenant_id: str, entidad_id: str) -> str:
        return f"pcl:ent:{tenant_id}:{entidad_id}"

    def embed_pregunta(self, texto: str) -> list[float]:
        if self._embedder is None:
            from app.embeddings.bge_client import bge_client

            self._embedder = bge_client
        return self._embedder.embed(normalizar_pregunta(texto))

    # ── lookup ──────────────────────────────────────────────────────────────────
    def lookup(self, tenant_id: str, pregunta: str, contexto: dict | None) -> CacheHit | None:
        """Devuelve un hit válido (coseno ≥ umbral + state hash vigente) o None."""
        try:
            emb = self.embed_pregunta(pregunta)
        except Exception:  # noqa: BLE001 — embedder caído → miss (degradación)
            logger.debug("embedder no disponible; lookup degrada a miss")
            return None

        cfg = self.config_provider.get(tenant_id)
        ctx_fp = contexto_fingerprint(contexto)
        idx = self._idx_key(tenant_id, ctx_fp)
        try:
            candidatas = self.backend.smembers(idx)
        except Exception:  # noqa: BLE001 — Redis caído → miss
            logger.debug("redis no disponible; lookup degrada a miss")
            return None

        mejor: CacheHit | None = None
        for ck in candidatas:
            raw = self.backend.get(ck)
            if raw is None:
                self.backend.srem(idx, ck)  # entrada expirada (TTL): limpia el índice
                continue
            entry = json.loads(raw)
            sim = coseno(emb, entry.get("embedding") or [])
            if sim >= cfg.umbral_similitud and (mejor is None or sim > mejor.similitud):
                mejor = CacheHit(key=ck, entry=entry, similitud=sim)

        if mejor is None:
            return None

        # Invalidación viva: el documento pudo cambiar desde que se cacheó.
        actual = self.state_hasher(tenant_id, mejor.entry.get("entidad_ids") or [])
        if actual != mejor.entry.get("dkg_state_hash"):
            self._eliminar_entrada(tenant_id, mejor.key, mejor.entry, ctx_fp)
            return None
        return mejor

    # ── write ─────────────────────────────────────────────────────────────────
    def write(
        self,
        tenant_id: str,
        pregunta: str,
        contexto: dict | None,
        respuesta: dict,
        modo: str,
        costo_centavos: float,
        dkg_state_hash: str | None = None,
    ) -> None:
        """Indexa una respuesta. Best-effort: si Redis/embedder fallan, no rompe."""
        try:
            emb = self.embed_pregunta(pregunta)
        except Exception:  # noqa: BLE001
            logger.debug("embedder no disponible; no se cachea")
            return

        cfg = self.config_provider.get(tenant_id)
        ctx_fp = contexto_fingerprint(contexto)
        entidad_ids = _entidades_de(contexto, respuesta)
        if dkg_state_hash is None:
            dkg_state_hash = self.state_hasher(tenant_id, entidad_ids)
        ck = self.cache_key(tenant_id, _sha(normalizar_pregunta(pregunta)), ctx_fp)
        entry = {
            "pregunta": pregunta,
            "pregunta_normalizada": normalizar_pregunta(pregunta),
            "embedding": emb,
            "contexto_fingerprint": ctx_fp,
            "entidad_ids": entidad_ids,
            "respuesta": respuesta,
            "modo": modo,
            "costo_centavos": costo_centavos,
            "dkg_state_hash": dkg_state_hash,
            "cached_at": time.time(),
        }
        try:
            self.backend.setex(ck, cfg.ttl_segundos, json.dumps(entry, ensure_ascii=False))
            idx = self._idx_key(tenant_id, ctx_fp)
            self.backend.sadd(idx, ck)
            self.backend.expire(idx, cfg.ttl_segundos)
            for eid in entidad_ids:
                self.backend.sadd(self._ent_key(tenant_id, eid), ck)
        except Exception:  # noqa: BLE001 — caché es optimización, no dependencia
            logger.debug("redis no disponible; no se cacheó la respuesta")

    # ── invalidación viva ───────────────────────────────────────────────────────
    def invalidate_by_entities(self, tenant_id: str, entidad_ids: list[str]) -> int:
        """
        Elimina SOLO las entradas atadas a las entidades modificadas (doc §5.3).
        Lo invoca el worker al terminar una ingesta/`apply_changes`. Devuelve el
        número de entradas de caché eliminadas (deduplicadas).
        """
        eliminadas: set[str] = set()
        for eid in entidad_ids or []:
            ek = self._ent_key(tenant_id, str(eid))
            try:
                miembros = self.backend.smembers(ek)
            except Exception:  # noqa: BLE001
                continue
            for ck in miembros:
                if ck in eliminadas:
                    continue
                raw = self.backend.get(ck)
                entry = json.loads(raw) if raw else None
                ctx_fp = entry.get("contexto_fingerprint") if entry else ck.rsplit(":", 1)[-1]
                self._eliminar_entrada(tenant_id, ck, entry, ctx_fp)
                eliminadas.add(ck)
            self.backend.delete(ek)
        return len(eliminadas)

    def invalidar_tenant(self, tenant_id: str) -> int:
        """
        Invalida TODA la caché de consulta del tenant (B13.3 §5 fix): toda entrada
        `pcl:cache:{tenant}:*` + sus índices `pcl:idx:*`/`pcl:ent:*`. Se invoca en
        CAMBIOS DE CICLO DE VIDA del documento (borrado, re-ingesta): respuestas
        cacheadas del documento VIEJO (incluidas las VACÍAS, que no tienen
        `entidad_ids` y por eso la invalidación por-entidad no captura) jamás se
        sirven como "RESPUESTA INSTANTÁNEA · CACHÉ" sobre un grafo ya cambiado.
        La invalidación es parte del ciclo de vida, igual que el done-marker.
        """
        try:
            claves = (
                self.backend.scan(f"pcl:cache:{tenant_id}:*")
                + self.backend.scan(f"pcl:idx:{tenant_id}:*")
                + self.backend.scan(f"pcl:ent:{tenant_id}:*")
            )
        except Exception:  # noqa: BLE001 — caché es optimización, no dependencia
            logger.warning("no se pudo escanear caché PCL del tenant %s", tenant_id)
            return 0
        cache_keys = [k for k in claves if k.startswith(f"pcl:cache:{tenant_id}:")]
        if claves:
            self.backend.delete(*claves)
        return len(cache_keys)

    def purgar_anteriores_a(
        self, cutoff_epoch: float, tenant_id: str | None = None, dry_run: bool = False
    ) -> dict[str, int]:
        """
        Purga entradas de caché PCL escritas ANTES de `cutoff_epoch` (Unix, s).

        Uso (PRIORIDAD 0): limpiar entradas ENVENENADAS pre-fix — las anteriores al
        fix de `contexto_fingerprint` (que añadió `doc=`, commit 5b31f09,
        2026-06-15). Antes de ese fix, dos documentos sueltos del mismo tenant
        (con `documento_id` vacío) compartían bucket de contexto, así que la misma
        pregunta sobre el doc B podía servir la respuesta cacheada del doc A. Esas
        entradas están envenenadas POR DISEÑO y deben purgarse en TODOS los tenants.

        `tenant_id=None` ⇒ cross-tenant. `dry_run=True` ⇒ solo cuenta, no borra.
        Best-effort: el caché es optimización (doc §11); si Redis falla, no rompe.
        Devuelve {escaneadas, purgadas}.
        """
        patron = f"pcl:cache:{tenant_id}:*" if tenant_id else "pcl:cache:*"
        try:
            claves = self.backend.scan(patron)
        except Exception:  # noqa: BLE001 — caché es optimización, no dependencia
            logger.warning("no se pudo escanear caché PCL para purga (patrón %s)", patron)
            return {"escaneadas": 0, "purgadas": 0}

        purgadas = 0
        for ck in claves:
            raw = self.backend.get(ck)
            if raw is None:
                continue
            try:
                entry = json.loads(raw)
            except Exception:  # noqa: BLE001 — entrada corrupta ⇒ candidata a purga
                entry = None
            cached_at = float((entry or {}).get("cached_at") or 0.0)
            if cached_at >= cutoff_epoch:
                continue
            purgadas += 1
            if dry_run:
                continue
            partes = ck.split(":")
            tid = partes[2] if len(partes) > 2 else (tenant_id or "")
            ctx_fp = (entry or {}).get("contexto_fingerprint") or ck.rsplit(":", 1)[-1]
            self._eliminar_entrada(tid, ck, entry, ctx_fp)
        logger.info(
            "purga PCL pre-fix | patrón=%s cutoff=%.0f escaneadas=%d purgadas=%d dry_run=%s",
            patron, cutoff_epoch, len(claves), purgadas, dry_run,
        )
        return {"escaneadas": len(claves), "purgadas": purgadas}

    def _eliminar_entrada(self, tenant_id: str, ck: str, entry: dict | None, ctx_fp: str) -> None:
        """Borra una entrada y la descuelga de los índices de contexto y entidad."""
        try:
            self.backend.delete(ck)
            self.backend.srem(self._idx_key(tenant_id, ctx_fp), ck)
            for eid in (entry or {}).get("entidad_ids", []) or []:
                self.backend.srem(self._ent_key(tenant_id, str(eid)), ck)
        except Exception:  # noqa: BLE001
            logger.debug("no se pudo limpiar la entrada %s", ck)
