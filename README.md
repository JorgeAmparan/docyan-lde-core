# DOCYAN LDE — Live Document Environment

**by XCID SA de CV**

Plataforma de localización documental con IA para industria regulada y agencias de traducción profesional. DOCYAN convierte documentación técnica en un entorno documental vivo, consultable por QR, multilingüe y auditable.

> Antes **Panohayan DLE™**. Renombrado a **DOCYAN LDE** (28 mayo 2026).

---

## Qué es

DOCYAN no es una CAT tool ni un traductor automático. Es un **entorno documental vivo** que:

- Ingiere documentación técnica (NOM, ISO, manuales, MSDS, certificados de calibración, especificaciones) y construye un **grafo de conocimiento documental (DKG)** con procedencia nativa.
- Traduce con rigor gobernado (**Pista A**) aprovechando memoria de traducción (DTM), corpus terminológico y lock terminológico — actuando como un traductor experimentado, no traduciendo de cero lo ya resuelto.
- Ingiere traducciones de agencias (**Pista B**) y las alinea como documento vivo multilingüe consultable (un mismo QR físico sirve a operadores en 12-20 idiomas).
- Permite **consulta operativa** por QR desde piso de planta (PWA o WhatsApp), con respuestas estructuradas por tipo de intención y pedigree clickeable a la fuente.
- Registra todo en una **bitácora de auditoría (FAT)** con cadena criptográfica SHA-256, para clientes que exigen trazabilidad regulatoria.

## Dos pistas

- **Pista A — Traducción rigurosa** (labs ISO 17025, maquiladoras IMMEX del corredor T-MEC). DOCYAN traduce con gobernanza. MXN.
- **Pista B — Documento vivo multilingüe** (agencias profesionales, B2B2C). La agencia traduce; DOCYAN ingiere, alinea y sirve. USD.

## Arquitectura (alto nivel)

- **Ingesta:** Docling + **FalkorDB GraphRAG-SDK 1.1.1** (reemplaza el DII propio tras el PoC). Extracción con Gemini 2.5 Flash, QA con gpt-4o-mini. Corre en un worker aparte (`docyan-lde-ingest`, **construido en B2**) que consume una cola Redis. **Todo documento pasa antes por el cotizador pre-ingesta** (tiktoken + presupuesto + hard caps; gate sin bypass — `docs/cotizador.md`). Schemas por tipo documental: `docs/schemas_documentales.md`.
- **Embeddings:** **BGE-M3 self-hosted** (multilingüe, soberanía de datos, costo cero recurrente), servicio aparte `docyan-lde-embedder`, 1024 dim.
- **Grafo:** FalkorDB (DKG + DTM) self-hosted en `docyan-lde-graph`, multi-tenancy por `graph_name`, versionado in-place. RPO 15 min.
- **Backend:** Python 3.11 + FastAPI, desplegado en **Fly.io** (`docyan-lde-api`, imagen <1 GB).

### Topología de procesos (B1 + B2)

DOCYAN corre como **5 procesos Fly separados**: `docyan-lde-api` (backend),
`docyan-lde-graph` (FalkorDB), `docyan-lde-embedder` (BGE-M3), `docyan-lde-ingest`
(worker de ingesta, **B2**) y `docyan-lde-redis` (Redis compartido: cola de
ingesta + sesiones MO/APScheduler, **B2.1**). Detalle, diagrama y rutas de
comunicación en **[`docs/dkg_topology.md`](docs/dkg_topology.md)**; ontología del
grafo en **[`docs/dkg_ontology.md`](docs/dkg_ontology.md)**.
- **Frontend:** Next.js 15 + React 19 + Tailwind + shadcn/ui, desplegado en **Vercel**.
- **Orquestación:** Master Orchestrator (sesiones Redis + APScheduler).
- **Canales:** PWA + WhatsApp (360dialog).
- **Gobernanza:** GRG (reglas técnicas) + FAT (auditoría criptográfica).

## Estructura del repo

```
docyan-lde-core/
├── app/                    # Backend FastAPI
│   ├── orchestrator/       # Master Orchestrator + sub-componentes
│   ├── graph/              # DKG/DTM sobre GraphRAG-SDK
│   ├── schemas_documentales/  # Catálogo de tipos + generador dinámico
│   ├── translation/        # Motor de Traducción Rigurosa (Pista A)
│   ├── ingesta_bilingue/   # Pista B (parsers CAT + alineadores)
│   ├── intent/             # Clasificador + pipelines por tipo
│   ├── governance/         # GRG
│   ├── audit/              # FAT + hash chain
│   ├── alerts/             # Alertas administrativas (safety_validator)
│   ├── channels/           # PWA + WhatsApp
│   ├── qr/                 # Tokens QR
│   └── api/                # Routers
├── frontend/               # Next.js 15 (UI #1 PWA, #2 Revisión, #3 PM, #4 Onboarding)
├── migrations/             # SQL Supabase
├── scripts/                # Backup, rename, utilidades
├── tests/                  # pytest
└── docs/                   # Plan v2, Sprint Contracts, adenda, arquitectura
```

## Documentación

- `docs/DOCYAN_Resumen_Ejecutivo_Plan_Dev_v2.md` — **estado vivo y decisiones vigentes** (punto de entrada).
- `docs/Catalogo_Normativo_Schemas_v2.md` — catálogo cerrado de 14 tipos documentales.
- `docs/DOCYAN LDE — Design System/` — **ley visual** (prototipo `DOCYAN-Prototipo.html` = única verdad del frontend interno).
- `docs/Plan_Desarrollo_MVP_DOCYAN_v2_postPoC.md` + `docs/adenda_postPoC_28mayo2026.md` — referencia estructural histórica (cómo se llegó aquí).
- `docs/sprints/` — contratos de la numeración original (B5–B14, planes diferidos); lo ejecutado vive en `docs/sprints/historico/`.
- `CLAUDE.md` — guía operativa para asistencia de IA en este repo.

## Setup

```bash
# Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # completar GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.

# Frontend
cd frontend && npm install

# Tests
pytest tests/ -v
cd frontend && npm test
```

Ver `DEPLOYMENT.md` para despliegue a Fly.io + Vercel.

## Estado

En desarrollo activo, desplegado en Fly.io (5 apps, región `dfw`) + Vercel. El desarrollo real siguió fases (F1.5/F2/F3) + Sprint Núcleo Consultable + B13.3 Retrieval, no la numeración secuencial original B0–B13. Estado vivo en `docs/DOCYAN_Resumen_Ejecutivo_Plan_Dev_v2.md`.

---

© XCID SA de CV — DOCYAN LDE™
