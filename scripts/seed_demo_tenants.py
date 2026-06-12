#!/usr/bin/env python3.11
"""
Siembra de tenants demo del sitio público (F3 §E + §D).

DOCYAN LDE™ by XCID.

Crea/puebla los tenants demo solo-lectura que alimentan `/demo/[codo]` y el demo
del hero, ingiriendo documentos REALES por el pipeline existente (cotizador →
confirmar → worker). D3: cero CANNED_*; los CoDos demo son tenants reales.

Uso:
    python3.11 scripts/seed_demo_tenants.py --manifest scripts/demo_manifest.json
    python3.11 scripts/seed_demo_tenants.py --dry-run     # solo cotiza, no encola

El manifiesto mapea cada CoDo a sus documentos en disco. Formato:

    {
      "demo-hero":   ["docs/demo/msds_acetona_en.pdf", "docs/demo/sds_solvent_en.pdf"],
      "demo-lab":    ["docs/demo/calibracion_rotina380.pdf", ...],
      "demo-maq":    [...],
      "demo-pharma": [...],
      "demo-min":    [...],
      "demo-agri":   [...]
    }

Los tenant_id deben coincidir con `DEMO_TENANTS` de `app/api/routers/demo.py`
(env DEMO_TENANT_*). El hero usa MSDS en inglés (consulta multilingüe: pregunta en
español, span original en inglés intacto).

PENDIENTE DE JORGE: los archivos del manifiesto. Si no hay documento público de
calidad para un vertical, usar los reales ya verificados (MSDS/calibración/manual)
adaptando el vertical, y reportarlo (no bloquear el sprint).

Este script NO inventa documentos: si el manifiesto referencia un archivo que no
existe, lo reporta y continúa con los demás (no aborta la siembra completa).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# Saldo de cortesía generoso para los tenants demo (cubre el cómputo de la ingesta;
# los demo no pagan setup — su cupo no aplica, ingieren una sola vez en el alta).
DEMO_SALDO_USD = 50.0


def _ingest_one(tenant_id: str, path: Path, *, dry_run: bool, tipo_override: str | None = None) -> dict:
    """Cotiza y (si no es dry-run) confirma+encola la ingesta de un documento.

    `tipo_override` fuerza el `tipo_documento` (schema de extracción) en vez del
    heurístico — p. ej. un manual de operación que el heurístico clasifica como
    `especificacion` pero debe ir como `manual_tecnico` para extraer `:Procedimiento`.
    """
    import hashlib
    import uuid

    from app.ingesta.budget_manager import BudgetManager
    from app.ingesta.providers import get_cotizador, get_dispatcher, get_document_store
    from app.ingesta.text_extract import extraer_texto
    from app.jobs.job_models import CotizacionSnapshot, IngestJob

    data = path.read_bytes()
    texto, _confiable = extraer_texto(data, path.name)

    # CLASIFICACIÓN DEL TIPO DOCUMENTAL — paridad con la ruta API (POST /ingesta/
    # documents). SIN esto el worker no recibe tipo y cae a extracción genérica
    # (__Entity__), saltándose el schema por tipo que produce la ontología DOCYAN
    # (:Especificacion/:TerminoTecnico…) que el retrieval cita. Es la divergencia
    # diagnosticada: la costura de consulta citada (B13.2) exige el schema por tipo.
    from app.ingesta import providers as _prov
    tipo_heuristico, _conf = _prov.get_selector().clasificar_heuristica(
        texto[:8000], path.name
    )
    tipo_documento = tipo_override or tipo_heuristico

    # Asegura saldo de cómputo del tenant demo (sin auto-recharge en prod; aquí lo
    # provisionamos explícitamente para la siembra).
    BudgetManager().ensure_budget(tenant_id, saldo_inicial_usd=DEMO_SALDO_USD)

    cot = get_cotizador().cotizar(
        tenant_id=tenant_id, texto_documento=texto, tipo_documento=tipo_documento
    )
    if not cot.aprobado:
        return {"doc": path.name, "ok": False, "motivo": cot.motivo}
    if dry_run:
        return {"doc": path.name, "ok": True, "dry_run": True,
                "tipo": tipo_documento, "costo_usd": cot.costo_estimado_usd}

    store = get_document_store()
    ref = store.put(tenant_id, path.name, data)
    job = IngestJob(
        job_id=uuid.uuid4().hex, tenant_id=tenant_id, documento_ref=ref,
        nombre_archivo=path.name, content_sha256=hashlib.sha256(data).hexdigest(),
        tipo_documento=tipo_documento,  # ← el worker lo usa para elegir el schema
        bytes_originales=len(data),
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=cot.costo_estimado_usd,
            tiempo_estimado_seg=cot.tiempo_estimado_seg,
            tokens_documento=cot.tokens_documento, aprobado=True,
            decision=cot.decision.value, precio_setup_usd=cot.precio_setup_usd,
        ),
    )
    disp = get_dispatcher()
    disp.crear_job(job)
    disp.confirmar(job.job_id)  # reserva saldo + encola hacia el worker
    return {"doc": path.name, "ok": True, "job_id": job.job_id,
            "tipo": tipo_documento, "costo_usd": cot.costo_estimado_usd}


def main() -> int:
    ap = argparse.ArgumentParser(description="Siembra de tenants demo (F3 §E).")
    ap.add_argument("--manifest", required=True, help="JSON {tenant_id: [paths]}")
    ap.add_argument("--dry-run", action="store_true", help="Solo cotiza, no encola.")
    ap.add_argument("--tipo", default=None, help="Forzar tipo_documento (schema), p. ej. manual_tecnico.")
    args = ap.parse_args()

    manifest = json.loads(Path(args.manifest).read_text())
    total_ok = total_fail = 0
    for tenant_id, docs in manifest.items():
        print(f"\n── {tenant_id} ({len(docs)} documento(s)) ──")
        for rel in docs:
            p = Path(rel)
            if not p.exists():
                print(f"  ✗ {rel}: NO EXISTE (PENDIENTE DE JORGE — provee el archivo)")
                total_fail += 1
                continue
            try:
                res = _ingest_one(tenant_id, p, dry_run=args.dry_run, tipo_override=args.tipo)
            except Exception as exc:  # noqa: BLE001 — un doc no debe tumbar la siembra.
                print(f"  ✗ {p.name}: error {type(exc).__name__}: {exc}")
                total_fail += 1
                continue
            if res["ok"]:
                total_ok += 1
                print(f"  ✓ {res['doc']} [tipo={res.get('tipo')}] "
                      f"{'(dry-run)' if res.get('dry_run') else res.get('job_id','')}"
                      f" ~${res.get('costo_usd', 0):.4f}")
            else:
                total_fail += 1
                print(f"  ✗ {res['doc']}: {res['motivo']}")
            time.sleep(0.1)

    print(f"\nResumen: {total_ok} OK, {total_fail} fallidos.")
    if not args.dry_run and total_ok:
        print("Los jobs quedaron encolados; el worker los procesará. Verifica el "
              "grafo demo con el runbook e2e antes de publicar (regla de encendido B13).")
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
