"""
ED-2 §2.4 — Marcado de datos accionables en el payload de consulta.

El backend decide el flag `accionable` + `tipo_sugerido` por dato, determinístico
por (intención, tipo_documento). Evidencia §5.4: NO se sobre-marca — un dato cuyo
tipo documental no está en el mapeo NO lleva flag.
"""

from __future__ import annotations

from app.pipelines.base import ContextoPipeline
from app.pipelines.tipo1_informativa import resolver


class _ReaderPartes:
    """Reader sintético: una espec citada en un catálogo de partes (especificacion)."""

    def informativa(self, tenant, termino, entidad, documento=None):
        return {
            "termino": "Acople motor-eje",
            "definicion": None,
            "especificaciones": [
                {
                    "nombre": "Número de parte",
                    "valor": "MX-4471",
                    "unidad": None,
                    "documento_id": "doc-partes-777",
                    "documento_nombre": "Lista de partes MAXI-10ND",
                    "documento_tipo": "especificacion",
                    "span_inicio": 10,
                    "span_fin": 30,
                    "fragmento": "Acople motor-eje MX-4471",
                }
            ],
        }


class _ReaderManual:
    """Reader sintético: una espec citada en un manual técnico (sin mapeo)."""

    def informativa(self, tenant, termino, entidad, documento=None):
        return {
            "termino": "Par de apriete",
            "definicion": None,
            "especificaciones": [
                {
                    "nombre": "Par de apriete",
                    "valor": "40 Nm",
                    "unidad": "Nm",
                    "documento_id": "doc-manual-1",
                    "documento_nombre": "Manual técnico MAXI-10ND",
                    "documento_tipo": "manual_tecnico",
                    "span_inicio": 5,
                    "span_fin": 20,
                    "fragmento": "Par de apriete 40 Nm",
                }
            ],
        }


def _ctx():
    return ContextoPipeline(tenant_id="t", pregunta="acople", entidad_id=None, documento_id=None)


def test_espec_en_catalogo_de_partes_es_accionable_cotizacion():
    res = resolver(_ctx(), _ReaderPartes())
    espec = res.payload.especificaciones[0]
    assert espec.accionable is True
    assert espec.tipo_sugerido == "cotizacion"
    # Provenance intacto para heredar en la solicitud.
    assert espec.cita.documento_id == "doc-partes-777"
    assert espec.cita.fragmento == "Acople motor-eje MX-4471"


def test_espec_en_manual_no_se_sobre_marca():
    res = resolver(_ctx(), _ReaderManual())
    espec = res.payload.especificaciones[0]
    assert espec.accionable is False  # sin mapeo ⇒ sin flag (§5.4)
    assert espec.tipo_sugerido is None
