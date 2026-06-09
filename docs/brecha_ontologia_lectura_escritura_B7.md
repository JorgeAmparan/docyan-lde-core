# Brecha de ontología escritura↔lectura — alcance pendiente de B7

> **Estado:** documentado, NO construido. Insumo para Sprint Contract de B7.
> **Fecha:** 8 junio 2026. **Autor del diagnóstico:** Claude (Opus 4.8), verificado contra FalkorDB real.
> **Resumen en una línea:** los 8 pipelines de consulta (`/mo/query`) están implementados y son correctos como código, pero **leen un grafo con un shape (labels/edges/propiedades) que la ingesta de hoy no produce**. Solo Tipo 1 y Tipo 2 tienen datos, y aun esos salen incompletos (sin valor/unidad, sin citas, sin pasos enlazados).

---

## 1. Cómo se verificó (test real, reproducible)

Contra un FalkorDB real (`localhost:6379`), se poblaron dos grafos de tenant y se ejecutó el **código de producción** (`app/pipelines/dkg_reader.py:DKGReader` + los resolvers `tipo1_informativa` / `tipo2_guia_paso_a_paso`):

- **Escenario A — "como ingiere el worker hoy":** nodos/aristas idénticos a lo que `DocumentSchema.to_sdk_schema()` produce desde el catálogo (`app/schemas_documentales/catalogo/*`). Es decir, label = `EntidadSchema.label`, edge-type = `RelacionSchema.label`. SIN `:DocumentoSource`.
- **Escenario B — "como el reader espera leer":** el shape que el Cypher del reader realmente consulta.

Resultado (literal del test):

| | Tipo 1 — InfoCard | Tipo 2 — ProcedureCard |
|---|---|---|
| **Escenario A (ingesta real)** | spec hallada por nombre, pero `valor=None`, `unidad=None`, **`citas=[] (len=0)`** | título OK, **`pasos=0`** |
| **Escenario B (shape esperado)** | `valor=85`, `unidad=N·m`, **cita llena** (doc1 · §4.2.1 · pág 12) | **2 pasos** con EPP/herramientas/advertencias |

**Conclusión del test:** las citas llegan **VACÍAS** con la ingesta actual. El código del reader es correcto (Escenario B lo demuestra); la brecha está en el *seam* escritura↔lectura, no en lectura. El test confirmó además que el problema excede a las citas: en Tipo 1 el valor/unidad también salen vacíos y en Tipo 2 los pasos no se enlazan.

> Nota: el test simula fielmente el shape documentado de salida del SDK (label=entidad, edge=relación), no invoca el extractor LLM en vivo (Gemini). Eso es deliberado: aísla la cuestión de ontología de la variabilidad del LLM.

---

## 2. Hallazgo transversal #1 — no existe el nodo de procedencia `:DocumentoSource`

Las citas de **Tipo 1** y la comparación de versiones de **Tipo 8** dependen de un nodo `:DocumentoSource` enlazado a las entidades de dominio:

```cypher
OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(e)   -- tipo1_informativa
RETURN d.id AS documento_id, d.tipo_documento AS documento_nombre
```

Pero:
- **Ningún schema del catálogo define `:DocumentoSource` ni la arista `:CONTIENE`.** (Verificado: `grep` sobre `app/schemas_documentales/catalogo/` no encuentra ninguna.)
- GraphRAG-SDK crea su **propia** procedencia: `:Document` / chunks + `MENTIONED_IN` / `PART_OF` / `NEXT_CHUNK` + spans de caracteres. **No** crea `:DocumentoSource` ni `:CONTIENE`.

➡️ **Falta un paso de "bridge de procedencia"**: al cerrar cada ingesta, registrar el documento como `:DocumentoSource` (con `id`, `tipo_documento`, `version_documento`, `hash_contenido`, `seccion`, `pagina`) y enlazarlo a las entidades de dominio extraídas vía `:CONTIENE`. Sin esto, **ninguna cita se llena, nunca**, en ningún tipo. Es la pieza de mayor palanca (desbloquea citas en 1, 2 y comparación en 8).

`:DocumentoSource` ya existe en la ontología (`app/graph/schemas/dkg_ontology.py:74,187-193`) con su modelo Pydantic — falta producirlo en ingesta.

---

## 3. Hallazgo transversal #2 — spans de caracteres no llegan a la cita

