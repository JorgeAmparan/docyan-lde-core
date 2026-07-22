"""
B13.3 · DEF-1 (scope completo de lectura) + DEF-2 (híbrido) en `DKGReader.informativa`.

DOCYAN LDE™ by XCID.

Verifica con un reader de grafo sintético (sin FalkorDB) que:
  · DEF-1 — la InfoCard ahora lee ontología más allá de `:Especificacion`: el
    químico del MSDS vive en `:Sustancia` y se vuelve consultable, con CITA propia
    anclada y atribución correcta (nombre + tipo del MISMO documento).
  · DEF-2 — con embedder, una spec sin token compartido con el query entra por
    puente semántico (PEL↔TLV); sin embedder, el recall es léxico estricto
    (desambiguación histórica intacta); embedder caído → degradación a léxico.

Las pruebas contra el shape REAL del pipeline (extracción Gemini) viven en la
suite de paráfrasis real (`test_b133_parafrasis_real.py`, requiere FalkorDB).
"""
from __future__ import annotations

import hashlib
import json
import re

from app.pipelines import tipo1_informativa
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

CHUNK_ID = "c-msds-1"
# Texto crudo de un MSDS (como queda en un :Chunk), whitespace "de Docling".
CHUNK_TEXT = (
    "## SECTION 1. IDENTIFICATION\n\nProduct name:\n\nAluminum oxide\n\n"
    "## SECTION 8. EXPOSURE CONTROLS\n\nOSHA PEL:\n\n15 mg/m3 (total dust)\n\n"
    "ACGIH TLV:\n\n10 mg/m3\n"
)


class FakeEmbedder:
    def embed(self, text: str) -> list[float]:
        h = hashlib.sha256((text or "").encode("utf-8")).digest()
        return [b / 255.0 for b in h[:16]]


def _row(**kw) -> dict:
    base = {
        "id": None, "nombre": None, "valor": None, "unidad": None, "descripcion": None,
        "texto": None, "termino": None, "magnitud": None, "folio": None, "fecha": None,
        "name": None, "seccion": None, "pagina": None, "spans": None, "embedding": None,
        "documento_id": None, "documento_nombre": None, "documento_tipo": None,
        "documento_url": None,
    }
    base.update(kw)
    return base


def _spans(chunk_id=CHUNK_ID, start=0):
    return json.dumps({chunk_id: [{"start": start, "end": start + 5}]})


class FakeGraph:
    """Reader de grafo sintético: responde por label según el Cypher (sin FalkorDB)."""

    def __init__(self, by_label: dict[str, list[dict]], chunks=None, termino=None):
        self.by_label = by_label
        self.chunks = chunks or {}
        self.termino = termino

    def query(self, tenant_id, cypher, params=None):
        params = params or {}
        if "MATCH (c:Chunk)" in cypher:
            return [{"id": i, "text": self.chunks[i]} for i in params.get("ids", []) if i in self.chunks]
        if "MATCH (tt:TerminoTecnico)" in cypher:
            return [{"termino": self.termino, "definicion": None}] if self.termino else []
        if "MATCH (e:Especificacion)" in cypher:
            return [dict(r) for r in self.by_label.get("Especificacion", [])]
        m = re.search(r"MATCH \(n0:(\w+)\)", cypher)
        if m:
            return [dict(r) for r in self.by_label.get(m.group(1), [])]
        return []


def _pay(reader, pregunta):
    ctx = ContextoPipeline(tenant_id="t", pregunta=pregunta, params={"termino": pregunta})
    return tipo1_informativa.resolver(ctx, reader).payload


# ── DEF-1 — la ontología antes invisible se vuelve consultable + citada ─────────


