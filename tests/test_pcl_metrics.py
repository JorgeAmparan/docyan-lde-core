"""
Tests de la instrumentación PCL — agregado diario + lectura para el endpoint
admin (B8.5 §1.4, doc §7).

DOCYAN LDE™ by XCID.
"""
from datetime import datetime, timezone

from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.pcl.pcl_metrics import (
    EVENTO_CONSULTA,
    InMemoryPCLMetricsStore,
    PCLMetrics,
    _percentil,
)
from app.playbooks.models import InMemoryPlaybookStore, now_iso

TENANT = "t1"
HOY = datetime.now(timezone.utc).date()


def _fat_con_eventos():
    fat = FATExtendido(InMemoryFATStore())

    def ev(modo, costo, lat, ent=None):
        fat.registrar(
            tipo_evento=EVENTO_CONSULTA, familia=FamiliaFAT.F4_CONSULTA, tenant_id=TENANT,
            payload={"modo_respuesta": modo, "costo_estimado_centavos": costo,
                     "latencia_ms": lat, "entidad_id": ent},
        )

    ev("cache_hit", 0.0, 10, "e1")
    ev("cache_hit", 0.0, 12, "e1")
    ev("retrieval_first", 0.0, 30, "e1")
    ev("synthesis_first", 0.04, 80, "e2")
    ev("synthesis_first", 0.06, 120, "e2")
    return fat


def test_agregar_diario_cuenta_modos_costos_y_percentiles():
    fat = _fat_con_eventos()
    metrics = PCLMetrics(store=InMemoryPCLMetricsStore(), fat=fat)
    fila = metrics.agregar_diario(TENANT, HOY)

    assert fila["consultas_totales"] == 5
    assert fila["consultas_cache_hit"] == 2
    assert fila["consultas_retrieval_first"] == 1
    assert fila["consultas_synthesis_first"] == 2
    assert abs(fila["costo_total_centavos"] - 0.10) < 1e-6
    assert fila["costo_promedio_por_consulta"] == round(0.10 / 5, 4)
    # Costo por consulta ÚNICA (no cacheada): solo retrieval+synthesis.
    assert fila["costo_promedio_por_consulta_unica"] == round((0.0 + 0.04 + 0.06) / 3, 4)
    assert fila["latencia_p50_ms"] > 0
    assert fila["latencia_p95_ms"] >= fila["latencia_p50_ms"]
    # top patrones: e1 (3 consultas) por encima de e2 (2).
    top = fila["top_patrones_detectados"]
    assert top[0]["entidad_id"] == "e1" and top[0]["consultas"] == 3


def test_agregar_diario_dia_sin_eventos_es_cero():
    metrics = PCLMetrics(store=InMemoryPCLMetricsStore(), fat=FATExtendido(InMemoryFATStore()))
    fila = metrics.agregar_diario(TENANT, HOY)
    assert fila["consultas_totales"] == 0
    assert fila["costo_total_centavos"] == 0.0


def test_metricas_lee_ventana_y_calcula_totales():
    fat = _fat_con_eventos()
    metrics = PCLMetrics(store=InMemoryPCLMetricsStore(), fat=fat)
    metrics.agregar_diario(TENANT, HOY)

    res = metrics.metricas(TENANT, (HOY, HOY))
    assert res.tenant_id == TENANT
    assert len(res.dias) == 1
    assert res.totales.consultas_totales == 5
    assert res.totales.cache_hit_ratio == round(2 / 5, 4)
    assert res.totales.retrieval_first_ratio == round(1 / 5, 4)
    assert res.totales.synthesis_first_ratio == round(2 / 5, 4)


def test_agregar_diario_cuenta_sugerencias_del_store():
    fat = FATExtendido(InMemoryFATStore())
    metrics = PCLMetrics(store=InMemoryPCLMetricsStore(), fat=fat)
    store = InMemoryPlaybookStore()
    # Una consulta para que el usuario aparezca en usuarios_con_consultas.
    store.crear_consulta({"tenant_id": TENANT, "user_id": "u1", "nombre": "n",
                          "consulta_original": "q", "tipo_intencion": "INFORMATIVA",
                          "entidad_referenciada_id": "e1"})
    store.crear_sugerencia({"tenant_id": TENANT, "user_id": "u1",
                            "tipo_sugerencia": "inteligencia", "consulta_guardada_ids": []})
    # Una aceptada hoy.
    s2 = store.crear_sugerencia({"tenant_id": TENANT, "user_id": "u1",
                                 "tipo_sugerencia": "pedagogica", "consulta_guardada_ids": []})
    store.actualizar_sugerencia(TENANT, s2["id"],
                                {"estado": "aceptada", "decidido_at": now_iso()})

    fila = metrics.agregar_diario(TENANT, HOY, sugerencias_store=store)
    assert fila["sugerencias_emitidas"] == 2
    assert fila["sugerencias_aceptadas"] == 1


def test_percentil():
    assert _percentil([], 0.5) == 0
    assert _percentil([100], 0.95) == 100
    assert _percentil([10, 20, 30, 40], 0.5) == 25
