#!/usr/bin/env python3
"""
Crea (idempotente) el bucket privado de Supabase Storage para los backups del FAT.

DOCYAN LDE™ by XCID — B7.

La rutina de retención (`app/audit/retention.py` → `SupabaseStorageBackupSink`)
sube el export JSON de los eventos vencidos a este bucket y lo re-descarga para
verificar ANTES de eliminar nada. Bucket: `fat-backups`, PRIVADO (no público) —
contiene trazas de auditoría reguladas (retención 2-7 años, decisión #12).

Uso:
    export SUPABASE_URL=... SUPABASE_SERVICE_KEY=...
    python scripts/ensure_fat_backup_bucket.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.audit.retention import FAT_BACKUP_BUCKET  # noqa: E402


def main() -> int:
    from supabase import create_client

    from app.core.supabase_client import require_supabase_config

    url, key = require_supabase_config("ensure_fat_backup_bucket", service=True)
    sb = create_client(url, key)

    existentes = {b.name for b in sb.storage.list_buckets()}
    if FAT_BACKUP_BUCKET in existentes:
        print(f"OK: bucket '{FAT_BACKUP_BUCKET}' ya existe (privado).")
        return 0

    sb.storage.create_bucket(FAT_BACKUP_BUCKET, options={"public": False})
    print(f"CREADO: bucket privado '{FAT_BACKUP_BUCKET}'.")
    # Verificación: aparece en el listado.
    existentes = {b.name for b in sb.storage.list_buckets()}
    if FAT_BACKUP_BUCKET not in existentes:
        print("ERROR: el bucket no aparece tras crearlo.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
