"""
F1.5 Parte A — Débito real / cobro de setup. Tests backend (testing balanceado).

Cubre el esquema reservar / liquidar / liberar (opción C) sobre `tenant_budget`,
cableado en el gate (confirmar → reserva; worker completa → liquida; falla →
libera), la idempotencia conectada al SHA-256 de F1, la fórmula de setup del
Modelo Comercial §2.3, y el aislamiento multi-tenant del saldo.

El gate del cotizador NO tiene bypass: aquí se mockea el ALMACÉN de presupuesto
(InMemoryBudgetStore) y de cola (InMemoryQueueBackend), nunca la decisión.
"""
import asyncio

import pytest

from app.ingesta import pricing_table as pt
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.jobs.job_models import CotizacionSnapshot, IngestJob, JobStatus

DOC_BYTES = ("Procedimiento de calibración. Paso 1: nivelar. " * 200).encode("utf-8")


# ════════════════════════════════════════════════════════════════════════════
# Unidad — BudgetManager.reservar / liquidar / liberar
# ════════════════════════════════════════════════════════════════════════════

def _bm(saldo: float) -> BudgetManager:
    bm = BudgetManager(store=InMemoryBudgetStore())
    bm.ensure_budget("t", saldo_inicial_usd=saldo)
    return bm


def test_reservar_mueve_disponible_a_retenido():
    bm = _bm(10.0)
    res = bm.reservar("t", 3.0)
    assert res.ok and res.monto_reservado == 3.0
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 7.0 and b.retenido_usd == 3.0


def test_reservar_insuficiente_falla_limpio_no_reserva():
    bm = _bm(2.0)
    res = bm.reservar("t", 5.0)
    assert res.ok is False
    assert res.falta_usd == pytest.approx(3.0)
    b = bm.get_budget("t")  # saldo intacto: no se confirma
    assert b.saldo_actual_usd == 2.0 and b.retenido_usd == 0.0


def test_liquidar_descuenta_real_y_devuelve_sobrante():
    bm = _bm(10.0)
    bm.reservar("t", 3.0)             # disponible 7, retenido 3
    bm.liquidar("t", 3.0, 1.0)        # real 1.0: retenido→0, disponible 7+(3-1)=9
    b = bm.get_budget("t")
    assert b.retenido_usd == 0.0 and b.saldo_actual_usd == 9.0


def test_liquidar_costo_real_igual_a_reserva_consume_todo():
    bm = _bm(10.0)
    bm.reservar("t", 2.0)
    bm.liquidar("t", 2.0, 2.0)        # real == reserva: se gasta completa
    b = bm.get_budget("t")
    assert b.retenido_usd == 0.0 and b.saldo_actual_usd == 8.0


def test_liberar_devuelve_reserva_completa():
    bm = _bm(10.0)
    bm.reservar("t", 3.0)
    bm.liberar("t", 3.0)
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 10.0 and b.retenido_usd == 0.0


def test_debito_multitenant_aislado():
    bm = BudgetManager(store=InMemoryBudgetStore())
    bm.ensure_budget("a", saldo_inicial_usd=10.0)
    bm.ensure_budget("b", saldo_inicial_usd=10.0)
    bm.reservar("a", 4.0)
    bm.liquidar("a", 4.0, 4.0)
    assert bm.get_budget("a").saldo_actual_usd == 6.0
    # El tenant b no fue tocado.
    assert bm.get_budget("b").saldo_actual_usd == 10.0
    assert bm.get_budget("b").retenido_usd == 0.0


# ════════════════════════════════════════════════════════════════════════════
# Fórmula de cobro de setup (Modelo Comercial §2.3)
# ════════════════════════════════════════════════════════════════════════════

def test_formula_documento_chico_gana_piso_25():
    # costo×25 = 0.04*25 = 1.0 < 25 → gana el piso $25.
    assert pt.precio_setup(0.04) == 25.0


def test_formula_documento_caro_gana_costo_por_25():
    # costo 2.0 → 2.0*25 = 50 > 25 → gana costo×25.
    assert pt.precio_setup(2.0) == 50.0


def test_formula_factor_complejidad_escala():
    assert pt.precio_setup(2.0, factor_complejidad=2.0) == 100.0


def test_formula_visible_en_cotizacion_grande():
    """Un documento grande/caro: el setup en la cotización = costo×25 (no el piso)."""
    from app.ingesta.cotizador import estimar_costo

    desglose, _ = estimar_costo(800_000)  # ~$1.3 de cómputo
    costo = desglose.total_usd
    assert costo > 1.0  # garantiza que costo×25 supere el piso
    assert pt.precio_setup(costo) == round(costo * 25, 4)


