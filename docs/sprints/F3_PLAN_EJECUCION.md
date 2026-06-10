# Plan de ejecución — Sprint F3 (Sitio Público v2)

> Documento de PREPARACIÓN, no de ejecución. Escrito antes de la aprobación de Jorge.
> Cuando Jorge diga "ejecuta F3", arrancar desde aquí. Estado al escribirlo: **nada ejecutado, 0 archivos tocados.** Branch aún en `main`.
> Fuentes leídas: Sprint Contract F3 (`~/Downloads/Sprint_F3_Sitio_Publico_v2.md`), 4 docs rectores (Narrativa, Modelo Comercial, Precios, HANDOFF-sitio-publico-v2), mapa de repo (backend + frontend).

---

## 0. Arranque

```bash
git checkout -b sprint/F3-sitio-publico-v2   # off main (no existe aún)
```

Prototipo fuente (fidelidad visual): `…/DOCYAN LDE files/docyan-lde-design-rediseño_sitio_publico/project/ui_kits/commercial-v2/`
(OJO: la ruta real es `…/project/ui_kits/commercial-v2/`, NO `…/projects/…/comercial-v2`. El nombre de carpeta es `commercial-v2` con doble-l, en inglés.)

Archivos del prototipo (LOC): home 349 · producto 185 · como 122 · verticales 208 · seguridad 94 · precios 150 · codos 291 · codo-data 73 · demo 354 · shared 319 · site2.css 606 · tweaks-panel 541 (NO portar — es panel de diseño).

---

## 1. Hallazgos que cambian el plan respecto a lo que el contrato asume

### 1.1. El frontend YA tiene un "sitio público v2 FLOW" parcial
- Existe el route group `frontend/src/app/(public)/` con: `page.tsx` (landing FLOW), `precios/`, `como-funciona/`, `seguridad/`, `verticales/[slug]/` (agencias, pharma, laboratorios, maquiladoras, mining, agribusiness), `acerca/`, `soporte/`, `estado/`. Layout en `(public)/layout.tsx` (SiteNav + SiteFooter).
- `landing-v1/page.tsx` ya está preservado como referencia (coincide con D6 "kit previo se conserva sin rutas activas").
- **Implicación:** F3 NO crea el grupo `(public)` de cero; **reescribe/reemplaza** su contenido para que case fiel al prototipo `commercial-v2`, y agrega las rutas que falten: `/producto`, `/verticales` (hub, hoy solo hay `[slug]`), `/demo` (hub) + `/demo/[codo]`. Reconciliar las verticales del prototipo (lab/maquila/flotillas con detalle; D2: sin sexto CoDo) con las 6 carpetas existentes.

### 1.2. El demo actual usa DATOS MOCK — viola D3
- `frontend/src/app/demo/[vertical]/page.tsx` renderiza `DemoConsult` con datos mock (`DemoQA` en `frontend/src/lib/demo-data.ts`). El prototipo `codo-data.jsx` también trae Q&A curado (spans/cite/page hardcoded).
- **D3 exige tenants demo REALES, cero `CANNED_*`.** Por tanto: ingerir documentos reales en 5 tenants demo + cablear el demo público al endpoint real `POST /demo/query`. El `codo-data.jsx` sirve como **guion de las preguntas preparadas** (capa 1-2 del input de 3 capas), pero la respuesta citada debe venir del grafo real (capa 3).

### 1.3. La fórmula del cotizador tiene piso $25, el contrato pide $15
- `app/ingesta/cotizador.py:103-109` + `pricing_table.py:107`: `SETUP_PRICE_FLOOR_USD = $25` (env-configurable), `MULTIPLIER = 25×`, `factor 1.0`. Fórmula: `MAX($25, costo_base×25) × factor`.
- Los docs canónicos EN DISCO son **v1.0 / v2.0 (piso $25)**. El Sprint cita **v1.1 / v2.1 (piso $15 + cupos)** que NO están en disco (solo v1.0/v2.0 en `…/DOCYAN LDE files/` y copias en `…/Sprint hacia MVP 9 junio/`).
- **Resolución (CONFIRMADA por Jorge en sesión):** piso **$15 es la definición vigente**, apegarse al contrato. Cambiar el default `SETUP_PRICE_FLOOR_USD` a `15` (`pricing_table.py:107`). Los docs en disco ($25, v1.0/v2.0) quedaron desactualizados — no son autoridad. Ya NO es pendiente.

### 1.4. NO existe el concepto de "cupo de ingestas por tier"
- Hoy hay dos límites distintos, ninguno es el cupo del contrato:
  - `orgs.doc_limit` (mig 020) = tope de **documentos vivos** (freemium=3, pagados=NULL). NO es cupo de ingestas.
  - `tenant_budget.saldo_actual_usd` (mig 008) = USD prepagado para cómputo, con hard caps $5/doc, $20/sesión.
