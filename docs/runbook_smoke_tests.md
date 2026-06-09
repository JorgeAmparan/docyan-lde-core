# Runbook — Smoke tests de ingesta y `smoke-test-tenant`

## Tenant de smoke: `smoke-test-tenant`

`scripts/smoke_test_ingesta.py` ejercita la ingesta end-to-end contra infra real
(worker en Fly + FalkorDB + cotizador + Supabase). Necesita un tenant con saldo
prepagado en `tenant_budget`, porque el **cotizador es un gate sin bypass**
(CLAUDE.md §3 / Adenda §8, incidente PoC $5,000): sin saldo no hay ingesta.

Ese tenant es **`smoke-test-tenant`**. Es un tenant **sintético de pruebas**, no
un cliente productivo. Se conserva a propósito para que las corridas de smoke
(B2, B3.5 item 3, y futuras) tengan saldo sin tener que re-sembrarlo cada vez.

### Estado en Supabase (verificado B3.5, 2026-06-01)

`tenant_budget` tiene **una sola fila**:

| tenant_id | saldo_actual_usd | hard_cap_por_documento | creada |
|---|---|---|---|
| `smoke-test-tenant` | 10.0000 | 5.0000 | 2026-06-01 |

- No hay duplicados (la tabla tiene `UNIQUE INDEX` en `tenant_id` — son
  imposibles por diseño).
- No hay otros tenants de prueba ni tenants huérfanos. No existe tabla `orgs`
  registry: `tenant_id` es un `TEXT` (`org_id == tenant_id`), no una FK, así que
  el criterio de "huérfano" no aplica.
- **Conclusión B3.5 item 5:** no había nada que limpiar. `smoke-test-tenant` se
  conserva (decisión del contrato) y queda documentado aquí.

### Re-sembrar / recargar saldo

Si el saldo se agota o se borra, recargar vía el endpoint admin (o seed directo):

```bash
# Vía API (requiere auth admin) — ver docs/runbook_secrets_produccion.md
curl -X POST "$API/admin/tenant-budget" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{"tenant_id":"smoke-test-tenant","saldo_actual_usd":10.0}'
```

### Limpieza futura

Cuando exista un tenant productivo real, **no** borrar `smoke-test-tenant`: es
infra de pruebas. Si en el futuro aparecen tenants de prueba sobrantes (p. ej.
`test-*` de corridas múltiples), se pueden limpiar conservando `smoke-test-tenant`.
No borrar filas cuyo origen no sea obvio sin confirmación (no destruir saldo real
por suposición).

## Smoke de ingesta con GLiNER (B3.5 item 3)

Tras cachear `urchade/gliner_medium-v2.1` en la imagen del worker (NER híbrido
offline), re-correr el smoke con el mismo PDF de B2 y comparar nodos/relaciones
vs la corrida sin GLiNER (era **12 nodos / 19 relaciones**):

```bash
fly deploy --app docyan-lde-ingest --dockerfile worker/Dockerfile
./venv/bin/python scripts/smoke_test_ingesta.py   # mismo doc IB-111-RDA o equiv.
```

Requiere saldo en el proveedor de extracción (Gemini, o el override a Sonnet
documentado en el reporte de B2). Si no hay saldo, el smoke no puede correr: es
acción operativa externa, no deuda de código.

---

## Gate de migraciones (encendido NO puede ir verde con la DB desfasada)

**Lección B13 (2026-06-09):** el encendido se reportó "todo verde" con la
migración `018_budget_rpc.sql` (función `budget_reservar`) sin aplicar en prod →
`/ingesta/.../confirm` daba **500** (`PGRST202: Could not find the function
public.budget_reservar`) y la ingesta nunca completaba. Causa de fondo: el viejo
`--verify` solo comprobaba una lista de **tablas** escrita a mano; nunca vio las
**funciones** de la 018.

**Mecanismo permanente:**
- `scripts/apply_migrations.py` mantiene un **ledger** `schema_migrations`
  (una fila por archivo aplicado) y registra cada migración al aplicarla.
- `python scripts/apply_migrations.py --check` compara los `migrations/*.sql` en
  disco contra el ledger y **sale 1 si hay pendientes** (drift exacto y
  auto-mantenido — no depende de una lista de objetos a mano).
- El workflow **Deploy** (`.github/workflows/deploy.yml`) tiene un job
  `check-migrations` que corre `--check` contra Supabase prod (secret de Actions
  `SUPABASE_DB_URL`); `deploy-backend` y `deploy-frontend` lo tienen como `needs`,
  así que **si hay migraciones pendientes el deploy no corre** (no puede ir verde).

**Checklist de encendido / deploy:**
1. Aplicar pendientes: `SUPABASE_DB_URL=… python scripts/apply_migrations.py`
   (idempotente; registra en el ledger).
2. Confirmar sin drift: `… --check` → "✅ Sin migraciones pendientes (DB al día)".
3. Merge a `main`: el job `check-migrations` re-valida antes de desplegar.

---

## La capa de grafo SOLO es verificable post-deploy (e2e de grafo OBLIGATORIO)

**Lección B13 (sprint de corrección de frontend, 2026-06-09):** `docyan-lde-graph`
(FalkorDB) y `docyan-lde-redis` son apps Fly **privadas** (`.internal` / flycast):
**inalcanzables desde una laptop**. Solo Supabase es público (pooler aws). Por eso,
booteando la API local contra el `.env` de prod, **solo** se pueden ejercitar los
endpoints que tocan únicamente Supabase (auth: `signup`/`login`/`logout`/`refresh`/
`change-password`/`me`). Cualquier endpoint que toque el grafo NO es verificable
localmente:

- `GET /mo/codos`, `GET /mo/codos/{id}` (CoDos del tenant)
- `GET /onboarding/cuenta` (cuenta documentos del grafo)
- `GET /mis-documentos` (lista `:DocumentoSource`)
- el ciclo de ingesta (`/ingesta/documents` → worker → polling `/status`)
- `POST /mo/query` (consulta + cita)

**Regla de encendido (no opcional):** todo encendido / deploy futuro incluye un
**e2e de grafo post-deploy** como paso obligatorio, contra el API público ya
desplegado (`docyan-lde-api.fly.dev`). Secuencia mínima con cuenta freemium nueva:

```
signup → ingerir documento real → polling /ingesta/documents/{job}/status hasta
"completado" → aparece en GET /mis-documentos → GET /mo/codos (CoDos del tenant,
NO enlatados) → GET /mo/codos/{id} (entidad_id real) → POST /mo/query (respuesta
citada) → POST /auth/logout → POST /auth/refresh debe dar 401 (revocado).
```

Verificar la auth contra Supabase en local es un smoke parcial útil, **pero no
sustituye** el e2e de grafo: la mitad del producto vive en FalkorDB y esa mitad
solo se prueba con el backend desplegado. "Verde" sin e2e de grafo post-deploy =
encendido NO verificado.
