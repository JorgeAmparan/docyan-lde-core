#!/usr/bin/env python3
"""
Aplicador de migraciones SQL a Postgres/Supabase (B2.2).

DOCYAN LDE™ by XCID.

Aplica los archivos `migrations/NNN_*.sql` en orden contra la base de datos
Postgres de Supabase, en una transacción por archivo. Idempotente: si un objeto
ya existe (tabla/policy/función), lo reporta como "ya aplicada" y sigue.

Por qué este script y no PostgREST/supabase-py: las migraciones son DDL
(CREATE TABLE, ENABLE ROW LEVEL SECURITY, CREATE POLICY, CREATE FUNCTION,
CREATE TRIGGER). PostgREST y el cliente supabase-py NO ejecutan DDL — solo CRUD
sobre tablas existentes. Hace falta una conexión Postgres directa.

CONEXIÓN (una de estas):
  - `SUPABASE_DB_URL` = cadena Postgres completa. Formatos válidos:
      Direct:  postgresql://postgres:<DB_PASSWORD>@db.<ref>.supabase.co:5432/postgres
      Pooler:  postgresql://postgres.<ref>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
    (Supabase Dashboard → Project Settings → Database → Connection string.)
  - El `<DB_PASSWORD>` es el password de Postgres del proyecto, NO el
    SUPABASE_SERVICE_KEY (que es un JWT y no sirve para conectarse a Postgres).

USO:
    export SUPABASE_DB_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"
    python scripts/apply_migrations.py                 # aplica todas las pendientes
    python scripts/apply_migrations.py 008 009         # aplica solo esas
    python scripts/apply_migrations.py --verify         # solo verifica, no aplica

Salida: una línea por migración (APPLIED / ALREADY / FAILED) + verificación final
de tablas. Exit 0 si todo OK, 1 si algo falló.
"""
from __future__ import annotations

import glob
import os
import sys

try:
    import psycopg
except ImportError:
    print("ERROR: falta psycopg. Instala con: pip install 'psycopg[binary]'", file=sys.stderr)
    sys.exit(2)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS_DIR = os.path.join(REPO, "migrations")

# Tablas esperadas tras aplicar (para verificación). Las 15 del MVP (001→013) +
# las 2 de la CCP/PCL (015). 001 crea 2 (users, refresh_tokens); 013 crea 2
# (fat_retention_policy, configuracion_grg) además de extender audit_trail (004)
# de forma aditiva; 015 crea pcl_metrics_daily + pcl_cache_config (B8.5).
EXPECTED_TABLES = {
    "001a": "users",
    "001b": "refresh_tokens",
    "002": "documents",
    "003": "entities",
    "004": "audit_trail",
    "005": "governance_rules",
    "006": "quarantine",
    "007": "api_keys",
    "008": "tenant_budget",
    "009": "tenant_schemas",
    "010": "dtm_projects",
    "011": "sessions_completed",
    "012": "qr_tokens",
    "013a": "fat_retention_policy",
    "013b": "configuracion_grg",
    "015a": "pcl_metrics_daily",
    "015b": "pcl_cache_config",
    "016a": "platform_admins",
    "016b": "org_billing",
    "016c": "access_codes",
    "020a": "orgs",
    "020b": "invitations",
}

# Errores de "ya existe" que tratamos como idempotentes.
_DUPLICATE_SQLSTATES = {
    "42P07",  # duplicate_table
    "42710",  # duplicate_object (policy, trigger)
    "42723",  # duplicate_function
    "42P06",  # duplicate_schema
    "42701",  # duplicate_column
}


def _conn_str() -> str:
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        print(
            "ERROR: define SUPABASE_DB_URL con la cadena Postgres del proyecto.\n"
            "  Supabase Dashboard → Project Settings → Database → Connection string.\n"
            "  Ojo: NO es el SUPABASE_SERVICE_KEY (JWT); es el password de Postgres.",
            file=sys.stderr,
        )
        sys.exit(2)
    return url


