"""
Tests de migraciones SQL (B0).

Aplica las migraciones 001→007 sobre una base PostgreSQL+pgvector LIMPIA y verifica,
por cada tabla nueva (002-007):
  - la tabla existe,
  - RLS está habilitado,
  - existe una política de aislamiento multi-tenant,
  - las columnas clave que el código usa están presentes.

Además verifica que la función RPC match_entities() (que invoca app/core/edb.py) existe.

Conexión:
  - Usa TEST_DATABASE_URL si está definida (CI provee un service container pgvector).
  - Si no, usa el contenedor local por defecto:
        postgresql://postgres:test@localhost:55432/docyan_test
    que se levanta con:
        docker run -d --name docyan-test-pg -e POSTGRES_PASSWORD=test \
            -e POSTGRES_DB=docyan_test -p 55432:5432 pgvector/pgvector:pg16
  - Si no hay DB alcanzable, los tests se SKIPEAN con mensaje explícito (no se
    reportan como verdes falsos).
"""
import os
import pathlib

import pytest

psycopg = pytest.importorskip("psycopg")

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"

MIGRATION_FILES = [
    "001_users_and_refresh_tokens.sql",
    "002_documents.sql",
    "003_entities.sql",
    "004_audit_trail.sql",
    "005_governance_rules.sql",
    "006_quarantine.sql",
    "007_api_keys.sql",
    "008_tenant_budget.sql",
    "009_tenant_schemas.sql",
    "010_dtm_projects.sql",
    "011_sessions_completed.sql",
    "012_qr_tokens.sql",
    "013_fat_hash_chain.sql",
    "014_playbooks.sql",
    "015_pcl_metrics.sql",
    # 016 (platform_superadmin) crea tablas propias y se verifica aparte (F2).
    "017_debito_y_metricas.sql",
]

# (tabla, columnas clave que el código de la app referencia)
NEW_TABLES = {
    # size_bytes/result_bytes añadidas en 017 (instrumentación de peso, F1.5).
    "documents": ["id", "org_id", "name", "status", "size_bytes", "result_bytes"],
    "entities": ["id", "org_id", "document_id", "entity_class",
                 "entity_value", "data_text", "knowledge_triple", "embedding", "status"],
    "audit_trail": ["id", "org_id", "document_id", "entity_id", "component",
                    "action", "actor", "before_value", "after_value", "detail",
                    # B7 — columnas del :EventoFAT + hash chain (013, aditivas).
                    "tipo_evento", "familia", "actor_tipo", "entidad_afectada_tipo",
                    "entidad_afectada_id", "payload", "metadata",
                    "hash_evento", "hash_evento_anterior", "corrige_evento_id"],
    "governance_rules": ["id", "org_id", "entity_class", "rule_type",
                         "condition", "action", "is_active"],
    "quarantine": ["id", "org_id", "entity_id", "rule_id", "reason", "resolved"],
    "api_keys": ["id", "org_id", "api_key", "email", "org_name", "plan",
                 "stripe_customer_id", "is_active"],
    "tenant_budget": ["id", "tenant_id", "saldo_actual_usd", "retenido_usd",
                      "hard_cap_por_documento", "hard_cap_por_sesion"],
    "tenant_schemas": ["id", "tenant_id", "tipo_documento", "schema_def",
                       "es_generado_dinamicamente", "uso_contador"],
    "dtm_projects": ["id", "tenant_id", "nombre", "par_linguistico", "estado",
                     "tipo_origen", "cliente_id"],
    "sessions_completed": ["id", "tenant_id", "user_id", "session_type", "canal",
                           "started_at", "closed_at", "state", "closed_reason"],
    "qr_tokens": ["id", "tenant_id", "entidad_id_dkg", "nonce", "created_by",
                  "expires_at", "revoked_at", "created_at"],
    # B7 — FAT extendido (013): retención por familia + config GRG por tenant.
    "fat_retention_policy": ["id", "familia", "anios_retencion", "descripcion"],
    "configuracion_grg": ["id", "tenant_id", "tier", "umbrales_f2"],
    # B8 — Playbooks (014): Niveles A/B/C + aprendizaje del rechazo.
    "consultas_guardadas": ["id", "tenant_id", "user_id", "nombre", "consulta_original",
                            "tipo_intencion", "tipo_documento_origen", "entidad_referenciada_id",
                            "metadata", "disparos_totales", "ultimo_disparo_at", "deleted_at"],
    "playbooks": ["id", "tenant_id", "creado_por_user_id", "nombre", "descripcion",
                  "tipo_creacion", "vertical", "disparos_totales", "ultimo_disparo_at",
                  "deleted_at"],
    "playbook_pasos": ["id", "tenant_id", "playbook_id", "orden", "consulta_guardada_id",
                       "nota_paso"],
    "sugerencias_playbook": ["id", "tenant_id", "user_id", "tipo_sugerencia",
                             "consulta_guardada_ids", "evidencia_estructural",
                             "evidencia_conductual", "estado", "decidido_at"],
    "patrones_rechazados_por_usuario": ["id", "tenant_id", "user_id", "firma_patron",
                                        "conteo_rechazos", "ultimo_rechazo_at"],
    # B8.5 — CCP/PCL (015): métricas agregadas + configuración del caché por DoCo.
    "pcl_metrics_daily": ["id", "tenant_id", "fecha", "consultas_totales",
                          "consultas_cache_hit", "consultas_retrieval_first",
                          "consultas_synthesis_first", "costo_total_centavos",
                          "costo_promedio_por_consulta", "costo_promedio_por_consulta_unica",
                          "latencia_p50_ms", "latencia_p95_ms", "top_patrones_detectados",
                          "sugerencias_emitidas", "sugerencias_aceptadas",
                          "sugerencias_rechazadas"],
    "pcl_cache_config": ["tenant_id", "umbral_similitud", "ttl_segundos", "updated_at"],
}

