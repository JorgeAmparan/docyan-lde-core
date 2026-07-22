import json
import os

from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# Socket timeouts (ED-0 §3.2): sin ellos un `recv`/`connect` estancado a Redis
# congela el thread indefinidamente. Cortos porque Redis vive en la red privada
# de Fly (respuesta inmediata o falla). Configurables por entorno.
REDIS_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "5"))
REDIS_SOCKET_CONNECT_TIMEOUT = float(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "3"))


class RedisClient:
    """Redis client for sessions and caching."""

    def __init__(self, url: str | None = None):
        self.url = url or REDIS_URL
        self._client = None

    def _get_client(self):
        if self._client is None:
            import redis
            self._client = redis.from_url(
                self.url,
                decode_responses=True,
                socket_timeout=REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=REDIS_SOCKET_CONNECT_TIMEOUT,
            )
        return self._client

    def get(self, key: str) -> str | None:
        return self._get_client().get(key)

    def set(self, key: str, value: str, ttl: int | None = None):
        client = self._get_client()
        if ttl:
            client.setex(key, ttl, value)
        else:
            client.set(key, value)

    def get_json(self, key: str) -> dict | None:
        raw = self.get(key)
        if raw:
            return json.loads(raw)
        return None

    def set_json(self, key: str, value: dict, ttl: int | None = None):
        self.set(key, json.dumps(value), ttl=ttl)

    def delete(self, key: str):
        self._get_client().delete(key)

    def raw(self):
        """Cliente `redis-py` subyacente (para SET NX EX del lock del scheduler)."""
        return self._get_client()

    def health(self) -> bool:
        try:
            return self._get_client().ping()
        except Exception:
            return False


redis_client = RedisClient()
