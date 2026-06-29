# DOCYAN LDE™ — Resumen Ejecutivo del Plan Dev (para Opus)
*Estado al cierre de la sesión 15-jun-2026. Quirúrgico, para continuar el desarrollo.*

---

## DÓNDE ESTAMOS

**En vuelo (autorizado, ejecutándose):** Deploy coordinado Opción 1 — frontend (F3 + sprint Núcleo) + API + worker (piezas 3/4/6) + invalidación de caché PCL. CI verde como puerta. F3 confirmado release-ready por Jorge. El frontend es build indivisible: F3 y el sprint comparten archivos (`consult-view.tsx`), no se pueden separar.

**Tras el deploy:** preview multi-documento → recorrido de confirmación de Jorge → merge a prod.

---

## LO QUE CIERRA ESTE DEPLOY (Sprint Núcleo Consultable — verificado automatizado, 767 tests backend)

1. **Aislamiento documental** (bloqueante, provenance): frontend manda `documento_id`; `dkg_reader._scope_prefix` acota a `(:DocumentoSource {id})-[:CONTIENE]->(n)` y activa el `entidad_id` antes muerto; `pcl_cache.contexto_fingerprint` incluye `doc=<documento_id>`. Verificado: docA→docA, docB→docB, sin fuga.
2. **Cotizador en los 3 flujos** (`/documentos`, `/onboarding`, `/admin/ingesta`) — sin auto-confirm; tarjeta de cotización SIEMPRE, todos los planes (freemium tachado→$0.00). Es propuesta de valor, no gate de plan.
3. **Costo de figuras en la cotización** + cap `MAX_FIGURAS_POR_DOCUMENTO=30`; conteo ligero sin Docling en backend.
4. **Topes de costo:** `num_retries=2` global (litellm + SDK); `costo_discrepancia` real vs `response.usage` (no tier); job-retry re-gatea.
5. **Bucket `docyan-assets`** creado (round-trip verificado) + corto-circuito como red de seguridad.
6. **Estados honestos + no-cobro** (0 ontología → libera reserva, no cobra, permite retry) + **chat persistente** (sesión por CoDo, multi-turno).

**Criterio de cierre permanente:** "hecho" se prueba con ≥2 documentos (condición de cliente real), automatizado por Opus ANTES de entregar. El recorrido de Jorge confirma, no descubre.

---

## DECISIONES ARQUITECTÓNICAS VIGENTES (no re-abrir)

- **Ingesta:** GraphRAG-SDK 1.1.1 sobre FalkorDB (multi-tenant por `graph_name`). Docling + LlamaIndex multi-formato. tiktoken pre-ingesta.
- **Modelos (cadena cerrada):** extracción `gemini/gemini-2.5-flash` (prefijo obligatorio, `GEMINI_API_KEY`) → retry calidad `gemini-2.5-pro` → fallback proveedor `claude-opus-4-8` (visible, registrado) → QA `gpt-4o-mini`. Un tenant se ingiere con la primaria salvo fallback puntual.
- **Embeddings:** BGE-M3 self-hosted (flycast). Sin alterno.
- **Matching:** híbrido Levenshtein+BGE-M3, 70/30·30/70, umbral léxico ≥30% como compuerta global.
- **Precio:** `bands.ts` v2.1 = ÚNICA fuente (`pricing.ts` legacy eliminado, guard anti-regresión activo). Planes = tabla MXN fija Banda A (Esencial $4,990 / Profesional $10,900 / Enterprise desde $23,900 / Piloto $3,490), B/C en USD. Ingesta = único con FX vivo: Banxico FIX (SF43718) +3% → ceil $10 MXN, congelado al cotizar. Sin precio por seat (eje = documentos vivos, usuarios ilimitados). Sin Stripe hasta 3-5 clientes (cobro manual).
- **Costo ingesta (gate):** `precio_setup = MAX($15, costo_cómputo×25) × factor_complejidad`. Hard caps $5/doc, $20/sesión.
- **Stack:** FastAPI · Supabase (Postgres+pgvector+pg_trgm) · FalkorDB · Redis (cache=PCL, DB1) · Fly.io (apps: api, graph, embedder, redis, ingest; región dfw) · Next.js 15 + React + Tailwind + shadcn/ui en Vercel.
- **Catálogo de Schemas v2 CERRADO** (spec, no implementado): 14 tipos derivados de norma, estructurado por fase del ciclo de vida del activo. Regla de liberación: 4 patas (labels al scope de lectura + intents de ranking + suite de paráfrasis + render).
- **Regla de deploy:** todo deploy que toca retrieval/ranking/bridge invalida la caché PCL de los tenants afectados.

---

## LO QUE FALTA (orden; nada se trocea en sub-sprints)

1. **Lock terminológico** — glosario 3 orígenes, selección de variantes por usuario, lock como función técnica. Diferenciador vs CAT tools. (Requiere criterio lingüístico de Jorge.)
2. **Catálogo de Schemas — implementación** — refinar activos (calibración, SDS, subdividir manual) → `norma_ley` → resto. (Spec v2 cerrada.)
3. **Acervo Normativo precargado** (OSHA + anexos, NOMs instalación/operación/mantenimiento) — depende del schema `norma_ley`.

**Ops/config (no desarrollo):** SMTP/Brevo antes de onboarding real de cliente (hoy invite link en respuesta API como fallback).

**Diferido por decisión de Jorge:** WhatsApp (B9/B10) — degrada FLOW, requiere feedback real post-pilotos.

**Con disparador (no MVP):** CoDos compartidos/embajador · sprint legal/fiscal/aduanal · Stripe · FX/seat policy · Field Series · Bubble plugin.

**Curaduría:** manuales en TEXTO para maq/min (planos ahogan OCR — límite de fuente).

---

## PRINCIPIOS DE PROCESO (permanentes)

- Un desarrollo = un sprint. Nada se difiere por "más trabajo/incierto/bajo volumen". Solo se difiere lo que depende de autoridad de dominio de Jorge, tarea de ops, o decisión explícita suya.
- **Lo release-ready se despliega, no se estaciona** (lección F3: lo estacionado se entrelaza con lo nuevo hasta volverse inseparable).
- Opus verifica todo lo ejecutable automatizado; no usa el recorrido de Jorge como QA.
- "Citado" = verbatim del chunk real, jamás texto generado. Tipo declarado = tipo real. No se curvan documentos al pipeline.
- Verdad operacional: estado real, límites con causa, nada omitido en silencio.

---

## CAMINO CRÍTICO A PRIMER PILOTO

Deploy núcleo (en vuelo) → recorrido de Jorge → **producto demostrable** (calibración Mitutoyo "¿cuándo vence?" + MSDS + aislamiento entre ambos = Tier 1 y 2). Lock/catálogo/acervo enriquecen, no bloquean la demo. SMTP necesario para onboarding real, no para demostrar. Demo objetivo: Laboratorio Estándar.

---
*Verdad operacional al 15-jun: lo único no verificado del sprint es una ingesta real pagada hasta "vivo" (requiere worker desplegado + presupuesto Google $600 MXN + stack Docling del worker). El deploy en vuelo lo resuelve.*
