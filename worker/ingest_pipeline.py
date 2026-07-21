"""
Pipeline de ingesta del worker (B2 §4.1 / §5).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.

Orquestación (Adenda §5):

  Docling (conversión universal + OCR + tablas complejas)
    → GraphRAG-SDK 1.1.1 (extracción al grafo, multi-tenant por graph_name)
    → BGE-M3 self-hosted (embeddings, vía embedder_adapter de B1)
    → deduplicate_entities(fuzzy=True)  [await correcto — bug PoC #1]
    → finalize()
  El provenance (MENTIONED_IN / PART_OF / NEXT_CHUNK + spans de caracteres) es
  nativo del SDK.

Reglas:
  - Multi-tenancy ABSOLUTA: la conexión se crea con graph_name = graph_name_for(
    tenant_id) — el MISMO grafo que el backend lee (app/graph/dkg_ontology).
  - El worker NO cotiza ni reingiere sin confirmación: confía en que el job trae
    una cotización aprobada (el gate es del backend). Verifica esa invariante.
  - BGE-M3, NO OpenAI/Gemini para embeddings (decisión #1).

El stack pesado (graphrag_sdk, docling, litellm, torch) se importa de forma
perezosa: este módulo se puede importar para introspección/tests sin el stack.
"""
from __future__ import annotations

import asyncio
import logging
import os

from app.graph.schemas.dkg_ontology import graph_name_for
from app.jobs.job_models import IngestJob
from worker import llm_config

logger = logging.getLogger("docyan.worker.pipeline")

FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST", "localhost")
FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT", "6379"))


# ── Conversión Docling ────────────────────────────────────────────────────────


def convertir(path: str):
    """
    Convierte un documento (PDF/docx/xlsx/pptx/imagen/...) con Docling y devuelve
    `(markdown, docling_document)`. El `docling_document` permite extraer figuras
    para la auto-extracción de diagramas (B9.5 T3); `generate_picture_images=True`
    hace que las figuras lleven su imagen.

    Pipeline OFFLINE (HF_HUB_OFFLINE en la imagen del worker): usa los modelos
    layout + TableFormer precargados en build y OCR vía el binario `tesseract`
    (apt, sin modelo HF) — así convert() no requiere red. Para formatos no-PDF,
    Docling usa su pipeline por defecto.
    """
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        PdfPipelineOptions,
        TesseractCliOcrOptions,
    )
    from docling.document_converter import DocumentConverter, PdfFormatOption

    pdf_opts = PdfPipelineOptions()
    pdf_opts.do_table_structure = True  # TableFormer (tablas complejas, núcleo PoC)
    pdf_opts.ocr_options = TesseractCliOcrOptions()  # OCR con el tesseract de apt
    pdf_opts.generate_picture_images = True  # B9.5 T3: figuras con imagen (auto-extracción)
    # artifacts_path: directorio donde `docling-tools models download` dejó los
    # modelos en build (layout + tableformer). Sin esto, convert() intenta
    # snapshot_download desde HF y con HF_HUB_OFFLINE=1 falla con
    # LocalEntryNotFoundError (verificado offline en B2.2). Apuntarlo a la ruta del
    # prefetch hace que convert() corra 100% sin red.
    artifacts = os.getenv("DOCLING_ARTIFACTS_PATH")
    if artifacts and os.path.isdir(artifacts):
        pdf_opts.artifacts_path = artifacts
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)}
    )
    result = converter.convert(path)
    return result.document.export_to_markdown(), result.document


def convertir_a_markdown(path: str) -> str:
    """Compat: solo el Markdown (GraphRAG-SDK lo ingiere nativamente)."""
    return convertir(path)[0]


def _contar_paginas(path: str) -> int | None:
    """
    Cuenta páginas de un PDF para el contador de la fase `conversion` (F1 §2.2).
    Best-effort: si no es PDF o falla, devuelve None y la UI omite el contador.
    """
    if not path.lower().endswith(".pdf"):
        return None
    try:
        from pypdf import PdfReader

        return len(PdfReader(path).pages)
    except Exception:  # noqa: BLE001 — el conteo es señal de progreso, no gate
        return None


# ── Construcción del GraphRAG por tenant ──────────────────────────────────────


