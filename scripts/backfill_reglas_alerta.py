#!/usr/bin/env python3
"""
Backfill de `ReglaAlerta` default para tenants existentes (ED-1 §2.3.1).

DOCYAN LDE™ by XCID.

El onboarding siembra la regla default de alertas al crear una org nueva; este
script cubre los tenants YA existentes (creados antes de ED-1 o por la ruta
`/auth/register`, que no provisiona artefactos). Idempotente: `sembrar_reglas_default`
no toca un tenant que ya tiene reglas.

Enumera el conjunto REAL de tenants vivos (`tenants_vivos`: unión de users.org_id +
api_keys activas) y siembra en el grafo de cada uno.

USO:
    python scripts/backfill_reglas_alerta.py            # siembra todos
    python scripts/backfill_reglas_alerta.py --dry-run  # solo lista
"""
from __future__ import annotations

import sys


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    from app.alerts.reglas import listar_reglas, sembrar_reglas_default
    from app.graph.dkg_client import dkg_client
    from app.orchestrator import providers

    tenants = providers.tenants_vivos()
    print(f"Tenants vivos: {len(tenants)}")
    sembrados = 0
    ya_tenian = 0
    errores = 0
    for tid in tenants:
        try:
            if dry_run:
                existentes = listar_reglas(dkg_client, tid)
                estado = "YA TIENE" if existentes else "sembraría"
                print(f"  {tid}: {estado}")
                continue
            if sembrar_reglas_default(dkg_client, tid):
                sembrados += 1
                print(f"  {tid}: SEMBRADA regla default")
            else:
                ya_tenian += 1
                print(f"  {tid}: ya tenía reglas (sin cambio)")
        except Exception as exc:  # noqa: BLE001 — un tenant no tumba el backfill.
            errores += 1
            print(f"  {tid}: ERROR {type(exc).__name__}: {exc}", file=sys.stderr)

    if not dry_run:
        print(f"\nSembrados: {sembrados} · Ya tenían: {ya_tenian} · Errores: {errores}")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
