"""
F3 §C — Cupo de ingestas por tier (Modelo Comercial v1.1 §2.3). Tests backend.

Cubre (política balanceada del contrato F3):
  · Mapeo de cupo por plan + siembra (ensure_quota) idempotente.
  · Cotizador: dentro de cupo → setup $0; agotado → fórmula con piso $15; freemium
    (sin cupo) → fórmula como antes (compat).
  · Decremento idempotente por job_id (un reintento del mismo confirm no doble-descuenta).
  · El escenario de cierre del contrato: 10 ingestas "incluidas" y la 11ª cotiza $15.
  · Reposición mensual del recurrente, con techo en el cupo inicial.
  · Enterprise configurable.
  · Integración con el dispatcher (confirmar descuenta cupo; idempotente).
"""
from __future__ import annotations

from app.ingesta import pricing_table as pt
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
from app.ingesta.cotizador import Cotizador
from app.ingesta.quota_manager import (
    CUPOS_POR_PLAN,
    InMemoryQuotaStore,
    QuotaManager,
    cupo_para_plan,
)
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.jobs.job_models import CotizacionSnapshot, IngestJob

DOC = "Documento técnico de prueba. " * 50  # doc chico → cómputo de centavos


def _qm() -> QuotaManager:
    return QuotaManager(store=InMemoryQuotaStore())


def _bm(saldo: float, tenant: str = "t") -> BudgetManager:
    bm = BudgetManager(store=InMemoryBudgetStore())
    bm.ensure_budget(tenant, saldo_inicial_usd=saldo)
    return bm


# ── Mapeo y siembra ───────────────────────────────────────────────────────────


def test_cupo_por_plan_mapping():
    assert cupo_para_plan("esencial") == (10, 3)
    assert cupo_para_plan("profesional") == (30, 10)
    assert cupo_para_plan("Profesional") == (30, 10)  # case-insensitive
    assert cupo_para_plan("piloto") == (10, 3)  # piloto = Esencial
    assert cupo_para_plan("enterprise") is None  # configurable
    assert cupo_para_plan("freemium") is None
    assert cupo_para_plan(None) is None
    assert cupo_para_plan("desconocido") is None


def test_ensure_quota_siembra_por_plan():
    qm = _qm()
    q = qm.ensure_quota("org-esencial", "esencial")
    assert (q.cupo_inicial, q.cupo_recurrente_mensual, q.cupo_restante) == (10, 3, 10)

    q2 = qm.ensure_quota("org-prof", "profesional")
    assert (q2.cupo_inicial, q2.cupo_recurrente_mensual, q2.cupo_restante) == (30, 10, 30)


def test_ensure_quota_freemium_no_crea_fila():
    qm = _qm()
    assert qm.ensure_quota("org-free", "freemium") is None
    assert qm.get_quota("org-free") is None
    assert qm.estado("org-free").aplica is False


def test_ensure_quota_enterprise_configurable():
    qm = _qm()
    q = qm.ensure_quota("org-ent", "enterprise")
    assert q is not None
    assert q.enterprise_configurable is True
    assert q.cupo_restante == 0  # negociado a mano por el operador
    # El operador configura el cupo enterprise manualmente (upsert).
    q.cupo_inicial = 100
    q.cupo_recurrente_mensual = 50
    q.cupo_restante = 100
    qm.store.upsert(q)
    assert qm.estado("org-ent").cupo_restante == 100


def test_ensure_quota_idempotente_no_reinicia_gastado():
    qm = _qm()
    qm.ensure_quota("org", "esencial")
    qm.decrementar("org", "job-1")  # gasta 1 → restante 9
    again = qm.ensure_quota("org", "esencial")  # re-activar plan no reinicia
    assert again.cupo_restante == 9


# ── Cotizador: dentro / excedente / freemium ─────────────────────────────────


def test_cotizador_dentro_de_cupo_setup_cero():
    qm = _qm()
    qm.ensure_quota("t", "esencial")
    cot = Cotizador(budget_manager=_bm(100.0), quota_manager=qm).cotizar("t", DOC)
    assert cot.dentro_de_cupo is True
    assert cot.precio_setup_usd == 0.0
    assert cot.cupo_restante == 10  # cotizar no descuenta; solo confirmar
    assert "incluido en tu plan" in cot.motivo.lower()


def test_cotizador_excedente_cobra_piso_15():
    qm = _qm()
    q = qm.ensure_quota("t", "esencial")
    q.cupo_restante = 0  # cupo agotado
    qm.store.upsert(q)
    cot = Cotizador(budget_manager=_bm(100.0), quota_manager=qm).cotizar("t", DOC)
    assert cot.dentro_de_cupo is False
    assert cot.precio_setup_usd == 15.0  # doc chico → gana el piso $15 (v1.1)
    assert cot.cupo_restante == 0


def test_cotizador_freemium_sin_cupo_usa_formula():
    # Sin fila de cupo (freemium) → comportamiento previo: setup por fórmula.
    qm = _qm()  # sin ensure_quota para "t"
    cot = Cotizador(budget_manager=_bm(100.0), quota_manager=qm).cotizar("t", DOC)
    assert cot.dentro_de_cupo is False
    assert cot.cupo_restante is None  # no aplica cupo
    assert cot.precio_setup_usd == 15.0


def test_cotizador_sin_quota_manager_compat():
    # Sin quota_manager inyectado → comportamiento idéntico al previo (fórmula).
    cot = Cotizador(budget_manager=_bm(100.0)).cotizar("t", DOC)
    assert cot.dentro_de_cupo is False
    assert cot.cupo_restante is None
    assert cot.precio_setup_usd == 15.0


# ── Decremento idempotente + escenario de cierre (10 incluidas, 11ª $15) ─────