def _build_graphrag(tenant_id: str, document_schema):
    """
    Construye un GraphRAG apuntando al grafo aislado del tenant.

    Wiring validado en el PoC (poc_v111_gemini_flash.py): el `llm` base del
    GraphRAG es el de QA (gpt-4o-mini); el de EXTRACCIÓN (Gemini 2.5 Flash) NO va
    aquí sino en el `extractor` de `ingest()` (ver procesar()). El embedder es
    BGE-M3 (decisión #1; el PoC usó OpenAI 1536 "por simplicidad", no invalida).
    """
    from graphrag_sdk import ConnectionConfig, FalkorDBConnection, GraphRAG

    from app.graph.embedder_adapter import BGE_M3_DIMENSION, make_bge_m3_adapter

    embedder = make_bge_m3_adapter()
    connection = FalkorDBConnection(
        config=ConnectionConfig(
            host=FALKOR_HOST,
            port=FALKOR_PORT,
            graph_name=graph_name_for(tenant_id),  # multi-tenancy absoluta
        )
    )
    return GraphRAG(
        connection=connection,
        llm=llm_config.build_qa_llm(),  # base = QA (gpt-4o-mini), como el PoC
        embedder=embedder,
        schema=document_schema.to_sdk_schema() if document_schema else None,
        embedding_dimension=BGE_M3_DIMENSION,  # 1024 (BGE-M3), no 256/1536
    )


# ── Pipeline ───────────────────────────────────────────────────────────────────


