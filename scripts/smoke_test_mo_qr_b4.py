#!/usr/bin/env python3
"""
Smoke test end-to-end del Master Orchestrator + Tokens QR + Cotizador (B4).

DOCYAN LDE™ by XCID.

Ejercita los flujos del Sprint B4 a través de la CAPA HTTP REAL (FastAPI TestClient
sobre `app.api.main:app`), con los backends de red (Redis/Supabase/FalkorDB)
sustituidos por dobles en memoria vía dependency_overrides. Es un smoke LOCAL,
determinista y no destructivo — no toca producción ni datos reales.

Cubre los escenarios de "Salida verificable" del contrato:
  1. QR: genera → resuelve (contexto correcto) → revoca → ya no resuelve (404).
  2. Sesión: crea → transfiere de canal (preserva estado) → cierra (spillover).
  3. Ingesta vía MO: saldo suficiente → confirma → encolado; saldo insuficiente
     → rechazo limpio (cifras + tiempo), no encolado.
  4. Scheduler: la tarea de limpieza elimina una sesión expirada (tiempo simulado).

Uso:
    python scripts/smoke_test_mo_qr_b4.py
Salida: PASS/FAIL por escenario; exit 0 si todo PASS, 1 si algún FAIL.
"""
from __future__ import annotations

import os
import sys

