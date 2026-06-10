"""
Rate limiter por clave (F3 §D — endpoint demo público sin auth).

DOCYAN LDE™ by XCID.

Ventana fija (fixed window) sobre Redis: `INCR` + `EXPIRE` la primera vez. Es
suficiente y barato para proteger el endpoint demo público (sin auth, rate-limited
por IP) de abuso/scraping. Diseño testeable: el contrato `RateLimiter` se cumple con
`InMemoryRateLimiter` (tests, sin reloj) o `RedisRateLimiter` (producción).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    limit: int
    retry_after: int  # segundos aprox. hasta que la ventana se reinicia


class RateLimiter(Protocol):
    def hit(self, key: str) -> RateLimitResult: ...


@dataclass
class InMemoryRateLimiter:
    """Contador en proceso para tests. Sin expiración real (la ventana se ignora:
    se cuenta el total de hits por clave, que es lo que los tests verifican)."""

    limit: int = 30
    window_seconds: int = 60
    _counts: dict[str, int] | None = None

    def __post_init__(self) -> None:
        if self._counts is None:
            self._counts = {}

    def hit(self, key: str) -> RateLimitResult:
        n = self._counts.get(key, 0) + 1
        self._counts[key] = n
        return RateLimitResult(
            allowed=n <= self.limit,
            remaining=max(0, self.limit - n),
            limit=self.limit,
            retry_after=self.window_seconds,
        )

    def reset(self, key: str | None = None) -> None:
        if key is None:
            self._counts = {}
        else:
            self._counts.pop(key, None)


class RedisRateLimiter:
    """Ventana fija sobre Redis (producción). `INCR` atómico + `EXPIRE` al primer hit."""

    def __init__(
        self,
        redis_client=None,
        limit: int | None = None,
        window_seconds: int = 60,
        prefix: str = "rate:demo:",
    ) -> None:
        self._redis = redis_client
        self.limit = limit if limit is not None else int(
            os.getenv("DEMO_RATE_LIMIT_PER_MIN", "30")
        )
        self.window_seconds = window_seconds
        self.prefix = prefix

    def _client(self):
        if self._redis is None:
            from app.cache.redis_client import redis_client

            self._redis = redis_client
        return self._redis._get_client()

    def hit(self, key: str) -> RateLimitResult:
        rkey = f"{self.prefix}{key}"
        client = self._client()
        n = int(client.incr(rkey))
        if n == 1:
            client.expire(rkey, self.window_seconds)
        ttl = client.ttl(rkey)
        ttl = ttl if isinstance(ttl, int) and ttl > 0 else self.window_seconds
        return RateLimitResult(
            allowed=n <= self.limit,
            remaining=max(0, self.limit - n),
            limit=self.limit,
            retry_after=ttl,
        )
