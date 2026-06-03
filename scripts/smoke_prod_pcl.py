#!/usr/bin/env python3
"""
Smoke E2E de la CCP/PCL contra Fly REAL (docyan-lde-api) — cierre prod B8.5.

DOCYAN LDE™ by XCID.

NO usa dobles: golpea la capa HTTP pública del backend desplegado, que habla con
Supabase/Redis/FalkorDB/BGE-M3 reales en Fly. Verifica los tres caminos de la
Capa de Contexto Persistente que B8.5 añadió:

  1. CACHE HIT — una consulta repetida idéntica se sirve desde el caché semántico
     (BGE-M3 + Redis), `cache_hit=true`, `modo=cache_hit`, `similitud≥0.92`.
  2. INVALIDACIÓN VIVA — tras una ingesta sintética real (worker), la consulta
     cacheada cuya entidad coincide con el `document_id` ingerido se invalida →
     la siguiente consulta es cache miss (vivo). El caché se tag-ea con el
     `job_id` (= document_id que el worker invalida al terminar — doc CCP §5.3).
  3. MÉTRICAS — se agregan los eventos FAT F4 `consulta_servida` del día (mismo
     código que el job 03:00h del scheduler) y `GET /admin/pcl/metrics` devuelve
     los agregados (totales, hit ratio, distribución de modos, latencias).

Uso:
    BASE=https://docyan-lde-api.fly.dev python scripts/smoke_prod_pcl.py
    (carga .env para SUPABASE_* / provisión de presupuesto / agregación).
Exit 0 si todo PASS.
"""
from __future__ import annotations

import datetime as dt
import os
import sys
import time
import uuid

# Repo root en sys.path: el script importa módulos `app.*` (provisión de
# presupuesto + agregación de métricas) y se ejecuta desde scripts/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE = os.getenv("BASE", "https://docyan-lde-api.fly.dev").rstrip("/")
POLL_TIMEOUT_S = int(os.getenv("PCL_SMOKE_POLL_TIMEOUT", "420"))
RESULTS: list[tuple[str, bool, str]] = []

DOC_SINTETICO = (
    "# Procedimiento de calibración del manómetro MN-7\n\n"
    "El manómetro MN-7 debe calibrarse cada 12 meses. El rango de operación es "
    "0 a 250 kPa. La tolerancia admisible es ±2%. El responsable de calibración "
    "registra el certificado en el expediente del equipo.\n"
)


def check(nombre: str, cond: bool, detalle: str = "") -> None:
    RESULTS.append((nombre, cond, bool(cond) and detalle or detalle))
    print(f"  [{'PASS' if cond else 'FAIL'}] {nombre}" + (f" — {detalle}" if detalle else ""))


def _ccp(resp_json: dict) -> dict:
    return ((resp_json or {}).get("resultado") or {}).get("contexto_ccp") or {}