def test_cotizador_expone_precio_setup():
    from app.ingesta.cotizador import Cotizador

    bm = _bm(100.0)
    cot = Cotizador(budget_manager=bm).cotizar("t", DOC_BYTES.decode())
    d = cot.to_dict()
    assert d["precio_setup_usd"] >= 25.0  # piso para un doc chico
    assert d["factor_complejidad"] == 1.0


# ════════════════════════════════════════════════════════════════════════════
# Integración con el gate — dispatcher (confirmar/completar/fallar)
# ════════════════════════════════════════════════════════════════════════════

def _wire(saldo: float, tenant: str = "t"):
    bm = BudgetManager(store=InMemoryBudgetStore())
    bm.ensure_budget(tenant, saldo_inicial_usd=saldo)
    backend = InMemoryQueueBackend()
    disp = JobDispatcher(backend=backend, budget_manager=bm)
    return disp, bm, backend


def _job(job_id="j1", tenant="t", costo=2.0, sha=None, ref="r"):
    return IngestJob(
        job_id=job_id, tenant_id=tenant, documento_ref=ref, nombre_archivo="d.pdf",
        content_sha256=sha,
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=costo, tiempo_estimado_seg=10, tokens_documento=100,
            aprobado=True, decision="aprobado_requiere_confirmacion",
        ),
    )


def test_confirmar_reserva_el_monto_cotizado():
    disp, bm, backend = _wire(10.0)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 8.0 and b.retenido_usd == 2.0  # disponible↓ retenido↑
    job = backend.load_job("j1")
    assert job.reserva_estado == "retenido" and job.reserva_usd == 2.0
    assert backend.queue_length() == 1


def test_completar_liquida_a_costo_real_devuelve_sobrante():
    disp, bm, _ = _wire(10.0)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")               # disponible 8, retenido 2
    disp.marcar_procesando("j1")
    disp.marcar_completado("j1", {"document_id": "x"}, costo_real_usd=0.5)
    b = bm.get_budget("t")
    assert b.retenido_usd == 0.0 and b.saldo_actual_usd == 9.5  # 8 + (2 - 0.5)
    job = disp.backend.load_job("j1")
    assert job.reserva_estado == "liquidado" and job.costo_real_usd == 0.5


def test_completar_sin_costo_real_usa_cotizado_como_aproximacion():
    disp, bm, _ = _wire(10.0)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")
    disp.marcar_completado("j1", {"document_id": "x"})  # sin costo real → cotizado
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 8.0 and b.retenido_usd == 0.0  # cobra 2.0 (cotizado)


def test_fallar_terminal_libera_la_reserva():
    disp, bm, _ = _wire(10.0)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")
    disp.marcar_fallido("j1", "Docling reventó")
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 10.0 and b.retenido_usd == 0.0  # reserva devuelta


def test_confirmar_sin_saldo_disponible_no_encola_ni_reserva():
    disp, bm, backend = _wire(1.0)
    disp.crear_job(_job(costo=2.0))
    with pytest.raises(ValueError):
        disp.confirmar("j1")
    assert backend.queue_length() == 0
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 1.0 and b.retenido_usd == 0.0


def test_reserva_baja_el_disponible_que_ve_el_cotizador():
    """Una reserva viva reduce el disponible: la siguiente cotización lo refleja."""
    from app.ingesta.cotizador import Cotizador

    disp, bm, _ = _wire(2.02)
    disp.crear_job(_job(job_id="j1", costo=2.0))
    disp.confirmar("j1")  # retiene 2.0 → disponible 0.02
    cz = Cotizador(budget_manager=bm)
    # Un doc cuyo costo (~$0.025) ya no cabe en el disponible que dejó la reserva.
    cot = cz.cotizar("t", ("Texto técnico. " * 5000))
    assert cot.aprobado is False


# ════════════════════════════════════════════════════════════════════════════
# Idempotencia conectada al SHA-256 (A.3)
# ════════════════════════════════════════════════════════════════════════════

def test_sha_ya_liquidado_no_recobra_corta_en_confirm():
    disp, bm, backend = _wire(10.0)
    # Contenido ya ingerido previamente (registrado por tenant + SHA-256).
    backend.record_ingested("t", "SHA1", {"resultado": {"document_id": "prev"}})
    disp.crear_job(_job(job_id="j2", costo=2.0, sha="SHA1"))
    job = disp.confirmar("j2")
    # Cortó antes de reservar: idempotente, no encolado, saldo intacto.
    assert job.status == JobStatus.completed and job.idempotente is True
    assert backend.queue_length() == 0
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 10.0 and b.retenido_usd == 0.0


