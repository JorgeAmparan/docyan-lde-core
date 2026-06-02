"""
Reportes auditables del FAT en 4 formatos (doc 08, B7).

DOCYAN LDE™ by XCID.

Exporta un conjunto de eventos FAT (filtrado por tenant / familia / rango de
fechas / entidad / actor) a:
  - JSON  (formato API)
  - CSV   (spreadsheet)
  - XML   (máquina-a-máquina)
  - PDF   (formato regulatorio, con la cadena de hashes incluida)

El PDF se genera con un writer mínimo en PURE PYTHON (sin reportlab/weasyprint:
no están en el stack del backend <1 GB). Produce un PDF 1.4 válido, paginado, con
el texto de cada evento y su hash, de modo que un auditor (o un parser) puede
leer la cadena directamente del documento.
"""
from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass
from xml.sax.saxutils import escape as _xml_escape

from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import EventoFAT


@dataclass
class FiltroReporte:
    """Filtros de exportación. Todos opcionales (None = sin filtro)."""

    familia: FamiliaFAT | None = None
    desde: str | None = None  # timestamp ISO inclusive
    hasta: str | None = None  # timestamp ISO inclusive
    entidad_afectada_id: str | None = None
    actor_id: str | None = None

    def aplica(self, ev: EventoFAT) -> bool:
        if self.familia is not None and ev.familia != self.familia:
            return False
        if self.desde is not None and ev.timestamp < self.desde:
            return False
        if self.hasta is not None and ev.timestamp > self.hasta:
            return False
        if (
            self.entidad_afectada_id is not None
            and ev.entidad_afectada_id != self.entidad_afectada_id
        ):
            return False
        if self.actor_id is not None and ev.actor_id != self.actor_id:
            return False
        return True


def filtrar(eventos: list[EventoFAT], filtro: FiltroReporte | None) -> list[EventoFAT]:
    if filtro is None:
        return list(eventos)
    return [e for e in eventos if filtro.aplica(e)]


# ── JSON ─────────────────────────────────────────────────────────────────────


def export_json(eventos: list[EventoFAT], filtro: FiltroReporte | None = None) -> str:
    evs = filtrar(eventos, filtro)
    return json.dumps(
        {"total": len(evs), "eventos": [e.to_dict() for e in evs]},
        ensure_ascii=False,
        indent=2,
    )


# ── CSV ──────────────────────────────────────────────────────────────────────

_CSV_COLS = [
    "evento_id",
    "tipo_evento",
    "familia",
    "timestamp",
    "actor_tipo",
    "actor_id",
    "tenant_id",
    "entidad_afectada_tipo",
    "entidad_afectada_id",
    "corrige_evento_id",
    "hash_evento",
    "hash_evento_anterior",
    "payload",
    "metadata",
]


def export_csv(eventos: list[EventoFAT], filtro: FiltroReporte | None = None) -> str:
    evs = filtrar(eventos, filtro)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_COLS, extrasaction="ignore")
    writer.writeheader()
    for e in evs:
        row = e.to_dict()
        row["payload"] = json.dumps(e.payload, ensure_ascii=False, sort_keys=True)
        row["metadata"] = json.dumps(e.metadata, ensure_ascii=False, sort_keys=True)
        writer.writerow(row)
    return buf.getvalue()


# ── XML ──────────────────────────────────────────────────────────────────────


def export_xml(eventos: list[EventoFAT], filtro: FiltroReporte | None = None) -> str:
    evs = filtrar(eventos, filtro)
    partes: list[str] = ['<?xml version="1.0" encoding="UTF-8"?>']
    partes.append(f'<fat_report total="{len(evs)}">')
    for e in evs:
        partes.append("  <evento>")
        d = e.to_dict()
        for col in _CSV_COLS:
            val = d.get(col)
            if col in ("payload", "metadata"):
                val = json.dumps(val, ensure_ascii=False, sort_keys=True)
            txt = _xml_escape("" if val is None else str(val))
            partes.append(f"    <{col}>{txt}</{col}>")
        partes.append("  </evento>")
    partes.append("</fat_report>")
    return "\n".join(partes)


# ── PDF (writer mínimo pure-python, sin dependencias) ────────────────────────


def _pdf_escape(texto: str) -> str:
    """Escapa caracteres especiales de cadenas literales PDF y no-ASCII."""
    out = texto.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    # PDF base usa codificación de byte único (WinAnsi). Reemplaza no-latin1.
    return "".join(c if ord(c) < 256 else "?" for c in out)


def _wrap(texto: str, ancho: int = 95) -> list[str]:
    """Trocea una línea larga en segmentos de `ancho` caracteres."""
    if len(texto) <= ancho:
        return [texto]
    return [texto[i : i + ancho] for i in range(0, len(texto), ancho)]