class IngestPipeline:
    """Procesa un IngestJob: convierte, extrae al grafo, dedup, finaliza."""

    def __init__(self, document_store=None, schema_registry=None, dkg_client=None):
        self.document_store = document_store
        self.schema_registry = schema_registry
        # Cliente DKG para materializar la estructura auto-extraída (T3/T5) directo
        # al grafo. Inyectable para test; por default apunta al FalkorDB del tenant.
        if dkg_client is None:
            from app.graph.dkg_client import DKGClient

            dkg_client = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
        self.dkg_client = dkg_client

    def _resolver_schema(self, job: IngestJob, muestra: str = ""):
        """
        Resuelve el schema del job: registry del tenant → catálogo → generador
        dinámico (Gemini). La generación ocurre AQUÍ (worker), no en el backend:
        el worker tiene litellm/Gemini; el backend se mantiene <1 GB y sin litellm.
        """
        from app.schemas_documentales.catalogo import CATALOGO

        tipo = job.tipo_forzado or job.tipo_documento
        if tipo:
            if self.schema_registry is not None:
                via_reg = self.schema_registry.resolver(job.tenant_id, tipo)
                if via_reg is not None:
                    return via_reg
            if tipo in CATALOGO:
                return CATALOGO[tipo]

        # Sin tipo de catálogo → generar schema dinámico (evita el caso LGPGIR).
        from app.schemas_documentales.generador import GeneradorSchemas

        schema = GeneradorSchemas().generar(muestra, job.contexto)
        if self.schema_registry is not None:
            try:
                self.schema_registry.registrar(job.tenant_id, schema, es_generado_dinamicamente=True)
            except Exception:  # noqa: BLE001
                logger.warning("no se pudo registrar el schema generado")
        return schema

    async def procesar(self, job: IngestJob, local_path: str, progreso=None) -> dict:
        """
        Ejecuta el pipeline completo para un job confirmado. Devuelve estadísticas.

        `local_path`: ruta local del documento (el worker ya lo descargó del
        document store). `job` debe traer una cotización aprobada (invariante del
        gate; el worker la verifica como defensa en profundidad).

        `progreso`: callback opcional `fn(phase, phase_fraction, counters)` (F1
        §2.2). El pipeline lo invoca en los límites de fase con los contadores
        reales que conoce en cada punto (pages tras conversión, entities/relations
        tras extracción/grafo, merged tras dedup). La fase `descarga` la emite el
        worker ANTES de llamar a procesar (ya tiene los bytes). La granularidad es
        por fase con contadores de cierre reales; Docling y GraphRAG-SDK no
        exponen avance intra-fase síncrono (limitación documentada en el reporte).
        """
        if job.cotizacion is None or not job.cotizacion.aprobado:
            raise PermissionError(
                f"job {job.job_id}: sin cotización aprobada. El worker NO ingiere "
                "documentos que no pasaron el gate del cotizador (CLAUDE.md §14)."
            )

        def _emit(phase: str, fraction: float, counters: dict) -> None:
            if progreso is not None:
                try:
                    progreso(phase, fraction, counters)
                except Exception:  # noqa: BLE001 — el progreso es señal, no gate
                    logger.debug("callback de progreso falló (ignorado)")

        # Idempotencia (F1 §2.4 / #8): el document_id que ve el SDK es el SHA-256
        # del CONTENIDO (no el job_id). apply_changes() es crash-safe por SHA-256,
        # así que re-ingerir el mismo contenido (otro job_id, nombre o sesión) NO
        # duplica entidades. El worker además corta antes vía buscar_idempotente.
        doc_id = job.content_sha256 or job.job_id

        # FASE conversion — Docling convierte (opaco): inicio y, al terminar, el
        # conteo de páginas real.
        _emit("conversion", 0.0, {})
        markdown, docling_doc = convertir(local_path)
        paginas = _contar_paginas(local_path)
        pg_counters = {"pages": paginas, "page": paginas} if paginas else {}
        _emit("conversion", 1.0, pg_counters)
        schema = self._resolver_schema(job, muestra=markdown[:8000])

        # FASE extraccion — arranca; los contadores finos (spans/entities) los
        # produce el SDK al cerrar `ingest`.
        _emit("extraccion", 0.0, pg_counters)

        # CADENA CANÓNICA DE TRES CAPAS (decisión Jorge, jun 2026 — llm_config):
        #   Capa 1 primaria (Gemini Flash) → Capa 3 fallback de PROVEEDOR (Opus) ante
        #   EXCEPCIÓN de proveedor (key/cuota/outage); Capa 2 retry de CALIDAD (Gemini
        #   Pro) ante 0 ontología o timeout del primario (misma familia, determinista).
        # Toda corrida registra `modelo_usado` + `capa` (visible, jamás silencioso).
        # Idempotente: `apply_changes` es crash-safe por SHA-256; para FORZAR la
        # re-extracción de calidad se borra el doc del SDK (`delete_document`) antes.
        primary = llm_config.extraction_model()
        quality = llm_config.quality_retry_model()
        prov_fallbacks = llm_config.provider_fallback_models()

        async def _intento(model: str):
            graphrag = _build_graphrag(job.tenant_id, schema)
            try:
                extractor, resolver = llm_config.build_extractor_and_resolver(
                    graphrag.embedder, model=model
                )
                res = await graphrag.ingest(
                    text=markdown, document_id=doc_id, extractor=extractor, resolver=resolver,
                )
                nodos = getattr(res, "nodes_created", None) or 0
                rels = getattr(res, "relationships_created", None) or 0
                _emit("extraccion", 1.0, {**pg_counters, "entities": nodos})
                _emit("grafo", 1.0, {"entities": nodos, "relations": rels, "relationsTotal": rels})
                _emit("dedup", 0.0, {"entities": nodos})
                dups = 0
                if llm_config.LLM_CONFIG["deduplicate_fuzzy"]:
                    dups = await graphrag.deduplicate_entities(fuzzy=True)
                _emit("dedup", 1.0, {"merged": dups, "entities": nodos})
                await graphrag.finalize()
                return res, dups, nodos
            finally:
                graphrag.close()

        ingest_result = None
        duplicados_resueltos = 0
        modelo_usado: str | None = None
        capa_extraccion: str | None = None
        last_exc: Exception | None = None
        timeout_primario = False

        # Pieza 4b — mide el USO REAL de litellm de TODA la extracción (capas 1/2/3)
        # para comparar el gasto REAL vs el estimado, no solo el tier del modelo.
        uso_cm = llm_config.medir_uso()
        uso = uso_cm.__enter__()

        # Capa 1 + Capa 3: primario; ante EXCEPCIÓN escala al fallback de proveedor.
        secuencia = [(primary, "primaria")] + [(m, "fallback_proveedor") for m in prov_fallbacks]
        for model, capa in secuencia:
            try:
                ingest_result, duplicados_resueltos, _n = await _intento(model)
                modelo_usado, capa_extraccion = model, capa
                if capa == "fallback_proveedor":
                    # Señal VISIBLE para monitoreo: si Opus opera en >5% de ingestas
                    # es incidente de key/cuota de Google a resolver, no costo a absorber.
                    logger.warning(
                        "job %s: EXTRACCION_FALLBACK_PROVEEDOR modelo=%s — falla del "
                        "proveedor primario; alerta si recurrente (>5%%)", job.job_id, model,
                    )
                break
            except (asyncio.TimeoutError, TimeoutError) as exc:
                last_exc = exc
                if capa == "primaria":
                    timeout_primario = True
                logger.warning("job %s: timeout de extracción con %s (capa %s)",
                               job.job_id, model, capa)
                break  # timeout → Capa 2 (calidad), no seguir con proveedor
            except Exception as exc:  # noqa: BLE001 — escalada de proveedor deliberada
                last_exc = exc
                logger.warning("job %s: extracción falló con %s (capa %s): %s",
                               job.job_id, model, capa, exc)

        # Capa 2 — retry de CALIDAD (misma familia) ante 0 ontología o timeout primario.
        nodos_primarios = (getattr(ingest_result, "nodes_created", 0) or 0) if ingest_result else 0
        if quality and (timeout_primario or (ingest_result is not None and nodos_primarios == 0)):
            logger.warning(
                "job %s: EXTRACCION_RETRY_CALIDAD %s→%s (0 ontología/timeout del primario)",
                job.job_id, primary, quality,
            )
            # Forzar la re-extracción: borrar el doc del SDK (si no, la dedup por SHA lo salta).
            try:
                g = _build_graphrag(job.tenant_id, schema)
                try:
                    await g.delete_document(doc_id)
                finally:
                    g.close()
            except Exception as exc:  # noqa: BLE001 — best-effort previo al retry
                logger.warning("job %s: delete_document falló antes del retry calidad: %s",
                               job.job_id, exc)
            try:
                r2, d2, n2 = await _intento(quality)
                if n2 > 0 or ingest_result is None:
                    ingest_result, duplicados_resueltos = r2, d2
                    modelo_usado, capa_extraccion = quality, "retry_calidad"
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning("job %s: retry de calidad %s falló: %s", job.job_id, quality, exc)

        # Cierra la medición de uso real (Pieza 4b) antes de cualquier salida.
        uso_cm.__exit__(None, None, None)

        if ingest_result is None:
            raise RuntimeError(
                f"job {job.job_id}: la extracción falló en las 3 capas "
                f"(primaria={primary}, calidad={quality}, proveedor={prov_fallbacks}). "
                f"Último error: {last_exc}"
            ) from last_exc

        # Visibilidad de costo (decisión Jorge #4): el cotizador estima contra la
        # PRIMARIA (Flash). Si operó la capa 2/3, el costo real difiere.
        sin_ontologia = (getattr(ingest_result, "nodes_created", 0) or 0) == 0

        # Pieza 4b — `costo_discrepancia` REAL: compara el gasto REAL (response.usage
        # acumulado por litellm) contra el estimado del cotizador, no solo el tier del
        # modelo. Si no se capturó uso (litellm sin callback / tests), cae al
        # comparador por tier (modelo != primario). NO se traslada al cliente: solo
        # se registra para monitoreo (el saldo liquida la reserva estimada).
        costo_estimado_usd = (
            job.cotizacion.costo_estimado_usd if job.cotizacion is not None else 0.0
        )
        costo_real_usd = round(uso["cost_usd"], 6) if uso.get("calls") else None
        _TOLERANCIA_DISCREPANCIA = 0.20  # 20% sobre lo estimado = discrepancia
        if costo_real_usd is not None and costo_estimado_usd > 0:
            costo_discrepancia = (
                costo_real_usd > costo_estimado_usd * (1 + _TOLERANCIA_DISCREPANCIA)
                or modelo_usado != primary
            )
        else:
            costo_discrepancia = modelo_usado != primary  # fallback por tier (sin uso real)

        # B9.5 §1.0 — Bridge de procedencia + normalización: crea el :DocumentoSource
        # y las aristas/propiedades que los pipelines de lectura (B8) esperan para
        # CITAS y para los tipos 1/2/6/8. Corre sobre el MISMO grafo del tenant, tras
        # el cierre del SDK. Best-effort acotado: es parte del cierre de la ingesta,
        # no un gate del cobro — si fallara, se loguea y el documento queda ingerido
        # (las citas degradan, no se pierde contenido).
        bridge_counters: dict = {}
        try:
            from app.graph.dkg_client import DKGClient
            from app.graph.dkg_provenance import bridge_and_normalize

            bridge_counters = bridge_and_normalize(
                DKGClient(host=FALKOR_HOST, port=FALKOR_PORT),
                job.tenant_id,
                doc_id=doc_id,
                tipo_documento=(schema.tipo_documento if schema else job.tipo_documento) or "documento",
                nombre_archivo=job.nombre_archivo,
                content_sha256=job.content_sha256,
                entidad_id=job.contexto.get("entidad_id"),
            )
        except Exception as exc:  # noqa: BLE001 — el bridge no es gate del cobro
            logger.warning("bridge de procedencia falló (citas degradan): %s", exc)

        # B9.5 §1.1 — Auto-extracción + materialización directa al grafo (T3 diagramas,
        # T5 árboles). DOCYAN extrae del documento y escribe el resultado al grafo sin
        # revisión manual (la extracción del stack es de calidad suficiente).
        # Best-effort: no es gate del cobro.
        visuales = self._auto_materializar_visuales(schema, markdown, docling_doc, job, doc_id)

        # Marca uso del schema (señal de utilidad para el registry vivo).
        if self.schema_registry is not None and schema is not None:
            try:
                self.schema_registry.marcar_uso(job.tenant_id, schema.tipo_documento)
            except Exception:  # noqa: BLE001 — el conteo de uso no debe tumbar la ingesta
                logger.warning("no se pudo marcar uso del schema %s", schema.tipo_documento)

        # B8.5 — invalidación viva del caché semántico (doc CCP §5.3): al cerrar una
        # ingesta exitosa, las entradas del caché atadas a las entidades modificadas
        # (incluido el documento recién ingestado) se invalidan. NO se borra el caché
        # entero: solo lo afectado. Best-effort: el caché es optimización, no gate.
        invalidadas = self._invalidar_cache(job.tenant_id, ingest_result, doc_id)

        # B13.3 fix: ÚNICA FUENTE DE VERDAD de "vivo" = el `:DocumentoSource` existe.
        # Si el bridge no lo dejó (falla/0), el job NO debe declararse vivo en silencio.
        try:
            from app.graph import dkg_documents
            doc_vivo = dkg_documents.documento_existe(self.dkg_client, job.tenant_id, doc_id)
        except Exception:  # noqa: BLE001
            doc_vivo = bool((bridge_counters or {}).get("documento_source"))
        completed_sin_documento = not doc_vivo
        if completed_sin_documento:
            logger.warning(
                "job %s: COMPLETED_SIN_DOCUMENTO — no quedó :DocumentoSource (no es vivo)",
                job.job_id,
            )

        # Campos del IngestionResult del SDK (como reporta el PoC).
        return {
            "tipo_documento": schema.tipo_documento if schema else None,
            "document_id": doc_id,
            "nodos_creados": getattr(ingest_result, "nodes_created", None),
            "relaciones_creadas": getattr(ingest_result, "relationships_created", None),
            "chunks_indexados": getattr(ingest_result, "chunks_indexed", None),
            "duplicados_resueltos": duplicados_resueltos,
            "modelo_extraccion": modelo_usado,
            # Visibilidad de la cadena de 3 capas (decisión Jorge): qué capa/modelo
            # corrió, contra qué se cotizó, y si hubo discrepancia de costo o ontología.
            "capa_extraccion": capa_extraccion,           # primaria|retry_calidad|fallback_proveedor
            "cotizado_contra": primary,                   # el cotizador estima contra la primaria
            "costo_discrepancia": costo_discrepancia,     # True ⇒ real > estimado×1.2 o corrió capa 2/3
            # Pieza 4b — gasto REAL medido (response.usage) vs estimado, para monitoreo.
            "costo_estimado_usd": round(costo_estimado_usd, 6),
            "costo_real_usd": costo_real_usd,             # None ⇒ no se capturó uso (fallback por tier)
            "tokens_reales": {
                "prompt": uso.get("prompt_tokens", 0),
                "completion": uso.get("completion_tokens", 0),
                "llamadas": uso.get("calls", 0),
            },
            "completed_sin_ontologia": sin_ontologia,     # True ⇒ 0 entidades incluso tras retry de calidad
            "completed_sin_documento": completed_sin_documento,  # True ⇒ NO quedó :DocumentoSource (no vivo)
            "documento_vivo": doc_vivo,                   # ÚNICA fuente de verdad de "vivo"
            "cache_invalidadas": invalidadas,
            "bridge": bridge_counters,
            "visuales_materializados": visuales,
            # F1.5: peso del resultado almacenado (markdown convertido) en bytes.
            "markdown_bytes": len(markdown.encode("utf-8")),
            "metadata": getattr(ingest_result, "metadata", {}),
        }

    def _hashes_visuales_previos(self, tenant_id: str) -> dict:
        """
        §5bis — mapa {hash_imagen → DraftDiagrama de referencia} de las figuras YA
        portadas en el tenant (otras ingestas), para deduplicar cross-documento.
        Best-effort: ante cualquier fallo del grafo devuelve {} (dedup intra-doc).
        """
        try:
            from worker.extraction.models import DraftDiagrama

            rows = self.dkg_client.query(
                tenant_id,
                "MATCH (r:RecursoVisual) WHERE r.hash_imagen IS NOT NULL "
                "RETURN r.hash_imagen AS h, r.url AS url, r.titulo AS titulo",
            )
            previos: dict[str, DraftDiagrama] = {}
            for row in rows or []:
                h = row.get("h")
                url = row.get("url")
                if h and url:
                    previos[h] = DraftDiagrama(
                        titulo=row.get("titulo") or "", recurso_url=url, hash_imagen=h,
                    )
            return previos
        except Exception as exc:  # noqa: BLE001 — la dedup cross-doc no es gate
            logger.debug("no se pudieron leer hashes visuales previos: %s", type(exc).__name__)
            return {}

    def _auto_materializar_visuales(self, schema, markdown, docling_doc, job, doc_id) -> dict:
        """
        Auto-extrae y materializa DIRECTO al grafo según los tipos de visualización
        del schema: T5 (árbol) desde el texto, T3 (diagrama) desde las figuras. Sin
        revisión manual — el resultado queda vivo para la consulta, con procedencia
        (`doc_id`/`entidad_id`). Best-effort: nunca rompe la ingesta.

        Devuelve contadores {arboles, diagramas, fidelidad_visual}. La `fidelidad_visual`
        (ED-0c) es el QA de ingesta: figuras detectadas por Docling vs realmente
        portadas como recurso renderable, para que la degradación NO sea silenciosa.
        """
        counters: dict = {"arboles": 0, "diagramas": 0}
        tipos = set(getattr(schema, "tipos_intencion_visualizacion", []) or []) if schema else set()
        entidad_id = job.contexto.get("entidad_id")

        # T5 — árbol de diagnóstico (extracción de texto) → grafo.
        if 5 in tipos:
            try:
                from worker.extraction.materializar import materializar_arbol
                from worker.extraction.tree_extractor import extraer_arbol_diagnostico

                arbol = extraer_arbol_diagnostico(markdown)
                if arbol is not None:
                    materializar_arbol(self.dkg_client, job.tenant_id, arbol,
                                       doc_id=doc_id, entidad_id=entidad_id)
                    counters["arboles"] = 1
            except Exception as exc:  # noqa: BLE001 — extracción no es gate
                logger.warning("auto-extracción de árbol falló: %s", type(exc).__name__)

        # T3 — diagramas (figuras + visión) → grafo. ED-0c: porta TODA figura con
        # imagen (sin tope, sin gate de callouts) y mide la fidelidad detectadas-vs-portadas.
        if 3 in tipos and docling_doc is not None:
            try:
                from worker.extraction.diagram_extractor import extraer_diagramas
                from worker.extraction.docling_figures import extraer_figuras
                from worker.extraction.materializar import materializar_diagrama

                # Docling detectó estas figuras (algunas pueden no dar imagen raster
                # utilizable → vectoriales/fallidas: eso es parte de la fidelidad).
                detectadas = len(getattr(docling_doc, "pictures", None) or [])
                figuras = extraer_figuras(docling_doc)  # las que sí dieron PNG usable
                con_imagen = len(figuras)

                # §5bis: siembra los hashes de figuras YA portadas en el tenant (otras
                # ingestas) para deduplicar cross-documento — una figura idéntica no se
                # re-almacena ni se re-visiona. Best-effort: si el grafo no responde,
                # la dedup queda intra-documento (igual de correcta, menos alcance).
                hashes_previos = self._hashes_visuales_previos(job.tenant_id)

                drafts, fid = extraer_diagramas(
                    job.tenant_id, figuras, hashes_previos=hashes_previos,
                )
                for d in drafts:
                    materializar_diagrama(self.dkg_client, job.tenant_id, d,
                                          doc_id=doc_id, entidad_id=entidad_id)
                counters["diagramas"] = len(drafts)
                counters["fidelidad_visual"] = {
                    "figuras_detectadas": detectadas,             # Docling pictures
                    "con_imagen_utilizable": con_imagen,          # dieron PNG raster
                    "sin_imagen_utilizable": max(0, detectadas - con_imagen),  # vectorial/no-raster
                    "portadas": fid["portadas"],                  # :RecursoVisual con url
                    "con_callouts": fid["con_callouts"],          # + etiquetas de visión
                    "figuras_deduplicadas": fid["figuras_deduplicadas"],  # §5bis: mismo hash
                    "store_fallo": fid["store_fallo"],
                    "vision_fallo": fid["vision_fallo"],
                    "omitidas_por_tope": fid["omitidas_por_tope"],
                }
                # QA: si no se portaron TODAS las detectadas, avísalo fuerte (no silencioso).
                if fid["portadas"] < detectadas:
                    logger.warning(
                        "FIDELIDAD VISUAL job %s: %d/%d figuras portadas — "
                        "sin_imagen=%d store_fallo=%d tope=%d (revisar en QA de ingesta)",
                        job.job_id, fid["portadas"], detectadas,
                        max(0, detectadas - con_imagen), fid["store_fallo"],
                        fid["omitidas_por_tope"],
                    )
            except Exception as exc:  # noqa: BLE001 — extracción no es gate
                logger.warning("auto-extracción de diagramas falló: %s", type(exc).__name__)

        if counters["arboles"] or counters["diagramas"] or counters.get("fidelidad_visual"):
            logger.info("visuales materializados | tenant=%s | %s", job.tenant_id, counters)
        return counters

    @staticmethod
    def _entidades_modificadas(ingest_result, document_id: str) -> list[str]:
        """
        IDs de entidades cuyo estado en el DKG cambió con esta ingesta. El documento
        recién ingestado (`document_id`) siempre cuenta; el SDK puede reportar más en
        `entity_ids`/`affected_entities` (se incluyen si los expone).
        """
        ids = {document_id}
        for attr in ("entity_ids", "affected_entities", "updated_entities"):
            extra = getattr(ingest_result, attr, None)
            if extra:
                ids.update(str(e) for e in extra)
        return sorted(ids)

    def _invalidar_cache(self, tenant_id: str, ingest_result, document_id: str) -> int:
        """Invalida el caché PCL del tenant tras una ingesta. Best-effort (doc §5.3).

        B13.3 §5 fix: invalidación a nivel TENANT, no solo por-entidad. Una ingesta
        (especialmente una RE-ingesta de un doc borrado/re-extraído) puede cambiar la
        respuesta a preguntas YA cacheadas — incluidas las que devolvieron VACÍO con el
        documento viejo (sin `entidad_ids`, que la invalidación por-entidad no captura).
        Es un evento de ciclo de vida: el grafo cambió, la caché vieja muere."""
        try:
            from app.pcl.pcl_cache import PCLCache

            return PCLCache().invalidar_tenant(tenant_id)
        except Exception as exc:  # noqa: BLE001 — el caché no es gate de la ingesta
            logger.warning("no se pudo invalidar el caché PCL: %s", type(exc).__name__)
            return 0
