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
