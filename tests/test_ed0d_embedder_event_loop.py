"""
Sprint ED-0d — el embedder (docyan-lde-embedder) no bloquea su event loop.

Regresión (versión embedder de la de ED-0): el `/embed` era `async def` corriendo
`model.encode` (bloqueante, CPU) DIRECTO en el event loop → una inferencia congelaba
el loop y las demás peticiones (incluida /health) se colgaban (ReadTimeout en el
worker aun con timeout de 300s). Fix ED-0d: inferencia en UN hilo (executor de 1
worker), carga en startup, health profundo pero acotado que NO se cuelga.

Sin torch/sentence-transformers (worker-only): se mockea `_encode` con una función
que "tarda" (simula la inferencia CPU); todo lo demás es el app real vía ASGITransport.
"""
from __future__ import annotations

import asyncio
import time

import httpx
from httpx import ASGITransport


async def test_dos_embeds_concurrentes_completan_y_health_no_bloquea(monkeypatch):
    import embedder.main as m

    # Inferencia FALSA: "tarda" 1.5s (simula el encode CPU de BGE-M3), 1024 dim.
    def fake_encode(texts):
        time.sleep(1.5)
        return [[0.0] * m.EMBED_DIM for _ in texts]

    monkeypatch.setattr(m, "_encode", fake_encode)
    monkeypatch.setattr(m, "_ready", True)  # ASGITransport no corre startup

    transport = ASGITransport(app=m.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://embed") as c:
        loop = asyncio.get_event_loop()

        async def do_embed():
            return await c.post("/embed", json={"texts": ["hola", "mundo"]})

        async def health_durante_inferencia():
            await asyncio.sleep(0.3)  # deja arrancar una inferencia
            t0 = loop.time()
            r = await c.get("/health")
            return r, loop.time() - t0

        e1, e2, (h, dt_health) = await asyncio.gather(
            do_embed(), do_embed(), health_durante_inferencia()
        )

    # (a) ambos /embed concurrentes COMPLETAN (serializados, pero ninguno se cuelga)
    assert e1.status_code == 200 and e2.status_code == 200
    assert len(e1.json()["embeddings"]) == 2
    assert len(e1.json()["embeddings"][0]) == m.EMBED_DIM

    # (b) /health respondió < 1s DURANTE la inferencia (el loop no se bloqueó)
    assert h.status_code == 200
    assert dt_health < 1.0, f"/health tardó {dt_health:.2f}s — el loop del embedder se bloqueó"
    assert h.json()["busy"] is True  # reportó honestamente "ocupado" (no colgado)


async def test_health_503_mientras_el_modelo_no_esta_listo(monkeypatch):
    import embedder.main as m

    monkeypatch.setattr(m, "_ready", False)      # aún cargando
    monkeypatch.setattr(m, "_inferring", False)
    transport = ASGITransport(app=m.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://embed") as c:
        r = await c.get("/health")
        e = await c.post("/embed", json={"texts": ["x"]})
    assert r.status_code == 503        # health NO miente: 503 hasta que el modelo cargue
    assert e.status_code == 503        # /embed rechaza limpio mientras carga


async def test_health_profundo_hace_embed_cuando_esta_libre(monkeypatch):
    import embedder.main as m

    llamadas = {"n": 0}

    def fake_encode(texts):
        llamadas["n"] += 1
        return [[0.0] * m.EMBED_DIM for _ in texts]

    monkeypatch.setattr(m, "_encode", fake_encode)
    monkeypatch.setattr(m, "_ready", True)
    monkeypatch.setattr(m, "_inferring", False)
    transport = ASGITransport(app=m.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://embed") as c:
        r = await c.get("/health")
    # health libre ⇒ ejercita el modelo (embed real de "ok"), no miente con un flag.
    assert r.status_code == 200 and r.json()["busy"] is False
    assert llamadas["n"] >= 1