def _select_migrations(args: list[str]) -> list[str]:
    files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    nums = [a for a in args if a.isdigit() or (len(a) == 3 and a.isdigit())]
    if nums:
        files = [f for f in files if any(os.path.basename(f).startswith(n) for n in nums)]
    return files


def _table_exists(cur, table: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = %s",
        (table,),
    )
    return cur.fetchone() is not None


def verify(conn) -> bool:
    ok = True
    with conn.cursor() as cur:
        for num, table in EXPECTED_TABLES.items():
            exists = _table_exists(cur, table)
            print(f"  verify {num}: public.{table} → {'OK' if exists else 'MISSING'}")
            ok = ok and exists
    return ok


LEDGER_TABLE = "schema_migrations"


def _ensure_ledger(conn) -> None:
    """Crea el registro de migraciones aplicadas (idempotente)."""
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            f"CREATE TABLE IF NOT EXISTS {LEDGER_TABLE} ("
            "filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )


def _record_applied(conn, name: str) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {LEDGER_TABLE} (filename) VALUES (%s) ON CONFLICT (filename) DO NOTHING",
            (name,),
        )


def _ledger_applied(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT filename FROM {LEDGER_TABLE}")
        return {r[0] for r in cur.fetchall()}


def check_pending(conn) -> list[str]:
    """
    Migraciones presentes en disco que NO están registradas como aplicadas.
    Detección de DRIFT exacta y auto-mantenida (no depende de una lista de tablas
    escrita a mano — esa es justo la razón por la que 018 pasó inadvertida).
    """
    applied = _ledger_applied(conn)
    files = [os.path.basename(f) for f in sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))]
    return [f for f in files if f not in applied]


def apply_file(conn, path: str) -> str:
    name = os.path.basename(path)
    with open(path, encoding="utf-8") as fh:
        sql = fh.read()
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(sql)
        return f"APPLIED  {name}"
    except psycopg.errors.Error as e:
        sqlstate = getattr(e, "sqlstate", None)
        if sqlstate in _DUPLICATE_SQLSTATES:
            return f"ALREADY  {name} (objeto ya existe: {sqlstate})"
        return f"FAILED   {name}: [{sqlstate}] {str(e).splitlines()[0]}"


def main(argv: list[str]) -> int:
    verify_only = "--verify" in argv
    check_only = "--check" in argv
    args = [a for a in argv if not a.startswith("--")]

    conn_str = _conn_str()
    print(f"Conectando a Postgres… (host: {conn_str.split('@')[-1].split('/')[0]})")
    with psycopg.connect(conn_str, connect_timeout=15) as conn:
        _ensure_ledger(conn)

        # ── --check: GATE de drift (usado por el pipeline de deploy) ────────────
        # Falla (exit 1) si HAY migraciones en disco no aplicadas. Así un deploy
        # NO puede declararse verde con la DB desfasada (la 018 sin aplicar habría
        # roto este check). No aplica nada: solo reporta.
        if check_only:
            pending = check_pending(conn)
            for f in pending:
                print(f"  PENDING  {f}")
            if pending:
                print(f"\n❌ {len(pending)} migración(es) pendiente(s) — la DB de prod está desfasada.")
                print("   Aplica con: python scripts/apply_migrations.py")
                return 1
            print("\n✅ Sin migraciones pendientes (DB al día).")
            return 0

        if verify_only:
            return 0 if verify(conn) else 1

        files = _select_migrations(args)
        if not files:
            print("No hay migraciones que aplicar.")
            return 0

        any_failed = False
        for path in files:
            result = apply_file(conn, path)
            print(f"  {result}")
            if result.startswith("FAILED"):
                any_failed = True
            else:
                _record_applied(conn, os.path.basename(path))  # registra en el ledger

        print("\nVerificación final:")
        ok = verify(conn)
        pending = check_pending(conn)
        for f in pending:
            print(f"  PENDING  {f}")
        if any_failed or not ok or pending:
            print("\n❌ Migraciones con errores, tablas faltantes o pendientes.")
            return 1
        print("\n✅ Migraciones aplicadas, registradas y verificadas (sin drift).")
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
