#!/usr/bin/env python3
"""
Purga de entradas de caché PCL ENVENENADAS pre-fix (PRIORIDAD 0, paso 2).

Contexto: hasta el commit 5b31f09 (2026-06-15 22:21:17 -0600) el
`contexto_fingerprint` NO incluía `documento_id`. Dos documentos sueltos del
mismo tenant (con `documento_id` vacío en el contexto) compartían bucket, así que
la misma pregunta sobre el documento B podía servir la respuesta cacheada del
documento A. Toda entrada `pcl:cache:*` con `cached_at` anterior al fix está
envenenada por diseño y debe purgarse — en TODOS los tenants.

El caché es una optimización (doc CCP §11): purgarlo NO pierde verdad operativa
(vive en FAT); a lo sumo la siguiente consulta re-paga inferencia una vez.

Uso (contra el Redis de PRODUCCIÓN — requiere REDIS_URL del entorno prod):

    # 1) ver cuántas se purgarían, sin borrar:
    python3 scripts/purge_pcl_prefix.py --dry-run
    # 2) purgar de verdad, todos los tenants:
    python3 scripts/purge_pcl_prefix.py
    # 3) purgar solo un tenant:
    python3 scripts/purge_pcl_prefix.py --tenant <org_id>

NOTA OPERATIVA: este script NO puede ejecutarse desde el entorno local de
desarrollo — el Redis de producción es privado (`docyan-lde-redis.internal`).
Correr desde una consola con acceso a la red de Fly (p.ej. `fly ssh console`
en `docyan-lde-api`, que comparte REDIS_URL).
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

# Fix de fingerprint (`doc=`), commit 5b31f09. Cutoff en UTC.
FIX_ISO_UTC = "2026-06-16T04:21:17+00:00"  # 2026-06-15 22:21:17 -0600


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--cutoff", default=FIX_ISO_UTC,
        help="ISO-8601 con tz. Entradas con cached_at anterior se purgan. "
             f"Default = fecha del fix ({FIX_ISO_UTC}).",
    )
    ap.add_argument("--tenant", default=None, help="Solo este org_id; omitir = todos los tenants.")
    ap.add_argument("--dry-run", action="store_true", help="Solo cuenta; no borra nada.")
    args = ap.parse_args()

    cutoff_epoch = dt.datetime.fromisoformat(args.cutoff).timestamp()

    from app.pcl.pcl_cache import PCLCache, RedisCacheBackend

    cache = PCLCache(backend=RedisCacheBackend())
    res = cache.purgar_anteriores_a(cutoff_epoch, tenant_id=args.tenant, dry_run=args.dry_run)

    alcance = args.tenant or "TODOS los tenants"
    modo = "DRY-RUN (no se borró nada)" if args.dry_run else "PURGA EJECUTADA"
    print(f"[{modo}] alcance={alcance} cutoff={args.cutoff}")
    print(f"  escaneadas={res['escaneadas']}  candidatas_pre_fix={res['purgadas']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
