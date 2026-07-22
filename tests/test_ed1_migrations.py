"""
ED-1 — Migraciones 023/024/025 sobre PostgreSQL LIMPIO.

Aplica TODA la cadena de migraciones (001→025) y verifica las tablas nuevas de
ED-1 (`destinatarios`, `notificaciones`): existencia, RLS, política de aislamiento
por tenant y columnas clave. Además verifica que la 025 sembró la política de
retención de la familia F10 en `fat_retention_policy`.

Se salta (no falla) si no hay PostgreSQL alcanzable (mismo criterio que
tests/test_migrations.py).
"""
from __future__ import annotations

import glob
import os
import pathlib

import pytest

psycopg = pytest.importorskip("psycopg")

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"

# Cadena completa en disco (evita hardcodear la lista; ED-1 añade 023-025).
MIGRATION_FILES = [os.path.basename(f) for f in sorted(glob.glob(str(MIGRATIONS_DIR / "*.sql")))]

NEW_TABLES = {
    "destinatarios": ["id", "org_id", "tipo", "nombre", "email", "empresa",
                      "usuario_id", "miembros", "categorias", "activo"],
    "notificaciones": ["id", "org_id", "usuario_id", "tipo_evento", "evento_ref",
                       "destinatario_id", "canal", "titulo", "cuerpo", "leida",
                       "estado", "error", "created_at", "leida_at"],
}

DEFAULT_URL = "postgresql://postgres:test@localhost:55432/docyan_test"


def _db_url() -> str:
    return os.getenv("TEST_DATABASE_URL", DEFAULT_URL)


@pytest.fixture(scope="module")
def clean_db():
    url = _db_url()
    try:
        conn = psycopg.connect(url, connect_timeout=5)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"PostgreSQL no alcanzable en {url} ({e}).")
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE;")
        cur.execute("CREATE SCHEMA public;")
        cur.execute("GRANT ALL ON SCHEMA public TO public;")
        for fname in MIGRATION_FILES:
            sql = (MIGRATIONS_DIR / fname).read_text(encoding="utf-8")
            cur.execute(sql)
    yield conn
    conn.close()


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_tabla_existe(clean_db, table):
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=%s;", (table,)
        )
        assert cur.fetchone() is not None, f"tabla {table} no existe"


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_rls_habilitado(clean_db, table):
    with clean_db.cursor() as cur:
        cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||%s)::regclass;", (table,))
        row = cur.fetchone()
        assert row is not None and row[0] is True, f"RLS no habilitado en {table}"


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_politica_de_tenant(clean_db, table):
    with clean_db.cursor() as cur:
        cur.execute("SELECT count(*) FROM pg_policies WHERE tablename=%s;", (table,))
        assert cur.fetchone()[0] >= 1, f"sin política de aislamiento en {table}"


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_columnas_esperadas(clean_db, table):
    expected = NEW_TABLES[table]
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s;", (table,)
        )
        actual = {r[0] for r in cur.fetchall()}
    missing = set(expected) - actual
    assert not missing, f"{table}: faltan columnas {missing}"


def test_retencion_f10_sembrada(clean_db):
    with clean_db.cursor() as cur:
        cur.execute("SELECT anios_retencion FROM fat_retention_policy WHERE familia='F10';")
        row = cur.fetchone()
        assert row is not None and row[0] == 3, "retención F10 no sembrada (migración 025)"
