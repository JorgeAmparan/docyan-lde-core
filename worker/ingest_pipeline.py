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
import re

from app.graph.schemas.dkg_ontology import graph_name_for
from app.jobs.job_models import IngestJob
from worker import llm_config

logger = logging.getLogger("docyan.worker.pipeline")

FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST", "localhost")
FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT", "6379"))

# ── ED-0e — Gate de OCR POR PÁGINA ────────────────────────────────────────────
# Correr Tesseract OCR de página completa en 4 idiomas sobre un PDF que YA trae
# capa de texto nativa es desperdicio de CPU/RAM: fue la causa del OOM del worker
# (4 GB) con el manual LS-400 (88 pp de texto nativo + 85 imágenes, OCR fra+deu+
# spa+eng en cada una). El gate corre OCR SOLO en páginas SIN texto extraíble
# suficiente — cubre docs MIXTOS (texto nativo + anexos escaneados). Las figuras/
# callouts se extraen aparte por visión (ED-0c), así que apagar el OCR de página
# NO pierde el texto de los dibujos.
# Umbral: una página SIN capa de texto (escaneada/solo-imagen) da ~0 caracteres
# extraíbles; una con capa de texto nativa da decenas+ — incluso una lámina/diagrama
# con solo un pie de figura. El gate distingue "¿tiene capa de texto?" (no "¿tiene
# MUCHO texto?"): 16 es el piso para considerarla nativa. Un umbral alto (p. ej. 100)
# marcaría páginas de diagrama con texto escaso como "a OCR" y prendería el OCR de
# todo el doc — justo lo que OOM-mató al worker con LS-400 (19/88 pp con <100 chars
# pero mín. 59 → todas SÍ traen texto). Configurable por env.
OCR_MIN_CHARS_POR_PAGINA = int(os.getenv("OCR_MIN_CHARS_POR_PAGINA", "16"))
# Idiomas de OCR (default acotado: español + inglés — corredor T-MEC). El default
# de Docling es fra+deu+spa+eng: 4 pasadas de Tesseract por página = parte del gasto.
OCR_LANGS = os.getenv("OCR_LANGS", "spa+eng")


def _ocr_langs_list() -> list[str]:
    """`"spa+eng"` / `"spa, eng"` → `["spa", "eng"]` para TesseractCliOcrOptions."""
    return [x for x in re.split(r"[+,\s]+", OCR_LANGS.strip()) if x]