def _lineas_de_evento(e: EventoFAT) -> list[str]:
    d = e.to_dict()
    lineas = [
        f"[{d['familia']}] {d['tipo_evento']}  @ {d['timestamp']}",
        f"  evento_id: {d['evento_id']}   actor: {d['actor_tipo']}/{d['actor_id']}",
    ]
    if d.get("entidad_afectada_id"):
        lineas.append(
            f"  entidad: {d['entidad_afectada_tipo']}/{d['entidad_afectada_id']}"
        )
    if d.get("corrige_evento_id"):
        lineas.append(f"  corrige_evento_id: {d['corrige_evento_id']}")
    lineas += _wrap(f"  hash_evento: {d['hash_evento']}")
    lineas += _wrap(f"  hash_anterior: {d['hash_evento_anterior']}")
    lineas += _wrap(
        "  payload: " + json.dumps(e.payload, ensure_ascii=False, sort_keys=True)
    )
    lineas.append("")
    return lineas


def export_pdf(
    eventos: list[EventoFAT],
    filtro: FiltroReporte | None = None,
    titulo: str = "DOCYAN LDE — Reporte FAT (cadena de hashes SHA-256)",
) -> bytes:
    """
    Genera un PDF 1.4 válido con el reporte. Texto monoespaciado (Courier),
    paginado. Incluye el hash de cada evento → la cadena queda en el documento.
    """
    evs = filtrar(eventos, filtro)

    # Construir todas las líneas de texto.
    todas: list[str] = [titulo, f"Total de eventos: {len(evs)}", ""]
    for e in evs:
        todas.extend(_lineas_de_evento(e))

    # Paginar: ~52 líneas por página A4 a 12pt con interlineado 14.
    lineas_por_pagina = 52
    paginas: list[list[str]] = [
        todas[i : i + lineas_por_pagina]
        for i in range(0, max(len(todas), 1), lineas_por_pagina)
    ] or [[titulo]]

    # ── Ensamblar objetos PDF ────────────────────────────────────────────────
    objetos: list[bytes] = []

    def add_obj(cuerpo: bytes) -> int:
        objetos.append(cuerpo)
        return len(objetos)  # número de objeto (1-based)

    # Reservamos numeración: 1=Catalog, 2=Pages, luego por página (Page+Content),
    # y la fuente al final. Construimos primero los contenidos.
    n_paginas = len(paginas)
    # Layout de números:
    catalog_num = 1
    pages_num = 2
    primer_page_num = 3
    # Cada página usa 2 objetos (Page, Content) consecutivos.
    page_nums = [primer_page_num + 2 * i for i in range(n_paginas)]
    content_nums = [primer_page_num + 2 * i + 1 for i in range(n_paginas)]
    font_num = primer_page_num + 2 * n_paginas

    # 1. Catalog
    add_obj(f"<< /Type /Catalog /Pages {pages_num} 0 R >>".encode("latin-1"))
    # 2. Pages
    kids = " ".join(f"{n} 0 R" for n in page_nums)
    add_obj(
        f"<< /Type /Pages /Count {n_paginas} /Kids [{kids}] >>".encode("latin-1")
    )
    # Páginas + contenidos.
    for i, lineas in enumerate(paginas):
        # Page object.
        page_body = (
            f"<< /Type /Page /Parent {pages_num} 0 R "
            f"/MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_num} 0 R >> >> "
            f"/Contents {content_nums[i]} 0 R >>"
        ).encode("latin-1")
        add_obj(page_body)
        # Content stream.
        partes = ["BT", "/F1 9 Tf", "14 TL", "40 800 Td"]
        for ln in lineas:
            partes.append(f"({_pdf_escape(ln)}) Tj")
            partes.append("T*")
        partes.append("ET")
        stream = "\n".join(partes).encode("latin-1")
        content = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        add_obj(content)
    # Fuente.
    add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

    # ── Serializar con xref ──────────────────────────────────────────────────
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = []
    for i, cuerpo in enumerate(objetos, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode("latin-1"))
        out.write(cuerpo)
        out.write(b"\nendobj\n")

    xref_pos = out.tell()
    n_obj = len(objetos)
    out.write(f"xref\n0 {n_obj + 1}\n".encode("latin-1"))
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode("latin-1"))
    out.write(b"trailer\n")
    out.write(
        f"<< /Size {n_obj + 1} /Root {catalog_num} 0 R >>\n".encode("latin-1")
    )
    out.write(b"startxref\n")
    out.write(f"{xref_pos}\n".encode("latin-1"))
    out.write(b"%%EOF\n")
    return out.getvalue()


# ── Despacho por formato ──────────────────────────────────────────────────────

FORMATOS = ("json", "csv", "xml", "pdf")


def exportar(
    eventos: list[EventoFAT],
    formato: str,
    filtro: FiltroReporte | None = None,
) -> bytes:
    """Exporta al formato pedido. Devuelve bytes (texto → UTF-8)."""
    formato = formato.lower()
    if formato == "json":
        return export_json(eventos, filtro).encode("utf-8")
    if formato == "csv":
        return export_csv(eventos, filtro).encode("utf-8")
    if formato == "xml":
        return export_xml(eventos, filtro).encode("utf-8")
    if formato == "pdf":
        return export_pdf(eventos, filtro)
    raise ValueError(f"Formato no soportado: {formato!r}. Use uno de {FORMATOS}.")
