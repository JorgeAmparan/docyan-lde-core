"""
Payloads tipados de los 8 pipelines de consulta (B8 §A5).

DOCYAN LDE™ by XCID.

Pydantic v2 estricto. Cada pipeline (Tipos 1-8) compone uno de estos payloads y
el MO lo devuelve dentro de `ConsultaResuelta`. Se exportan a OpenAPI 3.1; B9
genera los tipos TypeScript con `openapi-typescript` para la renderización
condicional por tipo de intención.

El payload usa un campo discriminador `kind` (Literal) para que el frontend
distinga la variante sin ambigüedad (unión discriminada → `oneOf` en OpenAPI).
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ── Provenance / citas (transversal: regulatorio, doc 03) ─────────────────────


class Cita(_Base):
    """Cita de procedencia: documento + sección + página (+ span de caracteres).

    `fragmento` es el texto VERBATIM del documento (recortado del chunk de origen por
    `span_inicio:span_fin`), no texto sintetizado. Integridad de cita (regla absoluta):
    una cita "exacta" SOLO puede mostrarse si `fragmento` viene del documento real; si
    `fragmento` es None, la UI dice "fragmento no disponible" en vez de inventar.
    """

    documento_id: str | None = None
    documento_nombre: str | None = None
    # Tipo documental del MISMO doc de origen (B13.3 §2.3): nombre+tipo nunca se
    # mezclan entre documentos distintos. El front muestra el badge correcto.
    documento_tipo: str | None = None
    seccion: str | None = None
    pagina: int | None = None
    span_inicio: int | None = None
    span_fin: int | None = None
    fragmento: str | None = None
    # Camino a "abrir documento" (B13.3 §2.3): URL del PDF (bucket público de solo
    # lectura para docs demo; URL firmada del propio tenant en producto autenticado).
    # None ⇒ el chip no ofrece "Abrir PDF". Nunca se expone un doc de otro tenant.
    documento_url: str | None = None


class CruceSugerido(_Base):
    """
    Cruce estructural a otro tipo de intención (doc 03). Permite a la UI ofrecer
    el salto (p. ej. de un procedimiento a la especificación que referencia).
    """

    tipo_intencion: str
    entidad_id: str | None = None
    etiqueta: str
    motivo: str


# ── Tipo 1 — Informativa → InfoCard ───────────────────────────────────────────


class EspecificacionItem(_Base):
    nombre: str
    valor: str | None = None
    unidad: str | None = None
    cita: Cita | None = None


class InfoCardPayload(_Base):
    kind: Literal["info_card"] = "info_card"
    titulo: str
    termino_tecnico: str | None = None
    definicion: str | None = None
    especificaciones: list[EspecificacionItem] = Field(default_factory=list)
    match_multiple: bool = False
    desambiguacion: list[str] = Field(default_factory=list)
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 2 — Guía paso a paso → ProcedureCard ─────────────────────────────────


class PasoProcedimiento(_Base):
    orden: int
    descripcion: str
    epp: list[str] = Field(default_factory=list)
    herramientas: list[str] = Field(default_factory=list)
    advertencias: list[str] = Field(default_factory=list)
    precondiciones: list[str] = Field(default_factory=list)
    postcondiciones: list[str] = Field(default_factory=list)
    cita: Cita | None = None


class ProcedureCardPayload(_Base):
    kind: Literal["procedure_card"] = "procedure_card"
    procedimiento_id: str | None = None
    titulo: str
    pasos: list[PasoProcedimiento] = Field(default_factory=list)
    modo_ejecutar_paso_a_paso: bool = False
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 3 — Gráficos/diagramas → DiagramViewer ───────────────────────────────


class EtiquetaDiagrama(_Base):
    texto: str
    # Caja normalizada (0..1) del rótulo sobre la figura (B9.5 T3, auto-extraída).
    x: float | None = None
    y: float | None = None
    w: float | None = None
    h: float | None = None
    lookup_dtm: str | None = None  # forma léxica en el par activo (no traducción)


class SimboloLeyenda(_Base):
    simbolo: str
    significado: str


class DiagramViewerPayload(_Base):
    kind: Literal["diagram_viewer"] = "diagram_viewer"
    recurso_id: str | None = None
    titulo: str
    recurso_url: str | None = None
    etiquetas: list[EtiquetaDiagrama] = Field(default_factory=list)
    leyenda_simbolica: list[SimboloLeyenda] = Field(default_factory=list)
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 4 — Video → VideoPlayer ──────────────────────────────────────────────


class CapituloVideo(_Base):
    titulo: str
    inicio_seg: float


class SubtituloVideo(_Base):
    idioma: str
    texto: str
    inicio_seg: float | None = None
    fin_seg: float | None = None


class VideoPlayerPayload(_Base):
    kind: Literal["video_player"] = "video_player"
    recurso_id: str | None = None
    titulo: str
    video_url: str | None = None
    capitulos: list[CapituloVideo] = Field(default_factory=list)
    subtitulos: list[SubtituloVideo] = Field(default_factory=list)
    transcripcion: str | None = None
    # Bandera HONESTA (B5 diferido): NO se generan subtítulos por traducción.
    subtitulos_disponibles_en_par_activo: bool = False
    acompana_procedimiento_id: str | None = None
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 5 — Troubleshooting → DiagnosticTree ─────────────────────────────────


class OpcionDecision(_Base):
    etiqueta: str
    siguiente_nodo_id: str | None = None
    causa_probable: str | None = None
    accion_resolutoria: str | None = None


class DiagnosticTreePayload(_Base):
    kind: Literal["diagnostic_tree"] = "diagnostic_tree"
    arbol_id: str | None = None
    titulo: str
    nodo_actual_id: str | None = None
    pregunta: str | None = None
    opciones: list[OpcionDecision] = Field(default_factory=list)
    es_hoja: bool = False
    causa_probable: str | None = None
    accion_resolutoria: str | None = None
    session_id: str | None = None  # estado de navegación vive en sesión MO (TTL 2h)
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 6 — Historial → Timeline ─────────────────────────────────────────────


class EventoTimeline(_Base):
    tipo: str
    descripcion: str
    timestamp: str | None = None
    entidad_id: str | None = None


class PatronesEDB(_Base):
    """Patrones del EDB visibles — sustento explícito del Nivel 3 (Adenda)."""

    consultas_frecuentes: list[str] = Field(default_factory=list)
    problemas_recurrentes: list[str] = Field(default_factory=list)
    observaciones_acumuladas: list[str] = Field(default_factory=list)


class TimelinePayload(_Base):
    kind: Literal["timeline"] = "timeline"
    titulo: str
    entidad_id: str | None = None
    eventos: list[EventoTimeline] = Field(default_factory=list)
    certificados_vigencia: list[EventoTimeline] = Field(default_factory=list)
    observaciones: list[EventoTimeline] = Field(default_factory=list)
    mediciones: list[EventoTimeline] = Field(default_factory=list)
    patrones_edb: PatronesEDB = Field(default_factory=PatronesEDB)
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 7 — Alertas → AlertsDashboard ────────────────────────────────────────


class AlertaItem(_Base):
    alerta_id: str | None = None
    descripcion: str
    fecha_vencimiento: str | None = None
    urgencia: str = "media"  # baja | media | alta
    entidad_id: str | None = None
    # Línea ABSOLUTA (CLAUDE.md §11.1): toda alerta servida es administrativa.
    administrativa: bool = True
    # B13.3 §2.4: cita verbatim del documento de origen del vencimiento (cuando el
    # nodo fuente tiene span anclable). None ⇒ sin fragmento, atribución honesta.
    cita: Cita | None = None


class AlertsDashboardPayload(_Base):
    kind: Literal["alerts_dashboard"] = "alerts_dashboard"
    titulo: str
    alertas: list[AlertaItem] = Field(default_factory=list)
    # Invariante regulatorio: SOLO alertas administrativas (nunca clínicas/operativas).
    solo_administrativas: bool = True
    citas: list[Cita] = Field(default_factory=list)


# ── Tipo 8 — Comparativa → ComparativeView ────────────────────────────────────


class DiferenciaDetectada(_Base):
    campo: str
    valor_izquierda: str | None = None
    valor_derecha: str | None = None
    es_cambio_seguridad: bool = False


class ComparativeViewPayload(_Base):
    kind: Literal["comparative_view"] = "comparative_view"
    titulo: str
    estrategia: Literal["versiones_documento", "entidades_mismo_tipo"]
    referencia_izquierda: str
    referencia_derecha: str
    diferencias: list[DiferenciaDetectada] = Field(default_factory=list)
    cacheada: bool = False
    computo_asincrono: bool = False
    citas: list[Cita] = Field(default_factory=list)


# ── Unión discriminada + envelope de respuesta del MO ─────────────────────────

PipelinePayload = Annotated[
    Union[
        InfoCardPayload,
        ProcedureCardPayload,
        DiagramViewerPayload,
        VideoPlayerPayload,
        DiagnosticTreePayload,
        TimelinePayload,
        AlertsDashboardPayload,
        ComparativeViewPayload,
    ],
    Field(discriminator="kind"),
]


class ContextoRespuestaCCP(_Base):
    """
    Metadatos de la Capa de Contexto Persistente (CCP/PCL) para una respuesta de
    consulta (B8.5). Surface del modo de respuesta + economía hacia el frontend
    (B9 los muestra; el endpoint admin los agrega). NO duplica el payload: lo
    acompaña. Doc CCP §4.3 / §7.1.
    """

    modo_respuesta: str  # retrieval_first | synthesis_first | cache_hit
    costo_estimado_centavos: float = 0.0
    latencia_ms: int = 0
    cache_hit: bool = False
    similitud_cache: float | None = None
    dkg_state_hash: str | None = None


class ConsultaResuelta(_Base):
    """
    Envelope que el MO devuelve para una consulta clasificada (`POST /mo/query`).

    Lleva la clasificación (tipo + score + método) + el payload tipado del
    pipeline + los cruces estructurales sugeridos a otros tipos.
    """

    tipo_intencion: str
    score: float
    ruta: str
    metodo: str
    cruces: list[CruceSugerido] = Field(default_factory=list)
    payload: PipelinePayload
    # Responsabilidad 10 del MO (degradación graceful): si el grafo no responde,
    # se devuelve un payload vacío VÁLIDO del tipo clasificado + nota honesta, en
    # vez de fingir contenido o romper el contrato (CLAUDE.md §2.2).
    degradado: bool = False
    nota: str | None = None
    # B8.5 — metadatos CCP/PCL (modo, costo, caché). La fachada PCL los adjunta;
    # opcional para no romper a quien componga el envelope sin pasar por la CCP.
    contexto_ccp: ContextoRespuestaCCP | None = None
