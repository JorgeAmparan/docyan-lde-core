# Deploy de la topología Fly — un config por app, sin default en la raíz (B2.2)

> **DOCYAN LDE™ by XCID.** Decisión estructural de B2.2 que cierra el bug de
> deploy del worker. Verdad operacional: diagnosticado y verificado el 1-jun-2026.

## El bug (qué pasaba)

`flyctl deploy --config worker/fly.toml --app docyan-lde-ingest` desde la raíz
del repo, en deploy **real** (no `--build-only`), terminaba releaseando la
app/imagen del **backend**. `--build-only` sí construía la imagen correcta del
worker, por eso el error pasó desapercibido en B2.2.

## Causa raíz

Había un `fly.toml` **default en la raíz** (el del backend `docyan-lde-api`).
`flyctl`, al correr desde un directorio que contiene un `fly.toml`, lo trata como
el manifiesto de la app de ese directorio. En el deploy real (build + release),
la resolución de app/imagen terminaba prefiriendo ese default de la raíz sobre el
`--config` pasado, mientras que `--build-only` corta antes de esa fase — de ahí
que build-only funcionara y el deploy real no.

## El arreglo (estructural, no parche)

**Cada app de la topología tiene su propio `fly.<algo>.toml`; NO existe un
`fly.toml` default en la raíz.** Esto ya era la convención a medias (existía
`fly.graph.toml`); se completó:

| App | Config | Ubicación | Build context |
|-----|--------|-----------|---------------|
| `docyan-lde-api` (backend) | `fly.api.toml` | raíz | raíz (Dockerfile raíz) |
| `docyan-lde-graph` (FalkorDB) | `fly.graph.toml` | raíz | — |
| `docyan-lde-ingest` (worker) | `worker/fly.toml` | `worker/` | **raíz** (COPY app/ + worker/) |
| `docyan-lde-redis` | `redis/fly.toml` | `redis/` | `redis/` |
| `docyan-lde-embedder` | `embedder/fly.toml` | `embedder/` | `embedder/` |

Cambios concretos:
- `git mv fly.toml fly.api.toml` (ya no hay default en la raíz).
- `.github/workflows/deploy.yml`: `flyctl deploy --remote-only --config fly.api.toml --app docyan-lde-api`.
- `worker/fly.toml`: comando de deploy documentado con `--app` explícito.

Con esto, **ningún deploy desde la raíz puede heredar el config de otra app**:
no hay default que heredar, y se pasa `--app` como target inequívoco.

## Comandos de deploy canónicos (desde la raíz del repo)

```bash
# Backend (también lo hace CI en push a main, vía deploy.yml):
flyctl deploy --remote-only --config fly.api.toml --app docyan-lde-api

# Worker de ingesta (manual; build context = raíz por los COPY app/ + worker/):
flyctl deploy --remote-only --config worker/fly.toml --app docyan-lde-ingest \
  --dockerfile worker/Dockerfile

# Graph / Redis / Embedder: cada uno con su --config (o desde su subdir).
flyctl deploy --remote-only --config fly.graph.toml --app docyan-lde-graph
```

`--app` y (para el worker) `--dockerfile` explícitos son cinturón-y-tirantes:
aunque una versión de flyctl resolviera algo relativo de forma distinta, el
target y el Dockerfile quedan inequívocos.

## Verificación (1-jun-2026)

- Worker: `flyctl deploy ... --config worker/fly.toml --app docyan-lde-ingest`
  construyó la imagen del **worker** (1.2 GB, torch+Docling) y la releaseó a
  `docyan-lde-ingest`. `flyctl status` → máquinas `started`, checks pasando.
- Backend: `flyctl deploy ... --config fly.api.toml --app docyan-lde-api`
  construyó la imagen del backend (~228 MB) y la releaseó a `docyan-lde-api`.
  `/health` 200; smoke service_role verde.

Ambos releases fueron a su propia app con su propia imagen — el bug ya no se
reproduce.
