"""
Integridad de cita (paquete pre-merge F3) — REGLA permanente de verificación.

DOCYAN LDE™ by XCID.

"Citado" significa VERBATIM del documento. Un test de cita NO califica si solo
comprueba que exista `documento_nombre`/`documento_id` (eso es contar etiquetas —
el punto ciego del e2e de B13.2). Aquí se aserta que el texto que la UI mostrará
como "fragmento del documento original" es **texto real del chunk** (módulo
espacios) que CONTIENE el término de la spec — nunca la `description` sintetizada
por el LLM.

Nota de diseño: los offsets `spans` del SDK NO casan 1:1 el texto almacenado del
chunk (Docling normaliza whitespace distinto al indexar → deriva). Por eso el
verbatim se ancla por TÉRMINO (`_fragmento_anclado`), no por `chunk[start:end]`
crudo: se localiza el `nombre` literal en el chunk y se devuelve una ventana de
contexto a su alrededor. Garantía: el fragmento siempre es real y contiene el
término; si el término no aparece literal (traducido/sintetizado), `fragmento=None`
y la UI dice "fragmento no disponible".

Cobertura:
  · `_primer_span` — parseo del span del SDK (válido / vacío / malformado).
  · `_fragmento_anclado` — ancla por término, ventana de contexto, fallback None.
  · `DKGReader.informativa` — produce el verbatim real (fake client, sin FalkorDB).
  · `tipo1_informativa._cita` — el verbatim fluye al payload como `cita.fragmento`,
    es substring real del documento y ≠ el texto generado (`valor`).
"""
from __future__ import annotations

import json
import re

import pytest

from app.pipelines import tipo1_informativa
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader, _fragmento_anclado, _primer_span

# Texto crudo de un SDS (como queda en un :Chunk tras la ingesta), con whitespace
# "de Docling": doble salto de línea entre campos (la fuente de la deriva de offsets).
CHUNK_ID = "c533f4b8-6b14-410f-8f39-f98d2494f4a6"
CHUNK_TEXT = (
    "## PHYSICAL DATA\n\nVapor Pressure:\n\n4 mm Hg at 68 o F (20 o C)\n\n"
    "Flash Point:\n\n113 o F (45 o C)\n\nWater Solubility:\n\nInsoluble\n"
)
_NORM = re.compile(r"\s+").sub(" ", CHUNK_TEXT)  # forma con espacios colapsados


def _espec(**over) -> dict:
    base = {
        "id": "e1",
        "nombre": "Flash Point",                                   # término REAL del doc
        "valor": "Flash point of 2-Pentanol, 4-Methyl, Acetate is "  # description del LLM
                 "113°F (45°C), indicating flammability risk.",
        "unidad": None,
        "seccion": None,
        "pagina": None,
        "spans": json.dumps({CHUNK_ID: [{"start": 30, "end": 41}]}),
        "documento_id": "doc-sha",
        "documento_nombre": "msds",
    }
    base.update(over)
    return base


class FakeClient:
    """Cliente de grafo sintético: responde por inspección del Cypher (sin FalkorDB)."""

    def __init__(self, especs: list[dict], chunks: dict[str, str], termino: str | None = None):
        self._especs = especs
        self._chunks = chunks
        self._termino = termino

    def query(self, tenant_id: str, cypher: str, params: dict | None = None) -> list[dict]:
        params = params or {}
        if "MATCH (e:Especificacion)" in cypher:
            return [dict(e) for e in self._especs]
        if "MATCH (c:Chunk)" in cypher:
            ids = params.get("ids", [])
            return [{"id": i, "text": self._chunks[i]} for i in ids if i in self._chunks]
        if "MATCH (tt:TerminoTecnico)" in cypher:
            return [{"termino": self._termino, "definicion": None}] if self._termino else []
        return []


# ── _primer_span ──────────────────────────────────────────────────────────────


def test_primer_span_valido():
    assert _primer_span(json.dumps({CHUNK_ID: [{"start": 30, "end": 41}]})) == (CHUNK_ID, 30, 41)


def test_primer_span_acepta_dict_ya_parseado():
    assert _primer_span({CHUNK_ID: [{"start": 1, "end": 5}]}) == (CHUNK_ID, 1, 5)


