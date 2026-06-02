"""
Tests del GRG extendido — familias ACTIVAS en runtime MVP (B7, doc 07).

F2 umbrales por criticidad, F3 freno de alucinación, F7 consulta operativa,
F8 canal. + ConfiguracionGRG por tenant (cache 15 min).
"""
import pytest

from app.governance.configuracion import (
    ConfiguracionGRG,
    ConfiguracionGRGService,
    InMemoryConfiguracionStore,
)
from app.governance.familias_grg import (
    UMBRALES_CRITICIDAD,
    AccionGRG,
    Criticidad,
    Tier,
)
from app.governance.grg_extendido import GRGExtendido

# ── F2 — umbrales por criticidad (R-UC-01..05) ────────────────────────────────


@pytest.mark.parametrize("criticidad", list(Criticidad))
def test_f2_en_el_umbral_sirve(criticidad):
    grg = GRGExtendido()
    umbral = UMBRALES_CRITICIDAD[criticidad]
    res = grg.f2_evaluar_umbral(criticidad, umbral)
    assert res.aprobada
    assert res.accion == AccionGRG.SERVIR


@pytest.mark.parametrize("criticidad", list(Criticidad))
def test_f2_bajo_umbral_accion_por_criticidad(criticidad):
    grg = GRGExtendido()
    umbral = UMBRALES_CRITICIDAD[criticidad]
    res = grg.f2_evaluar_umbral(criticidad, umbral - 0.01)
    if criticidad in (Criticidad.SEGURIDAD, Criticidad.REGULATORIO):
        # Criticidad alta → no sirve directo, escala a revisor + disclaimer.
        assert not res.aprobada
        assert res.accion == AccionGRG.ESCALAR_REVISOR
        assert res.escalar_a_revisor
        assert res.disclaimer
    else:
        # Resto → sirve con flag + disclaimer.
        assert res.aprobada
        assert res.accion == AccionGRG.FLAG_DISCLAIMER
        assert res.disclaimer


def test_f2_seguridad_tier1_confianza_baja_flag_disclaimer_y_fat():
    grg = GRGExtendido(tier=Tier.ENTERPRISE)
    res = grg.f2_evaluar_umbral(Criticidad.SEGURIDAD, 0.80)
    assert not res.aprobada
    assert res.escalar_a_revisor
    # Payload listo para FAT (familia F7 gobernanza).
    payload = res.to_fat_payload()
    assert payload["familia"] == "F2"
    assert payload["accion"] == "escalar_revisor"


# ── F3 — freno de alucinación ─────────────────────────────────────────────────


def test_f3_cifra_fabricada_bloquea():
    grg = GRGExtendido()
    fuente = "El límite es de 250 mg por kilogramo."
    output = "El límite es de 999 mg por kilogramo."  # 999 no está en la fuente
    res = grg.f3_freno_alucinacion(output, fuente)
    assert not res.aprobada
    assert res.accion == AccionGRG.BLOQUEAR
    assert "999" in res.detalle["numerica"]


def test_f3_norma_fabricada_bloquea():
    grg = GRGExtendido()
    fuente = "Conforme a la NOM-052-SEMARNAT-2005."
    output = "Conforme a la NOM-052-SEMARNAT-2005 y a la ISO 99999."  # ISO inventada
    res = grg.f3_freno_alucinacion(output, fuente)
    assert not res.aprobada
    assert any("ISO" in n.upper() for n in res.detalle["normativa"])


def test_f3_identificador_fabricado_bloquea():
    grg = GRGExtendido()
    fuente = "Lote LOTE-4471 aprobado."
    output = "Lote LOTE-4471 y certificado CERT-8899 aprobados."  # CERT inventado
    res = grg.f3_freno_alucinacion(output, fuente)
    assert not res.aprobada
    assert "CERT-8899" in res.detalle["identificadores"]


def test_f3_sin_fabricacion_sirve():
    grg = GRGExtendido()
    fuente = "El límite es 250 mg conforme a la NOM-052."
    output = "Según la NOM-052, el límite es 250 mg."
    res = grg.f3_freno_alucinacion(output, fuente)
    assert res.aprobada
    assert res.accion == AccionGRG.SERVIR


# ── F7 — consulta operativa (3 reglas) ────────────────────────────────────────


