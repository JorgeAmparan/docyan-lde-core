# Runbook — B13.3 Retrieval Real (re-siembra + verificación)

DOCYAN LDE™ by XCID. Cierra junto con B13.2. **El cierre real es el recorrido de
Jorge** (sus preguntas, su fraseo, su navegador) sobre el demo público y su cuenta
freemium. Ningún reporte de Opus cierra este sprint.

## 0. Qué cambió en código (ya mergeable, verificado offline)
- **DEF-1** — `DKGReader.informativa` lee toda la ontología citable por tipo
  (`:Sustancia`, `:Riesgo`, `:Producto`, `:Instrumento`, `:CertificadoCalibracion`,
  …), no solo `:Especificacion`. Cada dato trae cita propia anclada + atribución.
- **DEF-2** — retrieval híbrido léxico + BGE-M3 (`app/pipelines/retrieval_hibrido.py`,
  Decisión #2). Sin embedder configurado → léxico estricto (idéntico a B13.2). Con
  `EMBEDDER_URL`/`BGE_M3_URL` → pasada vectorial (puente "OSHA PEL"→TLV, EN↔ES).
- **Atribución** — `Cita.documento_nombre` + `Cita.documento_tipo` del MISMO doc
  (sin cruzar nombre de uno con tipo de otro). `Cita.documento_url` para "Abrir PDF".
- **Alertas** — `alerts_dashboard` cita el vencimiento (ancla en el AÑO real del doc).
- **Fix §2.5** — fallback de CoDo sin sugeridas invita a reformular (no a "sugeridas
  abajo" inexistentes). Etiqueta del cert de lab corregida vía nombre display.

## 1. Pre-requisitos del entorno (prod / Jorge)
```
export FALKORDB_HOST=...   FALKORDB_PORT=6379         # grafo vivo (NO 6381 local)
export EMBEDDER_URL=http://docyan-lde-embedder.internal:8000   # BGE-M3 (decisión #1)
export GEMINI_API_KEY=...  OPENAI_API_KEY=...         # extracción real
export REDIS_QUEUE_URL=... # cola de ingesta (o túnel: flyctl proxy 6399:6379 --app docyan-lde-redis)
```
Sin `EMBEDDER_URL` el retrieval cae a léxico estricto: "OSHA PEL"→TLV NO resolverá.

## 2. Re-siembra de los CoDos demo
El SDK dedupea por SHA-256: para re-extraer hay que borrar `:DocumentoSource` + la
marca `done` del documento (aprendido en lab). Luego:
```
python3.11 scripts/seed_demo_tenants.py --manifest docs/demo/manifest_b133.json --dry-run   # cotiza
python3.11 scripts/seed_demo_tenants.py --manifest docs/demo/manifest_b133.json             # encola
```
El manifiesto fija `tipo` y `nombre` display por documento (atribución legible).
Tras procesar el worker, **invalida la caché de consulta** de los demos (patrón
conocido) antes de verificar.

### Cobertura del manifiesto vs §2.6
| CoDo | Documentos sembrables HOY (en repo) | §2.6 enriquecido = PENDIENTE DE JORGE |
|---|---|---|
| lab | Mitutoyo manual + cert (✓ acceptance #1) | — |
| maq | Isopropanol SDS | Haas VF-4 manual + especificación + MSDS fluido de corte |
| pharma | NaOH CIP SDS | SOP de limpieza CIP (procedimiento) |
| min | HCl SDS | manual Komatsu + procedimiento de seguridad |
| agri | Hipoclorito SDS | manual de tanque/sanitización |
| hero | Acetona + Metanol SDS (✓) | — |

> El **retrieval ya soporta** los tipos enriquecidos (manual_tecnico→Procedimiento/Paso,
> calibracion→Cert/FechaVencimiento, msds→Sustancia/Riesgo). Agregar un sector es
> **curaduría** (conseguir el PDF público de fabricante + sembrar + verificar
> sugeridas), no ingeniería. Jorge provee los PDFs faltantes → se añaden al manifiesto.

## 3. Verificación obligatoria (regla #5: ≥5 paráfrasis reales, NO solo sugeridas)
```
export DOCYAN_PARAFRASIS_TENANT=demo-maq    # repetir por CoDo
python3.11 -m pytest tests/test_b133_parafrasis_real.py -q
```
Para cada dato (límite de exposición, punto de inflamación, nombre del químico) la
suite prueba ≥5 fraseos (siglas, EN/ES, una palabra) y exige ≥1 cita verbatim.
"OSHA PEL"→TLV es caso nombrado. **Una paráfrasis que no cita es HALLAZGO a reportar,
no a maquillar** (§2.6, regla #8).

## 4. Sugeridas nuevas por CoDo (regla #6)
Solo se publican en `frontend/src/lib/demo-data.ts` las preguntas que CITARON
verbatim verificado (ES+EN). El CoDo `lab` arranca con `questions: []` (el input
invita a reformular); sus 3 preguntas naturales (rango, vence, trazable) se publican
**después** de que el recorrido de Jorge las confirme citando limpio (acceptance #1).

## 5. "Abrir PDF" (provenance §2.3) — estado
`Cita.documento_url` está cableado extremo a extremo (reader → payload → front), y
`bridge_and_normalize(..., url_publica=...)` lo persiste. **PENDIENTE infra:** el
bucket público de solo lectura para documentos demo (NUNCA para docs de cliente) y
el servicio de URL firmada por tenant. Hasta entonces el chip "Abrir PDF" no aparece
(degradación honesta), pero nombre+tipo+fragmento ya dan procedencia completa.