def test_def1_sustancia_es_consultable_con_cita_y_atribucion():
    sust = _row(
        id="s1", nombre="Aluminum oxide", spans=_spans(start=CHUNK_TEXT.find("Aluminum oxide")),
        documento_id="msds_sha", documento_nombre="msds_am002.pdf", documento_tipo="msds",
    )
    g = FakeGraph({"Sustancia": [sust]}, chunks={CHUNK_ID: CHUNK_TEXT})
    pay = _pay(DKGReader(g, embedder=None), "¿cuál es el nombre del químico?")
    nombres = {e.nombre for e in pay.especificaciones}
    assert "Sustancia" in nombres
    espec = next(e for e in pay.especificaciones if e.nombre == "Sustancia")
    # El VALOR mostrado es el contenido verbatim del nodo (no fabricado).
    assert espec.valor == "Aluminum oxide"
    # Cita propia anclada: fragmento real del documento que CONTIENE el término.
    assert espec.cita is not None
    assert espec.cita.fragmento and "Aluminum oxide" in espec.cita.fragmento
    # Atribución correcta (§2.3): nombre + tipo del MISMO documento, sin mezclar.
    assert espec.cita.documento_nombre == "msds_am002.pdf"
    assert espec.cita.documento_tipo == "msds"


def test_def1_no_fabrica_fragmento_si_el_termino_no_esta_en_el_chunk():
    # Sustancia cuyo nombre NO aparece literal en el chunk → fragmento None honesto.
    sust = _row(id="s2", nombre="Óxido de aluminio (traducido)", spans=_spans(),
                documento_id="d", documento_nombre="x.pdf", documento_tipo="msds")
    g = FakeGraph({"Sustancia": [sust]}, chunks={CHUNK_ID: CHUNK_TEXT})
    pay = _pay(DKGReader(g, embedder=None), "sustancia química")
    espec = next(e for e in pay.especificaciones if e.nombre == "Sustancia")
    assert espec.cita is not None and espec.cita.fragmento is None


# ── DEF-2 — puente semántico + degradación ──────────────────────────────────────


def _especs_pel_tlv(tlv_emb):
    emb = FakeEmbedder()
    pel = _row(id="pel", nombre="OSHA PEL exposure limit", valor="15 mg/m3",
               spans=_spans(start=CHUNK_TEXT.find("OSHA PEL")),
               embedding=emb.embed("ruido"), documento_id="d", documento_nombre="m.pdf",
               documento_tipo="msds")
    tlv = _row(id="tlv", nombre="ACGIH TLV", valor="10 mg/m3",
               spans=_spans(start=CHUNK_TEXT.find("ACGIH TLV")),
               embedding=tlv_emb, documento_id="d", documento_nombre="m.pdf",
               documento_tipo="msds")
    return [pel, tlv]


def test_def2_puente_semantico_admite_tlv_sin_token_compartido():
    emb = FakeEmbedder()
    q = "exposure limit"
    g = FakeGraph({"Especificacion": _especs_pel_tlv(tlv_emb=emb.embed(q))},
                  chunks={CHUNK_ID: CHUNK_TEXT})
    pay = _pay(DKGReader(g, embedder=emb), q)
    nombres = {e.nombre for e in pay.especificaciones}
    assert "OSHA PEL exposure limit" in nombres  # léxico estricto
    assert "ACGIH TLV" in nombres                # puente semántico (sin token común)


def test_def2_con_embedder_sigue_desambiguando_osha():
    # "OSHA": PEL casa estricto; TLV sin embedding ⇒ vec 0 ⇒ no admitido. len==1.
    emb = FakeEmbedder()
    g = FakeGraph({"Especificacion": _especs_pel_tlv(tlv_emb=None)},
                  chunks={CHUNK_ID: CHUNK_TEXT})
    pay = _pay(DKGReader(g, embedder=emb), "OSHA")
    nombres = [e.nombre for e in pay.especificaciones]
    assert nombres == ["OSHA PEL exposure limit"]


def test_def2_sin_embedder_es_lexico_estricto():
    # Sin embedder, "exposure limit" no admite TLV (no comparte token) — paridad B13.2.
    g = FakeGraph({"Especificacion": _especs_pel_tlv(tlv_emb=[0.1] * 16)},
                  chunks={CHUNK_ID: CHUNK_TEXT})
    pay = _pay(DKGReader(g, embedder=None), "exposure limit")
    nombres = {e.nombre for e in pay.especificaciones}
    assert "ACGIH TLV" not in nombres


