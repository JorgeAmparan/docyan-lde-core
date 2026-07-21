# ED-0f — Diseño de batching de conversión (media página)

**Objetivo:** acotar el pico de memoria de la conversión Docling de LS-400 (88pp,
85 dibujos) de >8 GB a **<4 GB**, produciendo un resultado **byte-idéntico** a la
referencia dorada (mismos chunks, mismas figuras por hash, misma cita). Sin tocar
`images_scale`, sin cambiar modelos, cero degradación.

## Insight central: separar los dos drivers de memoria

El pico (traza real: 1 GB base → 9.7 GB monótono) tiene dos fuentes que **no hay
que mezclar**:

1. **Markdown / estructura** — layout + TableFormer sobre 88 páginas.
2. **Rásters de figuras** — `generate_picture_images=True` mantiene los 85 PNG
   (PIL) en memoria dentro del `DoclingDocument`.

`generate_picture_images` **NO cambia el markdown** (solo adjunta el raster a cada
`PictureItem`; los placeholders de imagen en el markdown son iguales con True/False).
Eso permite **dos pasadas** en vez de una sola cara:

### Pasada 1 — Markdown (una sola, sin imágenes)
`convertir()` corre Docling con `generate_picture_images=False`. Produce el
**markdown global** — idéntico al de la referencia dorada (que usó True). Se
alimenta al SDK **sin cambios** → **chunks, spans, provenance y citas byte-idénticos**.
Sin los 85 rásters, esta pasada baja drásticamente de memoria.

### Pasada 2 — Figuras (batched por rango de páginas)
Para cada lote de páginas `[i, i+N)` (N = `DOCLING_PAGE_BATCH`, env, default 8):
`convert(path, page_range=(i, i+N-1))` con `generate_picture_images=True`, se
extraen las figuras de ESE lote (`extraer_figuras` sobre su `docling_doc`), se
acumulan sus `png_bytes` en una lista global, y **se libera el lote** antes del
siguiente. El pico queda acotado a ~N páginas de rásters, no 88.

Los `png_bytes` de una figura son deterministas (misma fuente, mismo `images_scale`)
→ **mismos SHA-256 que la referencia dorada** → mismas figuras por hash.

## Cómo se cumplen los requisitos de Jorge

| Requisito | Cómo |
|---|---|
| **Tamaño de lote por env** | `DOCLING_PAGE_BATCH` (default 8), solo afecta la Pasada 2 |
| **Fusión markdown+figuras entre lotes** | El markdown NO se fusiona (Pasada 1 es única). Las figuras se concatenan en una lista global |
| **Spans/provenance GLOBALES** | Intactos: el SDK recibe UN markdown global idéntico → offsets byte-idénticos |
| **Tablas multipágina (cruce de borde)** | **NO es problema**: el markdown es de una sola pasada. El batching solo toca la extracción de rásters, y cada figura vive en una sola página. No hay tabla partida por lote |
| **HIS y dedup de figuras global** | Dedup §5bis opera sobre la lista global concatenada (mismos `hashes_previos`), no por lote |
| **Mismos modelos / mismo images_scale / cero degradación** | Ambas pasadas usan idéntico `PdfPipelineOptions` salvo `generate_picture_images` (P1=False, P2=True) y `page_range` (solo P2). `images_scale` intacto |

## Contrato de `convertir()`
Sigue devolviendo `(markdown, docling_doc_para_figuras, ocr_gate)`. El
`docling_doc_para_figuras` deja de ser el doc completo con imágenes; en su lugar
`_auto_materializar_visuales` recibe la **lista de figuras ya extraídas** (global)
— se adapta `extraer_figuras` para aceptar una lista pre-extraída o se pasa la lista
directo a `extraer_diagramas`. El resto del pipeline (extracción SDK, dedup,
materialización, bridge, cita) **no cambia**.

## Riesgo empírico + fallback (primer paso de ejecución)
**Incógnita:** ¿cuánto del pico es rásters vs. layout/TableFormer? Si los rásters
dominan, la Pasada 1 (sin imágenes) cabe en <4 GB y el diseño cierra.
**Validación temprana:** medir el pico de la Pasada 1 sola.
**Fallback** si layout/TableFormer por sí solo aún supera el presupuesto: batchear
también la Pasada 1 por `page_range` y reensamblar el markdown — PERO eso reintroduce
el riesgo de identidad de chunks (borde de lote). Se evaluaría con el diff del Paso 3;
si no queda vacío, se documenta y se decide con Jorge. (Expectativa: no hará falta —
los 85 rásters son el driver dominante.)

## Verificación (Paso 3)
Re-ingesta de LS-400 con batching → `golden_ls400.py` produce un manifiesto que se
compara con la referencia dorada. **Diff esperado: vacío** (mismos hashes de figura,
misma firma de chunks, misma cita) con **pico <4 GB**. Luego Paso 4 revierte a 4 GB.

## Pendiente de confirmar antes de codificar
- `page_range` en `DocumentConverter.convert()` de docling 2.96.0 (pilar del diseño)
  — verificar en el worker (`inspect.signature`) antes de implementar.
