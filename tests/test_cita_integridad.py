"""
Integridad de cita (paquete pre-merge F3) — REGLA permanente de verificación.

DOCYAN LDE™ by XCID.

"Citado" significa VERBATIM del documento. Un test de cita NO califica si solo
comprueba que exista `documento_nombre`/`documento_id` (eso es contar etiquetas —
el punto ciego del e2e de B13.2). Aquí se aserta que el texto que la UI mostrará
como "fragmento del documento original" es EXACTAMENTE `chunk[start:end]` del texto
crudo, no la `description` sintetizada por el LLM.

Cobertura:
  · `_primer_span` — parseo del span del SDK (válido / vacío / malformado).
  · `DKGReader.informativa` — recorta el verbatim del chunk vía span (fake client,
    sin FalkorDB → corre siempre en CI).
  · `tipo1_informativa._cita` — el verbatim fluye al payload como `cita.fragmento`,
    y el fragmento ≠ el texto generado (`valor`).
  · Fallback honesto — spec sin span ⇒ `fragmento is None` (la UI dirá
    "fragmento no disponible", nunca pasa texto generado como fuente).
"""
from __future__ import annotations

import json

import pytest

from app.pipelines import tipo1_informativa
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader, _primer_span

# Texto crudo realista de un SDS (como queda en un :Chunk tras la ingesta).
CHUNK_ID = "c533f4b8-6b14-410f-8f39-f98d2494f4a6"
CHUNK_TEXT = (
    "## PHYSICAL DATA\n\nVapor Pressure:\n\n4 mm Hg at 68 o F (20 o C)\n\n"
    "Flash Point:\n\n113 o F (45 o C)\n\nWater Solubility:\n\nInsoluble\n"
)
# Offsets del verbatim "113 o F (45 o C)" dentro del chunk.
_FRAG = "113 o F (45 o C)"
_INI = CHUNK_TEXT.index(_FRAG)
_FIN = _INI + len(_FRAG)


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


def _espec_con_span(**over) -> dict:
    base = {
        "id": "e1",
        "nombre": "Punto de inflamación 45°C",                       # nombre sintetizado (es)
        "valor": "Flash point of 2-Pentanol, 4-Methyl, Acetate is "  # description del LLM (en)
                 "113°F (45°C), indicating flammability risk.",
        "unidad": None,
        "seccion": None,
        "pagina": None,
        "spans": json.dumps({CHUNK_ID: [{"start": _INI, "end": _FIN}]}),
        "documento_id": "doc-sha",
        "documento_nombre": "msds",
    }
    base.update(over)
    return base


# ── _primer_span ──────────────────────────────────────────────────────────────


def test_primer_span_valido():
    assert _primer_span(json.dumps({CHUNK_ID: [{"start": _INI, "end": _FIN}]})) == (CHUNK_ID, _INI, _FIN)


def test_primer_span_acepta_dict_ya_parseado():
    assert _primer_span({CHUNK_ID: [{"start": 1, "end": 5}]}) == (CHUNK_ID, 1, 5)


@pytest.mark.parametrize("bad", [None, "", "[]", "{}", "no-json", "null",
                                 json.dumps({CHUNK_ID: []}),
                                 json.dumps({CHUNK_ID: [{"start": 5, "end": 5}]}),   # vacío
                                 json.dumps({CHUNK_ID: [{"start": 9, "end": 2}]})])  # invertido
def test_primer_span_sin_span_valido(bad):
    assert _primer_span(bad) is None


# ── DKGReader.informativa: recorta el verbatim ──────────────────────────────────


def test_informativa_recorta_verbatim_del_chunk():
    reader = DKGReader(client=FakeClient([_espec_con_span()], {CHUNK_ID: CHUNK_TEXT}))
    e = reader.informativa("t", "inflamación", None)["especificaciones"][0]
    # REGLA: el fragmento mostrado == chunk[start:end] del texto CRUDO.
    assert e["fragmento"] == CHUNK_TEXT[_INI:_FIN] == _FRAG
    assert e["span_inicio"] == _INI and e["span_fin"] == _FIN
    # Y NO es el texto generado por el LLM.
    assert e["fragmento"] != e["valor"]


def test_informativa_sin_span_no_inventa_fragmento():
    reader = DKGReader(client=FakeClient([_espec_con_span(spans=None)], {CHUNK_ID: CHUNK_TEXT}))
    e = reader.informativa("t", "inflamación", None)["especificaciones"][0]
    assert e.get("fragmento") is None  # → la UI muestra "fragmento no disponible"


def test_informativa_offset_fuera_de_rango_cae_a_none():
    bad = _espec_con_span(spans=json.dumps({CHUNK_ID: [{"start": 9000, "end": 9999}]}))
    reader = DKGReader(client=FakeClient([bad], {CHUNK_ID: CHUNK_TEXT}))
    e = reader.informativa("t", "inflamación", None)["especificaciones"][0]
    assert e.get("fragmento") is None


# ── tipo1_informativa._cita: el verbatim fluye al payload ───────────────────────


def test_cita_lleva_fragmento_verbatim_no_texto_generado():
    reader = DKGReader(client=FakeClient([_espec_con_span()], {CHUNK_ID: CHUNK_TEXT}))
    ctx = ContextoPipeline(tenant_id="t", pregunta="inflamación", params={"termino": "inflamación"})
    pay = tipo1_informativa.resolver(ctx, reader).payload
    cita = pay.especificaciones[0].cita
    assert cita is not None
    # El contrato de cita que la UI consume: verbatim == chunk[start:end].
    assert cita.fragmento == _FRAG
    assert cita.span_inicio == _INI and cita.span_fin == _FIN
    assert cita.fragmento != pay.especificaciones[0].valor


def test_cita_sin_span_fragmento_none_pero_cita_existe():
    """Sin span: la cita sigue (doc/sección) pero `fragmento is None` → fallback honesto."""
    reader = DKGReader(client=FakeClient([_espec_con_span(spans=None)], {CHUNK_ID: CHUNK_TEXT}))
    ctx = ContextoPipeline(tenant_id="t", pregunta="inflamación", params={"termino": "inflamación"})
    pay = tipo1_informativa.resolver(ctx, reader).payload
    cita = pay.especificaciones[0].cita
    assert cita is not None and cita.documento_id == "doc-sha"
    assert cita.fragmento is None
