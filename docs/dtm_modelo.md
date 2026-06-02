# DTM — Document Translation Memory (modelo / cimientos B3)

> **Estado:** B3 (Adenda MVP) — **solo cimientos del modelo**. No hay motor de
> traducción, ni fuzzy matching en runtime, ni lock activo, ni export TMX/XLIFF.
> Eso es B5/B6/B11 y se reactiva **sin migración** sobre lo que aquí se construye.
>
> **Fuente canónica del modelo:** doc 02. Reglas que el lock soportará: doc 07
> (regla F1). Multi-tenancy y roles: doc 09. Interfaces con el motor: doc 12.

El DTM **no es una TM tradicional plana**. Es un **grafo ontológico de
equivalencias técnicas** con contexto operacional, sobre el mismo motor que el
DKG (FalkorDB vía GraphRAG-SDK), pero en **grafos distintos segregados por par
lingüístico**.

---

## 1. Segregación estricta por par lingüístico

Cada par **direccional** vive en su propio `graph_name`. No hay cruce posible: el
aislamiento es físico, a nivel de FalkorDB, no un filtro de aplicación evadible.

```
docyan_dtm_{tenant_id}_{par_id}
```

`par_id` es la representación canónica del par direccional, p. ej. `en-US_es-MX`.
La dirección importa: `en-US→es-MX` y `es-MX→en-US` son grafos distintos
(contexto, glosario y lock difieren por dirección).

**Helper único de resolución** (`app/graph/dtm_segregation.py`):

```python
graph_name_for_pair(tenant_id, source_lang, target_lang)
# ('acme', 'en-US', 'es-MX') -> 'docyan_dtm_acme_en-US_es-MX'
```

Normaliza casing/​separador BCP-47 (idioma en minúscula, región en mayúscula;
acepta `-` o `_`), de modo que `EN-us`, `en_US` y `en-US` resuelven al mismo grafo.

### 5 pares iniciales (día 1)

| origen | destino | par_id |
|---|---|---|
| en-US | es-MX | `en-US_es-MX` |
| en-US | es-US | `en-US_es-US` |
| en-US | es-ES | `en-US_es-ES` |
| en-UK | es-MX | `en-UK_es-MX` |
| en-UK | es-ES | `en-UK_es-ES` |

### Agregar un par nuevo = configuración, no código

Un par nuevo se habilita añadiéndolo a `INITIAL_PAIRS` (provisioning automático
en onboarding) **o** pasándolo directo a `graph_name_for_pair`. **Agnóstico a
idioma**: ninguna lógica nueva. `normalize_lang` no valida contra IANA — DOCYAN
admite `en-UK` como lo define el negocio.

---

## 2. Nodos (modelo, `app/graph/schemas/dtm_ontology.py`)

**5 nodos de dominio** (los que el contrato B3 §1 enumera):

| Nodo | Propósito | Propiedades clave |
|---|---|---|
| `:SegmentoTraduccion` | Unidad de equivalencia origen↔destino | `texto_origen`, `texto_destino`, `idioma_origen`, `idioma_destino` (BCP-47), `tipo_segmento` (enum 23), `contexto`, `dominio`, `cliente_id`, `aprobado_por`, `score_calidad`, `uso_contador`, `version_glosario` |
| `:Glosario` | Glosario cliente / agencia / proyecto | `tipo_glosario`, `par_linguistico`, `version`, **`lock_terminologico` (bool)** |
| `:TerminoGlosario` | Término individual con prioridad | `texto_origen`, `texto_destino`, `definicion`, `dominio`, `prioridad` |
| `:RegistroRevision` | Acción de revisión sobre un segmento | `revisor_id`, `rol_revisor` (enum), `accion` (enum), `texto_anterior`, `texto_nuevo` |
| `:SugerenciaTermino` | Candidato a término detectado | `texto_origen`, `texto_destino_sugerido`, `dominio_inferido`, `frecuencia_aparicion`, `estado` (enum) |

**2 nodos estructurales** (no de dominio, soportan el modelo):

- `:Proyecto` — ancla de `:PERTENECE_A_PROYECTO`. Su metadato relacional vive en
  Supabase (`dtm_projects`, migración 010); el grafo lleva solo `proyecto_id`.