# ── Idempotencia vía el worker real (SHA computado al descargar) ──────────────

class _FakeStore:
    def __init__(self, data_by_ref):
        self.data = data_by_ref

    def get(self, ref):
        return self.data[ref]


class _FakePipeline:
    def __init__(self, store, fail_times=0):
        self.document_store = store
        self.fail_times = fail_times
        self.calls = 0

    async def procesar(self, job, path, progreso=None):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise RuntimeError("fallo transitorio simulado")
        return {"document_id": job.content_sha256, "nodos_creados": 5}


async def _nosleep(_s):
    return None


def _confirmar_y_sacar(disp, job_id):
    disp.confirmar(job_id)
    disp.backend.pop()


def test_reingerir_mismo_contenido_no_cobra_segunda_vez():
    import worker.main as wm

    disp, bm, backend = _wire(10.0)
    store = _FakeStore({"a": DOC_BYTES, "b": DOC_BYTES})  # mismo contenido
    pipeline = _FakePipeline(store)

    # Job 1: primera ingesta → cobra el cotizado (2.0). Disponible 10 → 8.
    disp.crear_job(_job(job_id="J1", costo=2.0, ref="a"))
    _confirmar_y_sacar(disp, "J1")
    asyncio.run(wm._procesar_un_job(disp, pipeline, "J1", sleep=_nosleep))
    assert bm.get_budget("t").saldo_actual_usd == 8.0
    assert pipeline.calls == 1

    # Job 2: MISMO contenido (otro job_id/ref). Reserva al confirmar (8→6) pero el
    # worker lo resuelve por idempotencia y LIBERA → vuelve a 8. No re-cobra.
    disp.crear_job(_job(job_id="J2", costo=2.0, ref="b"))
    _confirmar_y_sacar(disp, "J2")
    asyncio.run(wm._procesar_un_job(disp, pipeline, "J2", sleep=_nosleep))
    j2 = backend.load_job("J2")
    assert j2.idempotente is True and j2.reserva_estado == "liberado"
    assert pipeline.calls == 1  # no reprocesó
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 8.0 and b.retenido_usd == 0.0  # cobrado una sola vez


def test_estado_final_identico_a_la_primera_o_tras_reintentos(monkeypatch):
    """El saldo final es idéntico si el worker acierta al 1er intento o tras retries."""
    import worker.main as wm

    monkeypatch.setattr(wm, "MAX_RETRIES", 2)

    # Caso A: éxito al primer intento.
    dispA, bmA, backendA = _wire(10.0)
    pipeA = _FakePipeline(_FakeStore({"r": DOC_BYTES}), fail_times=0)
    dispA.crear_job(_job(job_id="A", costo=2.0, ref="r"))
    _confirmar_y_sacar(dispA, "A")
    asyncio.run(wm._procesar_un_job(dispA, pipeA, "A", sleep=_nosleep))

    # Caso B: dos fallos transitorios, luego éxito.
    dispB, bmB, backendB = _wire(10.0)
    pipeB = _FakePipeline(_FakeStore({"r": DOC_BYTES}), fail_times=2)
    dispB.crear_job(_job(job_id="B", costo=2.0, ref="r"))
    _confirmar_y_sacar(dispB, "B")
    asyncio.run(wm._procesar_un_job(dispB, pipeB, "B", sleep=_nosleep))

    # Mismo estado final del saldo (reserva una vez, liquida una vez).
    assert bmA.get_budget("t").saldo_actual_usd == bmB.get_budget("t").saldo_actual_usd == 8.0
    assert pipeB.calls == 3  # 2 fallos + 1 éxito (reintento NO re-reserva)
    assert backendB.load_job("B").reserva_estado == "liquidado"


def test_reintento_manual_tras_fallo_terminal_re_reserva():
    """El fallo terminal liberó la reserva; el reintento manual vuelve a reservar."""
    disp, bm, backend = _wire(10.0)
    disp.crear_job(_job(job_id="JM", costo=2.0))
    disp.confirmar("JM")                 # disponible 8, retenido 2
    backend.pop()
    disp.marcar_fallido("JM", "boom")    # libera → disponible 10, retenido 0
    assert bm.get_budget("t").saldo_actual_usd == 10.0
    disp.reintentar("JM")                # re-reserva → disponible 8, retenido 2
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 8.0 and b.retenido_usd == 2.0
    assert backend.load_job("JM").reserva_estado == "retenido"
