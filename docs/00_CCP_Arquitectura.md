# DOCYAN LDE™ — Capa de Contexto Persistente (CCP / PCL)

**Live Document Environment by XCID**
XCID SA de CV — Junio 2026 — Documento de arquitectura canónico

> Este documento fija la **arquitectura de la Capa de Contexto Persistente** y
> su nomenclatura. No reabre las 15 decisiones del Paso C ni reordena el plan
> de 14 bloques. Hace explícito y unificado lo que ya está modelado en piezas
> separadas (FAT, consultas guardadas, sugerencias EDB, playbooks, chat
> persistente) y añade la pieza faltante (caché semántico + retrieval-first vs
> synthesis-first) que el modelo de pricing necesita para ser viable.
>
> **Estatus:** estructura cerrada. Cifras finales del pricing siguen abiertas
> (decisión #13 del Paso C: tras primer cliente real).

---

## 1. Qué es la CCP y qué no es

La **Capa de Contexto Persistente (CCP)** es la maquinaria interna que sostiene
la **continuidad del conocimiento** en DOCYAN: lo que un usuario consulta hoy
informa lo que se le ofrece mañana; lo que el sistema observa en patrones de
uso se vuelve playbook; lo que se cristaliza como playbook abarata las
consultas futuras. **Un solo flujo de datos con tres densidades crecientes.**

La CCP **no es** un producto comercializable separado, no es una funcionalidad
visible, no es una sustitución de Playbooks ni del FAT. La CCP es la **columna
arquitectónica** que hace que Playbooks, FAT, EDB y caché semántico **operen
como una sola capa**, no como cuatro silos.

La CCP **sirve tres propósitos simultáneamente**:

1. **Foso del producto.** Es la materialización técnica del Nivel 3 (inteligencia
   organizacional, conocimiento tácito retenido).
2. **Defensa de margen.** Es lo que permite ofrecer "consulta holgada" sin
   margen negativo a escala. Sin caché semántico + retrieval-first, una
   licencia plana + consultas ilimitadas es financieramente inviable.
3. **Densidad creciente del valor del cliente.** Cada cliente que usa DOCYAN
   acumula memoria, patrones detectados y playbooks que **no son
   replicables por un competidor genérico** porque están atados a su grafo
   de conocimiento.

Un cliente sin CCP es un cliente que paga inferencia LLM por cada consulta y
cuyo valor se evapora si se va de DOCYAN. Un cliente con CCP madura paga
consultas que mayormente son caché o retrieval y deja un foso de Playbooks
que es propiedad del entorno DOCYAN. La diferencia financiera y de retención
no es marginal.

---

## 2. Nomenclatura cerrada

### 2.1 La unidad de cliente: CoDo / DoCo

Un **Contexto Documental (CoDo en español / DoCo en inglés)** es el agrupador
que el cliente compra y mantiene: un acervo coherente de documentos en una
organización, con su DKG, sus DTM, sus alertas, sus playbooks, sus
consultas. Es lo que en código actual se llama `tenant` o `org` y lo que el
modelo de pricing identifica como eje del tier ("documentos vivos /
Contextos Documentales activos y mantenidos").

- En **código y schemas** se usa **DoCo / `doco_id`**. El repo y la API son
  inglés-centric (FastAPI, Pydantic, OpenAPI).
- En **comunicación comercial y docs en español** se usa **CoDo**.
- Son la misma cosa traducida; nada en código se llama `codo_*`.
- **El rename `tenant_id` → `doco_id` en el repo es trabajo aparte y no
  urgente** (es claridad semántica, no funcionalidad). Vive como tarea de
  hardening cuando convenga. Mientras tanto, `tenant_id` y `DoCo` se usan
  como sinónimos en docs.

Ejemplos:
- *Cliente comercial:* "DOCYAN cubre 3 CoDos en tu organización: laboratorio
  central, planta Querétaro, oficina corporativa."
- *Equipo técnico:* "Cada DoCo tiene su `graph_name` en FalkorDB y su RLS en
  Supabase."

### 2.2 La maquinaria interna: CCP / PCL

La **Capa de Contexto Persistente (CCP en español / PCL en inglés —
Persistent Context Layer)** es el componente arquitectónico que documenta este
documento.

- En **código** se usa **PCL**: paquete `app/pcl/`, módulos `pcl_cache.py`,
  `pcl_metrics.py`, `pcl_facade.py`.
- En **docs en español y pitch interno** se usa **CCP**.
- Son la misma cosa traducida.

### 2.3 Relación entre los dos términos

- CoDo/DoCo es **qué** mantiene el cliente.
- CCP/PCL es **cómo** DOCYAN da continuidad al conocimiento dentro de cada
  DoCo.

Cada DoCo tiene su propia CCP aislada (multi-tenant absoluto, igual que
DKG/DTM/FAT). El caché de un DoCo nunca contamina otro. Una sugerencia
detectada en un DoCo nunca cruza a otro. Esto es no-negociable.

---

## 3. Los tres estados de densidad — un solo objeto

La CCP no es tres componentes separados. Es **un mismo flujo de datos que
endurece por niveles**, con cada nivel construyendo sobre el anterior.

```
┌─────────────────────────────────────────────────────────────┐
│  CCP — Capa de Contexto Persistente (por DoCo)              │
│                                                             │
│   Memoria reactiva ──→  Patrón detectado ──→  Playbook      │
│   (caché + FAT)         (EDB sugiere)         (cristalizado)│
│                                                             │
│   Estado bajo            Estado medio          Estado alto  │
│   de densidad            de densidad           de densidad  │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Memoria reactiva — estado bajo de densidad

Cada consulta que un usuario hace se registra y se cachea. Es el estadio
crudo. Incluye:

- **Registro FAT** (`:EventoOperativo` tipo `consulta_realizada` + evento
  FAT familia F4 con hash chain). Esto **ya existe** (B7).
- **Caché semántico** de la pregunta + contexto + tenant indexada por
  similitud con BGE-M3. La segunda consulta equivalente NO paga inferencia.
  Esto es lo que **falta** y B8.5 construye.
- **Chat persistente** en la sesión MO (Redis TTL diferenciado). Multi-turno
  nativo del SDK GraphRAG. **Ya existe** (B8).

La memoria reactiva es la base de todo lo demás. Sin ella, no hay patrones
que detectar ni Playbooks que cristalizar — y cada consulta paga LLM completo.

### 3.2 Patrón detectado — estado medio de densidad

El EDB observa la memoria reactiva acumulada y detecta patrones:
- Consultas guardadas que tocan la misma entidad operativa repetidamente.
- Secuencias de consulta repetidas en sesiones (señal conductual).
- Anotaciones (`:Observacion`) que recurren sobre los mismos puntos.

Cuando se cumple la **compuerta de tres señales** (estructural + conductual +
permiso), el EDB genera una `:SugerenciaPlaybook`. Esto **ya existe** (B8 Nivel
C), con la tarea programada `evaluacion_patrones_edb_para_n3` ejecutándose
diariamente.

El patrón detectado no es producto final: es una propuesta. Lo que lo vuelve
cristalizado es la aceptación humana del usuario.

### 3.3 Playbook — estado alto de densidad

El usuario acepta una sugerencia (o crea un playbook manualmente desde
consultas guardadas), y el patrón se vuelve un objeto formal: secuencia
nombrada, reusable, heredable cuando el usuario se va, **propiedad del
entorno DoCo** del cliente. Esto **ya existe** (B8 Nivel B).

El playbook abarata las consultas futuras: en lugar de redescubrir cada vez
la secuencia "verificar calibración → ver historial → revisar alertas
pendientes", el usuario dispara el playbook y obtiene la vista unificada con
provenance. Detrás, esa vista usa caché de cada paso siempre que sea posible.

### 3.4 La continuidad del flujo

El flujo no es lineal una sola vez. **Cada nivel alimenta al anterior:**

- Un playbook ejecutado registra disparos en la memoria reactiva (que el FAT
  registra; que el EDB cuenta para señal conductual de patrones futuros más
  amplios).
- Un patrón detectado pero rechazado por el usuario alimenta el aprendizaje
  local del rechazo (que afina las propuestas futuras).
- Una consulta cacheada que el grafo invalidó porque el documento fuente
  cambió regresa a la memoria reactiva como consulta nueva, paga inferencia
  una vez, y vuelve a estar cacheada.

El flujo es **un ciclo vivo**, no una tubería.

---

## 4. Los dos modos de respuesta — retrieval-first vs synthesis-first

Una decisión cerrada en este documento que **afina la economía de la CCP**:

No toda consulta necesita LLM. Distinguir entre las dos rutas es lo que
permite que la mayoría de consultas cueste casi cero.

### 4.1 Retrieval-first (default donde aplique)

**Definición:** la consulta se responde encontrando y mostrando un span del
documento fuente, no generando texto nuevo. El pipeline navega el DKG,
recupera el nodo o relación pertinente, y entrega:
- El span exacto del documento (con provenance MENTIONED_IN + caracteres).
- La cita clickeable (Nivel 1 del producto).
- Sin LLM en el camino. Costo: casi cero.

**Aplica por default a:**
- **Tipo 1 Informativa** con match único en el grafo ("¿torque del perno B?"
  cuando el especificación tiene la respuesta directa).
- **Tipo 3 Gráficos/Diagramas** ("muéstrame el diagrama eléctrico del
  equipo 23").
- **Tipo 4 Video** ("dame el video del procedimiento de calibración").
- **Tipo 6 Historial** filtrado por fecha/entidad ("¿cuándo se calibró por
  última vez?").
- **Tipo 7 Alertas** activas ("¿qué vence esta semana?").

Estos cinco tipos cubren la mayoría volumétrica de consultas reales del piso.

### 4.2 Synthesis-first (cuando es necesario)

**Definición:** la consulta requiere razonamiento, síntesis de varias fuentes,
explicación o composición. El pipeline navega el DKG, recupera contexto, lo
pasa al LLM, y entrega:
- Texto generado con cita de fuentes.
- Provenance clickeable (igual que retrieval).
- Costo: el de la inferencia (gpt-4o-mini default, Sonnet fallback).

**Aplica por default a:**
- **Tipo 1 Informativa** cuando hay match múltiple o ambigüedad (LLM
  desambigua).
- **Tipo 2 Guía paso a paso** cuando el procedimiento requiere composición
  o cuando el cliente pide explicación.
- **Tipo 5 Troubleshooting** (árbol de decisión interactivo con razonamiento).
- **Tipo 8 Comparativa** (síntesis ejecutiva de diferencias).

### 4.3 La heurística de elección

El pipeline coordinator (B4) consulta una heurística al inicio de cada
consulta:

```python
def elegir_modo(tipo_intencion, contexto_consulta) → ModoRespuesta:
    if tipo_intencion in MODOS_RETRIEVAL_FIRST_DEFAULT:
        if puede_resolver_con_retrieval_puro(contexto_consulta):
            return ModoRespuesta.RETRIEVAL_FIRST
    return ModoRespuesta.SYNTHESIS_FIRST
```

`puede_resolver_con_retrieval_puro` verifica que la navegación DKG produzca un
match único o un conjunto pequeño y bien definido. Si la navegación devuelve
incertidumbre o cero resultados, escala a synthesis-first.

**La decisión se registra en FAT familia F4** (campo `modo_respuesta` en el
payload de evento). Esto permite medir empíricamente qué % de consultas
realmente cae en retrieval-first y validar la hipótesis del modelo de pricing.

### 4.4 Por qué esto es columna y no decoración

Sin retrieval-first explícito, todos los pipelines pasan por LLM por default.
Cada consulta cuesta $0.04 promedio. Un piloto con 10 operadores haciendo 50
consultas/día = 15,000 consultas/mes = $600/mes solo de inferencia, sin caché.

Con retrieval-first cubriendo 60% de consultas + caché semántico capturando
70% de las restantes repetidas: el costo marginal por consulta única no
cacheada ni retrievable cae a ~$0.02 × 1,800 = $36/mes. **Margen positivo
defendible.**

Estas cifras son ilustrativas; el dato real lo medirá la instrumentación
(sección 7) en piloto.

---

## 5. Caché semántico — diseño

### 5.1 Indexación

Cada consulta exitosa (synthesis-first o retrieval-first con match único) se
indexa en Redis con clave compuesta:

```
pcl:cache:{doco_id}:{embedding_hash}:{contexto_fingerprint}
```

donde:
- `doco_id` es el aislamiento multi-tenant absoluto.
- `embedding_hash` es la huella BGE-M3 de la pregunta normalizada.
- `contexto_fingerprint` es un hash de: token QR si hay, entidad referenciada,
  tipo de documento origen, par lingüístico activo.

Valor cacheado:
- Payload de respuesta (tipado).
- Hash del estado del DKG al momento de cachear (`dkg_state_hash` —
  versionado in-place ya modelado).
- Timestamp de cacheo.
- Modo (retrieval-first / synthesis-first).
- Costo original (para métricas).

### 5.2 Lookup por similitud

Una nueva consulta entra al pipeline. Antes de invocar al worker o al LLM,
se hace lookup en el caché:

1. Calcular embedding BGE-M3 de la pregunta normalizada.
2. Buscar en Redis las claves del `doco_id` actual con `embedding_hash`
   cercano (umbral de similitud por tenant, default 0.92 — alto, conservador).
3. Si hay hit y el `dkg_state_hash` del caché coincide con el estado actual
   del DKG → **cache hit válido**, servir directo.
4. Si hay hit pero `dkg_state_hash` no coincide → **cache miss vivo**, el
   documento cambió, se invalida la entrada y se ejecuta el pipeline.

### 5.3 Invalidación viva

El caché es **vivo, no congelado**. Cuando el worker termina una ingesta o
una actualización del DKG, se calcula el nuevo `dkg_state_hash` por entidades
afectadas y se invalidan las entradas del caché que apuntaban al estado
anterior de esas entidades.

**No se borra el caché entero por una ingesta**. Solo las entradas afectadas
por las entidades modificadas. Esto preserva la mayoría del caché y la
inversión en consultas previas.

### 5.4 Gobernanza re-evaluada en cada hit

**Crítico:** un cache hit NO bypasea el Governance Gate. Cada respuesta
servida (cacheada o fresca) pasa por GRG. Razón: la criticidad puede haber
cambiado (un segmento marcado como informativo puede haberse re-clasificado
como seguridad), un usuario puede haber perdido permisos, una entidad puede
estar en cuarentena.

El GRG en hit cacheado solo re-evalúa rápidamente (permisos + criticidad +
cuarentena) sin re-ejecutar el pipeline. Si falla, se sirve degradación
graceful (mismo comportamiento que en consulta fresca). FAT registra la
re-evaluación.

### 5.5 TTL y rotación

- TTL default del caché: **30 días** por entrada (configurable por DoCo).
- Rotación: política LRU sobre Redis con `maxmemory-policy allkeys-lru`.
- Métricas de tamaño del caché por DoCo expuestas (sección 7).

---

## 6. La fachada PCL — contratos

El paquete `app/pcl/` expone una **interfaz unificada** sobre los componentes
ya existentes (FAT, consultas guardadas, EDB, playbooks) + el caché nuevo.
Los pipelines (B8), el MO (B4), las UIs (B9, B10, B13) consumen esta fachada,
no los componentes individuales.

### 6.1 Interfaz pública

```python
class PCL:
    """Fachada unificada de la Capa de Contexto Persistente."""

    # --- Memoria reactiva (estado bajo) ---
    async def consultar_o_cachear(
        doco_id, user_id, pregunta, contexto
    ) -> RespuestaCCP:
        """Lookup en caché → si miss, ejecuta pipeline → cachea → registra FAT."""

    async def historial_consultas(
        doco_id, user_id, filtros
    ) -> list[ConsultaRegistrada]:
        """Para Tipo 6 Historial y para UI 'mis consultas recientes'."""

    # --- Patrón detectado (estado medio) ---
    async def sugerencias_pendientes(
        doco_id, user_id
    ) -> list[SugerenciaPlaybook]:
        """Para 'Bajo demanda con lugar visible' (visión Playbooks)."""

    async def evaluar_patrones_diario(doco_id) -> EvaluacionResultado:
        """Invocado por el scheduler. Materializa Nivel C."""

    # --- Playbook (estado alto) ---
    async def guardar_consulta(
        doco_id, user_id, query_id, nombre
    ) -> ConsultaGuardada:
        """Nivel A. Naming progresivo aplica en la UI."""

    async def crear_playbook(
        doco_id, user_id, nombre, consulta_guardada_ids
    ) -> Playbook:
        """Nivel B."""

    async def disparar_playbook(
        doco_id, user_id, playbook_id
    ) -> VistaUnificada:
        """Ejecuta secuencia con provenance por paso. Cada paso pasa por caché."""

    # --- Métricas e instrumentación ---
    async def metricas(doco_id, ventana) -> MetricasCCP:
        """Hit rate del caché, costo por consulta, distribución de modos."""
```

### 6.2 Quién consume qué

| Consumidor | Métodos PCL usados |
|---|---|
| **MO (B4) — pipeline_coordinator** | `consultar_o_cachear` (entrada principal) |
| **Tareas scheduler (B4)** | `evaluar_patrones_diario` (diario) |
| **UI PWA (B9)** | `historial_consultas`, `sugerencias_pendientes`, `guardar_consulta`, `crear_playbook`, `disparar_playbook` |
| **WhatsApp (B10)** | Mismos métodos que B9, vía Channel Adapter |
| **Endpoint admin** | `metricas` |
| **Onboarding (B13)** | seed inicial de playbooks por vertical (usa `crear_playbook` masivamente) |

### 6.3 Lo que la fachada NO hace

- **No reescribe** los componentes existentes (FAT, consultas guardadas,
  EDB, playbooks). Los orquesta.
- **No introduce nuevos modelos de datos** salvo el caché en Redis y la
  tabla de métricas (sección 7).
- **No bypasea gobernanza ni auditoría.** Todo método de la fachada
  registra en FAT con hash chain.

---

## 7. Instrumentación obligatoria

Sin métricas, el modelo de pricing no se puede defender empíricamente.

### 7.1 Métricas por consulta (en FAT familia F4)

Cada evento `consulta_realizada` lleva:
- `modo_respuesta` — `retrieval_first` / `synthesis_first` / `cache_hit`.
- `costo_estimado_centavos` — basado en tokens del modelo invocado (0 si
  retrieval o caché).
- `latencia_ms` — desde request hasta respuesta servida.
- `similitud_caché` si fue hit (qué tanto se parecía la pregunta original).
- `dkg_state_hash` para auditoría de invalidación.

### 7.2 Métricas agregadas por DoCo

Tabla Supabase `pcl_metrics_daily` con:
- `doco_id`, `fecha`.
- `consultas_totales`, `consultas_cache_hit`, `consultas_retrieval_first`,
  `consultas_synthesis_first`.
- `costo_total_centavos`, `costo_promedio_por_consulta`,
  `costo_promedio_por_consulta_unica`.
- `latencia_p50_ms`, `latencia_p95_ms`.
- `top_patrones_detectados` (JSONB, top 5).
- `sugerencias_emitidas`, `sugerencias_aceptadas`, `sugerencias_rechazadas`.

Generada por tarea programada del scheduler (B4), diaria, 03:00h.

### 7.3 Endpoint admin

`GET /admin/pcl/metrics?doco_id=...&desde=...&hasta=...` devuelve agregado
de la tabla anterior. Para uso interno (Jorge y equipo) en validación del
modelo de pricing durante piloto.

### 7.4 Verificable desde el primer piloto

Estas métricas deben estar **operativas en producción desde B8.5**. La razón
es directa: sin ellas, el primer piloto te deja sin datos para defender
pricing al segundo cliente, y para entonces ya tienes contratos firmados sin
base empírica.

---

## 8. Cómo encaja con los bloques

### 8.1 Lo ya construido que la CCP unifica

- **B7 FAT** registra `:EventoOperativo` con hash chain. La memoria reactiva
  de la CCP usa este registro.
- **B8 Chat persistente** ya implementa multi-turno en sesión MO.
- **B8 Consultas guardadas, Playbooks, Sugerencias EDB con compuerta de tres
  señales.** La CCP las orquesta como estados de densidad creciente del
  mismo flujo.
- **B0.7 EDB** (Entity Data Brain) activo con service_role. La CCP consume
  su capacidad de detección.
- **B4 APScheduler** con tarea `evaluacion_patrones_edb_para_n3`. La CCP
  pone el contenido real.

### 8.2 Lo que B8.5 añade

- **Paquete `app/pcl/`** con la fachada y el caché.
- **Caché semántico** BGE-M3 sobre Redis con invalidación viva.
- **Retrieval-first vs synthesis-first** como decisión explícita en el
  pipeline coordinator.
- **Instrumentación** completa en FAT y tabla de métricas agregadas.
- **Endpoint admin** `/admin/pcl/metrics`.

### 8.3 Lo que bloques posteriores construyen sobre la CCP

- **B9 UI PWA** consume la fachada PCL para mostrar historial, sugerencias,
  playbooks, naming progresivo, y se beneficia de las latencias bajas del
  caché para UX fluida.
- **B10 WhatsApp** consume la fachada vía Channel Adapter. El caché es
  especialmente valioso aquí porque WhatsApp tiene latencia más estricta y
  el operador en campo no espera 8 segundos por respuesta.
- **B13 Onboarding** configura `permiso_ia_proactiva` y `silenciar_sugerencias`
  por usuario (que la CCP lee), siembra playbooks precargados por vertical
  vía `seed_for_vertical`, y configura umbrales del caché por DoCo.

---

## 9. Relación con el modelo de pricing

El documento `DOCYAN_Estrategia_Precios_y_Contexto_Persistente.md` define cuatro
componentes de cobro. La CCP **sostiene** dos de ellos:

| Componente de cobro | Cómo la CCP lo sostiene |
|---|---|
| **Setup ingesta inicial** | Cotizador pre-ingesta (B2, ya construido). La CCP no aplica aquí. |
| **Ingesta continua** | Mismo cotizador para actualizaciones. La CCP invalida selectivamente el caché sin reingerir todo. |
| **Licencia mensual por tier de DoCo** | **La CCP es la columna.** Consultas holgadas son posibles solo porque retrieval-first + caché + playbooks colapsan el costo marginal. El tier mide capacidades de la CCP por DoCo (memoria reactiva sola → memoria + patrones → memoria + patrones + playbooks). |
| **Seats admin** | Independiente. La CCP no aplica. |

**La CCP NO introduce un nuevo componente de cobro.** Es lo que hace viables
los componentes ya definidos.

---

## 10. Frontera respecto a decisión #13

La decisión #13 del Paso C dice: *"Mantener precios de project instructions
hasta primer cliente real."*

Este documento **no fija cifras**. Define:
- La estructura de la CCP (cerrada).
- Los contratos (cerrados).
- La nomenclatura (cerrada).
- Qué medir (cerrado).

Las cifras (qué cuesta tier básico, qué cuesta tier con Nivel 3, qué umbral
de similitud del caché, qué TTL óptimo del caché) se ajustan **con datos del
primer piloto** vía las métricas que B8.5 instrumenta.

Es deliberado: cierras la arquitectura ahora porque sin ella no hay piloto
viable financieramente; cierras las cifras después porque sin datos del
piloto, cualquier número es invención.

---

## 11. Lo que esta arquitectura no es

Para evitar confusiones operativas:

- **No es un sistema de caching genérico.** Es semántico (BGE-M3), por DoCo,
  invalidación viva contra el DKG, con gobernanza re-evaluada en cada hit.
- **No es Redis como base de datos.** Redis es el almacén volátil del caché y
  del scheduler. La verdad operativa de la CCP vive en FAT (Supabase +
  FalkorDB), no en Redis.
- **No es un layer de abstracción opcional.** Es la fachada obligatoria que
  los pipelines y UIs consumen. No hay "saltar la CCP" para casos
  específicos. Todo pasa por aquí. Las excepciones se discuten antes de
  implementar, no después.
- **No es un componente que sustituya el modelo de roles.** Multi-tenancy
  absoluto + permisos del doc 09 aplican igual. La CCP no abre boquetes.
- **No es post-MVP.** Es columna del MVP. Sin ella, el modelo de pricing no
  es defendible y el time-to-value en B9 se degrada.

---

## 12. Anclaje a los principios DOCYAN

- **Aporta valor / alivia dolor:** la memoria que retiene el método del
  experto, sin que el usuario tenga que construir nada.
- **Fácil de usar:** invisible para el operador. Solo experimenta respuestas
  rápidas y un sistema que aprende su forma de trabajar.
- **Asistido por IA de arquitectura XCID:** la CCP **es** XCID — el EDB que
  observa, el grafo que conoce, la gobernanza que respeta, el caché
  semántico que aprende patrones de consulta, todo orquestado.

---

*Fin del documento de arquitectura. El resto de las Project Instructions, los
14 documentos de modelado, la Adenda Post-PoC, la Visión y Propuesta de Valor,
la Visión de Playbooks de Consulta y la Estrategia de Precios permanecen
vigentes y compatibles con este documento.*
