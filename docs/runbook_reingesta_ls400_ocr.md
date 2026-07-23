# Runbook — Reingesta del LS-400 con OCR (DEMO-READY, jul 2026)

> **Estado: LISTO PARA CORRER — espera el "go" de Jorge** (es la corrida de
> costo/deploy que reservó al elegir la Opción 1 del sprint DEMO-READY).

## Por qué

Diagnóstico DEMO-READY (evidencia dura): el `demo-bomba` tiene el **archivo
correcto** de 88pp (`ls400_operacion.pdf`, sha `65dd1d…` == doc_id del grafo), pero
su **capa de texto son SOLO encabezados corridos** (~115 chars/pág:
`"BOMBA LS-400 / MANTENIMIENTO / PAG 36 / MANUAL DE OPERACIÓN"`). El gate de OCR
(≥16 chars) lo contó como texto-nativo y **apagó el OCR**, así que el cuerpo real —
procedimientos, specs, cebado, presión, RPM — que vive **dentro de las 244 figuras**
nunca se extrajo. Retrieval VACÍO en prod para casi toda pregunta natural.

Densidad de contenido medida (descontando boilerplate): **LS-400 op = 59**
(header-only) vs maxi_op = 210, partes = 790, SDS ≥ 3577 (texto real). Solo la
operación necesita OCR; **partes** (790, cita bien) y la **ficha** (1pp, ya se
OCR'd por el gate) NO se retocan.

## Fix ya en el repo (este sprint)

`worker/ingest_pipeline.py` — dos palancas de OCR, **ambas default-off** (baseline
ED-0e byte-idéntico preservado; tests en `tests/test_ed0e_gate_ocr.py`, 18/18):

- `OCR_FORCE=1` — fuerza `do_ocr=True` incondicional (palanca explícita de este pase).
- `OCR_MIN_CONTENIDO_POR_PAGINA=120` — auto-detecta docs header-only por densidad de
  contenido (LS-400=59 < 120 → OCR; maxi_op=210 > 120 → no). **Durable y recomendado**:
  déjalo puesto en el worker y cualquier futuro manual escaneado-con-headers se OCR'a solo.

`scripts/seed_demo_tenants.py --reset` — borra el `:DocumentoSource` del grafo +
limpia la idempotencia por sha ANTES de re-encolar (sin esto, re-subir el MISMO
archivo hace idempotency-skip y no re-extrae — footgun conocido).

## Comando (desde la laptop, con proxies a prod)

```bash
# 1) Túnel a la cola de ingesta de prod (el worker de prod consume de aquí).
flyctl proxy 6399:6379 --app docyan-lde-redis &
flyctl proxy 6398:6379 --app docyan-lde-graph &        # para el --reset (borra el grafo)
export REDIS_QUEUE_URL="redis://localhost:6399/0"
export FALKOR_HOST=localhost FALKOR_PORT=6398
#   + SUPABASE_URL / SUPABASE_SERVICE_KEY / GEMINI_API_KEY del .env de prod (ya en tu .env)

# 2) Enciende OCR en el worker de prod (durable) y espera a que reinicie la máquina.
flyctl secrets set OCR_MIN_CONTENIDO_POR_PAGINA=120 --app docyan-lde-ingest
#   (o, para un pase único sin dejarlo durable:  OCR_FORCE=1 … y lo quitas al terminar)

# 3) Dry-run: ver costo estimado ANTES de encolar (protección financiera).
PYTHONPATH=. python3.11 scripts/seed_demo_tenants.py \
    --manifest docs/demo/manifest_bomba_reingesta_ocr.json --tipo manual_tecnico --dry-run

# 4) Reingesta real (borra el doc viejo + idempotencia, re-encola con OCR).
PYTHONPATH=. python3.11 scripts/seed_demo_tenants.py \
    --manifest docs/demo/manifest_bomba_reingesta_ocr.json --tipo manual_tecnico --reset

# 5) Espera a que el worker procese (log del worker: "gate OCR | do_ocr=True motivo=baja_densidad").
flyctl logs --app docyan-lde-ingest | grep "gate OCR"

# 6) Verifica contra prod (deberían dejar de dar VACÍO):
curl -s -XPOST https://docyan-lde-api.fly.dev/demo/query -H 'Content-Type: application/json' \
  -d '{"texto":"cómo cebar la bomba","codo":"bomba","documento_id":"65dd1dfdfee4d858139e5fbe75febfb1a9f8a525cc48fa82667c4f1e222d3f44"}'

# 7) Cierra los proxies.  kill %1 %2
```

## Costo esperado

- **LLM extracción** (Gemini 2.5 Flash sobre el texto OCR'd, ~40-60K tokens):
  **~$0.20–0.50/doc** (el PoC midió $0.04 sin OCR; ~5-10× por el cuerpo real). QA
  gpt-4o-mini y embeddings BGE-M3 self-hosted ≈ $0. El cotizador (paso 3) da el número
  exacto antes de encolar.
- **Worker**: OCR de 88pp añade ~3-6 min. Con `DOCLING_QUEUE_MAX_SIZE=1` la memoria
  queda acotada página-a-página; tesseract corre como subproceso CLI (memoria aparte
  del heap del worker). **No se prevé bump de RAM 24/7**; confirmar headroom en el log
  de la corrida (`anon-rss`) — si topara 4 GB, el stopgap es subir el worker a 8 GB
  SOLO durante el pase y revertir (decisión de costo tuya).

## Verificación de fidelidad (regla DEMO-READY: verificar, no proyectar)

Tras la reingesta, correr ≥5 paráfrasis reales por doc (regla
[[verificacion-consulta-parafrasis]]): "cómo cebo la bomba", "presión de operación",
"mantenimiento del sistema hidráulico", "capacidad del tanque", "diagrama de cableado".
Cada una debe citar con **fragmento verbatim** (no encabezado vacío) y página real.
Si una figura debe verse en respuesta visual, verificar el `diagram_viewer` con imagen.
