"""
B13.3 · §2.4 — Alertas administrativas con CITA verbatim del vencimiento.

DOCYAN LDE™ by XCID.

`alerts_dashboard` surface la `FechaVencimiento`/`CertificadoVigencia` con cita
anclada en el AÑO del vencimiento (que sí aparece literal en el documento). Asserta:
  · "vence" responde la fecha de VENCIMIENTO, no la de emisión.
  · la cita lleva fragmento verbatim del documento + atribución correcta.
  · la LÍNEA ABSOLUTA intacta: solo administrativas (el safety_validator filtra).

Reader sintético (sin FalkorDB); el camino real se cubre en la suite de paráfrasis.
"""
from __future__ import annotations

import json

from app.pipelines import tipo7_alertas
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

CHUNK_ID = "c-cert-1"
CHUNK_TEXT = (
    "## CALIBRATION CERTIFICATE G26D50542\n\nIssue date:\n\n12 March 2024\n\n"
    "Valid until:\n\n12 March 2027\n\nTraceable to:\n\nNIST standard 4291\n"
)


class FakeGraph:
    def __init__(self, alertas, chunks):
        self._alertas = alertas
        self._chunks = chunks

    def query(self, tenant_id, cypher, params=None):
        params = params or {}
        if "MATCH (c:Chunk)" in cypher:
            return [{"id": i, "text": self._chunks[i]} for i in params.get("ids", []) if i in self._chunks]
        if "MATCH (a:Alerta)" in cypher:
            return [dict(a) for a in self._alertas]
        return []


def _alerta_row(**kw):
    base = {
        "alerta_id": "alert_1", "descripcion": "Certificado G26D50542 vence el 2027-03-12 (en 300 días).",
        "fecha_vencimiento": "2027-03-12", "urgencia": "baja", "tipo": "vencimiento",
        "entidad_id": None,
        "_src_spans": json.dumps({CHUNK_ID: [{"start": CHUNK_TEXT.find("12 March 2027"),
                                              "end": CHUNK_TEXT.find("12 March 2027") + 13}]}),
        "_src_nombre": "Certificado G26D50542",
        "documento_id": "cert_sha", "documento_nombre": "cert_g26.pdf",
        "documento_tipo": "calibracion", "documento_url": None,
    }
    base.update(kw)
    return base


def _resolver(reader):
    ctx = ContextoPipeline(tenant_id="t", pregunta="¿cuándo vence la calibración?", params={})
    return tipo7_alertas.resolver(ctx, reader).payload


def test_alerta_vencimiento_con_cita_verbatim_del_anio():
    g = FakeGraph([_alerta_row()], {CHUNK_ID: CHUNK_TEXT})
    pay = _resolver(DKGReader(g))
    assert len(pay.alertas) == 1
    a = pay.alertas[0]
    # "Vence" = fecha de VENCIMIENTO (2027), no la de emisión (2024).
    assert a.fecha_vencimiento == "2027-03-12"
    assert a.cita is not None
    # Verbatim real anclado al año del vencimiento (presente en el documento). El
    # campo `fecha_vencimiento` (2027) es la garantía de "vence≠emisión"; el
    # fragmento es la ventana de contexto verbatim alrededor de ese año.
    assert a.cita.fragmento and "2027" in a.cita.fragmento
    assert "Valid until" in a.cita.fragmento
    # Atribución coherente (mismo doc: nombre + tipo).
    assert a.cita.documento_nombre == "cert_g26.pdf"
    assert a.cita.documento_tipo == "calibracion"
    assert a.administrativa is True


def test_alerta_sin_span_fuente_no_inventa_fragmento():
    g = FakeGraph([_alerta_row(_src_spans=None)], {CHUNK_ID: CHUNK_TEXT})
    pay = _resolver(DKGReader(g))
    a = pay.alertas[0]
    # Sin span anclable: cita con atribución pero fragmento None (honesto).
    assert a.cita is not None and a.cita.fragmento is None
    assert a.cita.documento_nombre == "cert_g26.pdf"


def test_alerta_linea_absoluta_filtra_no_administrativa():
    # Una "alerta" con sugerencia operativa decisoria NO debe servirse (safety_validator).
    mala = _alerta_row(alerta_id="alert_mala",
                       descripcion="Detenga la línea de inmediato por el vencimiento.")
    g = FakeGraph([_alerta_row(), mala], {CHUNK_ID: CHUNK_TEXT})
    pay = _resolver(DKGReader(g))
    descripciones = [a.descripcion for a in pay.alertas]
    assert all("Detenga" not in d for d in descripciones)
    assert pay.solo_administrativas is True