- **El cupo "Esencial 10+3/mes · Profesional 30+10/mes · Enterprise configurable" hay que construirlo nuevo** (backend §C). Es lo más sustancial del backend.

### 1.5. NO existe rate-limiter por IP
- `app/cache/redis_client.py` tiene get/set/json/delete/health, sin limiter. Construir uno (patrón `rate:{ip}:{endpoint}` con TTL, o `slowapi`) para `POST /demo/query`.

---

## 2. Backend §C — Cupo de ingestas (lo construye primero, desbloquea precios y onboarding)

### 2.1. Migración `021_cupo_ingestas.sql` (aditiva, idempotente)
Decidir modelo (PENDIENTE menor — recomendación): columnas en `orgs` o tabla nueva `org_ingest_quota`. Recomiendo **tabla nueva** `org_ingest_quota(org_id PK, cupo_inicial INT, cupo_recurrente_mensual INT, cupo_restante INT, ultima_reposicion TIMESTAMPTZ, enterprise_configurable BOOL)`, sembrada por plan al activar:
- Esencial: inicial 10, recurrente 3/mes.
- Profesional: inicial 30, recurrente 10/mes.
- Enterprise: configurable (campo editable, sin default rígido).
- Freemium: SIN fila de cupo de setup (opera con saldo de cortesía, sin cambio — Sprint §C1).
- RPC atómicas estilo mig 018: `cupo_decrementar(p_org)`, `cupo_reponer_mensual()`. Idempotencia del decremento por job_id/sha (no doble-decrementa en reintento).

### 2.2. Cotizador — integrar cupo (`app/ingesta/cotizador.py`)
Orden nuevo en `cotizar()`:
1. Consultar `cupo_restante` del tenant.
2. **Dentro de cupo:** setup = $0; mensaje "incluido en tu plan (N restantes)"; solo pide confirmar (no toca saldo USD para el setup, pero sí valida hard caps de cómputo).
3. **Excedente (cupo 0):** cotiza con fórmula canónica `MAX($15, costo_base×25) × factor` → cambiar `SETUP_PRICE_FLOOR_USD` default a `15`.
4. Freemium: sin cupo, ruta de cortesía actual intacta.

### 2.3. Decremento + reposición
- **Decremento al confirmar:** en `app/jobs/dispatcher.py:confirmar()` (~línea 250), junto a la reserva de presupuesto, decrementar cupo SI la ingesta fue "dentro de cupo". Idempotente por SHA-256 (ya hay precedente en el débito).
- **Reposición mensual:** nueva `JobSpec` en `app/orchestrator/scheduler.py:165` con `trigger="cron", {"day": 1, "hour": 0}` → función módulo serializable que llame al RPC `cupo_reponer_mensual()`. (Repone el recurrente, respeta techo si se define.)

### 2.4. Exponer cupo a la UI
- Endpoint o ampliación de `app/onboarding/limites.py:estado_cupo()` para devolver cupo de ingestas restante. Reflejar en `/cuenta` y en la UI de carga (frontend lo pinta).

### 2.5. Tests backend (obligatorios)
`tests/test_cupo_ingestas.py` y ampliar cotizador:
- dentro de cupo → setup $0, mensaje correcto, cupo decrementa 1.
- excedente → cotiza con piso $15 (no $25); verificar número exacto.
- idempotencia del decremento (reintento mismo job no doble-decrementa).
- reposición mensual suma el recurrente.
- Enterprise configurable (set campo, respeta).
- Patrón: `InMemoryBudgetStore` + `BudgetManager` + `Cotizador(budget_manager=bm)` (ver `tests/test_cotizador_requires_confirmation.py:56`).

---

## 3. Backend §D/E — Endpoint demo público + tenants demo

### 3.1. `POST /demo/query` (nuevo router público, sin auth)
- Reusa `MasterOrchestrator.handle_request()` / `/mo/query` (`app/api/routers/mo.py:217`, `master_orchestrator.py:194`) **scopeado al tenant demo** (graph_name del CoDo). NO reimplementar el pipeline.
- **Solo lectura:** un POST de escritura contra tenant demo debe fallar (test de aislamiento).
- **Rate-limit por IP** (Redis, `rate:demo:{ip}`), timeout 9s. Sin auth.
- Las 3 capas (HANDOFF §8 / demo.jsx): match exacto → keywords → backend real → fallback honesto ("esa pregunta no está en este documento demo — pruébalo con tus documentos").

