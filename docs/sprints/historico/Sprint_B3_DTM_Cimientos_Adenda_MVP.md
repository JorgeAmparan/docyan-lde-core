# Sprint Contract B3 — DTM (solo cimientos)

**Producto:** DOCYAN LDE™ — Live Document Environment by XCID
**Bloque:** B3 (numeración postPoC) | **Ejecutor:** Opus 4.8 vía Claude Code CLI
**Modo:** Una aprobación + ejecución completa + un reporte final. Opus ejecuta
todo en su sesión (terminal, git, Supabase, Fly), sin pelota de regreso a Jorge.
**Rama:** `sprint/B3-dtm-cimientos` sobre `main` (B0.6 + B0.7 + B2 + B2.1 + B2.2
ya mergeados, commit `5da18c7`).

---

## Alcance acotado por la Adenda MVP

La **Adenda de Alcance MVP de Consulta Viva**
(`docs/DOCYAN_Adenda_Alcance_MVP_ConsultaViva.md`) dice literal sobre B3:

> **B3 DTM (Translation Memory) — solo cimientos.** El schema, segregación por
> par lingüístico, lock terminológico modelado, schema bilingüe. **Sin motor de
> traducción encima.**

> Cimientos de traducción que SE CONSERVAN en MVP — estos no se difieren — se
> construyen en B3 aunque no se expongan en UI:
> - Schema DTM completo con segregación estricta por par lingüístico.
> - TM dual (TM Cliente con prioridad sobre TM Agencia) modelada en el grafo.
> - Lock terminológico como propiedad técnica de segmentos/términos, no como UI.
> - Estructura bilingüe en el modelo de documentos.

Por tanto, B3 se ejecuta **estrictamente** dentro de este alcance. El motor de
traducción, el fuzzy matching operacional en runtime, el lock activo que
reemplaza términos, las sugerencias EDB en runtime y la exportación TMX/XLIFF/
TBX quedan **explícitamente fuera** de B3 — pertenecen a B5/B6/B11 (diferidos
en la Adenda, contratos antiguos se conservan en `docs/sprints/` como referencia
para el día de la reactivación).

## Prerequisitos (ya cumplidos)

- B1 cerrado: GraphRAG-SDK 1.1.1 integrado, schema DKG, multi-tenancy nativa por
  `graph_name`, BGE-M3 self-hosted como embedder confirmado.
- B2 + B2.1 + B2.2 cerrados: worker de ingesta operativo, FalkorDB desplegada
  (`docyan-lde-graph`), Redis desplegado (`docyan-lde-redis`).
- Smoke de ingesta verde end-to-end (commit `5da18c7`).

## Contexto para Opus

El DTM (Document Translation Memory, antes PTM) NO es TM tradicional plana. Es
**grafo ontológico de equivalencias técnicas** con contexto operacional. Vive
sobre el mismo motor (FalkorDB vía GraphRAG-SDK) que el DKG, en **grafos
distintos segregados por par lingüístico**. Doc 02 es la fuente canónica del
modelo; doc 12 documenta interfaces; doc 07 documenta las reglas que el lock
soportará (regla F1) cuando se active en B5.

En este sprint **se construye el modelo**, no el motor. El día que un cliente
real pida traducción rigurosa, B5/B6/B11 se reactivan **sin migración** porque
los cimientos están aquí.

## Componentes a construir (alcance EXACTO)

### 1. Schema DTM en FalkorDB (sobre GraphRAG-SDK)

**Nodos (5 tipos):**

- `:SegmentoTraduccion`
  - `texto_origen`, `texto_destino`
  - `idioma_origen`, `idioma_destino` (BCP-47)
  - `contexto`, `dominio`, `cliente_id`
  - `aprobado_por`, `score_calidad`, `uso_contador`, `version_glosario`
  - `tipo_segmento` (enum de 23 valores — ver §1.1)
  - `tenant_id`, `created_at`, `updated_at`

- `:Glosario`
  - `tipo_glosario` (enum: cliente / agencia / proyecto)
  - `par_linguistico` (string BCP-47 ↔ BCP-47)
  - `version`
  - `lock_terminologico` (bool) ← propiedad técnica del schema; el motor que
    lo lee viene en B5
  - `tenant_id`, `created_at`, `updated_at`

- `:TerminoGlosario`
  - `texto_origen`, `texto_destino`
  - `definicion`, `dominio`, `prioridad`
  - `tenant_id`, `created_at`, `updated_at`

