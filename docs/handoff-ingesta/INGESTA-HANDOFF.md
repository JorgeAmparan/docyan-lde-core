# Handoff — Componente de progreso de ingesta (Capa A · Admin › Ingesta)

**Para:** equipo de implementación (Next.js 15 · React 19 · Tailwind · shadcn/ui · react-i18next)
**Reemplaza:** la simulación determinista del mock por progreso real del backend.
**Archivo de referencia (mock):** `ui_kits/pwa/ingesta-progress.jsx` + estilos en `ui_kits/pwa/admin.css` (bloque "Ingesta · progreso de procesamiento en vivo").

> El mock es cosmético: todo el estado deriva de `t` (segundos simulados). En
> producción, **borra el motor de simulación** (`useEffect` con `setInterval`,
> `ingState(i, t)`, `ING_STARTS`, `PH_BASE`, factores) y alimenta el mismo árbol
> visual con eventos reales. La UI no cambia; solo cambia **la fuente del progreso**.

---

## 1. Por qué este diseño (no romper esto al portar)

El reto no es la barra, es que **~600 s por documento no se sientan colgados**. Cuatro
mecanismos cargan ese peso — consérvalos:

1. **5 tramos nombrados** (no una barra lisa). El usuario siempre ve en cuál de 5 hitos
   está; los completados se llenan en jade con ✓, el activo lleva borde cinabrio.
2. **Contadores reales por fase** (página 38/142, 99 spans, 615/673 relaciones). El
   número que sube es lo que convence de que hay trabajo, no el %.
3. **Ticker de actividad** que rota ~1.4 s — el componente "respira" en esperas largas.
4. **ETA con cadencia tranquila** (~2.5 s), no un cronómetro nervioso.

Si el backend solo puede dar un `%` global y nada más, **el efecto se pierde**. Pide al
backend que emita, por documento: **fase actual + fracción de fase + 2-3 contadores**.

---

## 2. Mapeo de fases → tramos de la barra

Los 5 tramos son fijos en la UI. Mapea tus estados internos de pipeline a estas claves.
El **peso** (`w`) es el % de ancho que ocupa cada tramo — ajústalo a tu reparto real de
tiempo para que la velocidad de la barra se sienta natural (un tramo pesado avanza
"lento" en px/seg, que es justo lo que evita el salto-y-congela).

| `phase` (clave UI) | Etiqueta        | Peso sugerido | Etapa de tu pipeline (B0–B8.5) | Contador a mostrar              |
|--------------------|-----------------|---------------|--------------------------------|---------------------------------|
| `descarga`         | Descarga        | 6             | fetch + verificación SHA-256   | `bytes / total` (MB)            |
| `conversion`       | Conversión      | 16            | PDF/OCR → texto normalizado    | `page / pages`                  |
| `extraccion`       | Extracción      | 38            | spans + entidades + clasificación | `page`, `spans`, `entities`  |
| `grafo`            | Escritura a grafo | 28          | upsert a FalkorDB + embeddings | `relations / relationsTotal`    |
| `dedup`            | Deduplicación   | 12            | fusión de duplicados / alias   | `merged / entities`             |

> El estado del documento se deriva de la fase: `descarga` → **Cargando**;
> `conversion…dedup` → **Procesando**; fin → **Completado**; aborto → **Error**.

---

## 3. Contrato de eventos (backend → frontend)

Recomendado: **SSE** (`text/event-stream`) o WebSocket por lote. Fallback: *polling*
cada 2–3 s a `GET /api/ingesta/lotes/{batchId}`. El payload es el mismo en los dos casos.

### 3.1 Tipos (TypeScript)

```ts
type Phase = 'descarga' | 'conversion' | 'extraccion' | 'grafo' | 'dedup';
type DocStatus = 'encolado' | 'cargando' | 'procesando' | 'completado' | 'error';

interface DocProgress {
  docId: string;
  name: string;
  kind: string;            // "pdf · OCR", "xlsx", …
  status: DocStatus;
  phase: Phase | null;     // null si encolado o terminado
  phaseFraction: number;   // 0..1 — avance DENTRO de la fase actual
  pct: number;             // 0..100 — avance total del doc (calculado server-side, ver §4)
  etaSeconds: number | null; // restante del doc; null si encolado/terminado
  queuePosition?: number;  // 1-based, solo si status === 'encolado'
  counters?: {             // los que apliquen a la fase actual
    bytes?: number; bytesTotal?: number;
    page?: number; pages?: number;
    spans?: number; entities?: number;
    relations?: number; relationsTotal?: number;
    merged?: number;
  };
  activity?: string;       // línea del ticker, ya localizada (ver §5). Opcional.
  error?: { code: string; message: string }; // si status === 'error'
  consultUrl?: string;     // destino de "Consultar →" cuando completado
}

interface BatchProgress {
  batchId: string;
  status: 'procesando' | 'completado';
  docs: DocProgress[];     // en orden de cola; el activo es el que tiene status procesando/cargando
  pct: number;             // 0..100 del lote (ponderado por trabajo, no por nº de docs)
  etaSeconds: number;      // restante del lote completo
  counts: { completado: number; procesando: number; encolado: number; error: number };
}
```

### 3.2 Eventos SSE

