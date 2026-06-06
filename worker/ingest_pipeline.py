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

import logging
import os

from app.graph.schemas.dkg_ontology import graph_name_for
from app.jobs.job_models import IngestJob
from worker import llm_config

logger = logging.getLogger("docyan.worker.pipeline")

FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST", "localhost")
FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT", "6379"))


# ── Conversión Docling ────────────────────────────────────────────────────────


def convertir_a_markdown(path: str) -> str:
    """
    Convierte un documento (PDF/docx/xlsx/pptx/imagen/...) a Markdown con Docling,
    preservando tablas complejas (TableFormer) y aplicando OCR cuando hace falta.
    GraphRAG-SDK ingiere Markdown nativamente.

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
    return result.document.export_to_markdown()


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

    def __init__(self, document_store=None, schema_registry=None):
        self.document_store = document_store
        self.schema_registry = schema_registry

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
        markdown = convertir_a_markdown(local_path)
        paginas = _contar_paginas(local_path)
        pg_counters = {"pages": paginas, "page": paginas} if paginas else {}
        _emit("conversion", 1.0, pg_counters)
        schema = self._resolver_schema(job, muestra=markdown[:8000])

        # FASE extraccion — arranca; los contadores finos (spans/entities) los
        # produce el SDK al cerrar `ingest`.
        _emit("extraccion", 0.0, pg_counters)

        # Fallback multi-modelo (B2.2): el worker prueba la cadena
        # [primario, *fallbacks] de llm_config. Si la extracción falla con un
        # modelo (presupuesto/quota/rate-limit/API error), reintenta el documento
        # con el siguiente. Idempotente: `apply_changes` del SDK es crash-safe por
        # SHA-256, así que re-ingerir el mismo document_id no duplica.
        chain = llm_config.extraction_model_chain()
        ingest_result = None
        duplicados_resueltos = 0
        modelo_usado = None
        last_exc: Exception | None = None
        for i, model in enumerate(chain):
            graphrag = _build_graphrag(job.tenant_id, schema)
            try:
                # Wiring del PoC: extractor = modelo de extracción; resolver =
                # LLMVerifiedResolution con el mismo LLM + el embedder BGE-M3.
                extractor, resolver = llm_config.build_extractor_and_resolver(
                    graphrag.embedder, model=model
                )
                ingest_result = await graphrag.ingest(
                    text=markdown,
                    document_id=doc_id,
                    extractor=extractor,
                    resolver=resolver,
                )
                nodos = getattr(ingest_result, "nodes_created", None)
                rels = getattr(ingest_result, "relationships_created", None)
                _emit("extraccion", 1.0, {**pg_counters, "entities": nodos or 0})
                # FASE grafo — relaciones escritas (las reporta el ingest_result).
                _emit("grafo", 1.0, {
                    "entities": nodos or 0,
                    "relations": rels or 0,
                    "relationsTotal": rels or 0,
                })
                # FASE dedup — fusión de duplicados (BUG PoC #1; async con await).
                _emit("dedup", 0.0, {"entities": nodos or 0})
                if llm_config.LLM_CONFIG["deduplicate_fuzzy"]:
                    duplicados_resueltos = await graphrag.deduplicate_entities(fuzzy=True)
                _emit("dedup", 1.0, {"merged": duplicados_resueltos, "entities": nodos or 0})
                # Finalize (async; existe finalize_sync para contextos sync).
                await graphrag.finalize()
                modelo_usado = model
                if i > 0:
                    logger.warning(
                        "job %s: extracción OK con modelo de fallback %s (#%d del chain)",
                        job.job_id, model, i + 1,
                    )
                break
            except Exception as exc:  # noqa: BLE001 — fallback de modelo deliberado
                last_exc = exc
                logger.warning(
                    "job %s: extracción falló con modelo %s (%d/%d): %s",
                    job.job_id, model, i + 1, len(chain), exc,
                )
            finally:
                graphrag.close()
        if ingest_result is None:
            raise RuntimeError(
                f"job {job.job_id}: la extracción falló con todos los modelos del "
                f"chain {chain}. Último error: {last_exc}"
            ) from last_exc

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

        # Campos del IngestionResult del SDK (como reporta el PoC).
        return {
            "tipo_documento": schema.tipo_documento if schema else None,
            "document_id": doc_id,
            "nodos_creados": getattr(ingest_result, "nodes_created", None),
            "relaciones_creadas": getattr(ingest_result, "relationships_created", None),
            "chunks_indexados": getattr(ingest_result, "chunks_indexed", None),
            "duplicados_resueltos": duplicados_resueltos,
            "modelo_extraccion": modelo_usado,
            "cache_invalidadas": invalidadas,
            "metadata": getattr(ingest_result, "metadata", {}),
        }

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
        """Invalida las entradas del caché PCL afectadas. Best-effort (doc §5.3)."""
        try:
            from app.pcl.pcl_cache import PCLCache

            entidades = self._entidades_modificadas(ingest_result, document_id)
            return PCLCache().invalidate_by_entities(tenant_id, entidades)
        except Exception as exc:  # noqa: BLE001 — el caché no es gate de la ingesta
            logger.warning("no se pudo invalidar el caché PCL: %s", type(exc).__name__)
            return 0