- `:RegistroRevision`
  - `revisor_id`
  - `rol_revisor` (enum: traductor / revisor_agencia / revisor_cliente)
  - `accion` (enum: aprobar / editar / rechazar / comentar)
  - `texto_anterior`, `texto_nuevo`
  - `tenant_id`, `created_at`

- `:SugerenciaTermino`
  - `texto_origen`, `texto_destino_sugerido`
  - `dominio_inferido`, `frecuencia_aparicion`
  - `estado` (enum: propuesta / aceptada / rechazada / reportada_al_cliente)
  - `tenant_id`, `created_at`, `updated_at`

### 1.1. Los 23 tipos de segmento (enum)

`narrativa`, `especificacion`, `instruccion_paso`, `advertencia`,
`etiqueta_diagrama`, `leyenda_simbolica`, `subtitulo`, `transcripcion`,
`nodo_diagnostico_pregunta`, `nodo_diagnostico_respuesta_etiqueta`,
`causa_probable`, `accion_resolutoria`, `descripcion_evento`,
`observacion_descripcion`, `accion_correctiva`, `mensaje_alerta`,
`consecuencia_no_accion`, `accion_recomendada_alerta`,
`resumen_ejecutivo_comparativo`, `descripcion_diferencia`,
`accion_sugerida_comparativa`, `requisito_normativo`,
`modulo_formativo_contenido`.

Constraint: cualquier `:SegmentoTraduccion` insertado debe declarar uno de los
23 valores; insertar otro valor → falla loud.

### 2. Segregación estricta por par lingüístico (`graph_name`)

Cada par direccional vive en su propio `graph_name`. **Sin cruce.** El patrón
es paralelo al de DKG multi-tenant (decisión cerrada), pero compuesto con el par:

```
docyan_dtm_{tenant_id}_{par_id}
```

donde `par_id` es la representación canónica del par, por ejemplo
`en-US_es-MX`, `en-US_es-US`, `en-US_es-ES`, `en-UK_es-MX`, `en-UK_es-ES`.

**5 pares iniciales (día 1):** los listados arriba. Agnóstico a idioma: nuevos
pares son configuración, no código nuevo. Un helper `graph_name_for_pair(
tenant_id, source_lang, target_lang)` produce el nombre canónico.

### 3. TM dual modelada (NO búsqueda en runtime)

La distinción TM Cliente vs TM Agencia se modela en el grafo vía
`tipo_glosario` en `:Glosario` y `cliente_id` en `:SegmentoTraduccion`. La
relación `:USA_GLOSARIO` desde un segmento hacia su glosario lleva una
propiedad `prioridad` que registra el orden (cliente > agencia). **El motor
que consulta esta prioridad en runtime se construye en B5.** Aquí solo se
modela la estructura.

### 4. Lock terminológico como propiedad de schema

`:Glosario.lock_terminologico` es un boolean. **Solo modelo.** El constraint
generator que en B5 leerá esta propiedad para reemplazar términos en runtime
NO se construye aquí. Documentar explícitamente en el código y en
`docs/dtm_modelo_lock.md` que la propiedad existe para que B5 la consuma.

### 5. Aristas DTM y cross DKG↔DTM (estructura, no flujos activos)

**Aristas DTM (relaciones internas):**
- `:PERTENECE_A_PROYECTO` (de `:SegmentoTraduccion` a un proyecto modelado)
- `:RECIBIO_REVISION` (de `:SegmentoTraduccion` a `:RegistroRevision`)
- `:CONTIENE_TERMINO` (de `:Glosario` a `:TerminoGlosario`)
- `:USA_GLOSARIO` (de `:SegmentoTraduccion` a `:Glosario`, con `prioridad`)
- `:USA_TERMINO_GLOSARIO` (de `:SegmentoTraduccion` a `:TerminoGlosario`)
- `:CANDIDATA_PARA_GLOSARIO` (de `:SugerenciaTermino` a `:Glosario`)

**Aristas cross DKG↔DTM:**
- `:TRADUCIDA_VIA` (de nodos DKG como `:Especificacion`, `:Paso`,
  `:Advertencia`, etc. hacia `:SegmentoTraduccion`)
- `:TRADUCIDO_DESDE` (de subtítulos / transcripciones en DKG hacia
  `:SegmentoTraduccion`)

Las aristas se definen en el schema. **No se ejercitan en runtime en este
sprint** — el flujo de creación de estos vínculos durante la ingesta bilingüe
es B6, y la lectura por el motor de traducción es B5.

### 6. Estructura bilingüe en el modelo de documentos del DKG

