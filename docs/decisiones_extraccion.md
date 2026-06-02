# Decisiones de extracción del DKG — DOCYAN LDE™ by XCID

> Decisión cerrada (Sprint B3.6, 2 junio 2026). Revierte el cambio no solicitado
> de B3.5 que activó NER híbrido con GLiNER. Fuente de verdad para el wiring del
> extractor del worker de ingesta (`docyan-lde-ingest`).

---

## Decisión: extracción **LLM-only** en MVP

El worker de ingesta extrae al grafo (DKG) con un extractor **LLM-only** sobre
GraphRAG-SDK 1.1.1. En código:

```python
# worker/llm_config.py — build_extractor_and_resolver()
extractor = GraphExtraction(
    llm=llm_extraction,
    entity_extractor=LLMExtractor(llm_extraction),  # LLM-only (no GLiNER)
)
resolver = LLMVerifiedResolution(llm=llm_extraction, embedder=embedder)
```

El paso `entity_extractor=LLMExtractor(...)` es **explícito y obligatorio**:
`GraphExtraction` del SDK usa `GLiNERExtractor()` por DEFAULT como step-1 NER. Si
no se pasa `entity_extractor`, entra el híbrido GLiNER por la puerta de atrás.

### Modelo primario: Gemini Flash 2.5

`gemini/gemini-2.5-flash` (prefijo `gemini/` OBLIGATORIO o LiteLLM defaultea a
Vertex AI y falla pidiendo credenciales GCP). Decisión #1 del Paso C. El PoC del
28 mayo 2026 sobre NOM-052 validó que **Gemini Flash 2.5 infiere sujetos
implícitos en voz pasiva regulatoria** ("deberán identificarse…" → Generador):
extrajo 15 obligaciones vs 4 de gpt-4o, a costo de gpt-4o-mini (~$0.04/doc). Esa
capacidad es el núcleo del motor de extracción.

### Modelo fallback: Sonnet 4.6

`anthropic/claude-sonnet-4-6`, vía la cadena de fallback multi-modelo ya
implementada en B2.2 (`extraction_model_chain()` en `worker/llm_config.py`). Si
el primario falla (presupuesto/quota/rate-limit/API error), el worker reintenta
el documento con el siguiente del chain. La cadena de fallback **no se modifica**.

> **Override operativo vigente:** mientras Gemini no tenga saldo, está activo el
> override `INGEST_EXTRACTION_MODEL=anthropic/claude-sonnet-4-6` (Fly secret en
> `docyan-lde-ingest`). Para volver a Gemini Flash 2.5 como primario, basta:
> `flyctl secrets unset INGEST_EXTRACTION_MODEL --app docyan-lde-ingest`.
> El default del código (`_DEFAULT_EXTRACTION_MODEL`) ya es Gemini Flash 2.5;
> no hace falta ningún cambio de código.

---

## GLiNER híbrido: **descartado en MVP**

El modo híbrido (GLiNER hace el step-1 NER local; el LLM verifica + extrae
relaciones) se activó en B3.5 cacheando `urchade/gliner_medium-v2.1` en la imagen
del worker. **No fue solicitado por Jorge**; vino de una interpretación apresurada
de una nota "no bloqueante" de B2.

Resultado medido sobre el documento técnico de validación en español:

| Configuración | Nodos | Relaciones semánticas |
|---|---|---|
| **B2 — LLM-only** | ≈12 | ≈19 |
| **B3.5 — híbrido GLiNER** | 8 | 0 |

Razones del descarte:

- **(a)** `gliner_medium-v2.1` es **anglocéntrico**; los documentos del mercado
  alfa (laboratorios ISO 17025, maquiladoras IMMEX) están mayoritariamente en
  **español** técnico/regulatorio.
- **(b)** GLiNER **no infiere sujetos implícitos** en voz pasiva regulatoria —
  exactamente la capacidad por la que se eligió Gemini Flash 2.5.

## Cache de GLiNER en la imagen: **conservado, inerte**

El prefetch de `urchade/gliner_medium-v2.1` en `worker/Dockerfile` (paso 4) **se
conserva** pero queda **inerte**: con el `entity_extractor=LLMExtractor(...)`
explícito, `GLiNERExtractor` nunca se invoca. No se borra para no re-construir la
imagen ni perder el trabajo de cache ya hecho. Deja la imagen lista para
experimentación **post-MVP** con `gliner_multi-v2.1` (versión multilingüe): para
reactivar el híbrido bastaría volver a pasar `GLiNERExtractor()` como
`entity_extractor`.

---

*XCID SA de CV — DOCYAN LDE™ by XCID — Sprint B3.6 — Confidencial.*
