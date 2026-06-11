# Runbook — Siembra de tenants demo + lecciones del incidente (F3)

> Origen: siembra de los CoDos demo del sitio público (F3 §E). El primer intento
> construyó grafos "verdes" que **no se podían citar**. Diagnóstico aislado con el
> mismo SDS por dos rutas. Estas son las lecciones operativas.

## 1. Toda ingesta pasa por la CLASIFICACIÓN DE TIPO — sin tipo no hay cita

La costura de consulta citada (B13.2) cita sobre la ontología DOCYAN
(`:Especificacion` / `:TerminoTecnico` / `:Procedimiento` …) enlazada a
`:DocumentoSource`. Esa ontología **solo se produce si el job lleva
`tipo_documento`**: el worker usa el tipo para elegir el schema de extracción.

- **Con tipo** (p.ej. `msds`): el worker aplica el schema MSDS → extrae
  `:Especificacion` → el retrieval léxico las cita.
- **Sin tipo** (`None`): el worker cae a extracción genérica de GraphRAG-SDK →
  `:Chunk` + `:__Entity__` solamente → `:Especificacion = 0` → la consulta
  devuelve un info_card degradado **sin citas**. El grafo se construye "verde"
  (nodos, chunks, embeddings) pero es **estructuralmente inconsultable**.

**Evidencia** (mismo `acetone_sds_en.pdf`, prod):

| Ruta | `tipo_documento` | `:Especificacion` | `/...query` citas |
|---|---|---|---|
| API (`POST /ingesta/documents`) | `msds` (heurística) | 9 | 7 |
| Seed por Redis directo (sin clasificar) | `None` | 0 | 0 |

**Regla:** cualquier camino que encole ingestas DEBE clasificar el tipo igual que
el API (`SchemaSelector.clasificar_heuristica(texto[:8000], filename)`) y ponerlo
en `IngestJob.tipo_documento`. `seed_demo_tenants.py` ya lo hace (F3, commit 3cf1c26).
La ruta canónica de producción es la API (cuenta → cotizar → confirmar); el seed
es un atajo operativo y debe mantener paridad.

### Variabilidad de extracción (esperable, no es bug)
La extracción es por LLM (Gemini): el MISMO schema sobre dos SDS distintos puede
rendir distinto número de `:Especificacion` (incluso 0 en una ficha pobre). En la
siembra demo, la ficha de etanol rindió 0 specs dos veces; se resolvió añadiendo un
segundo reactivo (metanol) al tenant. Para un demo con consultas garantizadas:
sembrar ≥2 documentos por tenant o validar `:Especificacion > 0` tras ingerir.

## 2. Gotcha del `.env` MIXTO (Supabase cloud + FalkorDB/Redis locales)

El `.env` de desarrollo apunta a **Supabase de producción (cloud)** pero a
**FalkorDB y Redis LOCALES**. Consecuencia: correr `seed_demo_tenants.py` tal cual
desde la laptop escribe presupuesto/storage en prod pero encola en la cola LOCAL —
**no siembra el grafo de producción**.

Para sembrar/operar contra prod desde la laptop hay que **tunelizar** la cola y el
grafo (son privados `.internal`):

```bash
flyctl proxy 6399:6379 --app docyan-lde-redis   # cola de ingesta
flyctl proxy 6398:6379 --app docyan-lde-graph   # FalkorDB (solo para inspección/diff)
export REDIS_QUEUE_URL="redis://localhost:6399/0"   # el seed encola aquí → worker prod consume
```

El worker de prod (privado) consume la cola de prod y escribe en la FalkorDB de
prod; la verificación se hace contra la API pública (`/demo/query`,
`/ingesta/documents/{id}/status`). **Cerrar los proxies al terminar.**

## 3. `register` vs `onboarding/signup` — solo el segundo siembra saldo freemium

- `POST /auth/register` crea la cuenta pero **no devuelve token** ni siembra saldo
  → cotizar con esa cuenta da **$0** y el confirm se rechaza. Sirve para alta
  básica/tests de auth, no para el flujo freemium real.
- `POST /onboarding/signup` es la **puerta freemium real**: crea la cuenta, emite
  tokens y siembra el **saldo de cortesía ($6, `FREEMIUM_SALDO_USD`)**.

