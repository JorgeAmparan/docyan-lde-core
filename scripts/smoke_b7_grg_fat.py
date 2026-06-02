#!/usr/bin/env python3
"""
Smoke end-to-end B7 — GRG extendido + FAT extendido (hash chain SHA-256).

DOCYAN LDE™ by XCID.

Ejercita SIN RED (backends en memoria, determinista) el flujo completo del
contrato B7 §"Salida verificable":

  1. Consulta vía MO → Governance Gate → GRG extendido (F2 por criticidad) →
     output servido o escalado → FAT con hash chain registrado.
  2. Verificador de integridad sobre el dataset producido → OK.
  3. Alterar un evento (simular intrusión) → el verificador lo detecta.
  4. Exportar el reporte del smoke en PDF y JSON → ambos contienen los hashes.

Contra Fly/Supabase real: el mismo flujo corre cambiando `FATAuditSink(fat=...)`
por `FATAuditSink()` (store híbrido Supabase+FalkorDB) y el endpoint admin
`/admin/fat/integrity`. Requiere secrets de producción (no incluidos aquí).

Uso:  python scripts/smoke_b7_grg_fat.py
Exit: 0 si todo pasa; !=0 si algo falla.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET", "smoke-secret-min-32-bytes-long-000000000000")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake")
os.environ.setdefault("ORG_ID", "smoke-tenant")

from app.audit.fat_extendido import EventoFAT, FATExtendido, InMemoryFATStore  # noqa: E402
from app.audit.integrity_checker import verificar_cadena, verificar_tenant  # noqa: E402
from app.audit.reports import export_json, export_pdf  # noqa: E402
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore  # noqa: E402
from app.ingesta.cotizador import Cotizador  # noqa: E402
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher  # noqa: E402
from app.orchestrator.audit_logger import AuditLogger, FATAuditSink  # noqa: E402
from app.orchestrator.master_orchestrator import MasterOrchestrator  # noqa: E402
from app.orchestrator.models import MORequest  # noqa: E402
from app.orchestrator.pipeline_coordinator import PipelineCoordinator  # noqa: E402
from app.orchestrator.session_manager import (  # noqa: E402
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
)

TENANT = "smoke-tenant"
AUTH = {"org_id": TENANT, "user_id": "u1", "role": "admin", "email": "a@t.com"}


def _build():
    bs = InMemoryBudgetStore()
    BudgetManager(store=bs).ensure_budget(TENANT, saldo_inicial_usd=100.0)
    coord = PipelineCoordinator(
        cotizador=Cotizador(budget_manager=BudgetManager(store=bs)),
        dispatcher=JobDispatcher(backend=InMemoryQueueBackend()),
    )
    fat = FATExtendido(InMemoryFATStore())
    mo = MasterOrchestrator(
        pipeline_coordinator=coord,
        session_manager=SessionManager(
            store=InMemorySessionStore(), spillover=InMemorySessionSpillover()
        ),
        audit_logger=AuditLogger(sink=FATAuditSink(fat=fat)),
    )
    return mo, fat


def main() -> int:
    print("== B7 smoke: GRG extendido + FAT hash chain ==")
    mo, fat = _build()

    # 1a. Consulta crítica confianza alta → sirve.
    r1 = mo.handle_request(
        MORequest(auth=AUTH, accion="consulta", texto="dato",
                  payload={"score_confianza": 0.97, "criticidad": "seguridad"})
    )
    assert r1.ok and r1.servido, "consulta de alta confianza debería servir"
    print(f"  [1a] consulta seguridad@0.97 → servido={r1.servido} OK")

    # 1b. Consulta crítica confianza media → escala a revisor (F2 R-UC).
    r2 = mo.handle_request(
        MORequest(auth=AUTH, accion="consulta", texto="proc",
                  payload={"score_confianza": 0.80, "criticidad": "seguridad"})
    )
    assert not r2.servido, "consulta crítica de confianza media debería escalar"
    print(f"  [1b] consulta seguridad@0.80 → bloqueado/escalado: {r2.razon_codigo if hasattr(r2,'razon_codigo') else ''} OK")

    eventos = fat.eventos(TENANT)
    print(f"  [FAT] {len(eventos)} eventos registrados con hash chain")

    # 2. Verificador sobre el dataset producido → íntegro.
    res = verificar_tenant(fat, TENANT)
    assert res.integra, f"cadena debería ser íntegra: {res.detalle}"
    print(f"  [2] integridad de la cadena: integra={res.integra} ({res.total_eventos} eventos) OK")

    # 3. Simular intrusión → detectar.
    alterado = EventoFAT.from_dict({**eventos[1].to_dict(), "payload": {"x": "intruso"}})
    rotos = eventos[:1] + [alterado] + eventos[2:]
    res_roto = verificar_cadena(TENANT, rotos)
    assert not res_roto.integra, "el verificador debería detectar la intrusión"
    print(f"  [3] intrusión detectada en {res_roto.primer_evento_roto} ({res_roto.tipo_problema}) OK")

    # 4. Exportar reporte en PDF y JSON con hashes.
    pdf = export_pdf(eventos)
    js = export_json(eventos)
    texto_pdf = pdf.decode("latin-1")
    assert pdf.startswith(b"%PDF") and all(e.hash_evento in texto_pdf for e in eventos), \
        "PDF debe contener todos los hashes"
    assert all(e.hash_evento in js for e in eventos), "JSON debe contener todos los hashes"
    print(f"  [4] reporte PDF ({len(pdf)} bytes) + JSON con hashes OK")

    print("== B7 smoke OK ==")
    return 0


if __name__ == "__main__":
    sys.exit(main())