def _env_bool(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


# ── DEMO-READY (jul 2026) — refuerzo del gate: "¿hay CONTENIDO?", no solo "¿capa?" ──
# El gate por-página (≥16 chars) detecta "¿la página tiene capa de texto?", NO "¿tiene
# CONTENIDO?". El manual LS-400 (88pp) trae ~115 chars/pág que son SOLO encabezados y
# pies corridos ("BOMBA LS-400 / 500N — MANTENIMIENTO / PAG 36 / MANUAL DE OPERACIÓN"):
# el gate lo contó como texto-nativo y apagó el OCR, dejando el cuerpo real (dentro de
# las 244 figuras/dibujos) sin extraer → grafo casi vacío → retrieval VACÍO en prod
# (diagnóstico DEMO-READY: `cebado/presión/RPM/especificaciones` = 0 páginas de texto).
# Dos palancas, ambas por env, sin cambiar el baseline ED-0e por default:
#   1. OCR_FORCE=1 — fuerza do_ocr=True incondicional (para REINGERIR un doc concreto
#      con OCR, sin tocar la lógica del gate). Es la palanca del pase de reingesta.
#   2. OCR_MIN_CONTENIDO_POR_PAGINA — densidad de CONTENIDO (descontando boilerplate
#      corto y repetido) por debajo de la cual se fuerza OCR aunque el gate por-página
#      diga que hay texto. Default 0 = DESACTIVADO (preserva ED-0e byte-idéntico).
#      Recomendado ~120 para auto-detectar docs header-only con margen amplio. Densidad
#      medida en el corpus demo (descontando boilerplate): LS-400=59 (header-only),
#      maxi_op=210, partes=790, SDS≥3577 (texto real). 120 cae holgado entre 59 y 210.
OCR_FORCE = _env_bool("OCR_FORCE")
OCR_MIN_CONTENIDO_POR_PAGINA = int(os.getenv("OCR_MIN_CONTENIDO_POR_PAGINA", "0"))
# Boilerplate = línea CORTA (≤ este largo) repetida en > umbral de páginas. Los headers
# corridos son cortos; el cuerpo de párrafo es largo (no se descuenta aunque se repita).
_BOILERPLATE_MAX_CHARS = 80


def _contenido_por_pagina(textos_por_pagina: list[str | None]) -> float:
    """
    Densidad de CONTENIDO por página, descontando el boilerplate (encabezados/pies
    corridos): líneas CORTAS (≤ `_BOILERPLATE_MAX_CHARS`) que se repiten en > 25 % de
    las páginas. Un manual con solo headers da densidad ~0 aunque el gate por-página lo
    cuente como "texto nativo". NO se descuentan líneas largas aunque se repitan (el
    cuerpo real puede repetir frases): solo el boilerplate corto y repetido. Los números
    se normalizan a `#` (así "PAG 27"/"PAG 36" cuentan como el mismo pie).
    """
    n = len(textos_por_pagina)
    if n == 0:
        return 0.0
    from collections import Counter

    freq: Counter[str] = Counter()
    for t in textos_por_pagina:
        vistas = set()
        for ln in (t or "").splitlines():
            s = re.sub(r"\d+", "#", ln.strip().lower())
            if 4 <= len(s) <= _BOILERPLATE_MAX_CHARS:
                vistas.add(s)
        freq.update(vistas)
    umbral_rep = max(2, n // 4)  # repetida en > 25 % de las páginas ⇒ boilerplate
    boiler = {s for s, c in freq.items() if c >= umbral_rep}
    contenido = 0
    for t in textos_por_pagina:
        for ln in (t or "").splitlines():
            crudo = ln.strip()
            if not crudo:
                continue
            norm = re.sub(r"\d+", "#", crudo.lower())
            if len(norm) <= _BOILERPLATE_MAX_CHARS and norm in boiler:
                continue  # boilerplate corto repetido: no cuenta como contenido
            contenido += len(crudo)
    return contenido / n


def _aplicar_overrides_ocr(g: dict) -> dict:
    """
    Aplica los overrides de OCR (DEMO-READY) sobre la decisión del gate por-página y
    anota `motivo_ocr`. Prioridad: OCR_FORCE > baja densidad de contenido > gate.
    No cambia el baseline: con OCR_FORCE apagado y OCR_MIN_CONTENIDO_POR_PAGINA=0 la
    decisión es idéntica a ED-0e.
    """
    g.setdefault("motivo_ocr", "gate_por_pagina" if g.get("do_ocr") else "texto_nativo")
    if OCR_FORCE:
        g["do_ocr"] = True
        g["motivo_ocr"] = "forzado"
        return g
    dens = g.get("contenido_por_pagina")
    if (
        not g.get("do_ocr")
        and OCR_MIN_CONTENIDO_POR_PAGINA > 0
        and dens is not None
        and g.get("paginas_totales")
        and dens < OCR_MIN_CONTENIDO_POR_PAGINA
    ):
        g["do_ocr"] = True
        g["motivo_ocr"] = "baja_densidad"
    return g


def _clasificar_paginas(textos_por_pagina: list[str | None]) -> dict:
    """
    Gate de OCR POR PÁGINA (ED-0e). Dada la lista de texto extraíble por página,
    clasifica cada una: 'texto nativo' (≥ OCR_MIN_CHARS_POR_PAGINA caracteres) vs
    'sin texto' (candidata a OCR). Devuelve los contadores de QA y la decisión
    doc-level `do_ocr` (True si ALGUNA página carece de texto nativo).
    """
    total = len(textos_por_pagina)
    nativas = sum(
        1 for t in textos_por_pagina if t and len(t.strip()) >= OCR_MIN_CHARS_POR_PAGINA
    )
    ocr = total - nativas
    return {
        "aplica": True,
        "paginas_totales": total,
        "paginas_texto_nativo": nativas,
        "paginas_ocr": ocr,          # páginas sin capa de texto suficiente → OCR
        "do_ocr": ocr > 0,           # doc-level: si NINGUNA lo necesita, OCR OFF
        "umbral_chars": OCR_MIN_CHARS_POR_PAGINA,
        "ocr_langs": OCR_LANGS,
    }


def _es_pdf(path: str) -> bool:
    """
    ¿El archivo es un PDF? Se detecta por CONTENIDO (magic bytes `%PDF-`), no por
    extensión: el worker descarga el documento a un temporal cuyo sufijo sale del
    `nombre_archivo` del job, que a veces NO trae `.pdf` (p. ej. "Manual … LS-400"
    → sufijo `.bin`). Detectar por extensión dejaba el gate ciego y el OCR corría
    igual (regresión ED-0e verificada en prod: OOM del worker pese al gate).
    """
    if path.lower().endswith(".pdf"):
        return True
    try:
        with open(path, "rb") as fh:
            return fh.read(5) == b"%PDF-"
    except Exception:  # noqa: BLE001 — ilegible ⇒ que Docling decida (OCR default)
        return False


def analizar_ocr_paginas(path: str) -> dict:
    """
    Escanea un PDF página por página (pypdf) para decidir el OCR (ED-0e). Para
    no-PDF o si el escaneo falla devuelve `aplica=False` → se deja el default de
    Docling (do_ocr=True): postura segura, no suprimir OCR cuando hay duda.
    """
    no_aplica = {
        "aplica": False, "paginas_totales": None, "paginas_texto_nativo": 0,
        "paginas_ocr": 0, "do_ocr": True, "umbral_chars": OCR_MIN_CHARS_POR_PAGINA,
        "ocr_langs": OCR_LANGS, "contenido_por_pagina": None,
    }
    if not _es_pdf(path):
        return _aplicar_overrides_ocr(no_aplica)
    try:
        from pypdf import PdfReader

        reader = PdfReader(path)
        textos: list[str] = []
        for pg in reader.pages:
            try:
                textos.append(pg.extract_text() or "")
            except Exception:  # noqa: BLE001 — página ilegible cuenta como sin texto (OCR)
                textos.append("")
        g = _clasificar_paginas(textos)
        g["contenido_por_pagina"] = round(_contenido_por_pagina(textos), 1)
        return _aplicar_overrides_ocr(g)
    except Exception as exc:  # noqa: BLE001 — el gate es optimización, no gate del cobro
        logger.warning(
            "gate OCR: no se pudo escanear %s (%s) — OCR por default", path, type(exc).__name__
        )
        return _aplicar_overrides_ocr(no_aplica)


# ── Conversión Docling ────────────────────────────────────────────────────────


# ED-0f — acota el pico de memoria de la conversión SIN cambiar el output.
# LS-400 (88pp, 244 figuras) escalaba a 9.7 GB en convert() → OOM hasta en 16 GB.
# Diagnóstico (medido en prod): NO eran los rásters de figura — con
# `generate_picture_images=False` el pico apenas bajó (9.63 vs 9.70 GB; los 244
# crops pesan ~70 MB). El driver real es la COLA de páginas de Docling
# (`queue_max_size`, default 100): un doc de 88pp entra COMPLETO en la cola y sus
# rásters de página + parsed-data se acumulan. Bajar `queue_max_size` aplica
# backpressure → solo ~N páginas en vuelo, con OUTPUT BYTE-IDÉNTICO (es profundidad
# de pipeline, no contenido): mismo markdown, mismos chunks, mismas citas, mismas
# figuras. UNA sola convert() — sin page_range, sin bordes de lote, sin riesgo de
# divergencia de chunks. (El intento de 2 pasadas + page_range se descartó: partía
# de que los rásters eran el driver, que la medición refutó.)
#
# Curva de pico medida en prod con LS-400 (88pp, 244 figuras) — output byte-idéntico
# en las tres (el diff contra el golden queda vacío: 244 figuras por hash + 11 chunks):
#     queue=100 → 9.63 GB   ·   queue=4 → 7.06 GB   ·   queue=1 → 3.34 GB
# Default=1 (UNA página en vuelo) para caber en el worker de 4 GB con margen. Es el
# ajuste más conservador de memoria; a cambio la conversión procesa página a página
# (throughput menor, irrelevante en ingesta asíncrona). Subir por env en workers con
# más RAM si se quiere más paralelismo de páginas.
DOCLING_QUEUE_MAX_SIZE = max(1, int(os.getenv("DOCLING_QUEUE_MAX_SIZE", "1")))


def _pdf_pipeline_options(ocr_gate: dict):
    """`PdfPipelineOptions` del worker. `queue_max_size` acotado (ED-0f) limita las
    páginas en vuelo → pico de memoria acotado con output IDÉNTICO. Mismos modelos y
    mismo `images_scale` (default): cero degradación."""
    from docling.datamodel.pipeline_options import (
        PdfPipelineOptions,
        TesseractCliOcrOptions,
    )

    opts = PdfPipelineOptions()
    opts.do_table_structure = True  # TableFormer (tablas complejas, núcleo PoC)
    # ED-0e — OCR SOLO si alguna página carece de texto nativo; idiomas acotados.
    opts.do_ocr = ocr_gate["do_ocr"]
    opts.ocr_options = TesseractCliOcrOptions(lang=_ocr_langs_list())
    opts.generate_picture_images = True  # B9.5 T3: figuras con imagen (auto-extracción)
    opts.queue_max_size = DOCLING_QUEUE_MAX_SIZE  # ED-0f — backpressure de páginas
    # artifacts_path: modelos precargados en build (layout+tableformer). Sin esto,
    # convert() intenta snapshot_download y con HF_HUB_OFFLINE=1 falla (B2.2).
    artifacts = os.getenv("DOCLING_ARTIFACTS_PATH")
    if artifacts and os.path.isdir(artifacts):
        opts.artifacts_path = artifacts
    return opts


class _MemoryPeakSampler:
    """
    Muestrea el pico de memoria USADA de la máquina durante `convert()` (DEMO-READY).

    Motivo: la reingesta OCR del LS-400 (88pp/244 figuras) topó los 4 GB y hubo que
    subir a 8 GB a mano, PERO el pico real NO se pudo medir a posteriori (sin
    `cgroup memory.peak`, con `max_usage_in_bytes=0`, y sin traza en el worker). Sin
    medición no hay auto-dimensionamiento honesto. Este sampler cierra ese hueco: cada
    ingesta reporta su pico → el cotizador calibra el requisito de memoria por perfil
    de documento (páginas × densidad × OCR) y el sistema decide solo (escalar/rechazar).

    Lee `MemTotal - MemAvailable` de /proc/meminfo (memoria usada de la máquina, no solo
    el RSS del proceso — incluye los subprocesos `tesseract` del OCR). Hilo daemon,
    best-effort: si /proc no está (no-Linux/tests), el pico queda en None y no rompe.
    """

    def __init__(self, intervalo_s: float = 2.0) -> None:
        self.intervalo_s = intervalo_s
        self.pico_kb: int | None = None
        self._stop = False
        self._thread = None

    @staticmethod
    def _usado_kb() -> int | None:
        try:
            total = disp = None
            with open("/proc/meminfo") as fh:
                for ln in fh:
                    if ln.startswith("MemTotal:"):
                        total = int(ln.split()[1])
                    elif ln.startswith("MemAvailable:"):
                        disp = int(ln.split()[1])
                    if total is not None and disp is not None:
                        break
            if total is None or disp is None:
                return None
            return total - disp
        except Exception:  # noqa: BLE001 — no-Linux/sin /proc ⇒ sin medición
            return None

    def _run(self) -> None:
        import time

        while not self._stop:
            u = self._usado_kb()
            if u is not None and (self.pico_kb is None or u > self.pico_kb):
                self.pico_kb = u
            time.sleep(self.intervalo_s)

    def __enter__(self) -> "_MemoryPeakSampler":
        import threading

        self.pico_kb = self._usado_kb()  # muestra inicial
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *_exc) -> None:
        self._stop = True
        if self._thread is not None:
            self._thread.join(timeout=self.intervalo_s + 1)

    @property
    def pico_gb(self) -> float | None:
        return round(self.pico_kb / 1_000_000, 2) if self.pico_kb is not None else None


def convertir(path: str):
    """
    Convierte un documento con Docling → `(markdown, docling_document, ocr_gate)`.
    UNA sola convert() con `generate_picture_images=True` (figuras con raster para
    T3) y `queue_max_size` acotado (ED-0f) para no acumular todas las páginas en
    memoria. `ocr_gate` (ED-0e) trae la señal de QA del gate de OCR.

    Pipeline OFFLINE (HF_HUB_OFFLINE): modelos layout+TableFormer precargados + OCR
    vía el binario `tesseract`. Para formatos no-PDF, Docling usa su pipeline default.
    """
    from docling.datamodel.base_models import InputFormat
    from docling.document_converter import DocumentConverter, PdfFormatOption

    ocr_gate = analizar_ocr_paginas(path)
    # Log ANTES de convert(): si la conversión OOM-mata al proceso, la decisión del
    # gate queda registrada igual (regresión ED-0e).
    logger.info(
        "gate OCR | %s | do_ocr=%s motivo=%s | paginas=%s texto_nativo=%s ocr=%s "
        "contenido/pp=%s | langs=%s umbral=%d densidad_min=%d force=%s queue=%d",
        path, ocr_gate["do_ocr"], ocr_gate.get("motivo_ocr"),
        ocr_gate.get("paginas_totales"), ocr_gate.get("paginas_texto_nativo"),
        ocr_gate.get("paginas_ocr"), ocr_gate.get("contenido_por_pagina"),
        OCR_LANGS, OCR_MIN_CHARS_POR_PAGINA, OCR_MIN_CONTENIDO_POR_PAGINA,
        OCR_FORCE, DOCLING_QUEUE_MAX_SIZE,
    )
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=_pdf_pipeline_options(ocr_gate))
        }
    )
    # Mide el pico de memoria de la conversión (fase pesada; OCR incluido) para calibrar
    # el requisito por perfil de documento (DEMO-READY — cierra el hueco de medición).
    with _MemoryPeakSampler() as mem:
        result = converter.convert(path)
    doc = result.document
    ocr_gate["pico_memoria_gb"] = mem.pico_gb
    logger.info(
        "convert OK | %s | pico_memoria=%s GB | do_ocr=%s paginas=%s",
        path, mem.pico_gb, ocr_gate.get("do_ocr"), ocr_gate.get("paginas_totales"),
    )
    if ocr_gate.get("paginas_totales") is None:
        try:
            ocr_gate = {**ocr_gate, "paginas_totales": len(doc.pages) or None}
        except Exception:  # noqa: BLE001 — el conteo es señal, no gate
            pass
    return doc.export_to_markdown(), doc, ocr_gate


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
        # ED-0f — una sola convert() con queue_max_size acotado (memoria acotada,
        # output byte-idéntico). El docling_doc trae las figuras con raster (T3).
        markdown, docling_doc, ocr_gate = convertir(local_path)
        paginas = ocr_gate.get("paginas_totales") or _contar_paginas(local_path)
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
        # DEMO-CIERRE — markdown POR PÁGINA de Docling para el page-provenance del
        # bridge (`export_to_markdown(page_no=N)`, docling 2.96). Best-effort: si el
        # doc no expone páginas o el export falla, el bridge deja las citas sin página.
        paginas_texto: dict[int, str] = {}
        try:
            for pno in list(getattr(docling_doc, "pages", {}) or {}):
                try:
                    paginas_texto[int(pno)] = docling_doc.export_to_markdown(page_no=int(pno))
                except Exception:  # noqa: BLE001 — una página que no exporta no rompe el resto
                    continue
        except Exception:  # noqa: BLE001 — sin páginas ⇒ sin page-provenance, no rompe
            paginas_texto = {}

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
                paginas_texto=paginas_texto,
                markdown=markdown,
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
            # ED-0e — señal de QA del gate de OCR: cuántas páginas se OCR-earon vs
            # se leyeron por su capa de texto nativa (evita el OCR redundante que
            # OOM-mató al worker). do_ocr=False ⇒ ninguna página necesitó OCR.
            "ocr_gate": {
                "paginas_totales": ocr_gate.get("paginas_totales"),
                "paginas_ocr": ocr_gate.get("paginas_ocr"),
                "paginas_texto_nativo": ocr_gate.get("paginas_texto_nativo"),
                "do_ocr": ocr_gate.get("do_ocr"),
                "ocr_langs": ocr_gate.get("ocr_langs"),
                "umbral_chars": ocr_gate.get("umbral_chars"),
            },
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
