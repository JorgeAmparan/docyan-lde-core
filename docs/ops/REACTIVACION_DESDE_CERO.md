# DOCYAN LDE — Reactivación desde cero

**Estado: APAGADO TOTAL.** Las cinco apps de Fly.io fueron destruidas el **12 de agosto de 2026** para llevar el costo recurrente de infraestructura a cero. No había datos que preservar: la decisión fue explícita y el corpus era material de prueba re-ingestable.

Este documento + el repo `docyan-lde-core` en GitHub son **la única fuente de reconstrucción**. Todo lo necesario para volver a levantar el entorno está aquí o en el repo.

**Destrucción verificada.** Las cinco apps se destruyeron sin errores con `fly apps destroy <app> --yes`. Después de ejecutarlas, `fly apps list` devuelve **cero apps** en la organización `personal` (la única de la cuenta). Al destruir una app, Fly elimina con ella sus machines, volúmenes e IPs: no quedaron volúmenes huérfanos — `docyan_graph_data` y `redis_data` se fueron con `docyan-lde-graph` y `docyan-lde-redis`. El cargo recurrente de Fly.io es cero.

> **Sobre los secrets:** este documento lista únicamente los **NOMBRES** de las variables que cada app necesita. Ningún valor está aquí ni estará nunca. Los valores se reconfiguran desde sus fuentes originales (consolas de Google AI Studio, OpenAI, Anthropic, Resend, Supabase, Banxico) al momento de reactivar.

---

## 1. Inventario previo a la destrucción

Capturado el 12 de agosto de 2026, inmediatamente antes de ejecutar `fly apps destroy`.

### 1.1 Las cinco apps

Todas en la organización `personal`, región primaria **`dfw`** (Dallas).

| App | Rol | `fly.toml` en el repo | Tamaño de machine | Volumen |
|---|---|---|---|---|
| `docyan-lde-api` | Backend FastAPI (público) | `fly.api.toml` | `shared-cpu-2x` / 1 GB | — |
| `docyan-lde-ingest` | Worker de ingesta (Docling + GraphRAG-SDK + PyTorch CPU) | `worker/fly.toml` | `shared-cpu-4x` / 4 GB | — |
| `docyan-lde-embedder` | BGE-M3 self-hosted (1024 dim, privado) | `embedder/fly.toml` | `shared-cpu-4x` / 8 GB | — |
| `docyan-lde-graph` | FalkorDB (DKG + DTM) | `fly.graph.toml` | `shared-cpu-1x` / 1 GB | `docyan_graph_data`, 5 GB |
| `docyan-lde-redis` | Cola de ingesta + sesiones MO | `redis/fly.toml` | `shared-cpu-1x` / 512 MB | `redis_data`, 5 GB |

**Los cinco `fly.toml` están en el repo y son la configuración autoritativa.** Contienen puertos internos, políticas de `auto_stop_machines`, `min_machines_running`, health checks y montajes de volumen. No hay que reconstruirlos a mano.

Detalle relevante que ya viene en esos archivos:

- `docyan-lde-api`: `internal_port = 8000`, `force_https = true`, `auto_stop_machines = "stop"`, `min_machines_running = 1`. Era la única app con política de dormido.
- `docyan-lde-graph`, `docyan-lde-redis`, `docyan-lde-embedder`, `docyan-lde-ingest`: `auto_stop_machines = "off"` + `min_machines_running = 1` — siempre vivos. **Ese era el piso de costo 24/7** (en particular el worker de 4 GB y el embedder de 8 GB).
- `docyan-lde-graph` fija la imagen de FalkorDB por digest: `falkordb/falkordb@sha256:58a95a33d591b25648bbb13268a23329aa39e70b4cbeff0752c65f8b4beba6db`. Se reconstruye idéntica.

### 1.2 Máquinas al momento de destruir

| App | Machines | Estado |
|---|---|---|
| `docyan-lde-api` | 2 (`shared-cpu-2x:1024MB`) | 1 `started`, 1 `stopped` |
| `docyan-lde-ingest` | 1 (`shared-cpu-4x:4096MB`) | `started` |
| `docyan-lde-embedder` | 1 (`shared-cpu-4x:8192MB`) | `started` |
| `docyan-lde-graph` | 1 (`shared-cpu-1x:1024MB`) | `started` |
| `docyan-lde-redis` | 1 (`shared-cpu-1x:512MB`) | `started` |