### 3.2. Tenants demo reales (D3 / §E)
- 2 docs hero (MSDS en inglés → consulta multilingüe: pregunta ES, span original EN intacto).
- 5 CoDos × 3 docs c/u (lab/maq/pharma/min/agri) ingeridos por el pipeline real, modo solo-lectura. `codo-data.jsx` = guion de entidades/preguntas (CODO-LAB-04 Centrífuga Hettich Rotina 380, CODO-MAQ-12 Haas VF-4, CODO-PHARMA-03 Bioreactor B-3, CODO-MIN-08 Komatsu PC-2000, CODO-AGRI-02 Tanque T-7).
- **BLOQUEADOR PROBABLE — PENDIENTE DE JORGE:** se necesitan documentos reales de calidad por vertical. Sprint §E1 + nota: si no hay público de calidad, usar MSDS/calibración/manual reales ya verificados de Jorge, adaptando vertical, y reportarlo. **No bloquear el sprint esperando docs** — ingerir con lo disponible y dejar marcado qué vertical quedó con doc sustituto.
- Script de ingesta one-shot reproducible en `scripts/` (siembra tenants demo). Ingesta vía worker existente (no debería requerir cambios; si los requiere: `flyctl deploy --config worker/fly.toml --app docyan-lde-ingest`).

### 3.3. Tests backend
- rate-limit dispara tras N/min por IP.
- aislamiento: escritura contra tenant demo falla.
- `/demo/query` devuelve respuesta citada real (no canned).

---

## 4. Frontend §A/B — 7 páginas + i18n + geo

