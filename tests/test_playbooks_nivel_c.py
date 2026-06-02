"""
Tests Playbooks Nivel C — Sugerencias bajo la compuerta de tres señales (B8 §B3).

Estructural (≥2 consultas misma entidad) + Conductual (≥3 disparos / 30d) +
Permiso (permiso_ia_proactiva). Más: caducidad pedagógica, inteligencia no caduca,
aprendizaje LOCAL del rechazo, y el experto silenciado como techo de autoridad.
"""
from app.playbooks.consultas_guardadas import ConsultasGuardadasService
from app.playbooks.models import (
    InMemoryPlaybookStore,
    TipoSugerencia,
    now_iso,
)
from app.playbooks.perfil import InMemoryPerfilProvider
from app.playbooks.playbooks_core import PlaybooksService
from app.playbooks.sugerencias import SugerenciasService, firma_patron

T = "test-org"
U = "u1"


def _setup(permiso=False, silenciar=False, entidades=("e1",), n_consultas=2):
    store = InMemoryPlaybookStore()
    consultas = ConsultasGuardadasService(store)
    perfil = InMemoryPerfilProvider()
    perfil.set_perfil(T, U, permiso_ia_proactiva=permiso, silenciar_sugerencias=silenciar)
    svc = SugerenciasService(store, perfil)
    creadas: dict[str, list[dict]] = {}
    for eid in entidades:
        creadas[eid] = [
            consultas.guardar(T, U, f"{eid}-c{i}", f"q {eid} {i}", "INFORMATIVA",
                              entidad_referenciada_id=eid)
            for i in range(n_consultas)
        ]
    return store, consultas, perfil, svc, creadas


def _disparar(store, consulta_id, veces):
    for _ in range(veces):
        store.registrar_disparo_consulta(T, consulta_id, now_iso())


def test_solo_estructural_no_genera():
    """≥2 consultas misma entidad, sin conductual ni permiso → NO genera."""
    _store, _c, _p, svc, _creadas = _setup(permiso=False)
    assert svc.evaluar_tenant(T) == []


def test_estructural_y_conductual_sin_permiso_no_genera():
    store, _c, _p, svc, creadas = _setup(permiso=False)
    _disparar(store, creadas["e1"][0]["id"], 4)
    assert svc.evaluar_tenant(T) == []


def test_las_tres_senales_generan_pedagogica():
    store, _c, _p, svc, creadas = _setup(permiso=True)
    _disparar(store, creadas["e1"][0]["id"], 3)
    generadas = svc.evaluar_tenant(T)
    assert len(generadas) == 1
    assert generadas[0]["tipo_sugerencia"] == TipoSugerencia.pedagogica.value
    assert generadas[0]["evidencia_conductual"]["disparos_ventana"] >= 3


def test_idempotente_no_duplica_pendiente():
    store, _c, _p, svc, creadas = _setup(permiso=True)
    _disparar(store, creadas["e1"][0]["id"], 3)
    svc.evaluar_tenant(T)
    assert svc.evaluar_tenant(T) == []  # ya hay una pendiente con esa firma


def test_caducidad_pedagogica_con_playbook_formal_pasa_a_inteligencia():
    store, _c, _p, svc, creadas = _setup(permiso=True)
    _disparar(store, creadas["e1"][0]["id"], 3)
    # El usuario crea un Playbook formal → caduca lo pedagógico.
    PlaybooksService(store).crear(
        T, U, "mi playbook", pasos=[{"consulta_guardada_id": creadas["e1"][0]["id"]}]
    )
    generadas = svc.evaluar_tenant(T)
    assert len(generadas) == 1
    assert generadas[0]["tipo_sugerencia"] == TipoSugerencia.inteligencia.value


def test_caducar_pedagogicas_marca_pendientes():
    store, _c, _p, svc, creadas = _setup(permiso=True)
    _disparar(store, creadas["e1"][0]["id"], 3)
    svc.evaluar_tenant(T)  # crea pedagógica pendiente
    PlaybooksService(store).crear(
        T, U, "pb", pasos=[{"consulta_guardada_id": creadas["e1"][0]["id"]}]
    )
    caducadas = svc.caducar_pedagogicas(T, U)
    assert caducadas == 1
    assert svc.listar_pendientes(T, U) == []


def test_inteligencia_no_caduca_con_muchos_playbooks():
    store, _c, _p, svc, creadas = _setup(permiso=True)
    _disparar(store, creadas["e1"][0]["id"], 3)
    pbs = PlaybooksService(store)
    for i in range(3):
        pbs.crear(T, U, f"pb{i}", pasos=[{"consulta_guardada_id": creadas["e1"][0]["id"]}])
    generadas = svc.evaluar_tenant(T)
    assert len(generadas) == 1
    assert generadas[0]["tipo_sugerencia"] == TipoSugerencia.inteligencia.value


def test_rechazo_local_sube_liston_solo_de_ese_patron():
    store, _c, _p, svc, creadas = _setup(permiso=True, entidades=("e1", "e2"))
    _disparar(store, creadas["e1"][0]["id"], 3)
    _disparar(store, creadas["e2"][0]["id"], 3)
    generadas = svc.evaluar_tenant(T)
    assert len(generadas) == 2

    # Rechaza la de e1.
    sug_e1 = next(g for g in generadas
                  if g["evidencia_estructural"]["entidad_id"] == "e1")
    svc.rechazar(T, sug_e1["id"])

    firma_e1 = firma_patron(U, "e1", sorted(c["id"] for c in creadas["e1"]))
    firma_e2 = firma_patron(U, "e2", sorted(c["id"] for c in creadas["e2"]))
    assert store.conteo_rechazos(T, U, firma_e1) == 1
    assert store.conteo_rechazos(T, U, firma_e2) == 0

    # Re-evaluar: e1 NO se regenera (listón subido a 5 > 3 disparos); e2 sigue
    # pendiente (intacta). El rechazo es LOCAL al patrón rechazado.
    svc.evaluar_tenant(T)
    pendientes = svc.listar_pendientes(T, U)
    entidades_pendientes = {p["evidencia_estructural"]["entidad_id"] for p in pendientes}
    assert entidades_pendientes == {"e2"}


def test_experto_silenciado_sin_pedagogica_y_liston_alto_inteligencia():
    store, _c, _p, svc, creadas = _setup(permiso=True, silenciar=True)
    # Con 3 disparos, el listón de inteligencia silenciada (5) no se alcanza.
    _disparar(store, creadas["e1"][0]["id"], 3)
    assert svc.evaluar_tenant(T) == []
    # Con 5 disparos sí se alcanza, y es de inteligencia (nunca pedagógica).
    _disparar(store, creadas["e1"][0]["id"], 2)
    generadas = svc.evaluar_tenant(T)
    assert len(generadas) == 1
    assert generadas[0]["tipo_sugerencia"] == TipoSugerencia.inteligencia.value


def test_aceptar_sugerencia_crea_playbook():
    store, _c, _p, svc, creadas = _setup(permiso=True)
    _disparar(store, creadas["e1"][0]["id"], 3)
    sug = svc.evaluar_tenant(T)[0]
    res = svc.aceptar(T, sug["id"], U, nombre="Mi recorrido")
    assert res["playbook"]["tipo_creacion"] == "sugerencia_edb_aceptada"
    assert len(res["playbook"]["pasos"]) == 2
    assert svc.store.obtener_sugerencia(T, sug["id"])["estado"] == "aceptada"
