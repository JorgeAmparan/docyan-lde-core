#!/usr/bin/env python3
"""
Backfill de los 5 tipos de solicitud semilla para tenants existentes (ED-2 §2.1).

DOCYAN LDE™ by XCID.

El onboarding siembra el catálogo base al crear una org nueva; este script cubre
los tenants YA existentes (creados antes de ED-2 o por `/auth/register`).
Idempotente: `asegurar_semilla` solo crea las claves base que falten en el tenant.
El propio listado del catálogo (`GET /tipos-solicitud`) también re-asegura la
semilla, así que este script es una comodidad operativa, no un requisito.

Enumera el conjunto REAL de tenants vivos (`providers.tenants_vivos`) y siembra en
Supabase (tabla `tipos_solicitud`).

USO:
    python scripts/backfill_tipos_solicitud.py            # siembra todos
    python scripts/backfill_tipos_solicitud.py --dry-run  # solo lista
"""

from __future__ import annotations

import sys


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    from app.orchestrator import providers
    from app.solicitudes.tipos import (
        SEMILLA_BASE,
        SupabaseTipoSolicitudStore,
        asegurar_semilla,
    )

    store = SupabaseTipoSolicitudStore()
    tenants = providers.tenants_vivos()
    print(f"Tenants vivos: {len(tenants)}")
    creados_total = 0
    ya_tenian = 0
    errores = 0
    for tid in tenants:
        try:
            if dry_run:
                claves = {t.clave for t in store.listar(tid) if t.clave}
                faltan = [s["clave"] for s in SEMILLA_BASE if s["clave"] not in claves]
                print(f"  {tid}: sembraría {faltan or '—'}")
                continue
            creadas = asegurar_semilla(store, tid)
            if creadas:
                creados_total += creadas
                print(f"  {tid}: SEMBRADOS {creadas} tipo(s) base")
            else:
                ya_tenian += 1
                print(f"  {tid}: ya tenía el catálogo (sin cambio)")
        except Exception as exc:  # noqa: BLE001 — un tenant no tumba el backfill.
            errores += 1
            print(f"  {tid}: ERROR {type(exc).__name__}: {exc}", file=sys.stderr)

    if not dry_run:
        print(
            f"\nTipos creados: {creados_total} · Tenants ya con catálogo: {ya_tenian} "
            f"· Errores: {errores}"
        )
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
