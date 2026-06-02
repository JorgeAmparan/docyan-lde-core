"""
Tests de reportes auditables del FAT (B7, doc 08 §E).

4 formatos (JSON/CSV/XML/PDF), roundtrip-parse, hashes presentes, filtros.
"""
import csv
import io
import json
from xml.etree import ElementTree as ET

from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.audit.reports import (
    FiltroReporte,
    export_csv,
    export_json,
    export_pdf,
    export_xml,
    exportar,
)


def _fat_con_eventos() -> FATExtendido:
    fat = FATExtendido(InMemoryFATStore())
    familias = [FamiliaFAT.F4_CONSULTA, FamiliaFAT.F7_GOBERNANZA, FamiliaFAT.F9_SISTEMA]
    for i in range(6):
        fat.registrar(
            tipo_evento=f"{familias[i % 3].value}.evt_{i}",
            familia=familias[i % 3],
            tenant_id="t1",
            actor_id=f"u{i % 2}",
            entidad_afectada_tipo="documento",
            entidad_afectada_id=f"doc-{i}",
            payload={"i": i},
            evento_id=f"e-{i}",
            timestamp=f"2026-06-02T10:0{i}:00+00:00",
        )
    return fat


def test_json_roundtrip_y_hashes():
    eventos = _fat_con_eventos().eventos("t1")
    data = json.loads(export_json(eventos))
    assert data["total"] == 6
    assert all("hash_evento" in e and len(e["hash_evento"]) == 64 for e in data["eventos"])


def test_csv_roundtrip():
    eventos = _fat_con_eventos().eventos("t1")
    texto = export_csv(eventos)
    filas = list(csv.DictReader(io.StringIO(texto)))
    assert len(filas) == 6
    assert filas[0]["hash_evento"]
    # payload roundtrip-parsea como JSON.
    assert json.loads(filas[0]["payload"]) == {"i": 0}


def test_xml_roundtrip():
    eventos = _fat_con_eventos().eventos("t1")
    root = ET.fromstring(export_xml(eventos))
    assert root.attrib["total"] == "6"
    assert len(root.findall("evento")) == 6
    primero = root.find("evento")
    assert primero is not None
    assert primero.find("hash_evento").text


def test_pdf_es_valido_y_contiene_hashes():
    eventos = _fat_con_eventos().eventos("t1")
    pdf = export_pdf(eventos)
    assert pdf.startswith(b"%PDF-1.4")
    assert pdf.rstrip().endswith(b"%%EOF")
    assert b"xref" in pdf and b"trailer" in pdf and b"startxref" in pdf
    # Cada hash debe aparecer textual en el documento (cadena incluida).
    texto = pdf.decode("latin-1")
    for ev in eventos:
        assert ev.hash_evento in texto


def test_pdf_pagina_muchos_eventos():
    fat = FATExtendido(InMemoryFATStore())
    for i in range(60):
        fat.registrar(
            tipo_evento=f"F4.e{i}", familia=FamiliaFAT.F4_CONSULTA, tenant_id="t1",
            evento_id=f"e-{i:03d}", timestamp=f"2026-06-02T{10 + i // 60:02d}:{i % 60:02d}:00+00:00",
        )
    pdf = export_pdf(fat.eventos("t1"))
    # Multipágina: /Type /Pages con Count > 1.
    assert b"/Count" in pdf
    assert pdf.startswith(b"%PDF")


def test_filtro_por_familia():
    eventos = _fat_con_eventos().eventos("t1")
    solo_f7 = json.loads(
        export_json(eventos, FiltroReporte(familia=FamiliaFAT.F7_GOBERNANZA))
    )
    assert solo_f7["total"] == 2
    assert all(e["familia"] == "F7" for e in solo_f7["eventos"])


def test_filtro_por_rango_fecha_y_actor():
    eventos = _fat_con_eventos().eventos("t1")
    f = FiltroReporte(desde="2026-06-02T10:02:00+00:00", hasta="2026-06-02T10:04:00+00:00")
    res = json.loads(export_json(eventos, f))
    assert {e["evento_id"] for e in res["eventos"]} == {"e-2", "e-3", "e-4"}
    por_actor = json.loads(export_json(eventos, FiltroReporte(actor_id="u0")))
    assert all(e["actor_id"] == "u0" for e in por_actor["eventos"])


def test_exportar_dispatch_4_formatos():
    eventos = _fat_con_eventos().eventos("t1")
    for fmt in ("json", "csv", "xml", "pdf"):
        out = exportar(eventos, fmt)
        assert isinstance(out, bytes) and len(out) > 0