- `:ReferenciaDKG` — nodo puente de provenance cross-grafo (ver §6).

Todo nodo lleva además `tenant_id`, `created_at`/`updated_at` e `id` estable.

### 2.1. Los 23 tipos de segmento (`tipo_segmento`, enum CERRADO)

`narrativa`, `especificacion`, `instruccion_paso`, `advertencia`,
`etiqueta_diagrama`, `leyenda_simbolica`, `subtitulo`, `transcripcion`,
`nodo_diagnostico_pregunta`, `nodo_diagnostico_respuesta_etiqueta`,
`causa_probable`, `accion_resolutoria`, `descripcion_evento`,
`observacion_descripcion`, `accion_correctiva`, `mensaje_alerta`,
`consecuencia_no_accion`, `accion_recomendada_alerta`,
`resumen_ejecutivo_comparativo`, `descripcion_diferencia`,
`accion_sugerida_comparativa`, `requisito_normativo`,
`modulo_formativo_contenido`.

Un `:SegmentoTraduccion` con un `tipo_segmento` fuera de estos 23 **falla loud**
en `validate_dtm_node` (no se inserta silenciosamente).

### Otros enums cerrados

- `tipo_glosario`: `cliente` / `agencia` / `proyecto`.
- `rol_revisor`: `traductor` / `revisor_agencia` / `revisor_cliente`.
- `accion` (revisión): `aprobar` / `editar` / `rechazar` / `comentar`.
- `estado` (sugerencia): `propuesta` / `aceptada` / `rechazada` / `reportada_al_cliente`.

---

## 3. TM dual modelada (cliente > agencia)

La distinción **TM Cliente vs TM Agencia** se modela en el grafo:

- `tipo_glosario` en `:Glosario` (`cliente` / `agencia`).
- `cliente_id` en `:SegmentoTraduccion`.
- La arista `:USA_GLOSARIO` (segmento → glosario) lleva `prioridad`, que registra
  el orden **cliente > agencia** (p. ej. `prioridad=1` cliente, `prioridad=2`
  agencia).

**El motor que CONSULTA esta prioridad en runtime es B5.** Aquí solo se modela la
estructura: la prioridad vive en la arista y es recuperable.

---

## 4. Lock terminológico — solo propiedad de schema

`:Glosario.lock_terminologico` es un `bool`. **Solo modelo.** El constraint
generator que en B5 lo leerá para reemplazar términos en runtime **no** se
construye aquí. Detalle del contrato para B5: `docs/dtm_modelo_lock.md`.

---

## 5. Aristas

**Internas del DTM** (6, todas dentro del mismo grafo de par):

| Arista | Origen → Destino |
|---|---|
| `:PERTENECE_A_PROYECTO` | `:SegmentoTraduccion` → `:Proyecto` |
| `:RECIBIO_REVISION` | `:SegmentoTraduccion` → `:RegistroRevision` |
| `:CONTIENE_TERMINO` | `:Glosario` → `:TerminoGlosario` |
| `:USA_GLOSARIO` (con `prioridad`) | `:SegmentoTraduccion` → `:Glosario` |
| `:USA_TERMINO_GLOSARIO` | `:SegmentoTraduccion` → `:TerminoGlosario` |
| `:CANDIDATA_PARA_GLOSARIO` | `:SugerenciaTermino` → `:Glosario` |

**Cross DKG↔DTM** (2): `:TRADUCIDA_VIA`, `:TRADUCIDO_DESDE` — ver §6.

---

## 6. Puente DKG↔DTM — verdad operacional

**Restricción real de FalkorDB:** una arista **no puede unir nodos de dos grafos
distintos**. El DKG vive en `docyan_tenant_<id>`; el DTM, en
`docyan_dtm_<id>_<par>`. Una arista cross *literal* entre ambos es imposible — no
es decisión de diseño, es el motor.

El puente (`app/graph/dkg_dtm_bridge.py`) la realiza de la forma fiel posible
respetando el aislamiento:

1. El **tipo** de arista queda registrado en el schema del DKG
   (`EdgeType.TRADUCIDA_VIA` / `TRADUCIDO_DESDE` + `DKG_TRANSLATABLE_LABELS`).