# Repo root al path (permite `python scripts/smoke_test_mo_qr_b4.py` desde la raíz).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET", "smoke-secret-min-32-bytes-long-0000000000")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service-key")
os.environ.setdefault("SUPABASE_KEY", "fake-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("FALKORDB_HOST", "localhost")
os.environ.setdefault("ORG_ID", "smoke-org")
os.environ.setdefault("API_KEY", "smoke-api-key")

from fastapi.testclient import TestClient  # noqa: E402

from app.api.main import app  # noqa: E402
from app.api.routers import mo as mo_router  # noqa: E402
from app.api.routers import qr as qr_router  # noqa: E402
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore  # noqa: E402
from app.ingesta.cotizador import Cotizador  # noqa: E402
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher  # noqa: E402
from app.orchestrator import providers  # noqa: E402
from app.orchestrator.audit_logger import AuditLogger, InMemoryAuditSink  # noqa: E402
from app.orchestrator.master_orchestrator import MasterOrchestrator  # noqa: E402
from app.orchestrator.models import Canal, SessionType  # noqa: E402
from app.orchestrator.pipeline_coordinator import PipelineCoordinator  # noqa: E402
from app.orchestrator.scheduler import DocyanScheduler  # noqa: E402
from app.orchestrator.session_manager import (  # noqa: E402
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
)
from app.qr.qr_generator import QrGenerator  # noqa: E402
from app.qr.qr_resolver import QrResolver  # noqa: E402
from app.qr.store import InMemoryQrTokenStore  # noqa: E402

HEADERS = {"X-API-Key": "smoke-api-key"}  # dev key → org=smoke-org, role=admin
RESULTS: list[tuple[str, bool, str]] = []


def check(nombre: str, cond: bool, detalle: str = ""):
    RESULTS.append((nombre, cond, detalle))
    print(f"  [{'PASS' if cond else 'FAIL'}] {nombre}" + (f" — {detalle}" if detalle else ""))


class FakeDKG:
    def __init__(self):
        self.entities = {}

    def add(self, t, e, props):
        self.entities[(t, e)] = {"id": e, **props}

    def get_entity(self, t, e):
        return self.entities.get((t, e))

    def query(self, t, cypher, params=None):
        return []


def build_overrides(saldo: float):
    budget_store = InMemoryBudgetStore()
    BudgetManager(store=budget_store).ensure_budget("smoke-org", saldo_inicial_usd=saldo)
    coord = PipelineCoordinator(
        cotizador=Cotizador(budget_manager=BudgetManager(store=budget_store)),
        dispatcher=JobDispatcher(backend=InMemoryQueueBackend()),
    )
    sessions = SessionManager(
        store=InMemorySessionStore(), spillover=InMemorySessionSpillover()
    )
    mo = MasterOrchestrator(
        pipeline_coordinator=coord, session_manager=sessions,
        audit_logger=AuditLogger(sink=InMemoryAuditSink()),
    )
    qr_store = InMemoryQrTokenStore()
    dkg = FakeDKG()
    generator = QrGenerator(store=qr_store, base_url="https://docyan-lde-api.fly.dev")
    resolver = QrResolver(store=qr_store, dkg=dkg, frontend_base_url="https://consulta.docyan.com")
    dkg.add("smoke-org", "ent-77", {"tipo": "extintor", "sitio": "Planta A"})
    return mo, generator, resolver, dkg


def escenario_qr(client):
    print("\n── Escenario 1: Tokens QR (genera → resuelve → revoca) ──")
    r = client.post("/qr/generate", json={"entidad_id": "ent-77"}, headers=HEADERS)
    check("QR generado (200)", r.status_code == 200, f"status={r.status_code}")
    body = r.json()
    token = body["url"].rsplit("/", 1)[-1]
    check("QR codifica URL pública", body["url"].startswith("https://docyan-lde-api.fly.dev/qr/"))
    check("QR trae imagen SVG", body.get("tiene_imagen") is True)

    res = client.get(f"/qr/{token}", params={"format": "json"})
    check("QR resuelve a contexto (200)", res.status_code == 200, f"status={res.status_code}")
    ctx = res.json()
    check("QR resuelve la entidad correcta", ctx["entidad"]["tipo"] == "extintor",
          f"entidad={ctx['entidad']}")
    check("QR aísla por tenant en la URL de frontend", "tenant=smoke-org" in ctx["frontend_url"])

    # Recupera el nonce del registro para revocar (el generador comparte store).
    gen = app.dependency_overrides[qr_router.get_qr_generator]()
    nonce = next(k[1] for k in gen.store._rows if k[0] == "smoke-org")
    rev = client.post("/qr/revoke", json={"nonce": nonce}, headers=HEADERS)
    check("QR revocado (200)", rev.status_code == 200, f"status={rev.status_code}")
    res2 = client.get(f"/qr/{token}", params={"format": "json"})
    check("QR revocado ya NO resuelve (404)", res2.status_code == 404, f"status={res2.status_code}")

    res3 = client.get("/qr/token-falso-sin-firma", params={"format": "json"})
    check("Token inválido → 404 (no filtra existencia)", res3.status_code == 404)


def escenario_sesion(client):
    print("\n── Escenario 2: Sesión (crea → transfiere → cierra) ──")
    r = client.post("/mo/sessions",
                    json={"session_type": "consulta", "canal": "pwa",
                          "initial_state": {"contexto": "ent-77"}},
                    headers=HEADERS)
    check("Sesión creada (200)", r.status_code == 200, f"status={r.status_code}")
    sid = r.json()["session_id"]

    t = client.post(f"/mo/sessions/{sid}/transfer", json={"canal": "whatsapp"}, headers=HEADERS)
    check("Sesión transferida a WhatsApp", t.status_code == 200 and t.json()["canal"] == "whatsapp")
    check("Estado preservado tras transferencia", t.json()["state"]["contexto"] == "ent-77")

    c = client.post(f"/mo/sessions/{sid}/close", json={"reason": "smoke"}, headers=HEADERS)
    check("Sesión cerrada con spillover", c.status_code == 200 and c.json()["spillover"] is True)
    g = client.get(f"/mo/sessions/{sid}", headers=HEADERS)
    check("Sesión cerrada ya no está viva (404)", g.status_code == 404)


def escenario_ingesta(client_suf, client_insuf):
    print("\n── Escenario 3: Ingesta vía MO (cotizador gate sin bypass) ──")
    r = client_suf.post("/mo/ingesta",
                        json={"texto_documento": "Documento de norma " * 100,
                              "nombre_archivo": "nom.pdf"},
                        headers=HEADERS)
    data = r.json()["data"]
    cot = data["cotizacion"]
    check("Saldo suficiente → aprobado", cot["aprobado"] is True)
    check("Cotización incluye costo > 0", cot["costo_total_usd"] > 0, f"${cot['costo_total_usd']}")
    check("Cotización incluye TIEMPO estimado", cot["tiempo_estimado_seg"] > 0,
          f"{cot['tiempo_estimado_seg']}s")
    job_id = data["job_id"]
    conf = client_suf.post(f"/mo/ingesta/{job_id}/confirm", headers=HEADERS)
    check("Confirmación encola el job (queued)", conf.json().get("status") == "queued")

    r2 = client_insuf.post("/mo/ingesta",
                           json={"texto_documento": "Documento de norma " * 100,
                                 "nombre_archivo": "nom.pdf"},
                           headers=HEADERS)
    data2 = r2.json()["data"]
    check("Saldo insuficiente → rechazado", data2["cotizacion"]["aprobado"] is False)
    check("Rechazo con cifras claras", "insuficiente" in data2["cotizacion"]["motivo"].lower(),
          data2["cotizacion"]["motivo"])
    conf2 = client_insuf.post(f"/mo/ingesta/{data2['job_id']}/confirm", headers=HEADERS)
    check("Job rechazado NO se puede confirmar (409)", conf2.status_code == 409,
          f"status={conf2.status_code}")


def escenario_scheduler():
    print("\n── Escenario 4: Scheduler (limpieza de sesiones expiradas) ──")
    estado = {"t": 1_000_000.0}
    store = InMemorySessionStore(clock=lambda: estado["t"])
    mgr = SessionManager(store=store, spillover=InMemorySessionSpillover())
    _orig = providers.get_session_manager
    providers.get_session_manager = lambda: mgr
    try:
        sid = mgr.create_session("smoke-org", "u1", SessionType.consulta, Canal.pwa)
        estado["t"] += 31 * 60  # expira (TTL consulta = 30m)
        sched = DocyanScheduler(jobstore="memory")
        ids = sched.register_default_jobs()
        check("Scheduler registra tareas iniciales", "cleanup_expired_sessions" in ids,
              f"jobs={ids}")
        eliminadas = sched.trigger("cleanup_expired_sessions")
        check("Limpieza elimina la sesión expirada", eliminadas == 1, f"eliminadas={eliminadas}")
        check("Sesión expirada ya no existe", mgr.get_session(sid) is None)
        sched.shutdown()
    finally:
        providers.get_session_manager = _orig


def main() -> int:
    print("=" * 64)
    print("  SMOKE B4 — Master Orchestrator + Tokens QR + Cotizador (LOCAL)")
    print("=" * 64)

    # Escenarios HTTP con saldo suficiente.
    mo_s, gen_s, res_s, _ = build_overrides(saldo=100.0)
    app.dependency_overrides[mo_router.get_mo] = lambda: mo_s
    app.dependency_overrides[qr_router.get_qr_generator] = lambda: gen_s
    app.dependency_overrides[qr_router.get_qr_resolver] = lambda: res_s
    client_suf = TestClient(app)
    escenario_qr(client_suf)
    escenario_sesion(client_suf)

    # Cliente con saldo insuficiente (MO distinto).
    mo_i, _, _, _ = build_overrides(saldo=0.0)
    app2 = app
    app2.dependency_overrides[mo_router.get_mo] = lambda: mo_i
    client_insuf = TestClient(app2)
    # Para el caso suficiente reusar mo_s: re-set override antes de cada llamada.
    app.dependency_overrides[mo_router.get_mo] = lambda: mo_s
    escenario_ingesta(client_suf, _IngestaInsufClient(mo_i))

    escenario_scheduler()

    app.dependency_overrides.clear()

    fails = [n for n, ok, _ in RESULTS if not ok]
    print("\n" + "=" * 64)
    print(f"  RESULTADO: {len(RESULTS) - len(fails)}/{len(RESULTS)} PASS")
    print("=" * 64)
    return 1 if fails else 0


class _IngestaInsufClient:
    """Wrapper que fija el override del MO insuficiente antes de cada request."""

    def __init__(self, mo_insuf):
        self.mo = mo_insuf
        self.client = TestClient(app)

    def post(self, url, **kw):
        app.dependency_overrides[mo_router.get_mo] = lambda: self.mo
        return self.client.post(url, **kw)


if __name__ == "__main__":
    sys.exit(main())
