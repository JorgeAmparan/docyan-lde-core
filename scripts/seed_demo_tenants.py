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


def _doc_spec(entry) -> dict:
    """Normaliza una entrada del manifiesto a {path, tipo, nombre}.

    Acepta una ruta string (compat) o un objeto:
        {"path": "...", "tipo": "manual_tecnico", "nombre": "Mitutoyo 500 — Manual"}
    `tipo` fuerza el schema de extracción; `nombre` es el NOMBRE DISPLAY que verá la
    cita (atribución legible: el cert deja de citarse como "lab_..._cert.pdf").
    """
    if isinstance(entry, str):
        return {"path": entry, "tipo": None, "nombre": None}
    return {"path": entry["path"], "tipo": entry.get("tipo"), "nombre": entry.get("nombre")}


def _reset_documento(tenant_id: str, content_sha256: str) -> None:
    """Borra el `:DocumentoSource` del grafo + limpia la marca de idempotencia ANTES
    de re-encolar el MISMO archivo. Sin esto, re-subir el mismo contenido hace
    idempotency-skip (el worker cierra el job `completed` reusando el resultado viejo,
    sin re-extraer) — el footgun del 'wipe salta la idempotencia' (ED-0e/B13.3). El
    `doc_id` en el grafo ES el content_sha256 (verificado). Best-effort: si el doc no
    existe en el grafo, `eliminar_documento` no falla."""
    from app.graph import dkg_documents
    from app.ingesta.providers import get_dispatcher
    from app.onboarding import providers as onb

    try:
        dkg_documents.eliminar_documento(onb.get_dkg(), tenant_id, content_sha256)
    except Exception as exc:  # noqa: BLE001 — grafo sin ese doc ⇒ nada que borrar
        print(f"    · reset grafo: {type(exc).__name__} (¿doc inexistente?) — sigo")
    get_dispatcher().borrar_idempotencia(tenant_id, content_sha256)
    print(f"    · reset OK (grafo + idempotencia) sha={content_sha256[:12]}")


def _ingest_one(
    tenant_id: str,
    spec: dict,
    *,
    dry_run: bool,
    tipo_override: str | None = None,
    reset: bool = False,
) -> dict:
    """Cotiza y (si no es dry-run) confirma+encola la ingesta de un documento.

    `spec` = {path, tipo, nombre}. El `tipo` por-doc del manifiesto manda sobre el
    `tipo_override` global (CLI) y sobre el heurístico — p. ej. un manual de operación
    que el heurístico clasifica como `especificacion` pero debe ir como `manual_tecnico`
    para extraer `:Procedimiento`. `nombre` fija la atribución display de la cita.

    `reset=True` borra el doc del grafo + idempotencia antes de re-encolar (para
    RE-INGERIR el mismo archivo, p. ej. el LS-400 con OCR forzado por env en el worker).
    """
    import hashlib
    import uuid

    from app.ingesta.providers import get_cotizador, get_dispatcher, get_document_store
    from app.ingesta.text_extract import extraer_texto
    from app.jobs.job_models import CotizacionSnapshot, IngestJob

    path = Path(spec["path"])
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
    tipo_documento = spec.get("tipo") or tipo_override or tipo_heuristico
    # Nombre display de la cita (B13.3 §2.3/§2.5): el del manifiesto, o el filename.
    nombre_display = spec.get("nombre") or path.name

    # ED-0b §5: v2.1 retiró el wallet prepagado (la 022 dropeó `tenant_budget`), así
    # que YA NO se provisiona saldo (el viejo `BudgetManager.ensure_budget` rompía
    # contra una tabla inexistente). El gate vigente es el cotizador + cupo: los
    # tenants demo se ingieren dentro de cupo freemium con confirmación explícita.
    cot = get_cotizador().cotizar(
        tenant_id=tenant_id, texto_documento=texto, tipo_documento=tipo_documento
    )
    if not cot.aprobado:
        return {"doc": nombre_display, "ok": False, "motivo": cot.motivo}
    if dry_run:
        return {"doc": nombre_display, "ok": True, "dry_run": True,
                "tipo": tipo_documento, "costo_usd": cot.costo_estimado_usd}

    content_sha256 = hashlib.sha256(data).hexdigest()
    if reset:
        _reset_documento(tenant_id, content_sha256)

    store = get_document_store()
    ref = store.put(tenant_id, path.name, data)
    job = IngestJob(
        job_id=uuid.uuid4().hex, tenant_id=tenant_id, documento_ref=ref,
        nombre_archivo=nombre_display, content_sha256=content_sha256,
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
    disp.confirmar(job.job_id)  # v2.1: encola hacia el worker (sin reserva de saldo)
    return {"doc": nombre_display, "ok": True, "job_id": job.job_id,
            "tipo": tipo_documento, "costo_usd": cot.costo_estimado_usd}


def main() -> int:
    ap = argparse.ArgumentParser(description="Siembra de tenants demo (F3 §E).")
    ap.add_argument("--manifest", required=True, help="JSON {tenant_id: [paths]}")
    ap.add_argument("--dry-run", action="store_true", help="Solo cotiza, no encola.")
    ap.add_argument("--tipo", default=None, help="Forzar tipo_documento (schema), p. ej. manual_tecnico.")
    ap.add_argument("--reset", action="store_true",
                    help="Borra doc del grafo + idempotencia antes de re-encolar "
                         "(RE-INGESTA del mismo archivo, p. ej. LS-400 con OCR forzado).")
    args = ap.parse_args()

    manifest = json.loads(Path(args.manifest).read_text())
    total_ok = total_fail = 0
    for tenant_id, docs in manifest.items():
        print(f"\n── {tenant_id} ({len(docs)} documento(s)) ──")
        for entry in docs:
            spec = _doc_spec(entry)
            p = Path(spec["path"])
            if not p.exists():
                print(f"  ✗ {spec['path']}: NO EXISTE (PENDIENTE DE JORGE — provee el archivo)")
                total_fail += 1
                continue
            try:
                res = _ingest_one(tenant_id, spec, dry_run=args.dry_run,
                                  tipo_override=args.tipo, reset=args.reset)
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
