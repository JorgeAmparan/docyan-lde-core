"""
Tests del seed de Playbooks por vertical (B8 §B4).

Verifica que la librería inicial de los 3 verticales del mercado alfa
(laboratorio, maquiladora, agencia) se materializa como Playbooks + consultas
guardadas reales. B13 refinará el contenido en onboarding.
"""
import pytest

from app.playbooks.models import InMemoryPlaybookStore, TipoCreacionPlaybook
from app.playbooks.seed_vertical import _cargar_plantillas, seed_for_vertical

VERTICALES = ["laboratorio", "maquiladora", "agencia"]
TIPOS_VALIDOS = {
    "INFORMATIVA", "GUIA_PASO_A_PASO", "GRAFICOS_DIAGRAMAS", "VIDEO",
    "TROUBLESHOOTING", "HISTORIAL", "ALERTAS", "COMPARATIVA",
}


@pytest.mark.parametrize("vertical", VERTICALES)
def test_seed_crea_playbooks_reales(vertical):
    store = InMemoryPlaybookStore()
    creados = seed_for_vertical("t1", vertical, store, user_id="system")
    # Al menos 2 playbooks por vertical (contrato del usuario: 2-3).
    assert len(creados) >= 2
    for pb in creados:
        assert pb["tipo_creacion"] == TipoCreacionPlaybook.precargado_vertical.value
        assert pb["vertical"] == vertical
        assert len(pb["pasos"]) >= 2
    # Las consultas guardadas de los pasos existen en el tenant.
    consultas = store.listar_consultas("t1", "system")
    assert len(consultas) >= 4


@pytest.mark.parametrize("vertical", VERTICALES)
def test_plantillas_usan_tipos_de_intencion_validos(vertical):
    for tpl in _cargar_plantillas(vertical):
        for paso in tpl["pasos"]:
            assert paso["tipo_intencion"] in TIPOS_VALIDOS
            assert paso["consulta_original"].strip()


def test_seed_vertical_inexistente_devuelve_vacio():
    store = InMemoryPlaybookStore()
    assert seed_for_vertical("t1", "vertical_que_no_existe", store) == []