Verificar que los nodos del DKG que tendrán versión bilingüe
(`:Especificacion`, `:Paso`, `:Advertencia`, etc.) admiten la arista
`:TRADUCIDA_VIA` sin migraciones. Si hace falta un ajuste menor de schema en
DKG para soportar la arista cross, hacerlo aquí, mínimo, sin alterar la
funcionalidad activa del DKG (que ya está en producción).

### 7. Aplicación del schema a los 5 grafos iniciales

Por cada tenant existente al deploy de B3, instanciar los 5 grafos vacíos con
el schema aplicado. Para tenants nuevos, automatizar la creación de los 5
grafos como parte del onboarding (B13 lo coordinará; B3 expone la función).

## Componentes en código

- `app/graph/schemas/dtm_ontology.py` — definición de nodos, aristas, enums.
- `app/graph/dtm_segregation.py` — helper `graph_name_for_pair(...)`, lista
  canónica de los 5 pares iniciales, validación de par.
- `app/graph/dtm_provisioning.py` — función `provision_dtm_graphs_for_tenant(
  tenant_id)` que crea los 5 grafos vacíos con schema aplicado.
- `app/graph/dkg_dtm_bridge.py` — registro de las aristas cross DKG↔DTM
  (`:TRADUCIDA_VIA`, `:TRADUCIDO_DESDE`) en el schema del DKG.
- `migrations/0XX_dtm_schema.sql` — si se necesita registro de proyectos /
  metadata en Supabase para que el grafo se conecte (mínimo necesario).
- `docs/dtm_modelo.md` — documenta el modelo construido, los 5 pares iniciales,
  cómo agregar un par nuevo (configuración), y el contrato que B5/B6/B11
  consumirán al reactivarse.

## Tests automatizados requeridos

- **Segregación estricta:** insertar `:SegmentoTraduccion` en
  `docyan_dtm_<t>_en-US_es-MX` y otro en `docyan_dtm_<t>_en-US_es-ES`; query a
  cada grafo retorna solo el suyo. Cruce → cero resultados.
- **Schema TM dual:** crear `:Glosario` tipo `cliente` y otro tipo `agencia` en
  el mismo grafo; relaciones `:USA_GLOSARIO` con `prioridad` correcta;
  recuperación verifica la `prioridad` en la arista.
- **Lock como propiedad:** crear `:Glosario` con `lock_terminologico=true` y
  otro con `false`; query lee la propiedad correctamente. No se prueba
  reemplazo de términos (eso es B5).
- **23 tipos de segmento:** test parametrizado que verifica que los 23 valores
  son aceptados y un valor fuera de la lista es rechazado loud.
- **Aristas DTM internas:** crear las 6 aristas (`:PERTENECE_A_PROYECTO`,
  `:RECIBIO_REVISION`, `:CONTIENE_TERMINO`, `:USA_GLOSARIO`,
  `:USA_TERMINO_GLOSARIO`, `:CANDIDATA_PARA_GLOSARIO`) y verificar persistencia.
- **Aristas cross DKG↔DTM:** crear un `:Especificacion` en el DKG y un
  `:SegmentoTraduccion` en el DTM del mismo tenant, vincular vía
  `:TRADUCIDA_VIA`, verificar que la arista persiste y es navegable.
- **Provisioning multi-tenant:** llamar a `provision_dtm_graphs_for_tenant(
  test_tenant)` y verificar que los 5 grafos quedan creados con schema, vacíos.
- **Idempotencia:** llamar a provisioning dos veces — segunda llamada no
  duplica grafos ni rompe.
- **5 pares iniciales canónicos:** validar que `graph_name_for_pair` genera el
  nombre correcto para los 5 pares y normaliza variantes (orden, casing).

Política balanceada (decisión cerrada): backend pesado en este sprint, sin
frontend. Cobertura mínima 80% sobre los archivos nuevos.

## Salida verificable (todas obligatorias antes de cerrar)

- ✅ `app/graph/schemas/dtm_ontology.py`, `dtm_segregation.py`,
  `dtm_provisioning.py`, `dkg_dtm_bridge.py` existen, importan, pasan ruff y
  mypy.
- ✅ `provision_dtm_graphs_for_tenant("smoke-test-tenant")` ejecutado contra
  el `docyan-lde-graph` desplegado en Fly crea los 5 grafos con schema. Opus
  ejecuta y reporta evidencia.
- ✅ Suite de tests verde (los nuevos + todos los anteriores).
- ✅ CI verde en los 3 jobs sobre `sprint/B3-dtm-cimientos`.
- ✅ `docs/dtm_modelo.md` documenta el modelo y el contrato que B5/B6/B11
  consumirán.