### 1.3 Direcciones IP

Se pierden al destruir. Las dedicadas v6 se reasignan nuevas al recrear; las v4 compartidas son automáticas.

- `docyan-lde-api`: v6 dedicada + v4 compartida (ingress público)
- `docyan-lde-ingest`: v6 dedicada + v4 compartida (ingress público)
- `docyan-lde-redis`: v6 dedicada + v4 compartida (ingress público)
- `docyan-lde-embedder`: solo ingress privado (`.flycast`)
- `docyan-lde-graph`: sin IP pública (solo `.internal`)

> Al reactivar, la IP pública de `docyan-lde-api` cambia. Si algún DNS o CORS apuntaba a una IP fija, hay que actualizarlo. El frontend apunta por hostname (`docyan-lde-api.fly.dev`), así que no se ve afectado.

### 1.4 Nombres de secrets por app

**Solo nombres. Ningún valor.**

#### `docyan-lde-api` — 21 secrets

```
ANTHROPIC_API_KEY          GEMINI_API_KEY             OPENAI_API_KEY
JWT_SECRET                 SUPABASE_URL               SUPABASE_SERVICE_KEY
FALKOR_HOST                FALKOR_PORT                EMBEDDER_URL
REDIS_URL                  REDIS_QUEUE_URL            BGE_M3_TIMEOUT
ALLOWED_ORIGINS            ALLOWED_ORIGIN_REGEX       FREEMIUM_SALDO_USD
BANXICO_TOKEN              BANXICO_FIX_FALLBACK       RESEND_API_KEY
EMAIL_FROM                 DOCYAN_ENABLE_SCHEDULER
```

#### `docyan-lde-ingest` — 9 secrets

```
GEMINI_API_KEY             OPENAI_API_KEY             ANTHROPIC_API_KEY
SUPABASE_URL               SUPABASE_SERVICE_KEY
REDIS_URL                  REDIS_QUEUE_URL
BGE_M3_TIMEOUT             BGE_M3_CONNECT_TIMEOUT
```

#### `docyan-lde-embedder` — sin secrets

No tenía ninguno configurado. Se levanta solo con su `fly.toml`.

#### `docyan-lde-redis` — sin secrets

No tenía ninguno. La contraseña/acceso vive en el `REDIS_URL` que consumen `api` e `ingest`.

#### `docyan-lde-graph` — sin secrets

No tenía ninguno. Se accede por red privada `.internal:6379`.

### 1.5 Valores derivados (no son secretos externos)

Estos no se buscan en ninguna consola: se **derivan** de la topología al reactivar.

| Nombre | Cómo se arma |
|---|---|
| `FALKOR_HOST` | `docyan-lde-graph.internal` |
| `FALKOR_PORT` | `6379` |
| `EMBEDDER_URL` | apunta al embedder por `.flycast:8000` |
| `REDIS_URL` / `REDIS_QUEUE_URL` | URL de `docyan-lde-redis` por red privada |
| `JWT_SECRET` | se genera nuevo, robusto. **No reutilizar el anterior.** Invalida sesiones viejas, lo cual es correcto en un entorno reconstruido |
| `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_REGEX` | dominio del frontend en Vercel |
| `EMAIL_FROM` | remitente verificado en Resend |
| `FREEMIUM_SALDO_USD`, `DOCYAN_ENABLE_SCHEDULER`, `BGE_M3_TIMEOUT`, `BGE_M3_CONNECT_TIMEOUT`, `BANXICO_FIX_FALLBACK` | parámetros de operación, no credenciales; ver defaults en `.env.example` |

Llaves que sí vienen de una consola externa: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `BANXICO_TOKEN`.

> `GEMINI_API_KEY` debe usarse con el prefijo `gemini/` en los model strings de LiteLLM. Sin ese prefijo LiteLLM defaultea a Vertex AI y falla pidiendo credenciales GCP.

### 1.6 Servicios fuera de Fly.io

| Servicio | Estado al apagar | Costo |
|---|---|---|
| **Vercel** (frontend, proyecto `docyan-lde`) | **Se deja vivo.** Plan **Hobby** confirmado por API | Cero |
| **Supabase** (Postgres + pgvector) | Requiere pausa manual desde el dashboard | Ver §4 |
| **GitHub** (`docyan-lde-core`) | Intacto. Fuente única de reconstrucción | Cero |

