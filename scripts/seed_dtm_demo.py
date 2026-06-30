#!/usr/bin/env python3.11
"""
Siembra de memoria de traducción (DTM) demo — DOCYAN LDE™ by XCID (P7 · Tipo 9).

Crea, en el grafo DTM del par direccional en-US→es-MX de un tenant, un conjunto
REAL de segmentos alineados (`:SegmentoTraduccion`) + un glosario con lock
terminológico (`:Glosario`-[:CONTIENE_TERMINO]->`:TerminoGlosario`). Esto puebla
la vista bilingüe del prototipo (Tipo 9) con datos reales para que una consulta
EN→ES devuelva segmentos citados — no es un stub: son pares de traducción
verbatim (memoria), análogos a los PDFs demo reales.

Pista B (consulta multilingüe): el documento origen está en inglés; la memoria
guarda su equivalencia aprobada en español con los términos fijados del glosario.

CORRE EN LA MÁQUINA DESPLEGADA (alcanza el FalkorDB privado .internal):
    fly ssh console -a docyan-lde-api -C \
        "python scripts/seed_dtm_demo.py --tenant <TENANT_ID>"

Idempotente: si el segmento marcador ya existe, no recrea nada.
"""
from __future__ import annotations

import argparse
import sys

SOURCE_LANG = "en-US"
TARGET_LANG = "es-MX"

# Glosario del par (términos fijados — lock terminológico, diferenciador vs CAT).
GLOSARIO_TERMINOS = [
    ("lock-out/tag-out", "bloqueo/etiquetado (LOTO)"),
    ("coolant filter", "filtro de refrigerante"),
    ("pressure relief valve", "válvula de alivio de presión"),
    ("personal protective equipment", "equipo de protección personal"),
]

# Segmentos alineados verbatim (memoria de traducción). tipo_segmento ∈ enum (23).
SEGMENTOS = [
    ("Stop the machine and apply lock-out/tag-out before service.",
     "Detén la máquina y aplica bloqueo/etiquetado (LOTO) antes del servicio.",
     "advertencia", "seguridad"),
    ("The housing remains pressurized until fully drained.",
     "El alojamiento permanece presurizado hasta drenarse por completo.",
     "narrativa", "operacion"),
    ("Replace the coolant filter cartridge every 500 hours.",
     "Reemplaza el cartucho del filtro de refrigerante cada 500 horas.",
     "instruccion_paso", "mantenimiento"),
    ("Wear personal protective equipment when handling the solvent.",
     "Usa equipo de protección personal al manipular el solvente.",
     "advertencia", "seguridad"),
    ("Inspect the pressure relief valve before each shift.",
     "Inspecciona la válvula de alivio de presión antes de cada turno.",
     "instruccion_paso", "mantenimiento"),
]

# id estable del marcador → idempotencia (no se resiembra si ya existe).
MARKER_ID = "dtm_demo_seed_marker_v1"


def seed(tenant_id: str) -> dict:
    from app.graph.dtm_client import DTMClient
    from app.graph.schemas.dtm_ontology import DTMEdgeType, DTMNodeLabel

    dtm = DTMClient()

    # Idempotencia: ¿ya está el marcador?
    existentes = dtm.query(
        tenant_id, SOURCE_LANG, TARGET_LANG,
        "MATCH (s:SegmentoTraduccion {id: $id}) RETURN s.id AS id",
        {"id": MARKER_ID},
    )
    if existentes:
        return {"tenant_id": tenant_id, "creado": False, "motivo": "ya sembrado (idempotente)"}

    from app.graph.dtm_segregation import graph_name_for_pair

    graph_name = graph_name_for_pair(tenant_id, SOURCE_LANG, TARGET_LANG)

    # Glosario + términos fijados.
    glos = dtm.create_node(
        tenant_id, SOURCE_LANG, TARGET_LANG, DTMNodeLabel.GLOSARIO.value,
        {"tipo_glosario": "agencia", "par_linguistico": "en-US↔es-MX",
         "lock_terminologico": True, "tenant_id": tenant_id, "version": "v1"},
    )
    glos_id = glos["id"]
    for origen, destino in GLOSARIO_TERMINOS:
        term = dtm.create_node(
            tenant_id, SOURCE_LANG, TARGET_LANG, DTMNodeLabel.TERMINO_GLOSARIO.value,
            {"texto_origen": origen, "texto_destino": destino, "tenant_id": tenant_id},
        )
        dtm.create_edge(
            graph_name, DTMNodeLabel.GLOSARIO.value, glos_id,
            DTMEdgeType.CONTIENE_TERMINO.value,
            DTMNodeLabel.TERMINO_GLOSARIO.value, term["id"],
        )

    # Segmentos alineados (el primero lleva el id marcador).
    creados = 0
    for i, (origen, destino, tipo_seg, dominio) in enumerate(SEGMENTOS):
        props = {
            "texto_origen": origen, "texto_destino": destino,
            "idioma_origen": SOURCE_LANG, "idioma_destino": TARGET_LANG,
            "tipo_segmento": tipo_seg, "dominio": dominio,
            "tenant_id": tenant_id, "score_calidad": 1.0,
        }
        if i == 0:
            props["id"] = MARKER_ID
        dtm.create_node(tenant_id, SOURCE_LANG, TARGET_LANG,
                        DTMNodeLabel.SEGMENTO_TRADUCCION.value, props)
        creados += 1

    return {"tenant_id": tenant_id, "creado": True, "graph_name": graph_name,
            "segmentos": creados, "terminos_glosario": len(GLOSARIO_TERMINOS)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Siembra DTM demo (Tipo 9 bilingüe).")
    ap.add_argument("--tenant", required=True, help="tenant_id destino.")
    args = ap.parse_args()
    res = seed(args.tenant)
    print(res)
    return 0


if __name__ == "__main__":
    sys.exit(main())
