"""
ED-1 §4.5 — Directorio de Destinatarios.

CRUD con scope de tenant; el ruteo resuelve SOLO por `destinatario_id`, nunca por
un email libre (guardrail §2.5); resolución expande departamentos a miembros.
"""
from __future__ import annotations

import pytest

from app.eventos_dirigidos.directorio import (
    Destinatario,
    DirectorioError,
    InMemoryDirectorioStore,
    InMemoryUsuarioResolver,
    resolver_destinos,
)

T1 = "org-1"
T2 = "org-2"


def _store():
    return InMemoryDirectorioStore()


def test_crud_y_scope_de_tenant():
    store = _store()
    d1 = store.crear(Destinatario(org_id=T1, tipo="proveedor_externo", nombre="Prov A", email="a@prov.mx"))
    store.crear(Destinatario(org_id=T2, tipo="proveedor_externo", nombre="Prov B", email="b@prov.mx"))

    # Listado aislado por tenant.
    assert [d.nombre for d in store.listar(T1)] == ["Prov A"]
    assert [d.nombre for d in store.listar(T2)] == ["Prov B"]

    # Un tenant no ve/edita/borra el destinatario de otro.
    assert store.obtener(T2, d1.id) is None
    assert store.actualizar(T2, d1.id, {"nombre": "hack"}) is None
    assert store.borrar(T2, d1.id) is False

    # Update + delete dentro del tenant correcto.
    upd = store.actualizar(T1, d1.id, {"nombre": "Prov A2"})
    assert upd is not None and upd.nombre == "Prov A2"
    assert store.borrar(T1, d1.id) is True
    assert store.obtener(T1, d1.id) is None


def test_validacion_tipo_email():
    store = _store()
    with pytest.raises(DirectorioError):
        store.crear(Destinatario(org_id=T1, tipo="proveedor_externo", nombre="X", email=None))
    with pytest.raises(DirectorioError):
        store.crear(Destinatario(org_id=T1, tipo="colaborador", nombre="X"))  # sin usuario_id
    with pytest.raises(DirectorioError):
        store.crear(Destinatario(org_id=T1, tipo="tipo_invalido", nombre="X"))


def test_resolucion_solo_por_id_no_email_libre():
    store = _store()
    prov = store.crear(Destinatario(org_id=T1, tipo="proveedor_externo", nombre="Prov", email="prov@x.mx"))

    # Resolver un id existente → un destino con ese email.
    destinos = resolver_destinos(store, T1, [prov.id])
    assert len(destinos) == 1 and destinos[0].email == "prov@x.mx"

    # Un "email libre" pasado como si fuera id NO resuelve a nada (no hay email
    # fuera del directorio).
    assert resolver_destinos(store, T1, ["correo-arbitrario@evil.mx"]) == []
    # Un id de otro tenant tampoco resuelve (aislamiento).
    assert resolver_destinos(store, T2, [prov.id]) == []


def test_departamento_se_expande_a_miembros():
    store = _store()
    dep = store.crear(Destinatario(
        org_id=T1, tipo="departamento_interno", nombre="Calidad",
        miembros=["u1", "u2"],
    ))
    resolver = InMemoryUsuarioResolver({
        (T1, "u1"): ("u1@lab.mx", "es"),
        (T1, "u2"): ("u2@lab.mx", "en"),
    })
    destinos = resolver_destinos(store, T1, [dep.id], usuario_resolver=resolver)
    assert len(destinos) == 2
    assert {d.email for d in destinos} == {"u1@lab.mx", "u2@lab.mx"}
    assert {d.usuario_id for d in destinos} == {"u1", "u2"}


def test_inactivo_no_resuelve():
    store = _store()
    prov = store.crear(Destinatario(org_id=T1, tipo="proveedor_externo", nombre="P", email="p@x.mx", activo=False))
    assert resolver_destinos(store, T1, [prov.id]) == []