```
event: batch            data: <BatchProgress>        // snapshot completo, al conectar y cada 2–3 s
event: doc              data: <DocProgress>          // delta de un documento (opcional, optimización)
event: doc-completed    data: { docId, name, consultUrl }   // dispara el toast verde
event: doc-error        data: { docId, name, error }        // dispara el toast rojo
event: batch-completed  data: { batchId, completado, error } // dispara el banner final
```

> Mínimo viable: emite solo `batch` cada 2–3 s. El front detecta transiciones comparando
> el `status` previo vs. el nuevo (igual que el mock con `prevRef`) y de ahí salen los
> toasts y el banner — **no necesitas** los eventos `doc-*` si no quieres. Son una
> optimización para feedback más inmediato.

---

## 4. Quién calcula qué

| Valor                       | Cálculo | Dónde |
|-----------------------------|---------|-------|
| `phase`, `phaseFraction`    | estado del worker de ingesta | **backend** |
| `pct` del documento         | `cumW(phaseIndex) + weight(phase) * phaseFraction` (ver `cumW` en el mock) | **backend** (manda el reparto de pesos) o **front** si prefieres tener los pesos en el cliente |
| `etaSeconds` del documento  | suma de duraciones estimadas de fases restantes + fracción restante de la actual | **backend** (es quien conoce tamaños/colas reales — más honesto) |
| `pct` y `etaSeconds` del lote | doc activo + suma de los encolados | **backend** |
| transiciones → toasts/banner | diff de `status` entre snapshots | **front** |

**Pesos:** déjalos como única fuente de verdad. Si viven en el front (constante `ING_PHASES`),
el backend solo manda `phase` + `phaseFraction` y el front calcula `pct`. Si los quieres
configurables por vertical, mándalos en el primer `batch`.

---

## 5. Localización (react-i18next)

- **Etiquetas de fase, estados, "queda", "En cola · posición N", textos de toast/banner**:
  claves i18n en el front. No los mandes traducidos desde el backend.
- **`activity` (ticker)**: dos opciones —
  (a) el backend manda una **clave + params** (`{ key: 'ticker.span', params: { n: 142 } }`)
  y el front traduce; **recomendado**.
  (b) el backend manda el string ya localizado según el `Accept-Language` del admin.
- Diseña los contenedores para **±35 % de variación** (alemán) — el mock ya usa `ellipsis`
  y `min-width:0` en las líneas de detalle y ticker.

---

## 6. Pasos de integración

1. **Portar el árbol visual** de `IngestBatch` / `DocRow` / `PhaseBar` a tu componente
   (JSX + Tailwind con los tokens del DS). Conserva clases/estructura; el CSS del bloque
   "Ingesta · progreso…" de `admin.css` traduce 1:1 a utilidades o a un `.module.css`.
2. **Borrar el motor de simulación**: el `useEffect` con `setInterval`, `ingState`,
   `ING_STARTS`, `ING_TOTAL`, `PH_BASE`, factores y pools de demo. Quitar la barra de
   "Demo · simulación" (velocidad/pausar/reiniciar) — era solo andamiaje.
3. **Suscribir la fuente real**: `useIngestBatch(batchId)` que abra el `EventSource`
   (o haga polling) y devuelva `BatchProgress`. Mapear `BatchProgress.docs[i]` →
   props de `DocRow` directamente (la forma ya coincide).
4. **Toasts**: con shadcn usa `sonner`/`useToast`. Dispáralos desde los eventos `doc-*`
   o desde el diff de status. Auto-dismiss ~6 s (igual que el mock).
5. **Respetar `prefers-reduced-motion`**: ya está en el CSS (shimmer/spin/breathe se
   apagan). Mantenlo.
6. **Persistencia / reconexión**: al reconectar SSE, el primer `batch` es un snapshot
   completo → la UI se rehidrata sola. Si el admin recarga, vuelve a `GET .../{batchId}`.

---

## 7. Casos borde (que el mock ya contempla visualmente)

- **Documento con error** a mitad de fase: status `error`, se muestra el motivo y acciones
  **Reintentar** / **Omitir**; el lote continúa con el siguiente. (Backend: `doc-error`.)
- **Lote terminado con errores parciales**: banner "Lote completado · N disponibles · K con error".
- **Cola**: solo 1 documento `procesando` a la vez en el mock (concurrencia 1). Si tu
  pipeline procesa en paralelo, permite varios `procesando` y muestra cada uno expandido
  (o colapsa a un acordeón si son muchos).
- **Feedback instantáneo**: al confirmar la cotización, monta la vista de progreso de
  inmediato con el primer doc ya en `cargando` — sin pantalla intermedia en blanco
  (principio de Flow del brief).

---

## 8. Endpoints sugeridos

```
POST /api/ingesta/lotes            → crea el lote desde la cotización confirmada; { batchId }
GET  /api/ingesta/lotes/{batchId}  → BatchProgress (snapshot; usar para polling/rehidratar)
GET  /api/ingesta/lotes/{batchId}/stream → SSE (event: batch | doc | doc-completed | doc-error | batch-completed)
POST /api/ingesta/docs/{docId}/retry → reintenta un documento con error
POST /api/ingesta/docs/{docId}/skip  → lo descarta del lote
```

---

**Resumen:** la UI ya está resuelta y es la parte difícil (el *ritmo* de una espera larga).
El trabajo de implementación es **un adaptador**: que tu worker emita `phase` +
`phaseFraction` + contadores por documento, y conectar eso al árbol visual existente.
