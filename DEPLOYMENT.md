# DOCYAN LDE — Guía de despliegue

**by XCID SA de CV** — Actualizado 28 mayo 2026

Arquitectura de despliegue: **5 apps en Fly.io** (región `dfw`) + **frontend en Vercel**. Railway fue retirado.

Apps Fly: `docyan-lde-api` (backend FastAPI, <1 GB) · `docyan-lde-graph` (FalkorDB, DKG+DTM) · `docyan-lde-embedder` (BGE-M3 self-hosted) · `docyan-lde-ingest` (worker de ingesta: Docling + GraphRAG-SDK + LiteLLM + PyTorch CPU) · `docyan-lde-redis` (cola de ingesta + sesiones).

---

## 1. Backend — Fly.io

**App:** `docyan-lde-api` (backend público) · **Región primaria:** `dfw` (Dallas).

### Prerrequisitos
- `flyctl` instalado y autenticado (`fly auth login`).
- `Dockerfile` del backend (usa `requirements.docker.txt`, sin paquetes macOS-only). El backend es **<1 GB y NO lleva PyTorch ni Docling/GraphRAG-SDK**: ese stack pesado vive aislado en el worker `docyan-lde-ingest` (`worker/Dockerfile`, ~7.5 GB con torch CPU + modelos Docling).
- Cada app se despliega con su propio config (ver §Despliegue). El embedder vive en `embedder/`, Redis en `redis/`, el worker en `worker/`.
- Pista B (alineadores `vecalign`/`hunalign`) **no está construida** (plan diferido); no se instala nada de eso aún.

### Variables de entorno (secrets Fly.io)

**Backend (`docyan-lde-api`):**
```bash
fly secrets set --app docyan-lde-api \
  JWT_SECRET=...            # robusto, sin default inseguro.
  SUPABASE_URL=...  SUPABASE_SERVICE_KEY=...   # service_role (camino crítico).
  FALKOR_HOST=docyan-lde-graph.internal  FALKOR_PORT=6379 \
  REDIS_URL=...  REDIS_QUEUE_URL=...           # sesiones MO + encolado de ingesta.
  ANTHROPIC_API_KEY=...     # Model Router de traducción (Pista A, diferida).
```

**Worker (`docyan-lde-ingest`)** — lleva además las llaves de los LLMs de ingesta:
```bash
fly secrets set --app docyan-lde-ingest \
  GEMINI_API_KEY=...        # extracción (gemini/gemini-2.5-flash). NO GOOGLE_API_KEY.
  OPENAI_API_KEY=...        # gpt-4o-mini = QA.
  ANTHROPIC_API_KEY=...     # fallback de proveedor (claude-opus-4-8) ante caída de Google.
  SUPABASE_URL=...  SUPABASE_SERVICE_KEY=...  REDIS_QUEUE_URL=...
```
> El `GEMINI_API_KEY` debe usarse con el prefijo `gemini/` en los model strings de LiteLLM, o LiteLLM defaultea a Vertex AI y falla pidiendo credenciales GCP. WhatsApp (360dialog) es plan diferido — sin secrets aún.

### Despliegue
```bash
fly deploy --config fly.api.toml        # backend
fly status  --app docyan-lde-api        # verificar health
fly logs    --app docyan-lde-api        # monitoreo
```
> Worker: `fly deploy --app docyan-lde-ingest --config worker/fly.toml --dockerfile worker/Dockerfile` (build desde la raíz del repo). **NO** uses `fly deploy` pelón en la raíz: desplegarías la imagen equivocada al worker.

### FalkorDB y Redis (apps Fly propias)
- **FalkorDB** (`docyan-lde-graph`, privado `.internal:6379`, volumen `/data`): persiste DKG + DTM + eventos FAT críticos. Respaldo decisión #12 (RPO 15min, RTO 4h, retención 7 años prod / 3 años operativo) vía `scripts/backup_falkordb.sh`.
- **Redis** (`docyan-lde-redis`, privado, volumen `redis_data`): doble propósito — cola de ingesta (`REDIS_QUEUE_URL`) + sesiones del Master Orchestrator/APScheduler (`REDIS_URL`, TTLs: consulta 30min, troubleshooting 2h, revisión 8h, onboarding 30 días).

### BGE-M3 self-hosted (app Fly propia)
Ya es un servicio **separado** (`docyan-lde-embedder`, privado `.flycast:8000`, 1024 dim); el backend lo consume por HTTP (`app/embeddings/bge_client.py`, `EMBEDDER_URL`). El torch/transformers vive en esa app y en el worker, **no** en el backend (<1 GB).

---

## 2. Frontend — Vercel

**Framework:** Next.js 15 App Router. Configuración en `vercel.json`.

### Variables de entorno (Vercel)
```
NEXT_PUBLIC_API_URL=https://docyan-lde-api.fly.dev
```

### Despliegue
- Conectar el repo `docyan-lde-core` a Vercel, root del proyecto = `frontend/`.
- Build: `npm run build`. Output: `.next`.
- Los tipos TypeScript de la API se generan desde el OpenAPI del backend (`frontend/scripts/generate-types.sh`) en el pipeline de build/CI.

---

## 3. Base de datos — Supabase

- Migraciones en `migrations/` (`001`–`008+`), aplicadas en orden.
- RLS multi-tenant donde aplique (consistente con `001`).
- Tablas: `tenants`, `documents`, `entities`, `audit_trail` (+ hash chain), `governance_rules`, `quarantine`, `api_keys`, y las del FAT de alta frecuencia (modelo híbrido FalkorDB+Supabase).

---

## 4. CI/CD — GitHub Actions

- Workflow ejecuta en cada PR: tests backend (pytest), tests frontend (Vitest + Playwright), lint, verificación de secrets (gitleaks).
- Sin tests verdes no se despliega.
- Verificador de integridad de la cadena FAT corre en CI (B6).

---

## 5. Checklist de despliegue inicial

- [ ] `fly secrets` completos (incluido prefijo correcto de Gemini).
- [ ] FalkorDB y Redis accesibles desde la app.
- [ ] Migraciones aplicadas.
- [ ] `fly deploy` con health 200.
- [ ] Frontend en Vercel apuntando a la API.
- [ ] CI verde en el último PR.
- [ ] Backup de FalkorDB programado.
- [ ] Sin `railway.toml` ni referencias a Railway en el repo.

---

© XCID SA de CV — DOCYAN LDE™