- ✅ Migración (si aplica) aplicada en Supabase.
- ✅ Smoke test mínimo del DTM: crear segmento, glosario, término, sugerencia,
  registro de revisión en un tenant de prueba; verificar que existen vía
  consulta directa al grafo. Opus ejecuta y reporta evidencia.
- ✅ Merge a `main` con CI verde.
- ✅ Reporte final único.

## Lo que NO se construye (alcance declarado, no diferido oculto)

Lo siguiente NO entra en B3 — se construye al reactivarse traducción:

- **B5 — Motor de traducción:** búsqueda priorizada de TM Dual en runtime,
  fuzzy matching híbrido (Levenshtein + BGE-M3), lock activo que reemplaza
  términos, sugerencias EDB en runtime, ranking del tabulador (100% / 95-99% /
  85-94% / 75-84% / 50-74% / 0-49%), umbral léxico ≥30% para invocar vectorial.
- **B6 — Ingesta bilingüe Pista B:** alineadores Vecalign + Hunalign,
  importadores TMX/XLIFF/TBX/SDLXLIFF/Bilingual DOCX, exportador TMX 1.4 /
  XLIFF 2.0 / TBX con metadata `x-docyan-*`, flujo de creación de aristas
  cross en runtime de ingesta.
- **B11 — UI de revisión lingüística:** ya diferida en la Adenda.

Estos NO son "no bloqueantes" — son **alcance declarado** que se desbloquea
cuando un cliente real pida traducción rigurosa (disparador de reactivación
documentado en la Adenda).

## Notas para Opus

- Reutilizar la fachada de FalkorDB construida en B1 (`docyan_graph.py` o
  equivalente). No recrear la conexión.
- BGE-M3 self-hosted (`docyan-lde-embedder`) NO se invoca en B3 (no hay
  matching activo en este sprint). Su uso es para B5.
- El `tenant_id` viene del flujo del backend (`docyan-lde-api`), respetando
  el modelo multi-tenant cerrado en doc 09.
- Si al implementar las aristas cross descubres que un nodo del DKG no admite
  la arista por una restricción del schema actual, ajustarlo aquí — mínimo y
  documentado.
- **Verdad operacional:** si algo del modelado en docs no se puede
  implementar tal cual por una restricción real (de FalkorDB, del SDK, de
  Cypher), no inventar. Documentar el ajuste y la razón.
- **No dejar "no bloqueantes":** si destapas un bug en código existente al
  implementar B3 (como pasó con Supabase en B0.6, Redis IPv4 en B2.1,
  autosuspend del worker en B2.2), arréglalo en el sprint, no lo dejes
  pendiente. Si no puedes arreglarlo dentro de B3 sin desbordar alcance,
  repórtalo como **bloqueador** al final del reporte, no como diferimiento
  difuso.
- Tienes acceso a `.env` local, a Fly autenticado, a Supabase, a git y a
  GitHub. Ejecuta hasta cierre. No requieres comandos manuales de Jorge para
  nada de la ejecución (Jorge revisa el reporte final).
- Sin exposición de secrets en el reporte. Si necesitas referenciar un valor
  sensible, usa digest hash o nombre del secret.

## Reglas de ejecución

- No stubs, no mocks (excepto tests), no hardcoded de valores que deban venir
  de configuración. Alcance completo dentro del scope acotado.
- Verdad operacional sobre proyección aspiracional.
- Sin pelota de regreso a Jorge para confirmaciones intermedias. Las
  definiciones están en doc 02, doc 07, doc 09, doc 12 y la Adenda MVP.
- Un solo reporte final.

## Referencias

- **Adenda MVP:** `docs/DOCYAN_Adenda_Alcance_MVP_ConsultaViva.md` (alcance).
- **Doc 02:** modelo DTM (nodos, aristas, los 23 tipos, segregación).
- **Doc 07:** reglas de gobernanza (regla F1 sobre lock — referencia para
  consumidores futuros).
- **Doc 09:** multi-tenancy y roles.
- **Doc 12:** interfaces con motor de traducción (contrato que B5 consumirá).
- **Plan postPoC:** `docs/Plan_Desarrollo_MVP_DOCYAN_v2_postPoC.md`.
- **15 decisiones del Paso C** (especialmente #1 BGE-M3, #2 matching híbrido —
  esta última latente en B3, activa en B5).

Commit sugerido: `feat(B3): DTM schema + segregación por par + cimientos de TM
dual y lock (Adenda MVP)`.
Push a `sprint/B3-dtm-cimientos`. Merge a `main` cuando CI verde.
