"""
Tests de generación + resolución de Tokens QR (B4 §6).

Roundtrip, validación de firma, aislamiento multi-tenant (404), revocación y
caducidad — todo con almacén en memoria y un DKG falso (sin FalkorDB).
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.qr.qr_generator import QrGenerator
from app.qr.qr_resolver import QrResolutionError, QrResolver
from app.qr.store import InMemoryQrTokenStore, QrTokenRecord


class FakeDKG:
    """DKG en memoria: entidades por (tenant, id). Aísla por tenant nativamente."""

    def __init__(self):
        self.entities: dict[tuple[str, str], dict] = {}
        self.docs: dict[tuple[str, str], list[dict]] = {}

    def add_entity(self, tenant_id, entidad_id, props=None, docs=None):
        self.entities[(tenant_id, entidad_id)] = {"id": entidad_id, **(props or {})}
        if docs:
            self.docs[(tenant_id, entidad_id)] = docs

    def get_entity(self, tenant_id, node_id):
        return self.entities.get((tenant_id, node_id))

    def query(self, tenant_id, cypher, params=None):
        return self.docs.get((tenant_id, (params or {}).get("id")), [])


@pytest.fixture
def setup():
    store = InMemoryQrTokenStore()
    dkg = FakeDKG()
    gen = QrGenerator(store=store, base_url="https://docyan-lde-api.fly.dev")
    res = QrResolver(store=store, dkg=dkg, frontend_base_url="https://docyan-lde.vercel.app")
    return store, dkg, gen, res


def test_roundtrip_resuelve_entidad_correcta(setup):
    store, dkg, gen, res = setup
    dkg.add_entity("tenant-a", "ent-1", {"tipo": "extintor"},
                   docs=[{"id": "doc-1", "tipo_documento": "manual"}])

    qr = gen.generar("tenant-a", "ent-1", created_by="user-x")
    assert qr.url.startswith("https://docyan-lde-api.fly.dev/qr/")
    assert qr.svg is not None and qr.svg.startswith("<?xml")  # segno render real

    # "Escanear" = resolver el token de la URL.
    token = qr.url.rsplit("/", 1)[-1]
    resuelto = res.resolve(token)
    assert resuelto.tenant_id == "tenant-a"
    assert resuelto.entidad_id == "ent-1"
    assert resuelto.entidad["tipo"] == "extintor"
    assert resuelto.documentos == [{"id": "doc-1", "tipo_documento": "manual"}]
    # El QR resuelve a la ruta pública REAL del frontend `/q/{token}` (no `/consulta`,
    # que no existe): self-contained por token, la página re-resuelve el contexto.
    assert resuelto.frontend_url == f"https://docyan-lde.vercel.app/q/{token}"


def test_firma_invalida_rechazada(setup):
    store, dkg, gen, res = setup
    dkg.add_entity("tenant-a", "ent-1")
    qr = gen.generar("tenant-a", "ent-1")
    token = qr.url.rsplit("/", 1)[-1]
    body, _sig = token.split(".", 1)
    with pytest.raises(QrResolutionError):
        res.resolve(f"{body}.ZZZZ")


def test_qr_de_otro_tenant_no_resuelve(setup):
    """El mismo entidad_id bajo otro tenant NO resuelve (aislamiento absoluto)."""
    store, dkg, gen, res = setup
    # La entidad 'ent-1' existe SOLO en tenant-a.
    dkg.add_entity("tenant-a", "ent-1", {"tipo": "extintor"})

    # Un token legítimamente firmado para tenant-b apuntando a 'ent-1'.
    from app.qr import tokens
    nonce = tokens.generate_nonce()
    store.save(QrTokenRecord(tenant_id="tenant-b", entidad_id_dkg="ent-1", nonce=nonce))
    token_b = tokens.sign("tenant-b", "ent-1", nonce)

    # Resuelve en el grafo de tenant-b, donde 'ent-1' no existe → 404.
    with pytest.raises(QrResolutionError):
        res.resolve(token_b)


def test_token_no_registrado_rechazado(setup):
    store, dkg, gen, res = setup
    dkg.add_entity("tenant-a", "ent-1")
    from app.qr import tokens
    # Token bien firmado pero NUNCA registrado en el almacén.
    token = tokens.sign("tenant-a", "ent-1", tokens.generate_nonce())
    with pytest.raises(QrResolutionError):
        res.resolve(token)


def test_revocacion_invalida_token(setup):
    store, dkg, gen, res = setup
    dkg.add_entity("tenant-a", "ent-1")
    qr = gen.generar("tenant-a", "ent-1")
    token = qr.url.rsplit("/", 1)[-1]
    # Antes de revocar resuelve.
    assert res.resolve(token).entidad_id == "ent-1"
    # Revoca y ahora falla.
    assert gen.revocar("tenant-a", qr.nonce) is True
    with pytest.raises(QrResolutionError):
        res.resolve(token)


def test_token_expirado_rechazado(setup):
    store, dkg, gen, res = setup
    dkg.add_entity("tenant-a", "ent-1")
    from app.qr import tokens
    nonce = tokens.generate_nonce()
    pasado = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    store.save(QrTokenRecord(tenant_id="tenant-a", entidad_id_dkg="ent-1",
                             nonce=nonce, expires_at=pasado))
    token = tokens.sign("tenant-a", "ent-1", nonce)
    with pytest.raises(QrResolutionError):
        res.resolve(token)


def test_entidad_inexistente_rechazada(setup):
    store, dkg, gen, res = setup
    # Registro válido pero la entidad no está en el grafo.
    qr = gen.generar("tenant-a", "ent-fantasma")
    token = qr.url.rsplit("/", 1)[-1]
    with pytest.raises(QrResolutionError):
        res.resolve(token)