`Cita` (en `app/schemas/pipeline_payloads.py:28-36`) tiene `span_inicio` / `span_fin`, y el SDK genera spans nativos en `MENTIONED_IN`. Pero el reader **no** los lee (no hay `span_inicio`/`span_fin` en ningún `RETURN`), y la ingesta no los aterriza en `:Especificacion`/`:DocumentoSource`. El demo público promete resaltado al span exacto; el motor no lo entregará hasta cablear span SDK → propiedad de cita.

---

## 4. Alcance por pipeline (qué nodos/aristas faltan crear en ingesta)

Leyenda: **LEE** = lo que el reader consulta (con `dkg_reader.py:línea`). **ESCRIBE HOY** = lo que la ingesta del catálogo produce. **FALTA** = el trabajo de B7.

### Tipo 1 — Informativa → InfoCard  *(parcial: aparece pero incompleto)*
- **LEE** (`dkg_reader.py:53-83`): `:Especificacion{nombre,valor,unidad,seccion,pagina}`; `:DocumentoSource-[:CONTIENE]->:Especificacion`; `:TerminoTecnico{termino,definicion}`.
- **ESCRIBE HOY** (`especificacion.py`): `:Especificacion{nombre,descripcion,categoria}`, `:ParametroTecnico{nombre,valor_nominal}`, `:Tolerancia`, `:UnidadMedida{simbolo,nombre}`; aristas `DEFINE_PARAMETRO`, `TIENE_TOLERANCIA`, `EXPRESADO_EN`.
- **FALTA:**
  1. El **valor numérico y la unidad** viven en `:ParametroTecnico.valor_nominal` y `:UnidadMedida.simbolo`, no en `:Especificacion`. → O bien el reader debe recorrer `DEFINE_PARAMETRO`/`EXPRESADO_EN`, o la ingesta debe denormalizar `valor`/`unidad` sobre `:Especificacion`. **Decisión PENDIENTE DE JORGE** (cambiar lectura vs cambiar escritura).
  2. `:DocumentoSource-[:CONTIENE]->` + `seccion`/`pagina` → citas (ver §2).
  3. `:TerminoTecnico` no lo produce ningún schema → la definición sale vacía. Falta extraerlo (o derivarlo).

### Tipo 2 — Guía paso a paso → ProcedureCard  *(parcial: título sí, pasos no)*
- **LEE** (`dkg_reader.py:87-111`): `:Procedimiento{nombre}`; `(:Procedimiento)-[:CONTIENE]->(:Paso{orden,descripcion,precondiciones,postcondiciones})`; `(:Paso)-->(:EPP)`, `(:Paso)-->(:Herramienta)`, `(:Paso)-->(:Advertencia)`.
- **ESCRIBE HOY** (`manual_tecnico.py`): `:Procedimiento{nombre,objetivo,ambito}`, `:Paso{numero,descripcion,resultado_esperado}`, `:Advertencia`, `:Herramienta`, `:EPP`; aristas `CONTIENE_PASO` (Proc→Paso), `TIENE_ADVERTENCIA` (Paso→Adv), `REQUIERE_HERRAMIENTA` (Paso→Herr), `REQUIERE_EPP` (**Proc→EPP**).
- **FALTA / MISMATCH:**
  1. **Arista Proc→Paso:** reader usa `:CONTIENE`, ingesta escribe `:CONTIENE_PASO`. → **0 pasos**. (Alinear nombre de arista, en uno de los dos lados.)
  2. **Orden del paso:** reader ordena por `paso.orden`, ingesta guarda `paso.numero`. → pasos sin orden.
  3. **EPP:** reader lo busca colgando del `:Paso`; ingesta lo cuelga del `:Procedimiento` (`REQUIERE_EPP`). → EPP nunca aparece en los pasos.
  4. `precondiciones`/`postcondiciones` no se extraen.
  5. **Citas:** `ProcedureCardPayload.citas` existe (`pipeline_payloads.py:92`) pero el resolver **nunca lo llena** (`tipo2_guia_paso_a_paso.py` no construye `Cita`). Bug del resolver + falta `:DocumentoSource`.

### Tipo 3 — Gráficos/diagramas → DiagramViewer  *(sin datos: 0%)*
- **LEE** (`dkg_reader.py:115-132`): `:RecursoVisual{titulo|nombre,url}`; `(:RecursoVisual)-[:CONTIENE]->(:Etiqueta{texto,x,y})`; `(:RecursoVisual)-[:CONTIENE]->(:LeyendaSimbolica{simbolo,significado})`.
- **ESCRIBE HOY:** nada. Ningún schema produce estas labels.
- **FALTA (todo):** mecanismo de ingesta de recursos visuales (Docling extrae imágenes/figuras del documento) que cree `:RecursoVisual` con `url` del asset + `:Etiqueta` con coordenadas `x,y` + `:LeyendaSimbolica` + aristas `:CONTIENE`. Requiere: (a) extracción de figuras como assets, (b) detección de etiquetas/callouts con coordenadas, (c) storage de assets con URL servible. **Es trabajo de extracción multimodal nuevo, no solo un schema.**

