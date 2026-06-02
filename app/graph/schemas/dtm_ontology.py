"""
Ontología del DTM (Document Translation Memory) — DOCYAN LDE™ by XCID.

B3 §1 (Adenda MVP — solo cimientos). Define EN CÓDIGO el modelo del DTM según
doc 02. El DTM **no es una TM tradicional plana**: es un grafo ontológico de
equivalencias técnicas con contexto operacional, sobre el mismo motor (FalkorDB
vía GraphRAG-SDK) que el DKG, pero en **grafos distintos segregados por par
lingüístico** (ver `app/graph/dtm_segregation.py`).

Este módulo es la fuente de verdad de QUÉ nodos / propiedades / aristas / enums
son válidos en el DTM. Sirve para:

  1. Validación de payloads (Pydantic v2) antes de escribir al grafo —
     en particular el enum cerrado de 23 `tipo_segmento` (§1.1): un valor fuera
     de la lista falla *loud*.
  2. Documentación viva del modelo (introspectable → docs/dtm_modelo.md).
  3. Catálogo de etiquetas / aristas para construir Cypher consistente y para
     que el provisioning aplique índices por etiqueta.

ALCANCE B3 (cimientos, no motor): aquí se construye el **modelo**. El motor que
consume estas estructuras en runtime llega después:

  - B5 — motor de traducción: lee `lock_terminologico`, prioridad de TM dual,
    fuzzy matching, sugerencias EDB, tabulador.
  - B6 — ingesta bilingüe: crea en runtime los vínculos cross DKG↔DTM.
  - B11 — UI de revisión lingüística.

Nada de eso se implementa aquí: este módulo solo deja el modelo listo para que
B5/B6/B11 se reactiven **sin migración**.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict

# ─────────────────────────────────────────────────────────────────────────────
# Segregación (prefijo de grafo). El nombre completo lo compone dtm_segregation.
# ─────────────────────────────────────────────────────────────────────────────

DTM_GRAPH_PREFIX = "docyan_dtm_"


# ─────────────────────────────────────────────────────────────────────────────
# Enums de dominio (doc 02)
# ─────────────────────────────────────────────────────────────────────────────


class TipoSegmento(str, Enum):
    """
    Los 23 tipos de segmento de traducción (B3 §1.1). Enum CERRADO: cualquier
    `:SegmentoTraduccion` debe declarar uno de estos valores; otro valor → falla
    loud en `validate_dtm_node`.
    """

    narrativa = "narrativa"
    especificacion = "especificacion"
    instruccion_paso = "instruccion_paso"
    advertencia = "advertencia"
    etiqueta_diagrama = "etiqueta_diagrama"
    leyenda_simbolica = "leyenda_simbolica"
    subtitulo = "subtitulo"
    transcripcion = "transcripcion"
    nodo_diagnostico_pregunta = "nodo_diagnostico_pregunta"
    nodo_diagnostico_respuesta_etiqueta = "nodo_diagnostico_respuesta_etiqueta"
    causa_probable = "causa_probable"
    accion_resolutoria = "accion_resolutoria"
    descripcion_evento = "descripcion_evento"
    observacion_descripcion = "observacion_descripcion"
    accion_correctiva = "accion_correctiva"
    mensaje_alerta = "mensaje_alerta"
    consecuencia_no_accion = "consecuencia_no_accion"
    accion_recomendada_alerta = "accion_recomendada_alerta"
    resumen_ejecutivo_comparativo = "resumen_ejecutivo_comparativo"
    descripcion_diferencia = "descripcion_diferencia"
    accion_sugerida_comparativa = "accion_sugerida_comparativa"
    requisito_normativo = "requisito_normativo"
    modulo_formativo_contenido = "modulo_formativo_contenido"


# Lista canónica de los 23 valores (orden de doc 02 / §1.1). Sirve para tests
# parametrizados y para la documentación introspectable.
TIPOS_SEGMENTO: tuple[str, ...] = tuple(t.value for t in TipoSegmento)
assert len(TIPOS_SEGMENTO) == 23, "El enum TipoSegmento debe tener exactamente 23 valores."


class TipoGlosario(str, Enum):
    cliente = "cliente"
    agencia = "agencia"
    proyecto = "proyecto"


class RolRevisor(str, Enum):
    traductor = "traductor"
    revisor_agencia = "revisor_agencia"
    revisor_cliente = "revisor_cliente"


class AccionRevision(str, Enum):
    aprobar = "aprobar"
    editar = "editar"
    rechazar = "rechazar"
    comentar = "comentar"


class EstadoSugerencia(str, Enum):
    propuesta = "propuesta"
    aceptada = "aceptada"
    rechazada = "rechazada"
    reportada_al_cliente = "reportada_al_cliente"


# ─────────────────────────────────────────────────────────────────────────────
# Etiquetas de nodo (labels) — catálogo canónico
# ─────────────────────────────────────────────────────────────────────────────


class DTMNodeLabel(str, Enum):
    # Los 5 nodos de dominio del DTM (B3 §1).
    SEGMENTO_TRADUCCION = "SegmentoTraduccion"
    GLOSARIO = "Glosario"
    TERMINO_GLOSARIO = "TerminoGlosario"
    REGISTRO_REVISION = "RegistroRevision"
    SUGERENCIA_TERMINO = "SugerenciaTermino"
    # Nodo de proyecto (ancla de `:PERTENECE_A_PROYECTO`). Estructural: registra
    # en el grafo el proyecto cuyo metadato vive en Supabase (migración 010).
    PROYECTO = "Proyecto"
    # Nodo puente de provenance cross-grafo (ver dkg_dtm_bridge). Representa,
    # DENTRO del grafo DTM, el nodo DKG de origen de una traducción. No es un
    # nodo de dominio: existe porque las aristas no cruzan graph_name en FalkorDB.
    REFERENCIA_DKG = "ReferenciaDKG"


# Los 5 nodos de dominio (subconjunto que el contrato B3 §1 enumera). Útil para
# el provisioning de índices y para tests.
DOMAIN_NODE_LABELS: tuple[str, ...] = (
    DTMNodeLabel.SEGMENTO_TRADUCCION.value,
    DTMNodeLabel.GLOSARIO.value,
    DTMNodeLabel.TERMINO_GLOSARIO.value,
    DTMNodeLabel.REGISTRO_REVISION.value,
    DTMNodeLabel.SUGERENCIA_TERMINO.value,
)


# ─────────────────────────────────────────────────────────────────────────────
# Tipos de arista (relationships)
# ─────────────────────────────────────────────────────────────────────────────


class DTMEdgeType(str, Enum):
    # Aristas internas del DTM (B3 §5).
    PERTENECE_A_PROYECTO = "PERTENECE_A_PROYECTO"
    RECIBIO_REVISION = "RECIBIO_REVISION"
    CONTIENE_TERMINO = "CONTIENE_TERMINO"
    USA_GLOSARIO = "USA_GLOSARIO"
    USA_TERMINO_GLOSARIO = "USA_TERMINO_GLOSARIO"
    CANDIDATA_PARA_GLOSARIO = "CANDIDATA_PARA_GLOSARIO"
    # Aristas cross DKG↔DTM (B3 §5). Realizadas vía nodo puente :ReferenciaDKG
    # dentro del grafo DTM — ver dkg_dtm_bridge y docs/dtm_modelo.md.
    TRADUCIDA_VIA = "TRADUCIDA_VIA"
    TRADUCIDO_DESDE = "TRADUCIDO_DESDE"


# Aristas internas: (origen, tipo, destino).
DTM_INTERNAL_EDGES: tuple[tuple[str, str, str], ...] = (
    (DTMNodeLabel.SEGMENTO_TRADUCCION.value, DTMEdgeType.PERTENECE_A_PROYECTO.value,
     DTMNodeLabel.PROYECTO.value),
    (DTMNodeLabel.SEGMENTO_TRADUCCION.value, DTMEdgeType.RECIBIO_REVISION.value,
     DTMNodeLabel.REGISTRO_REVISION.value),
    (DTMNodeLabel.GLOSARIO.value, DTMEdgeType.CONTIENE_TERMINO.value,
     DTMNodeLabel.TERMINO_GLOSARIO.value),
    (DTMNodeLabel.SEGMENTO_TRADUCCION.value, DTMEdgeType.USA_GLOSARIO.value,
     DTMNodeLabel.GLOSARIO.value),
    (DTMNodeLabel.SEGMENTO_TRADUCCION.value, DTMEdgeType.USA_TERMINO_GLOSARIO.value,
     DTMNodeLabel.TERMINO_GLOSARIO.value),
    (DTMNodeLabel.SUGERENCIA_TERMINO.value, DTMEdgeType.CANDIDATA_PARA_GLOSARIO.value,
     DTMNodeLabel.GLOSARIO.value),
)

# Aristas cross DKG↔DTM: (label DKG de origen, tipo, label DTM destino). El
# origen es un nodo del DKG; ver DKG_TRANSLATABLE_LABELS en dkg_dtm_bridge.
DTM_CROSS_EDGES: tuple[tuple[str, str, str], ...] = (
    ("<DKG>", DTMEdgeType.TRADUCIDA_VIA.value, DTMNodeLabel.SEGMENTO_TRADUCCION.value),
    ("<DKG>", DTMEdgeType.TRADUCIDO_DESDE.value, DTMNodeLabel.SEGMENTO_TRADUCCION.value),
)


# ─────────────────────────────────────────────────────────────────────────────
# Modelos Pydantic de validación de propiedades por nodo (doc 02 / §1)
# ─────────────────────────────────────────────────────────────────────────────


class _BaseNode(BaseModel):
    # Igual que el DKG: el grafo es flexible (extra="allow") pero las propiedades
    # nombradas se validan. use_enum_values serializa enums a su `.value` (string)
    # para que FalkorDB los almacene como escalares.
    model_config = ConfigDict(extra="allow", use_enum_values=True)


class SegmentoTraduccionProps(_BaseNode):
    texto_origen: str
    texto_destino: str | None = None
    idioma_origen: str  # BCP-47
    idioma_destino: str  # BCP-47
    tipo_segmento: TipoSegmento  # enum CERRADO de 23 valores (§1.1)
    contexto: str | None = None
    dominio: str | None = None
    cliente_id: str | None = None
    aprobado_por: str | None = None
    score_calidad: float | None = None
    uso_contador: int = 0
    version_glosario: str | None = None
    tenant_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class GlosarioProps(_BaseNode):
    tipo_glosario: TipoGlosario  # cliente / agencia / proyecto
    par_linguistico: str  # "en-US↔es-MX" (BCP-47 ↔ BCP-47)
    version: str | None = None
    # Propiedad TÉCNICA del schema (B3 §4): el motor que la LEE para reemplazar
    # términos en runtime es B5. Aquí solo se modela el bool.
    lock_terminologico: bool = False
    tenant_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class TerminoGlosarioProps(_BaseNode):
    texto_origen: str
    texto_destino: str | None = None
    definicion: str | None = None
    dominio: str | None = None
    prioridad: int | None = None
    tenant_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class RegistroRevisionProps(_BaseNode):
    revisor_id: str
    rol_revisor: RolRevisor
    accion: AccionRevision
    texto_anterior: str | None = None
    texto_nuevo: str | None = None
    tenant_id: str | None = None
    created_at: str | None = None


class SugerenciaTerminoProps(_BaseNode):
    texto_origen: str
    texto_destino_sugerido: str | None = None
    dominio_inferido: str | None = None
    frecuencia_aparicion: int | None = None
    estado: EstadoSugerencia = EstadoSugerencia.propuesta
    tenant_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ProyectoProps(_BaseNode):
    proyecto_id: str  # FK a la tabla proyectos en Supabase (migración 010)
    nombre: str | None = None
    par_linguistico: str | None = None
    tenant_id: str | None = None


class ReferenciaDKGProps(_BaseNode):
    # Provenance cross-grafo. Coordenadas del nodo DKG de origen.
    dkg_node_id: str
    dkg_label: str
    dkg_graph_name: str
    tenant_id: str | None = None


# Mapa label → modelo de validación.
DTM_NODE_PROPERTY_MODELS: dict[str, type[_BaseNode]] = {
    DTMNodeLabel.SEGMENTO_TRADUCCION.value: SegmentoTraduccionProps,
    DTMNodeLabel.GLOSARIO.value: GlosarioProps,
    DTMNodeLabel.TERMINO_GLOSARIO.value: TerminoGlosarioProps,
    DTMNodeLabel.REGISTRO_REVISION.value: RegistroRevisionProps,
    DTMNodeLabel.SUGERENCIA_TERMINO.value: SugerenciaTerminoProps,
    DTMNodeLabel.PROYECTO.value: ProyectoProps,
    DTMNodeLabel.REFERENCIA_DKG.value: ReferenciaDKGProps,
}

# Propiedades sobre las que el provisioning crea índice por etiqueta (B3 §7).
# `id` es la clave estable de todo nodo; el resto acelera las consultas que
# B5/B6 harán (por tipo, por par, por cliente).
DTM_INDEXED_PROPERTIES: dict[str, tuple[str, ...]] = {
    DTMNodeLabel.SEGMENTO_TRADUCCION.value: ("id", "tipo_segmento", "cliente_id"),
    DTMNodeLabel.GLOSARIO.value: ("id", "tipo_glosario"),
    DTMNodeLabel.TERMINO_GLOSARIO.value: ("id",),
    DTMNodeLabel.REGISTRO_REVISION.value: ("id",),
    DTMNodeLabel.SUGERENCIA_TERMINO.value: ("id", "estado"),
    DTMNodeLabel.PROYECTO.value: ("id", "proyecto_id"),
}


# ─────────────────────────────────────────────────────────────────────────────
# Validación
# ─────────────────────────────────────────────────────────────────────────────


class DTMValidationError(ValueError):
    """Propiedad inválida para un nodo DTM (incluye tipo_segmento fuera del enum)."""


def validate_dtm_node(label: str, props: dict) -> dict:
    """
    Valida y normaliza las propiedades de un nodo DTM contra su modelo Pydantic.

    - Label desconocido → DTMValidationError (no se permiten labels arbitrarios).
    - Label con modelo estricto → valida (incl. enums cerrados) y normaliza.
    - El `tipo_segmento` fuera de los 23 valores falla *loud* aquí (§1.1).
    """
    valid_labels = {m.value for m in DTMNodeLabel}
    if label not in valid_labels:
        raise DTMValidationError(
            f"Etiqueta de nodo DTM desconocida: '{label}'. "
            f"Debe estar en la ontología DTM (ver DTMNodeLabel)."
        )
    model = DTM_NODE_PROPERTY_MODELS.get(label)
    if model is None:
        return dict(props)
    try:
        return model(**props).model_dump(exclude_none=True)
    except Exception as exc:  # pydantic ValidationError u otros → loud, tipado.
        raise DTMValidationError(f"Propiedades inválidas para :{label} — {exc}") from exc


def dtm_ontology_summary() -> dict:
    """Introspección de la ontología DTM (para generar docs/dtm_modelo.md)."""
    return {
        "graph_name_prefix": DTM_GRAPH_PREFIX,
        "domain_node_labels": list(DOMAIN_NODE_LABELS),
        "all_node_labels": [m.value for m in DTMNodeLabel],
        "edge_types": [m.value for m in DTMEdgeType],
        "internal_edges": [list(e) for e in DTM_INTERNAL_EDGES],
        "cross_edges": [list(e) for e in DTM_CROSS_EDGES],
        "tipos_segmento": list(TIPOS_SEGMENTO),
        "enums": {
            "TipoGlosario": [e.value for e in TipoGlosario],
            "RolRevisor": [e.value for e in RolRevisor],
            "AccionRevision": [e.value for e in AccionRevision],
            "EstadoSugerencia": [e.value for e in EstadoSugerencia],
        },
        "validated_nodes": {
            label: list(model.model_fields.keys())
            for label, model in DTM_NODE_PROPERTY_MODELS.items()
        },
        "indexed_properties": {k: list(v) for k, v in DTM_INDEXED_PROPERTIES.items()},
    }