El frontend de Vercel queda vivo a propósito: costo cero y el dominio de preview sigue sirviendo como tarjeta de presentación estática. Con la API destruida, las llamadas al backend fallan — la UI carga pero no responde consultas. Es el comportamiento esperado en estado apagado.

---

## 2. Procedimiento de reactivación

Prerrequisitos: `flyctl` instalado y autenticado (`fly auth login`), repo `docyan-lde-core` clonado, y las llaves de cada proveedor a la mano.

### Paso 1 — Crear las cinco apps

```bash
fly apps create docyan-lde-api      --org personal
fly apps create docyan-lde-ingest   --org personal
fly apps create docyan-lde-embedder --org personal
fly apps create docyan-lde-graph    --org personal
fly apps create docyan-lde-redis    --org personal
```

Los nombres deben ser exactos: `FALKOR_HOST`, `EMBEDDER_URL` y las URLs de Redis dependen del hostname `.internal` / `.flycast`, que se deriva del nombre de la app.

> Si algún nombre fue tomado por otra cuenta en el intervalo, hay que elegir otro **y** actualizar el `app =` del `fly.toml` correspondiente junto con los secrets que referencian ese hostname.

### Paso 2 — Crear los volúmenes

Dos apps tienen estado en disco. Los volúmenes se crean antes del deploy, en `dfw`, con los nombres exactos que declaran los `[mounts]`:

```bash
fly volumes create docyan_graph_data --app docyan-lde-graph --region dfw --size 5
fly volumes create redis_data        --app docyan-lde-redis --region dfw --size 5
```

Nacen vacíos. FalkorDB y Redis inicializan solos en el primer arranque.

### Paso 3 — Reconfigurar los secrets

Los nombres son los de §1.4. Los valores salen de sus fuentes originales. Ejemplo de la forma (los `...` son donde van los valores reales, que nunca se commitean):

```bash
fly secrets set --app docyan-lde-api \
  ANTHROPIC_API_KEY=... GEMINI_API_KEY=... OPENAI_API_KEY=... \
  JWT_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
  FALKOR_HOST=docyan-lde-graph.internal FALKOR_PORT=6379 \
  EMBEDDER_URL=... REDIS_URL=... REDIS_QUEUE_URL=... \
  ALLOWED_ORIGINS=... ALLOWED_ORIGIN_REGEX=... \
  BANXICO_TOKEN=... BANXICO_FIX_FALLBACK=... \
  RESEND_API_KEY=... EMAIL_FROM=... \
  FREEMIUM_SALDO_USD=... BGE_M3_TIMEOUT=... DOCYAN_ENABLE_SCHEDULER=...

fly secrets set --app docyan-lde-ingest \
  GEMINI_API_KEY=... OPENAI_API_KEY=... ANTHROPIC_API_KEY=... \
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
  REDIS_URL=... REDIS_QUEUE_URL=... \
  BGE_M3_TIMEOUT=... BGE_M3_CONNECT_TIMEOUT=...
```

`embedder`, `redis` y `graph` no llevan secrets.

Confirmar con `fly secrets list -a <app>` que la lista de nombres coincide con §1.4 antes de desplegar.

### Paso 4 — Desplegar, en orden de dependencia

El orden importa: `api` e `ingest` fallan sus health checks si el grafo, la cola y el embedder no están arriba.

```bash
# 1. Infraestructura con estado
fly deploy --config fly.graph.toml            # FalkorDB (imagen pineada por digest)
fly deploy --config redis/fly.toml            # Redis

# 2. Embedder (lo consumen api e ingest)
fly deploy --config embedder/fly.toml         # BGE-M3

# 3. Backend
fly deploy --config fly.api.toml

# 4. Worker de ingesta — build desde la raíz del repo
fly deploy --app docyan-lde-ingest --config worker/fly.toml --dockerfile worker/Dockerfile
```

> **Nunca** `fly deploy` pelón en la raíz: desplegaría la imagen del backend al worker. El worker necesita explícitamente `--config worker/fly.toml --dockerfile worker/Dockerfile`.

