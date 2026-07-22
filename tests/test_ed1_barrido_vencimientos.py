"""
ED-1 §4.2 — `evaluate_vencimientos` real (barrido) + §2.3 ReglaAlerta.

Contra FalkorDB REAL: crea alertas al cruzar threshold; idempotencia (segunda
corrida = 0 duplicados / 0 renotificaciones); respeta la `ReglaAlerta` por tenant.
"""
from __future__ import annotations

import os
from datetime import date

import pytest

from app.alerts import reglas as _reglas
from app.alerts.barrido import evaluar_vencimientos_tenant
from app.eventos_dirigidos.directorio import Destinatario, InMemoryDirectorioStore
from app.eventos_dirigidos.notificaciones_inapp import InMemoryNotificacionInAppStore
from app.eventos_dirigidos.notificador import Notificador

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"


@pytest.fixture()
def client():
    from app.graph.dkg_client import DKGClient

    c = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
    try:
        ok = c.health()
    except Exception:  # noqa: BLE001
        ok = False
    if not ok:
        pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    for t in ("ed1_barrido", "ed1_barrido_a", "ed1_barrido_b", "ed1_reglas"):
        c.drop_tenant_graph(t)
    yield c
    for t in ("ed1_barrido", "ed1_barrido_a", "ed1_barrido_b", "ed1_reglas"):
        c.drop_tenant_graph(t)


def _notificador():
    dir_store = InMemoryDirectorioStore()
    dir_store.crear(Destinatario(
        org_id="*", tipo="colaborador", nombre="Ana", email="ana@x.mx",
        usuario_id="u-ana", id="dest-ana",
    ))
    # El store InMemory scope-a por org_id; sembramos para cada tenant usado.
    inapp = InMemoryNotificacionInAppStore()
    from app.eventos_dirigidos.directorio import InMemoryUsuarioResolver
    resolver = InMemoryUsuarioResolver()
    notif = Notificador(directorio_store=dir_store, inapp_store=inapp, email_sender=None,
                        usuario_resolver=resolver, sleep=lambda s: None)
    return notif, dir_store, inapp


def _sembrar_destinatario(dir_store, tenant):
    dir_store.crear(Destinatario(
        org_id=tenant, tipo="colaborador", nombre="Ana", email="ana@x.mx",
        usuario_id="u-ana", id=f"dest-{tenant}",
    ))
    return f"dest-{tenant}"


# ── ReglaAlerta persistida (§2.3.1) ──────────────────────────────────────────
def test_regla_se_persiste_y_relee(client):
    t = "ed1_reglas"
    assert _reglas.sembrar_reglas_default(client, t) is True
    # Idempotente: no re-siembra.
    assert _reglas.sembrar_reglas_default(client, t) is False

    regla = _reglas.regla_aplicable(client, t, "*")
    assert regla.thresholds == _reglas.DEFAULT_THRESHOLDS

    regla.thresholds = [45, 20]
    regla.destinatarios = ["dest-x"]
    regla.canales = ["email", "in_app"]
    _reglas.guardar_regla(client, regla)

    releida = _reglas.regla_aplicable(client, t, "*")
    assert sorted(releida.thresholds) == [20, 45]
    assert releida.destinatarios == ["dest-x"]
    assert set(releida.canales) == {"email", "in_app"}


# ── evaluate_vencimientos crea alertas + idempotencia (§4.2) ─────────────────
def test_crea_alerta_al_cruzar_threshold_y_es_idempotente(client):
    t = "ed1_barrido"
    notif, dir_store, inapp = _notificador()
    did = _sembrar_destinatario(dir_store, t)
    regla = _reglas.ReglaAlerta(tenant_id=t, thresholds=[30, 15, 7],
                                destinatarios=[did], canales=["in_app"])
    _reglas.guardar_regla(client, regla)

    # Certificado que vence en 20 días → cruza la banda de 30.
    client._graph(t).query(
        "CREATE (c:CertificadoVigencia {id:'c1', nombre:'Calibración balanza', "
        "fecha_vencimiento:'2026-06-28'})"
    )
    hoy = date(2026, 6, 8)  # dias = 20

    c1 = evaluar_vencimientos_tenant(client, t, hoy=hoy, notificador=notif)
    assert c1["creadas"] == 1
    assert c1["notificadas"] == 1
    # Alerta persistida con estado notificado.
    rows = client.query(t, "MATCH (a:Alerta) RETURN a.estado AS estado, a.origen AS origen", {})
    assert len(rows) == 1
    assert rows[0]["estado"] == "notificado"
    assert rows[0]["origen"] == "scheduler"
    inapp_1 = len(inapp.listar(t, "u-ana"))
    assert inapp_1 == 1

    # Segunda corrida: 0 duplicados, 0 renotificaciones.
    c2 = evaluar_vencimientos_tenant(client, t, hoy=hoy, notificador=notif)
    assert c2["creadas"] == 0
    assert c2["notificadas"] == 0
    rows2 = client.query(t, "MATCH (a:Alerta) RETURN count(a) AS c", {})
    assert rows2[0]["c"] == 1  # sin duplicado
    assert len(inapp.listar(t, "u-ana")) == inapp_1  # sin renotificar


def test_respeta_thresholds_por_tenant(client):
    notif, dir_store, inapp = _notificador()
    hoy = date(2026, 6, 8)  # dias = 20 para 2026-06-28

    # Tenant A: threshold 30 → 20 días cruza → notifica.
    ta = "ed1_barrido_a"
    da = _sembrar_destinatario(dir_store, ta)
    _reglas.guardar_regla(client, _reglas.ReglaAlerta(tenant_id=ta, thresholds=[30], destinatarios=[da], canales=["in_app"]))
    client._graph(ta).query("CREATE (c:CertificadoVigencia {id:'c1', nombre:'X', fecha_vencimiento:'2026-06-28'})")
    ca = evaluar_vencimientos_tenant(client, ta, hoy=hoy, notificador=notif)
    assert ca["notificadas"] == 1

    # Tenant B: threshold 7 → 20 días NO cruza → alerta creada pero 0 notificaciones.
    tb = "ed1_barrido_b"
    db = _sembrar_destinatario(dir_store, tb)
    _reglas.guardar_regla(client, _reglas.ReglaAlerta(tenant_id=tb, thresholds=[7], destinatarios=[db], canales=["in_app"]))
    client._graph(tb).query("CREATE (c:CertificadoVigencia {id:'c1', nombre:'X', fecha_vencimiento:'2026-06-28'})")
    cb = evaluar_vencimientos_tenant(client, tb, hoy=hoy, notificador=notif)
    assert cb["notificadas"] == 0
    # La alerta SÍ existe (nodo creado dentro del horizonte), solo no se notificó.
    assert client.query(tb, "MATCH (a:Alerta) RETURN count(a) AS c", {})[0]["c"] == 1
