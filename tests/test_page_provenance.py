"""
DEMO-CIERRE — page-provenance + contexto de sección en los :Chunk.

Verifica la asignación CORRECTA-POR-CONSTRUCCIÓN de `chunk.pagina` (contención
verbatim contra el markdown por-página de Docling) y `chunk.seccion` (encabezado),
con un cliente falso — sin FalkorDB. Regla dura: si el chunk no cae en EXACTAMENTE
una página, `pagina` queda null (NUNCA una página equivocada).
"""
from __future__ import annotations

from app.graph import dkg_provenance as P


class _FakeClient:
    """Cliente DKG falso: devuelve chunks fijos al SELECT y captura el UNWIND write."""

    def __init__(self, chunks: list[dict]) -> None:
        self._chunks = chunks
        self.writes: list[list[dict]] = []

    def query(self, tenant_id, cypher, params=None):
        if "WHERE c.pagina IS NULL" in cypher:
            return [{"id": c["id"], "text": c["text"]} for c in self._chunks]
        if "UNWIND $rows" in cypher:
            self.writes.append((params or {}).get("rows", []))
            return []
        return []


PAGINAS = {
    1: "## Sistema hidráulico\nPresión de la cara del pistón: 1150 psi máximos.",
    2: "## Llantas\nPresión de aire en frío marcada en la llanta del remolque.",
}
MARKDOWN = (
    "## Sistema hidráulico\nPresión de la cara del pistón: 1150 psi máximos.\n"
    "## Llantas\nPresión de aire en frío marcada en la llanta del remolque."
)


def _rows(client) -> dict[str, dict]:
    """Aplana los updates capturados a {id: row}."""
    out: dict[str, dict] = {}
    for batch in client.writes:
        for r in batch:
            out[r["id"]] = r
    return out


def test_pagina_por_contencion_una_sola_pagina():
    chunks = [
        {"id": "c1", "text": "Presión de la cara del pistón: 1150 psi máximos."},
        {"id": "c2", "text": "Presión de aire en frío marcada en la llanta del remolque."},
    ]
    cli = _FakeClient(chunks)
    res = P._asignar_pagina_seccion_chunks(cli, "t", PAGINAS, MARKDOWN)
    rows = _rows(cli)
    assert rows["c1"]["pagina"] == 1 and rows["c1"]["seccion"] == "Sistema hidráulico"
    assert rows["c2"]["pagina"] == 2 and rows["c2"]["seccion"] == "Llantas"
    assert res["chunks_con_pagina"] == 2 and res["chunks_con_seccion"] == 2


def test_pagina_null_si_ambigua_o_ausente():
    chunks = [
        # Aparece en AMBAS páginas ("Presión de") → ambiguo → pagina null (nunca se arriesga).
        {"id": "amb", "text": "Presión de"},  # además <20 chars → se ignora
        # Texto que NO está en ninguna página → pagina null.
        {"id": "aus", "text": "Este texto no aparece en ninguna página del documento fuente."},
    ]
    cli = _FakeClient(chunks)
    P._asignar_pagina_seccion_chunks(cli, "t", PAGINAS, MARKDOWN)
    rows = _rows(cli)
    # "amb" (<20) no se procesa; "aus" no cae en ninguna página → pagina null.
    assert "amb" not in rows
    assert rows.get("aus", {}).get("pagina") is None


def test_sin_paginas_no_asigna_ni_rompe():
    cli = _FakeClient([{"id": "c1", "text": "cualquier cosa larga que exista aquí"}])
    res = P._asignar_pagina_seccion_chunks(cli, "t", None, MARKDOWN)
    assert res["chunks_con_pagina"] == 0 and cli.writes == []


def test_correcto_por_construccion_nunca_pagina_equivocada():
    # Un chunk que cae en 2 páginas NO debe recibir una página (a lo más null).
    paginas = {1: "el mismo párrafo repetido exactamente", 2: "el mismo párrafo repetido exactamente"}
    cli = _FakeClient([{"id": "dup", "text": "el mismo párrafo repetido exactamente"}])
    P._asignar_pagina_seccion_chunks(cli, "t", paginas, "")
    rows = _rows(cli)
    assert rows.get("dup", {}).get("pagina") is None  # 2 páginas ⇒ null, jamás equivocada


def test_mapa_secciones_por_encabezados():
    md = "# Intro\nhola mundo\n## Detalle\nun dato técnico\ntexto más"
    segs = P._mapa_secciones(md)
    secciones = {s for s, _ in segs}
    assert "Intro" in secciones and "Detalle" in secciones


def test_norm_ws_colapsa_whitespace():
    assert P._norm_ws("  Hola\n\t MUNDO  ") == "hola mundo"
