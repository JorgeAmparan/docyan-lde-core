"""
Tests E2E de los endpoints de Playbooks (B8 §B, API del MO).

Niveles A/B/C vía HTTP con backends en memoria (dependency_overrides). Verifica
naming progresivo, disparo de consulta/Playbook y el ciclo de sugerencias.
"""
import pytest

from app.api.routers import mo as mo_router
from app.playbooks.consultas_guardadas import ConsultasGuardadasService
from app.playbooks.models import InMemoryPlaybookStore, now_iso
from app.playbooks.perfil import InMemoryPerfilProvider
from app.playbooks.playbooks_core import PlaybooksService
from app.playbooks.sugerencias import SugerenciasService
from tests.conftest import make_inmemory_mo

HEADERS = {"X-API-Key": "test-api-key-for-pytest"}  # → org=test-org, role=admin
T = "test-org"


@pytest.fixture
def pb_client(test_client):
    from app.api.main import app

    store = InMemoryPlaybookStore()
    perfil = InMemoryPerfilProvider()
    perfil.set_perfil(T, T, permiso_ia_proactiva=True)
    bundle = {
        "store": store, "perfil": perfil,
        "consultas": ConsultasGuardadasService(store),
        "playbooks": PlaybooksService(store),
        "sugerencias": SugerenciasService(store, perfil),
    }
    mo, _ = make_inmemory_mo()
    app.dependency_overrides[mo_router.get_mo] = lambda: mo
    app.dependency_overrides[mo_router.get_pb] = lambda: bundle
    yield test_client, bundle
    app.dependency_overrides.pop(mo_router.get_mo, None)
    app.dependency_overrides.pop(mo_router.get_pb, None)


def _save(client, nombre, entidad="e1", tipo="INFORMATIVA"):
    return client.post("/mo/queries/save", headers=HEADERS, json={
        "nombre": nombre, "consulta_original": f"q {nombre}",
        "tipo_intencion": tipo, "entidad_referenciada_id": entidad,
    }).json()


def test_save_listar_run_consulta(pb_client):
    client, _bundle = pb_client
    c = _save(client, "Par de apriete")
    assert c["disparos_totales"] == 0

    lst = client.get("/mo/queries/saved", headers=HEADERS).json()
    assert len(lst["items"]) == 1
    assert lst["termino_playbook_disponible"] is False  # solo 1

    run = client.post(f"/mo/queries/saved/{c['id']}/run", headers=HEADERS).json()
    assert run["servido"] is True
    assert run["resultado"]["payload"]["kind"] == "info_card"
    assert run["consulta"]["disparos_totales"] == 1


def test_naming_progresivo_flag_via_api(pb_client):
    client, _bundle = pb_client
    _save(client, "c1", entidad="e1")
    assert client.get("/mo/queries/saved", headers=HEADERS).json()["termino_playbook_disponible"] is False
    _save(client, "c2", entidad="e1", tipo="HISTORIAL")
    lst = client.get("/mo/queries/saved", headers=HEADERS).json()
    assert lst["termino_playbook_disponible"] is True


def test_crear_y_disparar_playbook(pb_client):
    client, _bundle = pb_client
    c1 = _save(client, "Especificación", entidad="e1")
    c2 = _save(client, "Historial", entidad="e1", tipo="HISTORIAL")
    pb = client.post("/mo/playbooks", headers=HEADERS, json={
        "nombre": "Apertura de turno",
        "pasos": [{"consulta_guardada_id": c1["id"]}, {"consulta_guardada_id": c2["id"]}],
    }).json()
    assert len(pb["pasos"]) == 2

    run = client.post(f"/mo/playbooks/{pb['id']}/run", headers=HEADERS).json()
    vista = run["vista_unificada"]
    assert len(vista) == 2
    assert vista[0]["tipo_intencion"] == "INFORMATIVA"
    assert run["playbook"]["disparos_totales"] == 1


def test_borrar_consulta_en_uso_bloqueada_via_api(pb_client):
    client, _bundle = pb_client
    c1 = _save(client, "c1")
    client.post("/mo/playbooks", headers=HEADERS, json={
        "nombre": "pb", "pasos": [{"consulta_guardada_id": c1["id"]}]})
    r = client.delete(f"/mo/queries/saved/{c1['id']}", headers=HEADERS)
    assert r.status_code == 409


def test_ciclo_sugerencias_via_api(pb_client):
    client, bundle = pb_client
    store = bundle["store"]
    consultas = bundle["consultas"]
    c1 = consultas.guardar(T, T, "c1", "q1", "INFORMATIVA", entidad_referenciada_id="e1")
    consultas.guardar(T, T, "c2", "q2", "HISTORIAL", entidad_referenciada_id="e1")
    for _ in range(3):
        store.registrar_disparo_consulta(T, c1["id"], now_iso())
    generadas = bundle["sugerencias"].evaluar_tenant(T)
    assert len(generadas) == 1

    pendientes = client.get("/mo/playbooks/sugerencias", headers=HEADERS).json()
    assert len(pendientes) == 1
    sug_id = pendientes[0]["id"]

    res = client.post(f"/mo/playbooks/sugerencias/{sug_id}/accept", headers=HEADERS,
                      json={"nombre": "Recorrido sugerido"}).json()
    assert res["playbook"]["tipo_creacion"] == "sugerencia_edb_aceptada"
    # Ya no quedan pendientes.
    assert client.get("/mo/playbooks/sugerencias", headers=HEADERS).json() == []


def test_rechazar_sugerencia_via_api(pb_client):
    client, bundle = pb_client
    store, consultas = bundle["store"], bundle["consultas"]
    c1 = consultas.guardar(T, T, "c1", "q1", "INFORMATIVA", entidad_referenciada_id="e1")
    consultas.guardar(T, T, "c2", "q2", "HISTORIAL", entidad_referenciada_id="e1")
    for _ in range(3):
        store.registrar_disparo_consulta(T, c1["id"], now_iso())
    sug = bundle["sugerencias"].evaluar_tenant(T)[0]
    r = client.post(f"/mo/playbooks/sugerencias/{sug['id']}/reject", headers=HEADERS).json()
    assert r["estado"] == "rechazada"


def test_seed_for_vertical_siembra_contenido_inicial(pb_client):
    """B8 trae contenido seed inicial para los 3 verticales del mercado alfa."""
    client, _bundle = pb_client
    r = client.post("/mo/playbooks/seed_for_vertical", headers=HEADERS,
                    json={"vertical": "maquiladora"}).json()
    assert r["vertical"] == "maquiladora"
    assert len(r["creados"]) >= 2
    assert all(c["tipo_creacion"] == "precargado_vertical" for c in r["creados"])
    assert r["nota"] is None


def test_seed_for_vertical_inexistente_nota_vacia(pb_client):
    client, _bundle = pb_client
    r = client.post("/mo/playbooks/seed_for_vertical", headers=HEADERS,
                    json={"vertical": "vertical_inexistente"}).json()
    assert r["creados"] == []
    assert "B13" in r["nota"]