### Tipo 4 — Video → VideoPlayer  *(sin datos: 0%)*
- **LEE** (`dkg_reader.py:136-158`): `:RecursoVideo{titulo|nombre,url,par_activo}`; `-[:CONTIENE]->:Capitulo{titulo,inicio_seg}`; `-[:CONTIENE]->:Subtitulo{idioma,texto,inicio_seg,fin_seg}`; `-[:CONTIENE]->:Transcripcion{texto}`.
- **ESCRIBE HOY:** nada.
- **FALTA (todo):** una vía de ingesta de video (no es Docling). Define el origen de los videos (¿se suben? ¿se referencian?), y la extracción de capítulos/subtítulos/transcripción. La bandera honesta `subtitulos_disponibles_en_par_activo` ya está prevista. **Posible candidato a diferir más allá de B7** según prioridad comercial (Pista A industrial puede no requerir video al inicio). PENDIENTE DE JORGE: ¿entra video en B7 o se difiere?

### Tipo 5 — Troubleshooting → DiagnosticTree  *(sin datos: 0%)*
- **LEE** (`dkg_reader.py:162-207`): `:ArbolDiagnostico{titulo|nombre}`; `-[:CONTIENE]->:NodoDecision{orden,pregunta}`; `(:NodoDecision)-[rel]->(:NodoDecision)` con `rel.etiqueta` (las opciones); `-[:CONTIENE]->:CausaProbable{descripcion}`; `-[:CONTIENE]->:AccionResolutoria{descripcion}`.
- **ESCRIBE HOY:** nada.
- **FALTA (todo):** schema de extracción de árboles de diagnóstico desde manuales de troubleshooting. Lo no trivial: las **aristas entre `:NodoDecision` deben llevar una propiedad `etiqueta`** (el texto de la opción: "Sí"/"No"/"enciende pero no arranca"). El SDK extrae aristas tipadas pero hay que verificar que pueda poblar propiedades de arista. Estructura recursiva (árbol) difícil de extraer de forma fiable por LLM — probablemente requiera prompt especializado + validación de conectividad del árbol.

### Tipo 6 — Historial → Timeline  *(parcial frágil)*
- **LEE** (`dkg_reader.py:211-247`), opcionalmente scopeado por `(:EntidadOperativa{id})-[]->(x)`:
  `:EventoOperativo{tipo,consulta_texto|descripcion,timestamp}`; `:CertificadoVigencia{nombre|descripcion,fecha_vencimiento|timestamp}`; `:Observacion{texto,timestamp}`; `:MedicionRegistrada{descripcion|nombre,timestamp}`. Ordena por `ts DESC`.
- **ESCRIBE HOY:**
  - `:EventoOperativo` — lo escribe el **MO** best-effort en cada consulta (`consulta_realizada`), NO la ingesta de documentos. → la timeline tiene historial de consultas, no eventos del documento.
  - `:CertificadoVigencia` — **NO existe**; `calibracion.py` produce `:CertificadoCalibracion` (label distinto) + `:FechaVencimiento` + `:MedicionRegistrada`.
  - `:MedicionRegistrada` — **label coincide** (lo produce `calibracion.py`), pero la ingesta no le pone `timestamp` ni la enlaza a `:EntidadOperativa`. → `ORDER BY ts` la deja sin orden y el scope por entidad no la encuentra.
  - `:Observacion` — proviene de la función de anotaciones (Adenda §7), no de ingesta.
- **FALTA:**
  1. Mismatch label: `:CertificadoVigencia` (lee) vs `:CertificadoCalibracion` (escribe) — alinear.
  2. `timestamp` en mediciones/certificados al ingerir.
  3. Enlace `:EntidadOperativa-[]->(x)` para el scope por equipo (hoy las entidades de ingesta no cuelgan de la EntidadOperativa/QR).