def test_decremento_idempotente_por_job():
    qm = _qm()
    qm.ensure_quota("org", "esencial")
    r1 = qm.decrementar("org", "job-X")
    assert (r1.decremented, r1.cupo_restante) == (True, 9)
    # Reintento del MISMO job: no vuelve a descontar.
    r2 = qm.decrementar("org", "job-X")
    assert (r2.decremented, r2.cupo_restante) == (False, 9)


def test_escenario_cierre_10_incluidas_11a_cobra_15():
    """Contrato F3 salida verificable: Esencial → 10 ingestas incluidas, 11ª cotiza $15."""
    qm = _qm()
    qm.ensure_quota("t", "esencial")
    cz = Cotizador(budget_manager=_bm(100.0), quota_manager=qm)

    for i in range(10):
        cot = cz.cotizar("t", DOC)
        assert cot.dentro_de_cupo is True, f"ingesta {i+1} debería ir incluida"
        assert cot.precio_setup_usd == 0.0
        # Simula la confirmación: descuenta 1 del cupo.
        res = qm.decrementar("t", f"job-{i}")
        assert res.decremented is True

    assert qm.estado("t").cupo_restante == 0
    # La 11ª: cupo agotado → cotiza con piso $15.
    cot11 = cz.cotizar("t", DOC)
    assert cot11.dentro_de_cupo is False
    assert cot11.precio_setup_usd == 15.0


# ── Reposición mensual ────────────────────────────────────────────────────────


def test_reposicion_mensual_suma_recurrente_con_techo():
    qm = _qm()
    qm.ensure_quota("t", "esencial")  # 10 inicial, 3/mes
    # Gasta 5 → restante 5.
    for i in range(5):
        qm.decrementar("t", f"j{i}")
    assert qm.estado("t").cupo_restante == 5
    # Reposición: +3 → 8 (no pasa del techo 10).
    n = qm.reponer_mensual()
    assert n == 1
    assert qm.estado("t").cupo_restante == 8
    # Otra reposición: +3 → 10 (cap en el techo, no 11).
    qm.reponer_mensual()
    assert qm.estado("t").cupo_restante == 10
    qm.reponer_mensual()
    assert qm.estado("t").cupo_restante == 10  # se mantiene en el techo


def test_reposicion_no_toca_orgs_sin_recurrente():
    qm = _qm()
    qm.ensure_quota("ent", "enterprise")  # recurrente 0
    n = qm.reponer_mensual()
    assert n == 0


# ── Integración con el dispatcher (confirmar descuenta cupo) ──────────────────


def _job_dentro_de_cupo(tenant="t", job_id="j1") -> IngestJob:
    return IngestJob(
        job_id=job_id, tenant_id=tenant, documento_ref="ref", nombre_archivo="d.pdf",
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=0.04, tiempo_estimado_seg=1.0, tokens_documento=100,
            aprobado=True, decision="aprobado_requiere_confirmacion",
            precio_setup_usd=0.0, dentro_de_cupo=True,
        ),
    )


def test_dispatcher_confirmar_descuenta_cupo():
    qm = _qm()
    qm.ensure_quota("t", "esencial")
    disp = JobDispatcher(
        backend=InMemoryQueueBackend(), budget_manager=_bm(100.0), quota_manager=qm
    )
    job = _job_dentro_de_cupo()
    disp.crear_job(job)
    disp.confirmar(job.job_id)
    assert qm.estado("t").cupo_restante == 9


def test_dispatcher_confirmar_idempotente_no_doble_descuenta():
    qm = _qm()
    qm.ensure_quota("t", "esencial")
    disp = JobDispatcher(
        backend=InMemoryQueueBackend(), budget_manager=_bm(100.0), quota_manager=qm
    )
    job = _job_dentro_de_cupo(job_id="jr")
    disp.crear_job(job)
    disp.confirmar(job.job_id)
    # Un segundo confirmar del mismo job (idempotente por job_id en el ledger del cupo).
    # El job ya no es confirmable (queued), pero el ledger blinda el cupo igual:
    qm.decrementar("t", "jr")  # mismo job_id → no descuenta
    assert qm.estado("t").cupo_restante == 9


class _FakeStore:
    """Store mínimo para ejercitar activar_plan (solo lo que toca)."""

    def __init__(self):
        self.orgs = {"org-1": {"id": "org-1", "plan": "freemium"}}
        self.billing = {}

    def get_org(self, org_id):
        return self.orgs.get(org_id)

    def update_org(self, org_id, **fields):
        self.orgs[org_id].update(fields)
        return self.orgs[org_id]

    def upsert_org_billing(self, org_id, **fields):
        self.billing[org_id] = fields


class _FakeAudit:
    def record(self, *a, **k):
        pass


class _Req:
    def __init__(self, plan):
        self.plan = plan
        self.criticidad_segmento = "operacional"
        self.doc_limit = None
        self.banda_mercado = None
        self.idioma = None


def test_activar_plan_siembra_cupo():
    """Wiring: la fase 2 (activar_plan) siembra el cupo del plan vía QuotaManager."""
    from app.onboarding.service import activar_plan

    qm = _qm()
    activar_plan(
        _FakeStore(), _FakeAudit(),
        org_id="org-1", actor="admin@test", req=_Req("profesional"), quota=qm,
    )
    estado = qm.estado("org-1")
    assert estado.aplica is True
    assert estado.cupo_restante == 30  # Profesional 30 inicial


def test_constantes_cupo_coinciden_con_modelo_comercial():
    # Guard contra drift de las cifras del Modelo Comercial v1.1.
    assert CUPOS_POR_PLAN["esencial"] == (10, 3)
    assert CUPOS_POR_PLAN["profesional"] == (30, 10)
    # Piso de setup v1.1.
    assert pt.precio_setup(0.04) == 15.0