def test_def1_fechavencimiento_responde_vence_con_cita():
    # "¿cuándo vence?" surface :FechaVencimiento (la fecha de VENCIMIENTO, no la de
    # emisión) con cita anclada. El bridge proyecta name→fecha; el reader lo lee.
    chunk = ("## CALIBRATION CERTIFICATE\n\nCalibration date:\n\n15 January 2026\n\n"
             "Next due / expires:\n\n15 January 2027\n")
    fv = _row(id="fv1", fecha="15 January 2027",
              spans=_spans(start=chunk.find("15 January 2027")),
              documento_id="cert", documento_nombre="mitutoyo_cert.pdf",
              documento_tipo="calibracion")
    g = FakeGraph({"FechaVencimiento": [fv]}, chunks={CHUNK_ID: chunk})
    pay = _pay(DKGReader(g, embedder=None), "¿cuándo vence la calibración?")
    item = next((e for e in pay.especificaciones if e.nombre == "Vence"), None)
    assert item is not None
    assert item.valor == "15 January 2027"           # vencimiento (2027), no emisión (2026)
    assert item.cita and item.cita.fragmento and "2027" in item.cita.fragmento
    assert item.cita.documento_tipo == "calibracion"


def test_informativa_combina_especificacion_y_labels_def1():
    # Una consulta amplia recupera specs Y la sustancia, cada una con su etiqueta.
    emb = FakeEmbedder()
    especs = _especs_pel_tlv(tlv_emb=emb.embed("exposure limit"))
    sust = _row(id="s1", nombre="Aluminum oxide",
                spans=_spans(start=CHUNK_TEXT.find("Aluminum oxide")),
                documento_id="d", documento_nombre="m.pdf", documento_tipo="msds")
    g = FakeGraph({"Especificacion": especs, "Sustancia": [sust]},
                  chunks={CHUNK_ID: CHUNK_TEXT})
    pay = _pay(DKGReader(g, embedder=emb), "exposure limit OSHA")
    # Toda cita arrastra su atribución coherente.
    for e in pay.especificaciones:
        if e.cita:
            assert e.cita.documento_tipo == "msds"


# ── §B · Embedder caído (503) → degradación honesta, NUNCA flood léxico ─────────


class _EmbedderCaido:
    def embed(self, text: str):  # noqa: ANN201
        raise ConnectionError("embed 503")


def test_informativa_propaga_embedder_caido_no_floodea():
    import pytest

    from app.pipelines.retrieval_hibrido import EmbedderNoDisponibleError

    # Universo con una spec que casa léxico el query (dispara la vectorial). Con el
    # embedder configurado-pero-caído, el reader NO cae a admitir todo el universo:
    # propaga para degradación honesta.
    fg = FakeGraph({"Especificacion": [_row(id="s1", nombre="OSHA PEL", valor="15 mg/m3")]})
    reader = DKGReader(client=fg, embedder=_EmbedderCaido())
    ctx = ContextoPipeline(tenant_id="t", pregunta="OSHA PEL", params={"termino": "OSHA PEL"})
    with pytest.raises(EmbedderNoDisponibleError):
        tipo1_informativa.resolver(ctx, reader)


def test_coordinator_degrada_honesto_ante_embedder_caido():
    from app.orchestrator.clasificacion.tipos import (
        RUTA_POR_TIPO,
        ResultadoClasificacion,
        TipoIntencion,
    )
    from app.orchestrator.pipeline_coordinator import PipelineCoordinator
    from app.pipelines.retrieval_hibrido import EmbedderNoDisponibleError

    class ReaderCaido:
        def informativa(self, *a, **k):
            raise EmbedderNoDisponibleError("503")

    coord = PipelineCoordinator(graph_reader=ReaderCaido())
    ctx = ContextoPipeline(tenant_id="t", pregunta="lubricante?", params={})
    clasif = ResultadoClasificacion(
        tipo=TipoIntencion.INFORMATIVA, score=0.9,
        ruta=RUTA_POR_TIPO[TipoIntencion.INFORMATIVA], metodo="heuristico")
    envelope, extras = coord.ejecutar_pipeline(clasif, ctx)

    assert envelope.degradado is True
    assert "temporalmente" in (envelope.nota or "").lower()
    assert envelope.payload.especificaciones == []          # CERO flood con citas
    assert "embedder_no_disponible" in extras["error"]      # queda en FAT vía el MO
