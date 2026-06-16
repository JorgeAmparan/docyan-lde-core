"""
Aislamiento documental E2E (Sprint Núcleo Consultable — Pieza 1, BLOQUEANTE).

DOCYAN LDE™ by XCID.

Guard de NO-REGRESIÓN del aislamiento (criterio de cierre del contrato): una
consulta sobre el documento A NUNCA devuelve un nodo cuyo `:DocumentoSource` sea B.
Reproduce el bug real del recorrido multi-documento (15-jun): IB-111-RDA citaba
MSDS AM002 porque el retrieval barría TODO el grafo del tenant. El fix scopea por
`(:DocumentoSource {id})-[:CONTIENE]->(n)`.

Corre contra FalkorDB REAL (el scope vive en Cypher; un fake no lo probaría). Si no
hay FalkorDB alcanzable hace SKIP — no es un falso verde. Variables:
    FALKORDB_HOST / FALKORDB_PORT  (o FALKOR_HOST / FALKOR_PORT)
"""
from __future__ import annotations

import os

import pytest

from app.pcl.pcl_cache import contexto_fingerprint

FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
TENANT = "tenant-aisl-e2e"


def _client_or_skip():
    """DKGClient contra FalkorDB real, o SKIP si no responde (no falso verde)."""
    try:
        import redis

        redis.Redis(host=FALKOR_HOST, port=FALKOR_PORT, socket_connect_timeout=1).ping()
    except Exception:
        pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    from app.graph.dkg_client import DKGClient

    return DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)


def _sembrar_dos_docs(c):
    """2 documentos con la MISMA spec léxica ('punto de inflamación'), valores
    distintos — el caso que provoca cross-citation si el retrieval no scopea."""
    c.query(TENANT, "MATCH (n) DETACH DELETE n")
    c.query(
        TENANT,
        """
        CREATE (dA:DocumentoSource {id:'docA', nombre_archivo:'IB-111-RDA.pdf',
                                    tipo_documento:'ficha', url_publica:'uA'})
        CREATE (dB:DocumentoSource {id:'docB', nombre_archivo:'MSDS AM002.pdf',
                                    tipo_documento:'msds', url_publica:'uB'})
        CREATE (a1:Especificacion {id:'a1', nombre:'Punto de inflamación', valor:'60 °C', spans:''})
        CREATE (b1:Especificacion {id:'b1', nombre:'Punto de inflamación', valor:'200 °C', spans:''})
        CREATE (dA)-[:CONTIENE]->(a1)
        CREATE (dB)-[:CONTIENE]->(b1)
        """,
    )


def _valores(reader, doc_id):
    data = reader.informativa(TENANT, "punto de inflamación", None, doc_id)
    return [(e["valor"], e["documento_id"]) for e in data["especificaciones"]]


def test_aislamiento_doc_a_cita_a_doc_b_cita_b():
    """A cita A, B cita B — sin fuga cruzada (paso 3 del recorrido)."""
    c = _client_or_skip()
    # léxico determinista (sin embedder)
    os.environ.pop("EMBEDDER_URL", None)
    os.environ.pop("BGE_M3_URL", None)
    _sembrar_dos_docs(c)
    from app.pipelines.dkg_reader import DKGReader

    reader = DKGReader(client=c, embedder=None)

    a = _valores(reader, "docA")
    b = _valores(reader, "docB")

    # Ningún nodo de A pertenece a B y viceversa (el guard inviolable).
    assert a and all(d == "docA" for _, d in a), f"fuga en docA: {a}"
    assert b and all(d == "docB" for _, d in b), f"fuga en docB: {b}"
    # Valor correcto por documento (no se cruza el dato).
    assert ("60 °C", "docA") in a and ("200 °C", "docA") not in a
    assert ("200 °C", "docB") in b and ("60 °C", "docB") not in b
    # Respuestas DISTINTAS para la misma pregunta (paso 4: sin colisión).
    assert a != b


def test_sin_scope_ve_ambos_demuestra_que_el_scope_aisla():
    """Sin documento_id (compat), el retrieval ve AMBOS docs: confirma que es el
    SCOPE —no otra cosa— lo que produce el aislamiento."""
    c = _client_or_skip()
    os.environ.pop("EMBEDDER_URL", None)
    os.environ.pop("BGE_M3_URL", None)
    _sembrar_dos_docs(c)
    from app.pipelines.dkg_reader import DKGReader

    reader = DKGReader(client=c, embedder=None)
    libre = _valores(reader, None)
    docs = {d for _, d in libre}
    assert {"docA", "docB"} <= docs, f"sin scope debería ver ambos: {libre}"


def test_fingerprint_cache_segrega_por_documento():
    """Pieza 1c: el fingerprint del caché segrega por documento_id — dos documentos
    sueltos (entidad vacía, mismo tipo) ya NO comparten entrada (la colisión '3ª vez').
    Test puro, siempre corre (no requiere FalkorDB)."""
    base = {"token_qr": "", "entidad_id": "", "tipo_documento": "", "par_linguistico": "es"}
    fp_a = contexto_fingerprint({**base, "documento_id": "docA"})
    fp_b = contexto_fingerprint({**base, "documento_id": "docB"})
    fp_none = contexto_fingerprint(base)
    assert fp_a != fp_b, "dos documentos distintos NO deben compartir fingerprint"
    assert fp_a != fp_none and fp_b != fp_none