2. Al vincular, dentro del grafo DTM del par se crea un nodo puente
   `:ReferenciaDKG` con las coordenadas del nodo DKG de origen (`dkg_node_id`,
   `dkg_label`, `dkg_graph_name`) y una arista **real**
   `(:ReferenciaDKG)-[:TRADUCIDA_VIA]->(:SegmentoTraduccion)`.
3. La arista **persiste y es navegable** dentro del grafo DTM; la resolución
   completa hacia el nodo DKG se hace por coordenadas (única vía dada la
   segregación).

`DKG_TRANSLATABLE_LABELS` (nodos DKG que admiten versión bilingüe, verificado en
B3 §6 sin requerir migración): `Especificacion`, `Paso`, `Advertencia`,
`Subtitulo`, `Transcripcion`, `LeyendaSimbolica`, `Etiqueta`, `CausaProbable`,
`AccionResolutoria`, `Observacion`, `RequisitoNormativo`, `TerminoTecnico`.

> **Alcance B3:** el puente expone `link_dkg_to_dtm` / `navigate_translations`
> para **demostrar** que la estructura soporta el vínculo. El **flujo de creación
> en runtime** durante la ingesta bilingüe es **B6**; la **lectura por el motor
> de traducción** es **B5**.

---

## 7. Provisioning de grafos por tenant

`app/graph/dtm_provisioning.py`:

```python
provision_dtm_graphs_for_tenant(tenant_id)  # -> reporte por par
```

Crea (o asegura) los 5 grafos DTM iniciales del tenant **vacíos y con schema
aplicado**, **idempotente**. "Schema aplicado" = índices por etiqueta+propiedad
(`DTM_INDEXED_PROPERTIES`): materializa el grafo en `GRAPH.LIST` aunque no tenga
datos y deja los índices que B5/B6 necesitarán (lookup por par/tipo/cliente/estado).

Idempotencia: FalkorDB lanza `Attribute '<x>' is already indexed` si el índice ya
existe; se captura como no-op. Llamar dos veces no duplica grafos ni índices.

Para tenants nuevos, el **onboarding (B13)** invocará esta función; B3 la expone.

---

## 8. Contrato que B5 / B6 / B11 consumirán al reactivarse

Lo construido en B3 queda listo para que, **sin migración**:

- **B5 — Motor de traducción** lea:
  - Prioridad de TM dual desde `:USA_GLOSARIO.prioridad` (cliente > agencia).
  - `:Glosario.lock_terminologico` para activar el reemplazo de términos
    (contrato en `docs/dtm_modelo_lock.md`).
  - Segmentos por `tipo_segmento`, `cliente_id`, par (índices ya creados) para el
    fuzzy matching híbrido (Levenshtein + BGE-M3) y el tabulador.
- **B6 — Ingesta bilingüe** cree en runtime los vínculos cross DKG↔DTM vía
  `link_dkg_to_dtm` (`:TRADUCIDA_VIA` / `:TRADUCIDO_DESDE`) y pueble
  `:SegmentoTraduccion` / `:Glosario` / `:TerminoGlosario`.
- **B11 — UI de revisión lingüística** lea/escriba `:RegistroRevision`
  (`rol_revisor`, `accion`) y `:SugerenciaTermino` (`estado`).

Disparador de reactivación: primer cliente real que pida traducción rigurosa
(documentado en la Adenda MVP).

---

## 9. Componentes en código

| Archivo | Rol |
|---|---|
| `app/graph/schemas/dtm_ontology.py` | Nodos, aristas, enums, validación, summary |
| `app/graph/dtm_segregation.py` | `graph_name_for_pair`, 5 pares, normalización |
| `app/graph/dtm_client.py` | Fachada DTM (reusa la conexión FalkorDB de B1) |
| `app/graph/dtm_provisioning.py` | `provision_dtm_graphs_for_tenant` (idempotente) |
| `app/graph/dkg_dtm_bridge.py` | Aristas cross + nodo puente `:ReferenciaDKG` |
| `migrations/010_dtm_projects.sql` | Registro relacional de proyectos (Supabase) |

Tests: `tests/test_dtm_ontology.py`, `tests/test_dtm_segregation.py`,
`tests/test_dtm_graph_integration.py`, `tests/test_dtm_provisioning.py`,
`tests/test_dtm_bridge.py`.
