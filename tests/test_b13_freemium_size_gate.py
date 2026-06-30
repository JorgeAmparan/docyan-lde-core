"""
B13 — Gate de tamaño freemium (tope de páginas por documento) con rechazo
orientado a CONVERSIÓN.

Verifica:
  · freemium con doc ≤100 pág → procede (cotiza; aprobado).
  · freemium con doc >100 pág → 402 con payload de conversión (no "saldo seco").
  · plan pagado con doc grande → sin tope de páginas (pasa al gate financiero).
  · El gate solo aplica a freemium; orgs sin formalizar no se topan.
"""
from __future__ import annotations

import io

import pytest

from app.api.auth import _create_access_token
from app.ingesta.cotizador import Cotizador
from app.ingesta.document_store import LocalDocumentStore
from app.ingesta.text_extract import CHARS_POR_PAGINA, contar_paginas
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.jobs.job_status import JobStatusReader
from app.platform_admin.store import InMemoryPlatformStore

# ~101 y ~3 páginas estimadas por longitud de texto (no-PDF → estimación por chars).
TEXTO_GRANDE = ("a" * (CHARS_POR_PAGINA * 101)).encode("utf-8")
TEXTO_CHICO = ("Procedimiento. Paso 1: desenergizar. " * 50).encode("utf-8")


# ════════════════════════════════════════════════════════════════════════════
# Unit — conteo de páginas + regla de tamaño freemium
# ════════════════════════════════════════════════════════════════════════════

def test_contar_paginas_estima_por_texto():
    assert contar_paginas(TEXTO_CHICO, "x.txt") == 1
    assert contar_paginas(TEXTO_GRANDE, "x.txt") == 101
    assert contar_paginas(b"", "vacio.txt") == 1  # nunca < 1


def test_verificar_tamano_freemium_regla():
    from app.onboarding.limites import (
        FREEMIUM_MAX_PAGINAS,
        DocumentoFreemiumExcedeError,
        verificar_tamano_freemium,
    )
    store = InMemoryPlatformStore()
    store.create_org("free", plan="freemium", doc_limit=3)
    store.create_org("paid", plan="esencial", doc_limit=None)

    # Freemium: exactamente en el tope pasa; uno más, rechaza.
    verificar_tamano_freemium(store, "free", FREEMIUM_MAX_PAGINAS)
    with pytest.raises(DocumentoFreemiumExcedeError) as exc:
        verificar_tamano_freemium(store, "free", FREEMIUM_MAX_PAGINAS + 1)
    payload = exc.value.payload()
    assert payload["error"] == "freemium_documento_excede_paginas"
    assert payload["paginas"] == FREEMIUM_MAX_PAGINAS + 1
    assert payload["limite_paginas"] == FREEMIUM_MAX_PAGINAS
    assert {s["accion"] for s in payload["salidas"]} == {
        "subir_documento_mas_pequeno", "upgrade_plan"}

    # Plan pagado: sin tope de páginas. Org sin formalizar: tampoco se topa.
    verificar_tamano_freemium(store, "paid", 5000)
    verificar_tamano_freemium(store, "inexistente", 5000)


# ════════════════════════════════════════════════════════════════════════════
# Integración HTTP — /ingesta/documents con el gate real
# ════════════════════════════════════════════════════════════════════════════

class _FakeDkgCount:
    def query(self, tenant_id, cypher, params=None):
        if "count(d) AS c" in cypher:
            return [{"c": 0}]  # 0 docs vivos → el gate de conteo no bloquea
        return []


@pytest.fixture
def wired(monkeypatch, tmp_path):
    queue_backend = InMemoryQueueBackend()
    cotizador = Cotizador()
    dispatcher = JobDispatcher(backend=queue_backend)
    status_reader = JobStatusReader(backend=queue_backend)

    from app.ingesta import providers as ip
    monkeypatch.setattr(ip, "get_cotizador", lambda: cotizador)
    monkeypatch.setattr(ip, "get_dispatcher", lambda: dispatcher)
    monkeypatch.setattr(ip, "get_status_reader", lambda: status_reader)
    monkeypatch.setattr(ip, "get_document_store", lambda: LocalDocumentStore(base_dir=str(tmp_path)))
    from app.schemas_documentales.registry import InMemorySchemaStore, SchemaRegistry
    from app.schemas_documentales.selector import SchemaSelector
    monkeypatch.setattr(
        ip, "get_selector",
        lambda: SchemaSelector(registry=SchemaRegistry(store=InMemorySchemaStore())),
    )

    # Onboarding store con dos orgs: una freemium, una pagada.
    store = InMemoryPlatformStore()
    store.create_org("free-org", plan="freemium", doc_limit=3)
    store.create_org("paid-org", plan="esencial", doc_limit=None)
    from app.onboarding import providers as op
    monkeypatch.setattr(op, "get_store", lambda: store)
    monkeypatch.setattr(op, "get_dkg", lambda: _FakeDkgCount())

    from fastapi.testclient import TestClient

    from app.api.main import app
    return TestClient(app)


def _jwt(org_id, role="admin"):
    tok = _create_access_token(
        {"id": "u1", "org_id": org_id, "role": role, "email": "a@a.com"})
    return {"Authorization": f"Bearer {tok}"}


def _subir(client, org_id, data, nombre="doc.txt"):
    files = {"file": (nombre, io.BytesIO(data), "text/plain")}
    return client.post("/ingesta/documents", headers=_jwt(org_id), files=files)


def test_freemium_doc_pequeno_procede(wired):
    r = _subir(wired, "free-org", TEXTO_CHICO)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["paginas_estimadas"] == 1
    assert body["cotizacion"]["aprobado"] is True  # v2.1: el cotizador siempre aprueba


def test_freemium_doc_grande_rechazo_conversion(wired):
    r = _subir(wired, "free-org", TEXTO_GRANDE)
    assert r.status_code == 402, r.text
    detail = r.json()["detail"]
    assert detail["error"] == "freemium_documento_excede_paginas"
    assert detail["paginas"] == 101
    assert detail["limite_paginas"] == 100
    # Es invitación a convertir, no "saldo insuficiente" seco.
    assert "saldo" not in detail["mensaje"].lower()
    assert len(detail["salidas"]) == 2


def test_plan_pagado_sin_tope_de_paginas(wired):
    # El mismo doc grande en un plan pagado NO se topa por páginas: pasa al cotizador.
    r = _subir(wired, "paid-org", TEXTO_GRANDE)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["paginas_estimadas"] == 101
    assert "cotizacion" in body  # llegó al gate financiero (no hubo tope de páginas)
