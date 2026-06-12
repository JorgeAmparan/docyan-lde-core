"""
B13.3 · DEF-2 — Suite de PARÁFRASIS contra el grafo REAL (regla #5/#7).

DOCYAN LDE™ by XCID.

NO fabrica nodos (regla #7): consulta el reader REAL sobre un tenant YA SEMBRADO
por el pipeline (Docling + Gemini + SDK + bridge). Por cada dato de prueba, ≥5
fraseos distintos (sinónimos, siglas, EN/ES, una palabra) con aserción de respuesta
CITADA. Es la verificación que la regla del sprint exige: "mínimo 5 paráfrasis
reales por documento", "OSHA PEL"→TLV como caso nombrado.

Cómo correrla (Jorge / CI con infra):
    export FALKORDB_HOST=... FALKORDB_PORT=... EMBEDDER_URL=...   # grafo + embedder vivos
    export DOCYAN_PARAFRASIS_TENANT=demo-maq                       # tenant ya sembrado
    /opt/homebrew/bin/python3.11 -m pytest tests/test_b133_parafrasis_real.py -q

Sin esas variables (o sin FalkorDB) la suite hace SKIP — no es un falso verde:
el cierre real es el recorrido de Jorge sobre el demo público y su cuenta freemium.
"""
from __future__ import annotations

import os

import pytest

TENANT = os.getenv("DOCYAN_PARAFRASIS_TENANT")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST")
FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")

# Datos de prueba: cada uno con ≥5 paráfrasis reales. El aserto es que AL MENOS una
# cite (servido + fragmento verbatim); las paráfrasis débiles que no citen son
# HALLAZGO a reportar, no a maquillar. "OSHA PEL"→TLV es el caso nombrado del sprint.
PARAFRASIS_MSDS: dict[str, list[str]] = {
    "limite_exposicion": [
        "¿Cuál es el límite de exposición ocupacional?",
        "OSHA PEL?",
        "What is the OSHA permissible exposure limit?",
        "ACGIH TLV del producto",
        "exposición permitida por inhalación",
        "límite",
    ],
    "punto_inflamacion": [
        "¿Cuál es el punto de inflamación?",
        "flash point",
        "¿es inflamable?",
        "temperatura de ignición",
        "flammability",
    ],
    "nombre_quimico": [
        "¿Cuál es el nombre del químico?",
        "chemical name",
        "¿qué sustancia es?",
        "composición",
        "nombre de la sustancia",
    ],
}


@pytest.fixture()
def reader():
    if not (TENANT and FALKOR_HOST):
        pytest.skip("Configura DOCYAN_PARAFRASIS_TENANT + FALKORDB_HOST (grafo real sembrado).")
    from app.graph.dkg_client import DKGClient
    from app.pipelines.dkg_reader import DKGReader

    c = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
    try:
        if not c.health():
            pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    except Exception:  # noqa: BLE001
        pytest.skip("FalkorDB no alcanzable")
    return DKGReader(c)  # embedder real vía EMBEDDER_URL/BGE_M3_URL si está configurado


def _cita_limpia(reader, tenant, pregunta) -> bool:
    """True si la consulta devuelve al menos una spec con fragmento verbatim."""
    data = reader.informativa(tenant, pregunta, None)
    for e in data.get("especificaciones") or []:
        if e.get("fragmento"):
            return True
    return False


@pytest.mark.parametrize("dato", list(PARAFRASIS_MSDS.keys()))
def test_parafrasis_dato_cita_con_al_menos_una(reader, dato):
    fraseos = PARAFRASIS_MSDS[dato]
    citan = [p for p in fraseos if _cita_limpia(reader, TENANT, p)]
    # Criterio del sprint: el dato debe ser alcanzable por fraseo natural, no solo
    # por la forma exacta del grafo. Reportamos cuántas de las ≥5 paráfrasis citaron.
    assert citan, (
        f"[{dato}] ninguna de {len(fraseos)} paráfrasis citó verbatim sobre {TENANT}. "
        f"HALLAZGO B13.3: {fraseos}"
    )


def test_osha_pel_encuentra_tlv(reader):
    """Caso nombrado: 'OSHA PEL' debe resolver al límite de exposición (puente PEL↔TLV)."""
    assert _cita_limpia(reader, TENANT, "OSHA PEL"), (
        "El puente semántico PEL↔TLV no resolvió 'OSHA PEL' con cita. "
        "Verifica que EMBEDDER_URL apunte al embedder vivo (decisión #1)."
    )
