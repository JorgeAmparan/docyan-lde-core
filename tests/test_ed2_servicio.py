"""
ED-2 §2.2/§2.5/§2.7 — Servicio de solicitudes (crear + transicionar).

Tests del contrato:
- 1 Guardrail: destinatario de otro tenant / inexistente → rechazo (no email libre).
- 3 Provenance heredado: la solicitud contiene documento_id + span + fragmento.
- 4 Ciclo de vida: transiciones válidas/ inválidas + FAT (reusa la máquina ED-1).
- 7 Promoción: 3 etiquetas libres iguales → propuesta registrada.
- 8 Demanda: campos de ciclo persistidos.
"""

from __future__ import annotations

import pytest

from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.eventos_dirigidos import ciclo_vida
from app.eventos_dirigidos.directorio import Destinatario, InMemoryDirectorioStore
from app.eventos_dirigidos.notificaciones_inapp import InMemoryNotificacionInAppStore
from app.eventos_dirigidos.notificador import Notificador
from app.notifications.email import CapturingEmailSender
from app.solicitudes import servicio
from app.solicitudes.modelo import InMemorySolicitudStore
from app.solicitudes.tipos import InMemoryTipoSolicitudStore, TipoSolicitud, asegurar_semilla

TENANT = "org-A"
OTRO = "org-B"


class StubDKG:
    """Cliente de grafo no-op: registra las queries pero no toca FalkorDB."""

    def __init__(self):
        self.calls = []

    def query(self, tenant, cypher, params=None):
        self.calls.append((tenant, cypher, params))
        return []


def _entorno():
    directorio = InMemoryDirectorioStore()
    tipo_store = InMemoryTipoSolicitudStore()
    asegurar_semilla(tipo_store, TENANT)
    sol_store = InMemorySolicitudStore()
    fat = FATExtendido(InMemoryFATStore())
    notif = Notificador(
        directorio_store=directorio,
        inapp_store=InMemoryNotificacionInAppStore(),
        email_sender=CapturingEmailSender(),
        fat=fat,
        sleep=lambda s: None,
    )
    return directorio, tipo_store, sol_store, fat, notif


def _crear(directorio, tipo_store, sol_store, fat, notif, dkg, **over):
    kw = dict(
        tenant_id=TENANT,
        destinatario_id=over.pop("destinatario_id", None),
        tipo_id=over.pop("tipo_id", None),
        etiqueta_libre=over.pop("etiqueta_libre", None),
        mensaje=over.pop("mensaje", "Necesito cotización."),
        campos_tipados=over.pop("campos_tipados", {"cantidad": 5}),
        provenance=over.pop("provenance", None),
        consulta_id=over.pop("consulta_id", "consulta-xyz"),
        solicitante_id="user-1",
        solicitante_nombre="Jorge",
        solicitante_email="j@x.mx",
        entidad_id="MAXI-10ND",
        codo_id="codo-1",
        directorio_store=directorio,
        tipo_store=tipo_store,
        solicitud_store=sol_store,
        dkg=dkg,
        notificador=notif,
        fat=fat,
    )
    kw.update(over)
    return servicio.crear_solicitud(**kw)


# ── Test 1 — Guardrail ────────────────────────────────────────────────────────
def test_guardrail_destinatario_de_otro_tenant_rechazado():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    # El destinatario existe, pero en OTRO tenant.
    ajeno = directorio.crear(
        Destinatario(
            org_id=OTRO,
            tipo="proveedor_externo",
            nombre="Prov B",
            email="b@x.mx",
        )
    )
    cot = tipo_store.obtener_por_clave(TENANT, "cotizacion")
    with pytest.raises(servicio.DestinatarioInvalido):
        _crear(
            directorio,
            tipo_store,
            sol_store,
            fat,
            notif,
            StubDKG(),
            destinatario_id=ajeno.id,
            tipo_id=cot.id,
        )


def test_guardrail_destinatario_inexistente_rechazado():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    cot = tipo_store.obtener_por_clave(TENANT, "cotizacion")
    with pytest.raises(servicio.DestinatarioInvalido):
        _crear(
            directorio,
            tipo_store,
            sol_store,
            fat,
            notif,
            StubDKG(),
            destinatario_id="no-existe",
            tipo_id=cot.id,
        )


# ── Test 3 — Provenance heredado ──────────────────────────────────────────────
def test_provenance_heredado_en_la_solicitud():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="Refax",
            email="v@refax.mx",
        )
    )
    cot = tipo_store.obtener_por_clave(TENANT, "cotizacion")
    provenance = {
        "documento_id": "doc-partes-777",
        "documento_nombre": "Lista de partes MAXI-10ND",
        "span_inicio": 120,
        "span_fin": 168,
        "fragmento": "Acople motor-eje, número de parte MX-4471.",
        "dato_origen_nodo_id": "espec-9",
    }
    s = _crear(
        directorio,
        tipo_store,
        sol_store,
        fat,
        notif,
        StubDKG(),
        destinatario_id=prov.id,
        tipo_id=cot.id,
        provenance=provenance,
        consulta_id="consulta-abc",
    )

    assert s.documento_id == "doc-partes-777"
    assert (s.span_inicio, s.span_fin) == (120, 168)
    assert s.fragmento == "Acople motor-eje, número de parte MX-4471."
    assert s.consulta_id == "consulta-abc"
    # Persistida y releíble.
    releida = sol_store.obtener(TENANT, s.id)
    assert releida.fragmento == provenance["fragmento"]