### Tipo 7 — Alertas → AlertsDashboard  *(sin datos: 0%, + gate regulatorio)*
- **LEE** (`dkg_reader.py:251-269`): `:Alerta{id,descripcion|nombre,fecha_vencimiento,urgencia,tipo,entidad_id}`, opcional scope `(:EntidadOperativa{id})-[]->(:Alerta)`.
- **ESCRIBE HOY:** nada produce `:Alerta`. (`calibracion.py` sí produce `:FechaVencimiento`, la materia prima.)
- **FALTA (todo):** las alertas **no se extraen, se generan**. Mecanismo (APScheduler + `:ReglaAlerta`, ambos ya en ontología `dkg_ontology.py:106-107`) que derive `:Alerta` administrativas desde `:FechaVencimiento`/`:CertificadoVigencia`. **Crítico:** pasa por `app/alerts/safety_validator.py` (línea regulatoria ABSOLUTA, CLAUDE.md §11.1) — solo administrativas, jamás clínicas/operativas. La fuente de datos (vencimientos) ya se ingiere; falta el generador + el gate.

### Tipo 8 — Comparativa → ComparativeView  *(sin datos: 0%)*
- **LEE** (`dkg_reader.py:273-293`):
  - `versiones_documento`: `:DocumentoSource{id}` con `tipo_documento`, `version_documento`, `hash_contenido`.
  - `entidades_mismo_tipo`: `:EntidadOperativa{id}` con `tipo`, `estado_ciclo_vida`, `sitio`.
- **ESCRIBE HOY:** `:DocumentoSource` no se crea en ingesta (ver §2). `:EntidadOperativa` se crea por backend (onboarding/QR), no por ingesta.
- **FALTA:** registrar cada documento ingerido como `:DocumentoSource` con `version_documento` + `hash_contenido` (el `content_sha256` ya existe en el job — `worker/ingest_pipeline.py:199`). Con el bridge de §2, la estrategia `versiones_documento` queda cubierta; `entidades_mismo_tipo` ya tiene de dónde leer si las entidades de ingesta se enlazan a `:EntidadOperativa` (ver Tipo 6.3).

---

## 5. Resumen ejecutivo de la brecha

| Tipo | Pipeline | Estado hoy | Pieza que falta (resumen) |
|---|---|---|---|
| 1 | InfoCard | parcial (sin valor/unidad/cita) | valor/unidad desde ParametroTecnico + bridge DocumentoSource + TerminoTecnico |
| 2 | ProcedureCard | parcial (sin pasos) | alinear `:CONTIENE`/`:CONTIENE_PASO`, `orden` vs `numero`, EPP→Paso, citas |
| 3 | DiagramViewer | 0% | extracción multimodal de figuras + etiquetas con coords + assets servibles |
| 4 | VideoPlayer | 0% | vía de ingesta de video (¿diferir?) |
| 5 | DiagnosticTree | 0% | extracción de árbol + propiedad `etiqueta` en aristas NodoDecision |
| 6 | Timeline | parcial frágil | label CertificadoVigencia, timestamp en mediciones, enlace a EntidadOperativa |
| 7 | AlertsDashboard | 0% | generador de alertas (APScheduler+ReglaAlerta) + safety_validator, desde vencimientos ya ingeridos |
| 8 | ComparativeView | 0% | bridge DocumentoSource con version/hash (content_sha256 ya existe) |

**Tres piezas transversales de máxima palanca (desbloquean varios tipos a la vez):**
1. **Bridge de procedencia `:DocumentoSource` + `:CONTIENE`** al cerrar ingesta → desbloquea citas (1, 2) y comparación de versiones (8).
2. **Enlace de entidades de ingesta a `:EntidadOperativa` (QR)** → desbloquea scope por equipo en historial (6) y `entidades_mismo_tipo` (8).
3. **Decisión de denormalización valor/unidad y alineación de nombres de arista** (`CONTIENE` vs `CONTIENE_PASO`, etc.) entre catálogo y reader → arregla 1 y 2 de inmediato y fija la convención para 3-7.

**PENDIENTE DE JORGE (decisiones de modelado, no las tomo yo):**
- A. ¿Se ajusta la **lectura** (readers recorren las aristas del catálogo) o la **escritura** (catálogo/ingesta denormaliza al shape que el reader espera)? Afecta a los 8.
- B. ¿Entra **Video (Tipo 4)** en B7 o se difiere por prioridad de Pista A industrial?
- C. Para **Tipo 3/5** (diagramas y árboles), ¿extracción automática por LLM/multimodal, o curación asistida? La extracción fiable de árboles de decisión y coordenadas de etiquetas es el trabajo más incierto del bloque.
