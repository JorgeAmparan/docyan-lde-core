# Onboarding de desarrollo local — DOCYAN LDE™

Notas para correr el backend y los tests en una Mac de desarrollo. No reemplaza
`.env.example` (fuente canónica de variables); documenta los **gotchas locales**
que no son obvios.

## FalkorDB: puerto 6379, no 6381

`.env.example` declara el valor correcto:

```
FALKOR_HOST=localhost
FALKOR_PORT=6379
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
```

**6379 es el puerto correcto.** Es donde corre el contenedor FalkorDB local
(`xcid-falkordb`) y coincide con CI (que setea `FALKORDB_HOST=localhost` sin
puerto → default 6379) y con `fly.graph.toml` en producción.

### Síntoma si tu `.env` local tiene 6381

`app/graph/dkg_client.py` llama `load_dotenv()` **sin `override`**, así que una
variable de shell sin exportar deja ganar al `.env`. Si tu `.env` personal trae
`FALKORDB_PORT=6381` (puerto que **no** está levantado), todos los tests de
integración del DKG/DTM se marcan **SKIP** en silencio — parece que pasan, pero
no se ejecutaron.

**Corrección:** pon `6379` en tu `.env` local, o exporta el override antes de
pytest:

```bash
FALKORDB_PORT=6379 FALKOR_PORT=6379 ./venv/bin/python -m pytest -q
```

> El `.env` personal NO está versionado: cada quien corrige el suyo. El valor
> de verdad es `.env.example` (6379). No hay ninguna referencia a 6381 en
> código, scripts ni docs — era solo configuración local desalineada.

### Grafo desplegado (smoke / debug contra Fly)

```bash
fly proxy 16379:6379 -a docyan-lde-graph
# luego, en otra shell:
FALKORDB_PORT=16379 ./venv/bin/python -m pytest -q tests/test_dkg_integration.py
```

## Gatekeeper / syspolicyd: la suite "se cuelga" en collection

Tras un `kill -9` masivo de procesos Python (o escribir muchos archivos
nuevos), macOS `syspolicyd`/XProtect re-verifica cada site-package en la
siguiente lectura. Síntoma: `import pytest` tarda 60-90 s a ~0 % CPU y la suite
parece colgada al recolectar. **No es un cuelgue de código** (`python -c
"print('ok')"` corre en <0.1 s).

- Evita tormentas de `kill -9`; usa `kill` (SIGTERM) normal.
- Cuando pase, la corrida autoritativa de la **suite completa es CI** (Linux,
  sin Gatekeeper). Subconjuntos "tibios" (un archivo de test) corren bien.

## Toolchain de calidad

```bash
./venv/bin/python -m ruff check app/ tests/
./venv/bin/python -m mypy app/graph/ app/ingesta/ app/schemas_documentales/   # strict en camino crítico
./venv/bin/python -m pytest -q
```

mypy corre en CI como job propio (ver `.github/workflows/ci.yml`). Configuración
por módulo en `pyproject.toml` (`[tool.mypy]` + overrides): `strict` en el
camino crítico MVP, `ignore_errors` en módulos legacy fuera de alcance.