def test_f7_conforme_sirve():
    grg = GRGExtendido()
    fuente = "Use guantes y verifique la presión a 250 kPa."
    respuesta = "1. Use guantes.\n2. Verifique la presión a 250 kPa."
    res = grg.f7_consulta_operativa(respuesta, fuente=fuente, tiene_pedigree=True)
    assert res.aprobada


def test_f7_sin_pedigree_falla():
    grg = GRGExtendido()
    fuente = "Use guantes."
    res = grg.f7_consulta_operativa(
        "1. Use guantes.", fuente=fuente, tiene_pedigree=False
    )
    assert not res.aprobada
    assert any("R-CO-03" in f for f in res.detalle["fallos"])


def test_f7_sin_pasos_accionables_falla():
    grg = GRGExtendido()
    fuente = "Información general sobre el proceso."
    res = grg.f7_consulta_operativa(
        "El proceso es complejo.", fuente=fuente, tiene_pedigree=True
    )
    assert not res.aprobada
    assert any("R-CO-01" in f for f in res.detalle["fallos"])


def test_f7_con_fabricacion_falla_por_r_co_02():
    grg = GRGExtendido()
    fuente = "Use guantes."
    respuesta = "1. Use guantes a 999 grados."  # 999 fabricado
    res = grg.f7_consulta_operativa(respuesta, fuente=fuente, tiene_pedigree=True)
    assert not res.aprobada
    assert any("R-CO-02" in f for f in res.detalle["fallos"])


# ── F8 — canal PWA vs WhatsApp ────────────────────────────────────────────────


def test_f8_segmento_critico_sin_disclaimer_en_whatsapp_falla():
    grg = GRGExtendido()
    res = grg.f8_canal(Criticidad.SEGURIDAD, "whatsapp", disclaimer_presente=False)
    assert not res.aprobada
    assert res.disclaimer


def test_f8_segmento_critico_con_disclaimer_igual_en_pwa_y_whatsapp():
    grg = GRGExtendido()
    pwa = grg.f8_canal(Criticidad.SEGURIDAD, "pwa", disclaimer_presente=True)
    wa = grg.f8_canal(Criticidad.SEGURIDAD, "whatsapp", disclaimer_presente=True)
    assert pwa.aprobada and wa.aprobada


def test_f8_segmento_informativo_no_exige_disclaimer():
    grg = GRGExtendido()
    res = grg.f8_canal(Criticidad.INFORMATIVA, "whatsapp", disclaimer_presente=False)
    assert res.aprobada


# ── ConfiguracionGRG por tenant ───────────────────────────────────────────────


def test_config_umbrales_ajustables_por_tenant():
    store = InMemoryConfiguracionStore()
    store.upsert(
        ConfiguracionGRG(
            tenant_id="t1", tier=Tier.ENTERPRISE,
            umbrales_f2={Criticidad.OPERACIONAL: 0.90},
        )
    )
    svc = ConfiguracionGRGService(store)
    grg = svc.build_grg("t1")
    assert grg.tier == Tier.ENTERPRISE
    # El umbral operacional fue subido de 0.75 a 0.90.
    assert grg.umbral_de(Criticidad.OPERACIONAL) == 0.90
    # Confianza 0.80 ahora queda BAJO el umbral del tenant.
    res = grg.f2_evaluar_umbral(Criticidad.OPERACIONAL, 0.80)
    assert res.accion == AccionGRG.FLAG_DISCLAIMER


def test_config_tenant_default_sin_registro():
    svc = ConfiguracionGRGService(InMemoryConfiguracionStore())
    config = svc.get_config("nuevo")
    assert config.tier == Tier.BASE
    assert config.umbrales_efectivos() == UMBRALES_CRITICIDAD


def test_config_cachea_15min_y_se_invalida():
    store = InMemoryConfiguracionStore()
    store.upsert(ConfiguracionGRG(tenant_id="t1", tier=Tier.BASE))
    svc = ConfiguracionGRGService(store)
    assert svc.get_config("t1").tier == Tier.BASE
    # Cambia el store directamente: el cache sigue sirviendo el valor viejo.
    store.upsert(ConfiguracionGRG(tenant_id="t1", tier=Tier.ENTERPRISE))
    assert svc.get_config("t1").tier == Tier.BASE
    # Tras invalidar, lee el nuevo.
    svc.invalidar("t1")
    assert svc.get_config("t1").tier == Tier.ENTERPRISE