El build del worker es pesado (~7.5 GB con torch CPU + modelos Docling); la primera vez tarda.

Verificar cada uno:

```bash
fly status --app <app>
fly logs   --app <app>
```

### Paso 5 — Reanudar Supabase

1. Entrar al dashboard de Supabase y reanudar el proyecto (§4 explica el estado en que quedó).
2. Aplicar las migraciones de `migrations/` en orden (`001`–`008+`).
3. Confirmar que existen las tablas: `tenants`, `documents`, `entities`, `audit_trail` (con hash chain), `governance_rules`, `quarantine`, `api_keys`, y las del FAT de alta frecuencia.
4. Confirmar RLS multi-tenant donde aplique (consistente con `001`).
5. Si el proyecto fue **eliminado** en vez de pausado, hay que crear uno nuevo, aplicar todas las migraciones desde cero y actualizar `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` en `api` e `ingest`.

### Paso 6 — Frontend en Vercel

Si el proyecto siguió vivo (caso esperado), solo confirmar:

- `NEXT_PUBLIC_API_URL=https://docyan-lde-api.fly.dev`
- Root del proyecto = `frontend/`, build `npm run build`, output `.next`
- Redesplegar para que tome la API ya viva

Si el proyecto fue eliminado: reconectar el repo `docyan-lde-core` a Vercel con esa misma configuración.

### Paso 7 — Re-ingesta de documentos de prueba

**Los PDFs fuente los tiene Jorge localmente. No están en el repo** (peso + copyright) y no se recuperan de Fly ni de Supabase.

Documentos del corpus de prueba: **LS-400**, **ATSG**, y los demás manuales usados en las demos.

Subir por el flujo normal de ingesta de la app y confirmar que el worker los procesa: `fly logs --app docyan-lde-ingest` debe mostrar el recorrido de cola → Docling → extracción → grafo.

### Paso 8 — Verificación end-to-end

- [ ] `fly apps list` muestra las cinco apps en estado `deployed`
- [ ] `fly volumes list` muestra `docyan_graph_data` y `redis_data`, ambos `created` en `dfw`
- [ ] `fly status --app docyan-lde-api` con health check en verde
- [ ] La API responde 200 en su endpoint de salud
- [ ] `docyan-lde-graph` alcanzable en `.internal:6379` desde el backend
- [ ] `docyan-lde-embedder` responde en `.flycast:8000` y devuelve vectores de 1024 dim
- [ ] Migraciones de Supabase aplicadas y tablas presentes
- [ ] Un documento de prueba ingesta completo y queda consultable
- [ ] Una consulta end-to-end desde el frontend devuelve respuesta con sus anclas
- [ ] CI verde (`pytest` backend + Vitest/Playwright frontend + gitleaks)

Referencia adicional de pruebas: `docs/runbook_smoke_tests.md`.

---

## 3. Costo en estado apagado

| Concepto | Costo |
|---|---|
| Fly.io — 5 apps | **Cero.** Apps destruidas: sin machines, sin volúmenes, sin IPs |
| Vercel — frontend | **Cero.** Plan Hobby |
| GitHub — repo | **Cero** |
| Supabase | Cero una vez pausado o en free tier — ver §4 |

---

## 4. Acción manual pendiente para Jorge

**Supabase no se pudo pausar desde esta sesión.** No hay CLI de Supabase instalado en la máquina y la pausa de un proyecto es una operación de dashboard que requiere sesión autenticada del dueño.

Qué hacer:

1. Entrar al dashboard de Supabase, al proyecto de DOCYAN LDE.
2. Revisar el plan. Si está en un plan de pago, bajarlo a **Free** o **pausar el proyecto** — el objetivo es cargo cero.
3. Si el proyecto ya está en Free tier, Supabase lo pausa solo por inactividad y el costo ya es cero: no hace falta hacer nada.

> Un proyecto pausado se puede reanudar sin perder el esquema, lo cual simplifica el Paso 5. Si se elimina, el Paso 5 requiere recrear desde las migraciones — que están completas en el repo, así que tampoco es bloqueante. Es decisión de Jorge cuál prefiere.

**Vercel no requiere acción.** Plan Hobby confirmado por API: costo cero, se deja vivo a propósito.

---

© XCID SA de CV — DOCYAN LDE™