### 4.1. Migrar prototipo a `(public)/` (App Router)
Rutas: `/` · `/producto` · `/como-funciona` · `/verticales` + `/verticales/[slug]` (lab, maquila, flotillas) · `/seguridad` · `/precios` · `/demo` + `/demo/[codo]`.
- Traducir `site2.css` (606 LOC) → Tailwind con tokens existentes (`tailwind.config.ts` + `globals.css` ya tienen `--amate-*`, `--ink-*`, `--cinnabar-*` #CF4124, `--radius-*`, IBM Plex). **Sin colores nuevos.**
- Implementar fiel el corner-bracket de cita `.cite2 .brk` (contrato visual). Ya existe precedente: `components/brand/citation-chip.tsx:8` usa `.brk`.
- Responsive HANDOFF §3: header 1 fila 60-64px, hamburguesa <980px con sheet (shadcn `sheet.tsx` instalado), hit ≥44px, grids a 1 col en móvil.
- **Eliminar `LinkOutModal`** del prototipo → `<Link>` directos a `/signup`, `/codigo`, `/login` (ya en prod, solo enlazar).

### 4.2. i18n + Geo (react-i18next YA configurado)
- Config en `frontend/src/i18n/config.ts`; namespaces existen (`landing`, `pricing`, `common`…). Diccionarios `locales/{es,en}/*.json`.
- Extraer todos los `t({es,en})` del prototipo a los diccionarios. Idioma consistente por vista (sin mezclas).
- **Falta ruteo por locale** (`/mx`, `/us`…) — construir middleware Next.js + cookie `lang`+`band`. Geolocalización preselecciona ambos; siempre ajustables (banner 1ª visita desechable + `GeoCtl` en footer/Precios + pill idioma en nav). Onboarding hereda banda+idioma.

### 4.3. Selector de banda — precios en vivo
- `precios.jsx` = única tabla. Bandas A/B/C re-renderizan tiers + piloto tachado (−30% sobre Esencial de la banda) sin recargar.
- Cifras (v2.1): A 250/550/1200 · B 349/770/1680 · C 375/825/1800. Piloto banda A: $250 tachado → $175.
- Mensaje "ingestas incluidas" (Esencial 10+3/mes · Profesional 30+10/mes · Enterprise negociado; adicionales **desde $15**), **sin exponer fórmula**.

### 4.4. Tests frontend
- unit selector de banda (re-render por banda) — Vitest, junto a `tests/unit/pricing.test.ts`.
- i18n sin mezclas por vista.
- grep restricción #1 (ver §6).

---

## 5. Frontend §E — CoDos demo (reusar renderers PWA, no duplicar)

- Los 8 intent-renders existen y son puros: `frontend/src/app/(app)/consult/renderers/` (informativa-card, guia-paso-a-paso, graficos-viewer, video-player, troubleshooting-tree, historial-timeline, alertas-dashboard, comparativa-view). DocOverlay: `components/brand/consulta-span-overlay.tsx`. Chip: `components/brand/citation-chip.tsx`.
- **Acción:** si están atados a `(app)` autenticado, **extraer los renderers + overlay a un lugar compartido** (`components/consult/` o paquete común) para usarlos en `/demo/[codo]` público sin auth. Sprint lo autoriza explícitamente.
- Cita progresiva 3 niveles (HANDOFF §8): chip → span inline; "Abrir PDF" → `DocOverlay` modal (bottom-sheet <560px) con span resaltado + sello pedigree SHA-256; dentro, "Abrir en pestaña nueva" → visor completo (`demo-doc.html` del prototipo → visor real con highlight + scroll a página). Documento siempre en idioma original.
- CTA salida CoDo: "Ahora con tus documentos →" → `/signup`.
- Migrar `demo/[vertical]` (mock) → `/demo/[codo]` cableado a `POST /demo/query` real.

---

## 6. §F + Restricciones absolutas (verificar antes del reporte)

### SEO + switch
- Metadata por página (title/desc ES+EN), OpenGraph, `sitemap.xml`, `robots.txt`.
- Redirects 301 de rutas viejas que cambien.
- v2 reemplaza al sitio actual en `docyan-lde.vercel.app` (mismo deploy; Vercel despliega solo en `main`, Root Directory=frontend — ver memoria vercel).

### Restricciones (cada una con test)
1. **"traducción"/"translation" NO aparece** en páginas públicas — TEST automatizado: grep sobre diccionarios i18n + HTML renderizado de rutas públicas (ES y EN) en CI. (Es la restricción dura #1.)
2. "DOCYAN cuenta, no concluye" en Seguridad (count-band), foso y vertical maquila.
3. Una sola tabla de precios; toda otra mención enlaza a `/precios`.
4. "Entorno de documentos analizados en vivo"; Live Document Environment (no "Living Document Engine"); línea regulatoria en Cómo funciona, Seguridad y verticales.
5. CTA primario global: "Pruébalo gratis — 3 documentos" → `/signup`.
6. Línea de seguridad regulatoria: alertas SOLO administrativas, nunca decisión clínica/operativa.

---

## 7. E2E Playwright (criterio de cierre)

- Embudo: home → CTA → `/signup` real; "Agendar demo" → `/codigo`.
- CoDo demo: abrir → consultar → cita → overlay con span → CTA salida `/signup`.
- Navegación de las 7 páginas ES/EN con banda conmutada en vivo.
- Responsive móvil: header + demo del hero (auto-scroll a respuesta).
- Demo hero responde consulta real citada (MSDS EN, pregunta ES, span EN intacto).
- Cuenta freemium nueva desde el CTA completa ciclo B13.2.
- Tenant Esencial de prueba: cotizador muestra "incluido en tu plan" en las 10 primeras ingestas y cotiza con **piso $15** la 11ª.
- Post-deploy: e2e de grafo del runbook (regla de encendido B13) obligatorio.

---

## 8. Orden de ejecución sugerido

1. Branch + migración 021 + RPC de cupo (desbloquea cotizador y precios).
2. Cotizador: piso $15 + integración de cupo + decremento + scheduler de reposición. Tests backend de cupo/fórmula.
3. `POST /demo/query` + rate-limiter IP + aislamiento solo-lectura. Tests.
4. Script de ingesta de tenants demo (2 hero + 5 CoDos). ← depende de docs de Jorge (PENDIENTE).
5. Frontend: tokens/site2.css → Tailwind; las 7 páginas; LinkOutModal→Link; responsive.
6. i18n extracción + locale routing + geo/banda; selector de precios en vivo.
7. CoDos: extraer renderers a compartido; cablear `/demo/[codo]` al backend real; cita 3 niveles + overlay.
8. SEO/sitemap/robots/301 + switch de deploy.
9. Tests frontend (banda, i18n, grep #1) + E2E Playwright.
10. Deploy + e2e de grafo post-deploy + capturas/URLs → reporte final.

---

## 9. PENDIENTE DE JORGE (orden de criticidad)

1. **(Bloqueante para §E)** Documentos reales por vertical para los 5 CoDos demo (2 hero MSDS-EN + 15 docs). Si no hay, autorizo usar tus MSDS/calibración/manual ya verificados adaptando vertical (Sprint lo permite) — pero confirma cuáles.
2. ~~Piso de fórmula~~ — **RESUELTO. Jorge confirmó $15 (definición vigente).** Ejecuto $15, docs en disco ($25) desactualizados.
3. **(Modelado menor)** Cupo: ¿tabla nueva `org_ingest_quota` (mi recomendación) o columnas en `orgs`? ¿El cupo recurrente tiene techo acumulable o se resetea? Asumo: recurrente se suma sin acumular indefinidamente (techo = inicial). Ajustable.
4. Migración a prod + variables (SMTP, FREEMIUM_SALDO_USD) — pendientes heredados de B13 (ver memoria b13-onboarding-ciclo-uso).