# ── Test 4 — Ciclo de vida + FAT ──────────────────────────────────────────────
def test_ciclo_de_vida_transiciones_y_fat():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    colab = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="colaborador",
            nombre="Compras",
            usuario_id="user-9",
            email="compras@x.mx",
        )
    )
    cot = tipo_store.obtener_por_clave(TENANT, "cotizacion")
    dkg = StubDKG()
    s = _crear(
        directorio, tipo_store, sol_store, fat, notif, dkg, destinatario_id=colab.id, tipo_id=cot.id
    )

    # Sin usuario_resolver el colaborador no expande in-app, pero email sí → notificado.
    assert s.estado in (ciclo_vida.CREADO, ciclo_vida.NOTIFICADO)

    servicio.aplicar_transicion(
        tenant_id=TENANT,
        solicitud_id=s.id,
        accion="iniciar_proceso",
        actor_id="user-9",
        solicitud_store=sol_store,
        dkg=dkg,
        fat=fat,
    )
    assert sol_store.obtener(TENANT, s.id).estado == ciclo_vida.EN_PROCESO

    r = servicio.aplicar_transicion(
        tenant_id=TENANT,
        solicitud_id=s.id,
        accion="resolver",
        actor_id="user-9",
        solicitud_store=sol_store,
        dkg=dkg,
        fat=fat,
    )
    assert r.estado == ciclo_vida.RESUELTO
    assert r.fecha_resolucion is not None  # Test 8: tiempo de ciclo persistido

    # Transición inválida desde terminal → error explícito.
    with pytest.raises(ciclo_vida.TransicionInvalida):
        servicio.aplicar_transicion(
            tenant_id=TENANT,
            solicitud_id=s.id,
            accion="iniciar_proceso",
            actor_id="user-9",
            solicitud_store=sol_store,
            dkg=dkg,
            fat=fat,
        )

    # FAT F10 registró creación + transiciones (evento_tipo="solicitud").
    tipos = [e.tipo_evento for e in fat.eventos(TENANT)]
    assert any("evento_dirigido.solicitud" in t for t in tipos)


def test_accion_desconocida_es_error():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="P",
            email="p@x.mx",
        )
    )
    cot = tipo_store.obtener_por_clave(TENANT, "cotizacion")
    s = _crear(
        directorio,
        tipo_store,
        sol_store,
        fat,
        notif,
        StubDKG(),
        destinatario_id=prov.id,
        tipo_id=cot.id,
    )
    with pytest.raises(ciclo_vida.AccionDesconocida):
        servicio.aplicar_transicion(
            tenant_id=TENANT,
            solicitud_id=s.id,
            accion="teletransportar",
            actor_id="x",
            solicitud_store=sol_store,
        )


# ── Test 7 — Promoción de etiquetas libres ────────────────────────────────────
def test_promocion_tres_etiquetas_iguales_registra_propuesta():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="P",
            email="p@x.mx",
        )
    )
    for _ in range(3):
        _crear(
            directorio,
            tipo_store,
            sol_store,
            fat,
            notif,
            StubDKG(),
            destinatario_id=prov.id,
            etiqueta_libre="Verificación metrológica",
        )

    propuestas = sol_store.propuestas_promocion(TENANT, umbral=3)
    assert any(
        p["etiqueta_libre"] == "verificación metrológica" and p["conteo"] >= 3 for p in propuestas
    )

    # Aceptar = crear el tipo (el sistema propone; el humano decide/actúa).
    nuevo = tipo_store.crear(TipoSolicitud(org_id=TENANT, nombre="Verificación metrológica"))
    assert tipo_store.obtener(TENANT, nuevo.id) is not None


def test_dos_etiquetas_no_llegan_al_umbral():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="P",
            email="p@x.mx",
        )
    )
    for _ in range(2):
        _crear(
            directorio,
            tipo_store,
            sol_store,
            fat,
            notif,
            StubDKG(),
            destinatario_id=prov.id,
            etiqueta_libre="Reabastecimiento",
        )
    assert sol_store.propuestas_promocion(TENANT, umbral=3) == []


# ── Test 8 — Demanda: campos de ciclo persistidos ─────────────────────────────
def test_demanda_campos_persistidos():
    directorio, tipo_store, sol_store, fat, notif = _entorno()
    prov = directorio.crear(
        Destinatario(
            org_id=TENANT,
            tipo="proveedor_externo",
            nombre="P",
            email="p@x.mx",
        )
    )
    cot = tipo_store.obtener_por_clave(TENANT, "cotizacion")
    s = _crear(
        directorio,
        tipo_store,
        sol_store,
        fat,
        notif,
        StubDKG(),
        destinatario_id=prov.id,
        tipo_id=cot.id,
    )
    fila = sol_store.obtener(TENANT, s.id)
    # Tipo, entidad, destinatario, tiempos → base de inteligencia de demanda.
    assert fila.tipo_id == cot.id
    assert fila.entidad_id == "MAXI-10ND"
    assert fila.destinatario_id == prov.id
    assert fila.fecha_creacion is not None