@pytest.mark.parametrize("bad", [None, "", "[]", "{}", "no-json", "null",
                                 json.dumps({CHUNK_ID: []}),
                                 json.dumps({CHUNK_ID: [{"start": 5, "end": 5}]}),
                                 json.dumps({CHUNK_ID: [{"start": 9, "end": 2}]})])
def test_primer_span_sin_span_valido(bad):
    assert _primer_span(bad) is None


# ── _fragmento_anclado: ancla por término, no por offset crudo ──────────────────


def test_fragmento_anclado_devuelve_texto_real_con_termino():
    frag = _fragmento_anclado(CHUNK_TEXT, "Flash Point", 30)
    assert frag is not None
    # Es texto REAL del documento (substring módulo espacios) que contiene el término…
    assert "Flash Point" in frag["texto"]
    assert frag["texto"] in _NORM
    # …y arrastra el valor adyacente del documento (no inventado).
    assert "113 o F (45 o C)" in frag["texto"]


def test_fragmento_anclado_termino_ausente_es_none():
    # Término traducido/sintetizado que NO aparece literal en el doc inglés.
    assert _fragmento_anclado(CHUNK_TEXT, "Punto de inflamación 45°C", 30) is None


def test_fragmento_anclado_offset_desalineado_no_importa():
    # Aunque la pista del span esté lejos/equivocada, ancla por término igual.
    frag = _fragmento_anclado(CHUNK_TEXT, "Flash Point", 9999)
    assert frag is not None and "Flash Point" in frag["texto"]


# ── DKGReader.informativa ───────────────────────────────────────────────────────


def test_informativa_produce_verbatim_real_no_generado():
    reader = DKGReader(client=FakeClient([_espec()], {CHUNK_ID: CHUNK_TEXT}))
    e = reader.informativa("t", "flash point", None)["especificaciones"][0]
    # REGLA: el fragmento es texto REAL del chunk (no el valor generado por el LLM).
    assert e["fragmento"] and e["fragmento"] in _NORM
    assert "Flash Point" in e["fragmento"]
    assert e["fragmento"] != e["valor"]
    assert e["span_inicio"] is not None and e["span_fin"] is not None


def test_informativa_sin_span_no_inventa_fragmento():
    reader = DKGReader(client=FakeClient([_espec(spans=None)], {CHUNK_ID: CHUNK_TEXT}))
    e = reader.informativa("t", "flash point", None)["especificaciones"][0]
    assert e.get("fragmento") is None  # → "fragmento no disponible"


def test_informativa_termino_no_en_chunk_cae_a_fallback():
    nf = _espec(nombre="Punto de inflamación 45°C")  # no aparece literal en el doc EN
    reader = DKGReader(client=FakeClient([nf], {CHUNK_ID: CHUNK_TEXT}))
    e = reader.informativa("t", "inflamación", None)["especificaciones"][0]
    assert e.get("fragmento") is None


# ── tipo1_informativa._cita: el verbatim fluye al payload ───────────────────────


def test_cita_lleva_fragmento_verbatim_no_texto_generado():
    reader = DKGReader(client=FakeClient([_espec()], {CHUNK_ID: CHUNK_TEXT}))
    ctx = ContextoPipeline(tenant_id="t", pregunta="flash point", params={"termino": "flash point"})
    pay = tipo1_informativa.resolver(ctx, reader).payload
    cita = pay.especificaciones[0].cita
    assert cita is not None
    # El contrato de cita que la UI consume: texto real del documento, no `valor`.
    assert cita.fragmento and cita.fragmento in _NORM
    assert "Flash Point" in cita.fragmento
    assert cita.fragmento != pay.especificaciones[0].valor


def test_cita_sin_span_fragmento_none_pero_cita_existe():
    """Sin span: la cita sigue (doc/sección) pero `fragmento is None` → fallback honesto."""
    reader = DKGReader(client=FakeClient([_espec(spans=None)], {CHUNK_ID: CHUNK_TEXT}))
    ctx = ContextoPipeline(tenant_id="t", pregunta="flash point", params={"termino": "flash point"})
    pay = tipo1_informativa.resolver(ctx, reader).payload
    cita = pay.especificaciones[0].cita
    assert cita is not None and cita.documento_id == "doc-sha"
    assert cita.fragmento is None
