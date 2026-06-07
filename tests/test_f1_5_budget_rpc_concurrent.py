"""
F1.5 (cierre) — Atomicidad del débito bajo concurrencia (RPC de Postgres, 018).

El saldo es dinero: las operaciones reservar/liquidar/liberar deben ser
indivisibles por descuento. Este test ejercita la condición de carrera REAL sobre
el mismo tenant disparando RPCs concurrentes desde N conexiones y verifica:
  · reservar NO sobre-vende: con saldo para K reservas, exactamente K tienen éxito
    bajo 5×K intentos concurrentes; el disponible nunca queda negativo.
  · liberar NO pierde actualizaciones: K liberaciones concurrentes devuelven el
    saldo exacto (invariante disponible + retenido conservado).

Requiere PostgreSQL (igual que test_migrations): usa TEST_DATABASE_URL o el
contenedor local por defecto; si no hay DB, SKIP explícito (no verde falso).
"""
import os
import pathlib
import threading

import pytest

psycopg = pytest.importorskip("psycopg")

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"
# Mínimo necesario para el saldo + RPC: documents/tenant_budget (017 altera ambas)
# y las funciones (018). No requiere pgvector.
NEEDED = [
    "002_documents.sql",
    "008_tenant_budget.sql",
    "017_debito_y_metricas.sql",
    "018_budget_rpc.sql",
]
DEFAULT_URL = "postgresql://postgres:test@localhost:55432/docyan_test"
TENANT = "tenant-concurrente"


def _db_url() -> str:
    return os.getenv("TEST_DATABASE_URL", DEFAULT_URL)


@pytest.fixture
def db():
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
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE;")
        cur.execute("CREATE SCHEMA public;")
        cur.execute("GRANT ALL ON SCHEMA public TO public;")
        for fname in NEEDED:
            cur.execute((MIGRATIONS_DIR / fname).read_text(encoding="utf-8"))
    yield conn, url
    conn.close()


def _seed(conn, saldo: float, retenido: float = 0.0):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM tenant_budget WHERE tenant_id = %s;", (TENANT,))
        cur.execute(
            "INSERT INTO tenant_budget (tenant_id, saldo_actual_usd, retenido_usd) "
            "VALUES (%s, %s, %s);",
            (TENANT, saldo, retenido),
        )


def _balances(conn) -> tuple[float, float]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT saldo_actual_usd, retenido_usd FROM tenant_budget WHERE tenant_id = %s;",
            (TENANT,),
        )
        row = cur.fetchone()
        return float(row[0]), float(row[1])


def _run_concurrent(url: str, n: int, fn):
    """Dispara `fn(conn)` en N hilos, cada uno con su propia conexión, sincronizados
    por una barrera para maximizar la contención. Devuelve la lista de resultados."""
    barrier = threading.Barrier(n)
    resultados: list = [None] * n

    def _worker(i: int):
        c = psycopg.connect(url, connect_timeout=5)
        c.autocommit = True
        try:
            barrier.wait()
            resultados[i] = fn(c)
        finally:
            c.close()

    hilos = [threading.Thread(target=_worker, args=(i,)) for i in range(n)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    return resultados


def test_reservar_concurrente_no_sobrevende(db):
    conn, url = db
    # Saldo para exactamente 10 reservas de $1; 50 intentos concurrentes.
    _seed(conn, saldo=10.0)
    K, INTENTOS = 10, 50

    def _reservar(c):
        with c.cursor() as cur:
            cur.execute("SELECT out_ok, out_disponible FROM budget_reservar(%s, %s::numeric);",
                        (TENANT, 1.0))
            ok, disp = cur.fetchone()
            assert float(disp) >= 0.0, "el disponible NUNCA debe quedar negativo"
            return bool(ok)

    res = _run_concurrent(url, INTENTOS, _reservar)
    exitosos = sum(1 for r in res if r)
    assert exitosos == K, f"oversell/undersell: {exitosos} reservas (esperadas {K})"
    disp, ret = _balances(conn)
    assert disp == 0.0 and ret == 10.0  # todo el saldo quedó retenido, nada de más


def test_liberar_concurrente_no_pierde_actualizaciones(db):
    conn, url = db
    # 10 reservas vivas (disponible 0, retenido 10); 10 liberaciones concurrentes.
    _seed(conn, saldo=0.0, retenido=10.0)

    def _liberar(c):
        with c.cursor() as cur:
            cur.execute("SELECT out_disponible, out_retenido FROM budget_liberar(%s, %s::numeric);",
                        (TENANT, 1.0))
            return cur.fetchone()

    _run_concurrent(url, 10, _liberar)
    disp, ret = _balances(conn)
    # Sin lost updates: las 10 liberaciones se aplican íntegras.
    assert disp == 10.0 and ret == 0.0


def test_liquidar_concurrente_conserva_el_total(db):
    conn, url = db
    # 10 reservas vivas; 10 liquidaciones concurrentes a costo real $0.40 c/u.
    _seed(conn, saldo=0.0, retenido=10.0)

    def _liquidar(c):
        with c.cursor() as cur:
            cur.execute(
                "SELECT out_disponible, out_retenido FROM budget_liquidar(%s, %s::numeric, %s::numeric);",
                (TENANT, 1.0, 0.40),
            )
            return cur.fetchone()

    _run_concurrent(url, 10, _liquidar)
    disp, ret = _balances(conn)
    # Cada liquidación: retenido -1, disponible +(1-0.4)=+0.6. Total: ret 0, disp 6.0.
    assert ret == 0.0 and disp == pytest.approx(6.0)