DEFAULT_URL = "postgresql://postgres:test@localhost:55432/docyan_test"


def _db_url() -> str:
    return os.getenv("TEST_DATABASE_URL", DEFAULT_URL)


@pytest.fixture(scope="module")
def clean_db():
    """Conexión a una DB con el schema public recreado y todas las migraciones aplicadas."""
    url = _db_url()
    try:
        conn = psycopg.connect(url, connect_timeout=5)
    except Exception as e:  # noqa: BLE001
        pytest.skip(
            f"PostgreSQL no alcanzable en {url} ({e}). "
            "Levanta el contenedor pgvector o define TEST_DATABASE_URL."
        )

    conn.autocommit = True
    with conn.cursor() as cur:
        # DB limpia: recrear el schema public por completo.
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE;")
        cur.execute("CREATE SCHEMA public;")
        cur.execute("GRANT ALL ON SCHEMA public TO public;")
        # Aplicar migraciones en orden.
        for fname in MIGRATION_FILES:
            sql = (MIGRATIONS_DIR / fname).read_text(encoding="utf-8")
            cur.execute(sql)
    yield conn
    conn.close()


def test_all_migrations_apply_cleanly(clean_db):
    """Todas las migraciones aplican sin error sobre DB limpia (cubierto por el fixture)."""
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
        )
        # 22 tablas: users, refresh_tokens + 6 (002-007) + tenant_budget +
        # tenant_schemas + dtm_projects + sessions_completed (011) + qr_tokens (012)
        # + fat_retention_policy + configuracion_grg (013) + Playbooks (014):
        # consultas_guardadas, playbooks, playbook_pasos, sugerencias_playbook,
        # patrones_rechazados_por_usuario + CCP/PCL (015): pcl_metrics_daily,
        # pcl_cache_config.
        assert cur.fetchone()[0] == 22


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_table_exists(clean_db, table):
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=%s;",
            (table,),
        )
        assert cur.fetchone() is not None, f"tabla {table} no existe"


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_table_has_rls_enabled(clean_db, table):
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT relrowsecurity FROM pg_class "
            "WHERE oid = ('public.' || %s)::regclass;",
            (table,),
        )
        row = cur.fetchone()
        assert row is not None and row[0] is True, f"RLS no habilitado en {table}"


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_table_has_tenant_policy(clean_db, table):
    with clean_db.cursor() as cur:
        cur.execute("SELECT count(*) FROM pg_policies WHERE tablename=%s;", (table,))
        assert cur.fetchone()[0] >= 1, f"sin política de aislamiento en {table}"


@pytest.mark.parametrize("table", sorted(NEW_TABLES.keys()))
def test_table_has_expected_columns(clean_db, table):
    expected = NEW_TABLES[table]
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s;",
            (table,),
        )
        actual = {r[0] for r in cur.fetchall()}
    missing = set(expected) - actual
    assert not missing, f"{table}: faltan columnas {missing}"


def test_match_entities_function_exists(clean_db):
    """La RPC que invoca app/core/edb.py:108 debe existir con esa firma."""
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM pg_proc WHERE proname = 'match_entities';"
        )
        assert cur.fetchone() is not None, "función match_entities ausente"


def test_entities_embedding_is_vector(clean_db):
    """La columna embedding debe ser tipo vector (pgvector) para BGE-M3."""
    with clean_db.cursor() as cur:
        cur.execute(
            "SELECT udt_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='entities' "
            "AND column_name='embedding';"
        )
        row = cur.fetchone()
        assert row is not None and row[0] == "vector", "embedding no es tipo vector"