Verificado en F3 post-deploy: `onboarding/signup` → cotización reporta
`saldo_disponible_usd = 6.0`. Para smokes del embudo freemium usar `onboarding/signup`.

---

## PROPUESTA (pendiente de decisión de Jorge — NO ejecutada): fail-fast del worker

**Caso de estudio (este incidente):** un job sin `tipo_documento` produjo un grafo
que pasó todas las señales de éxito (job `completed`, nodos/chunks/embeddings
creados) pero era **inconsultable** — un *fake-success estructural*. El error fue
silencioso: nada falló, solo no había nada que citar.

**Propuesta:** que el worker **rechace (fail-fast) los jobs sin `tipo_documento`**
en vez de caer a extracción genérica.

**Recomendación: SÍ, con matiz.** Fail-fast en el camino de ingesta de DOCUMENTOS
del cliente (donde la consulta citada es el producto). Concretamente:

- Si `tipo_documento is None` al llegar al worker → **fallar el job** con un error
  accionable (`"sin tipo_documento: el clasificador debe asignarlo antes de
  encolar"`) en vez de extraer genérico. Así el fake-success se vuelve un fallo
  ruidoso y visible en el estado del job.
- **Matiz:** el catálogo de schemas YA contempla el caso "no calza con el catálogo"
  → el worker **genera** un schema dinámico (CLAUDE.md). Eso es legítimo y NO debe
  fallar. La distinción es: `tipo_documento = None por falta de clasificación`
  (bug del encolador → fail-fast) vs `tipo tentativo que el worker resolverá/
  generará` (flujo normal → proceder). La ruta API siempre asigna un tipo (aunque
  sea tentativo); el `None` solo aparece cuando un encolador se saltó la
  clasificación — exactamente lo que pasó aquí.
- **Defensa en profundidad adicional:** tras ingerir, una aserción barata
  `:Especificacion / :Procedimiento / … > 0` (o "grafo consultable") que marque el
  job como `completed_sin_ontologia` en vez de `completed` a secas. Convierte el
  fake-success en una señal observable sin bloquear la ingesta.

No lo implemento sin tu go: toca el worker (se despliega aparte) y la semántica de
estados de job. Si lo apruebas, va como sprint corto propio.

---

## 4. Correspondencia químico-archivo — auditar por CONTENIDO, no por nombre de archivo (F3, jun 2026)

**Incidente:** la siembra inicial usó fact sheets de NJ DOH descargados con el
número equivocado. Los archivos quedaron **mal etiquetados**: `methanol_sds_en.pdf`
contenía *Methyl Amyl Acetate*, `min_hcl_sds.pdf` *Hexafluoroacetone*,
`agri_hipoclorito_sds.pdf` *Stoddard Solvent*. El nombre de archivo decía una cosa;
el contenido, otra. El overlay mostró un compuesto que NO era el del CoDo.

**Regla:** la correspondencia "químico declarado en la UI == químico del archivo"
se verifica contra el **texto crudo del chunk** (`Common Name:` del Fact Sheet), NO
contra `nombre_archivo`. El nombre de archivo no es evidencia.

**Fact sheets correctos (NJ DOH RTK):** acetona=0006-equiv, isopropanol=1010x,
NaOH, **metanol=1222 (METHYL ALCOHOL)**, **HCl=1012 (HYDROGEN CHLORIDE/Muriatic)**,
**hipoclorito=1707 (SODIUM HYPOCHLORITE)**. Verificar SIEMPRE con
`pdfminer … | grep 'Common Name'` antes de sembrar.

**Variabilidad de extracción (DEF-3):** el MISMO archivo metanol rindió 11
`:Especificacion` en demo-hero y 0 en demo-lab (extracción no determinista). Un
grafo con `:Especificacion=0` extrae ontología (`:Sustancia`/`:Riesgo`) pero el
pipeline `informativa` (solo lee `:Especificacion`) no la cita → fallback honesto.
Cierre real depende del retrieval ampliado (DEF-1) + retry de extracción
(fail-fast worker) — ver [[post-f3-sprint-plan]] / B13.3.