def main() -> int:  # noqa: C901 — smoke lineal legible de punta a punta
    c = httpx.Client(base_url=BASE, timeout=60.0)
    suffix = uuid.uuid4().hex[:10]
    email = f"pcl-smoke-{suffix}@docyan-smoke.example.com"
    password = "PclSm0ke!2026"
    org_name = f"PCL Smoke {suffix}"

    print(f"== Smoke prod B8.5 (CCP/PCL) contra {BASE} ==")

    # ── Alta de tenant fresco + login ────────────────────────────────────────
    r = c.post("/auth/register", json={
        "email": email, "password": password, "name": "PCL Smoke", "org_name": org_name,
    })
    check("auth/register nuevo tenant", r.status_code == 200, f"HTTP {r.status_code}")
    r = c.post("/auth/login", json={"email": email, "password": password})
    token = (r.json() or {}).get("access_token") if r.status_code == 200 else None
    check("auth/login + access_token", bool(token), f"HTTP {r.status_code}")
    if not token:
        return _resumen()
    H = {"Authorization": f"Bearer {token}"}

    me = c.get("/auth/me", headers=H)
    org_id = (me.json() or {}).get("org_id") if me.status_code == 200 else None
    check("auth/me → org_id", bool(org_id), f"org_id={org_id}")
    if not org_id:
        return _resumen()

    # ── Prerrequisitos de infraestructura del caché ──────────────────────────
    r = c.post("/admin/embedding/test", headers=H)
    emb_ok = r.status_code == 200 and (r.json() or {}).get("dim") == 1024
    check("BGE-M3 embedder vivo (dim 1024)", emb_ok, f"HTTP {r.status_code}")
    r = c.get("/admin/dkg/health", headers=H)
    check("FalkorDB (DKG) vivo", r.status_code == 200, f"HTTP {r.status_code}")

    # ── Provisión de presupuesto del tenant (gate del cotizador) ─────────────
    try:
        from app.ingesta.budget_manager import BudgetManager, SupabaseBudgetStore

        BudgetManager(store=SupabaseBudgetStore()).ensure_budget(
            org_id, saldo_inicial_usd=10.0
        )
        check("presupuesto del tenant provisionado", True, "saldo=10.0 USD")
    except Exception as e:  # noqa: BLE001
        check("presupuesto del tenant provisionado", False, f"{type(e).__name__}: {e}")
        return _resumen()

    # ── Cotización de la ingesta sintética (obtiene el job_id = document_id) ──
    files = {"file": ("calibracion_mn7.md", DOC_SINTETICO.encode("utf-8"), "text/markdown")}
    r = c.post("/ingesta/documents", files=files, headers=H)
    cot = r.json() if r.status_code == 200 else {}
    job_id = cot.get("job_id")
    aprobado = cot.get("requiere_confirmacion") is True
    check("ingesta cotizada (aprobada, pendiente de confirmar)",
          bool(job_id) and aprobado,
          f"HTTP {r.status_code} job={job_id} decision={(cot.get('cotizacion') or {}).get('decision')}")
    if not job_id or not aprobado:
        return _resumen()

    # La consulta se tag-ea con entidad = job_id: ese es el document_id que el
    # worker invalidará al terminar la ingesta (doc CCP §5.3).
    pregunta = "¿cada cuánto se calibra el manómetro MN-7 y cuál es su tolerancia?"
    cuerpo = {"texto": pregunta, "canal": "pwa", "entidad_id": job_id,
              "tipo_documento": "manual_tecnico", "score_confianza": 0.95}

    # ── 1) CACHE HIT — miss, luego hit ───────────────────────────────────────
    r1 = c.post("/mo/query", json=cuerpo, headers=H)
    ccp1 = _ccp(r1.json())
    check("consulta #1 servida (cache miss)",
          r1.status_code == 200 and ccp1.get("cache_hit") is False,
          f"HTTP {r1.status_code} modo={ccp1.get('modo_respuesta')} hit={ccp1.get('cache_hit')}")
    r2 = c.post("/mo/query", json=cuerpo, headers=H)
    ccp2 = _ccp(r2.json())
    check("consulta #2 idéntica → CACHE HIT",
          r2.status_code == 200 and ccp2.get("cache_hit") is True
          and ccp2.get("modo_respuesta") == "cache_hit",
          f"HTTP {r2.status_code} modo={ccp2.get('modo_respuesta')} "
          f"hit={ccp2.get('cache_hit')} sim={ccp2.get('similitud_cache')}")
    check("similitud del hit ≥ 0.92",
          isinstance(ccp2.get("similitud_cache"), (int, float))
          and ccp2.get("similitud_cache") >= 0.92,
          f"sim={ccp2.get('similitud_cache')}")

    # ── 2) INVALIDACIÓN VIVA — confirmar ingesta → worker → invalida [job_id] ─
    r = c.post(f"/ingesta/documents/{job_id}/confirm", headers=H)
    check("ingesta confirmada (encolada al worker)", r.status_code == 200, f"HTTP {r.status_code}")

    estado, t0 = None, time.time()
    while time.time() - t0 < POLL_TIMEOUT_S:
        s = c.get(f"/ingesta/documents/{job_id}", headers=H)
        estado = (s.json() or {}).get("status") if s.status_code == 200 else None
        if estado in ("completed", "failed", "rejected"):
            break
        time.sleep(10)
    detalle_job = ""
    if estado != "completed":
        sj = c.get(f"/ingesta/documents/{job_id}", headers=H).json()
        detalle_job = f"status={estado} error={sj.get('error')}"
    check("ingesta sintética completada por el worker", estado == "completed",
          detalle_job or f"status={estado} (≤{POLL_TIMEOUT_S}s)")

    if estado == "completed":
        # Dar un instante al worker para cerrar la invalidación tras finalize().
        time.sleep(3)
        r3 = c.post("/mo/query", json=cuerpo, headers=H)
        ccp3 = _ccp(r3.json())
        check("consulta tras ingesta → CACHE MISS (invalidación viva)",
              r3.status_code == 200 and ccp3.get("cache_hit") is False,
              f"HTTP {r3.status_code} modo={ccp3.get('modo_respuesta')} hit={ccp3.get('cache_hit')}")

    # ── 3) MÉTRICAS — agregar el día (mismo código del scheduler) + endpoint ──
    hoy = dt.datetime.now(dt.timezone.utc).date()
    try:
        from app.audit.fat_extendido import FATExtendido
        from app.audit.stores import SupabaseFATStore
        from app.pcl.pcl_metrics import PCLMetrics, SupabasePCLMetricsStore

        # Los eventos F4 `consulta_servida` residen en Supabase (HybridFATStore
        # rutea F4/F5/F6/F9 a Supabase); para correr la agregación DESDE FUERA de
        # la red privada de Fly se usa el store Supabase-only (FalkorDB es
        # .internal, inalcanzable desde aquí). El scheduler en el servidor usa el
        # store híbrido — equivalente para estos eventos.
        metrics = PCLMetrics(store=SupabasePCLMetricsStore(), fat=FATExtendido(SupabaseFATStore()))
        fila = metrics.agregar_diario(org_id, hoy)
        check("agregación diaria PCL (FAT F4 → pcl_metrics_daily)",
              fila.get("consultas_totales", 0) > 0,
              f"totales={fila.get('consultas_totales')} hit={fila.get('consultas_cache_hit')} "
              f"retr={fila.get('consultas_retrieval_first')} synth={fila.get('consultas_synthesis_first')}")
    except Exception as e:  # noqa: BLE001
        check("agregación diaria PCL (FAT F4 → pcl_metrics_daily)", False,
              f"{type(e).__name__}: {e}")

    r = c.get("/admin/pcl/metrics",
              params={"desde": hoy.isoformat(), "hasta": hoy.isoformat()}, headers=H)
    body = r.json() if r.status_code == 200 else {}
    tot = (body or {}).get("totales") or {}
    check("GET /admin/pcl/metrics devuelve agregados",
          r.status_code == 200 and tot.get("consultas_totales", 0) > 0,
          f"HTTP {r.status_code} totales={tot.get('consultas_totales')} "
          f"hit_ratio={tot.get('cache_hit_ratio')} "
          f"costo_prom={tot.get('costo_promedio_por_consulta')}")

    return _resumen()


def _resumen() -> int:
    fails = [n for n, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(fails)}/{len(RESULTS)} PASS ==")
    if fails:
        print("FAILS:", ", ".join(fails))
        return 1
    print("== SMOKE PROD B8.5 (CCP/PCL) OK ==")
    return 0


if __name__ == "__main__":
    sys.exit(main())
