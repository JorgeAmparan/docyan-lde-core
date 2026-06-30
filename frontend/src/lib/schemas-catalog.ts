/**
 * Catálogo normativo de SCHEMAS DOCUMENTALES — los 14 tipos cerrados.
 *
 * Espejo VERBATIM de `SCHEMAS` / `FASES` / `ESTADO_META` del design system
 * (docs/DOCYAN LDE — Design System/app/schemas.jsx · org-views.jsx · SchemasView).
 * Es DATO DE PRODUCTO canónico, no usuario simulado: el catálogo del mercado meta
 * está definido por el Catálogo Normativo de Schemas v2. Se renderiza tal cual.
 *
 * DOS EJES ORTOGONALES (no confundir):
 *   A) TIPO DOCUMENTAL (este archivo) — qué ontología se extrae según la norma que
 *      rige el documento. 14 tipos cerrados, organizados por fase del ciclo de vida.
 *   B) RENDER POR INTENCIÓN (answer-kind) — cómo se pinta una respuesta. Un tipo
 *      asigna 1..n renders (campo `render`); relación muchos-a-muchos.
 *
 * El cotizador usa `doc-types.ts` (ids que viajan al backend como `tipo_forzado`);
 * este módulo es la vista de CATÁLOGO de schemas, con la ontología completa.
 */
import type { DocTypeEstado, DocTypeSev } from "@/lib/doc-types";

/** Severidad por estado del schema — espejo de ESTADO_META del design system. */
export const SCHEMA_ESTADO_META: Record<
  DocTypeEstado,
  { label: string; sev: DocTypeSev; desc: string }
> = {
  activo: { label: "Activo", sev: "ok", desc: "Schema liberado y funcionando." },
  parcial: { label: "Parcial", sev: "caution", desc: "Existe; pendiente de refinar / subdividir." },
  falta: {
    label: "Por construir",
    sev: "warn",
    desc: "Sin schema aún → extracción genérica + aviso honesto.",
  },
};

/** Render-kind del eje B (answer-types). Etiqueta legible para el pie de tarjeta. */
export type RenderKind =
  | "info"
  | "steps"
  | "alerts"
  | "history"
  | "troubleshoot"
  | "bilingual"
  | "diagram"
  | "video"
  | "compare";

export const RENDER_LABEL: Record<RenderKind, string> = {
  info: "info_card",
  steps: "procedure_card",
  alerts: "alerts",
  history: "timeline",
  troubleshoot: "árbol del manual",
  bilingual: "vista bilingüe",
  diagram: "diagrama",
  video: "video",
  compare: "comparativa",
};

/** Fase del ciclo de vida del activo — eje organizador del catálogo. */
export interface Fase {
  key: string;
  label: string;
  q: string;
  icon: string;
}

export const FASES: Fase[] = [
  { key: "identidad", label: "Identidad / especificación", q: "¿qué es, qué características tiene?", icon: "file-text" },
  { key: "instalacion", label: "Instalación", q: "¿cómo se instala / configura?", icon: "wrench" },
  { key: "operacion", label: "Operación", q: "¿cómo se usa / opera?", icon: "play" },
  { key: "manten", label: "Mantenimiento", q: "¿cómo se mantiene / repara, cada cuánto?", icon: "settings" },
  { key: "calibracion", label: "Calibración / verificación", q: "¿está calibrado, hasta cuándo, con qué trazabilidad?", icon: "ruler" },
  { key: "calidad", label: "Calidad / inspección", q: "¿qué se controla, con qué criterio?", icon: "shield-check" },
  { key: "seguridad", label: "Seguridad", q: "¿qué peligros, qué protección?", icon: "shield-alert" },
  { key: "normativo", label: "Normativo", q: "¿qué exige la ley / norma?", icon: "scale" },
  { key: "historico", label: "Histórico / registro", q: "¿qué ha pasado en el tiempo?", icon: "history" },
  { key: "linguistico", label: "Activo lingüístico", q: "¿equivalente de término, segmento previo?", icon: "languages" },
];

/** Un tipo documental cerrado con su ontología de extracción. */
export interface SchemaDoc {
  id: string;
  fase: string;
  label: string;
  estado: DocTypeEstado;
  prioridad: number;
  audiencia: string;
  norma: string;
  nota?: string;
  ontologia: string[];
  render: RenderKind[];
  consultas: string[];
}

/**
 * Los 14 tipos documentales cerrados (Catálogo Normativo de Schemas v2).
 *   estado: activo  → schema liberado y funcionando en el repo.
 *           parcial → existe pero pendiente de refinar / subdividir.
 *           falta   → schema por construir (entra como extracción genérica + aviso).
 */
export const SCHEMAS: SchemaDoc[] = [
  {
    id: "ficha_tecnica",
    fase: "identidad",
    label: "Ficha técnica",
    estado: "activo",
    prioridad: 5,
    audiencia: "Usuario / técnico",
    norma: "Hoja del fabricante · ASTM/ISO de materiales según producto.",
    ontologia: [
      "Especificacion (parámetro→valor→unidad→tolerancia)",
      "Condiciones de prueba",
      "NormaReferencia",
    ],
    render: ["info"],
    consultas: ["¿valor de X?", "¿tolerancia?", "¿bajo qué norma?"],
  },
  {
    id: "especificacion",
    fase: "identidad",
    label: "Especificación de ingeniería",
    estado: "activo",
    prioridad: 5,
    audiencia: "Ingeniería / calidad",
    norma: "Especificación de ingeniería · ISO/ASTM del dominio.",
    ontologia: [
      "Especificacion (requisito)",
      "Característica (crítica/significativa)",
      "Método de verificación",
      "Norma aplicable",
    ],
    render: ["info"],
    consultas: ["¿requisito de X?", "¿cómo se verifica?", "¿es característica crítica?"],
  },
  {
    id: "instructivo",
    fase: "instalacion",
    label: "Instructivo de producto",
    estado: "falta",
    prioridad: 4,
    audiencia: "Usuario final",
    norma: "IEC/IEEE 82079-1 · NOM-018-STPS · NOM-024-SCFI (instructivos y garantías, MX).",
    ontologia: [
      "Procedimiento→Paso (uso/instalación)",
      "Advertencia",
      "Requisito previo",
      "Símbolos de seguridad",
    ],
    render: ["steps"],
    consultas: ["¿cómo se configura / instala?", "¿qué advertencia aplica?", "¿qué requiere antes de usar?"],
  },
  {
    id: "manual_instalacion",
    fase: "instalacion",
    label: "Manual de instalación",
    estado: "falta",
    prioridad: 4,
    audiencia: "Equipo de instalación",
    norma: "Fabricante + NOM de instalación del dominio (NOM-001-SEDE eléctrica, gas, etc.).",
    ontologia: [
      "Especificacion (tolerancias, anclajes)",
      "Procedimiento→Paso",
      "Requisitos de sitio/servicios",
      "Advertencia",
      "Herramienta",
    ],
    render: ["info", "steps"],
    consultas: ["¿qué requisitos de sitio?", "¿cómo se ancla / conecta?", "¿qué tolerancia de instalación?"],
  },
  {
    id: "manual_operacion",
    fase: "operacion",
    label: "Manual de operación",
    estado: "parcial",
    prioridad: 1,
    audiencia: "Operador / técnico",
    norma: "Fabricante + IEC 82079-1 · residual-risk warnings (directiva de maquinaria).",
    nota: "Subdivisión de manual_tecnico (hoy un solo tipo en el repo). Prioridad 1.",
    ontologia: [
      "Especificacion (rangos, capacidades)",
      "Procedimiento→Paso (operación)",
      "Advertencia / riesgo residual",
      "Controles / indicadores",
    ],
    render: ["info", "steps"],
    consultas: ["¿rango / capacidad?", "¿cómo se opera X?", "¿qué significa el indicador Y?"],
  },
  {
    id: "manual_mantenimiento",
    fase: "manten",
    label: "Manual de mantenimiento",
    estado: "parcial",
    prioridad: 1,
    audiencia: "Técnico de mantenimiento",
    norma: "Fabricante + O&M (MIMOSA/ISO 14224) · satisface OSHA/ISO de registros.",
    nota: "Subdivisión de manual_tecnico. Prioridad 1. Troubleshooting = SOLO como lo dice el manual, jamás diagnóstico del caso (línea absoluta).",
    ontologia: [
      "FechaVencimiento / intervalo (→alertas)",
      "Procedimiento→Paso (preventivo/correctivo)",
      "Componente (lubricación/insumos)",
      "Troubleshooting síntoma→causa→acción (del manual)",
      "Herramienta",
      "Refacción",
    ],
    render: ["steps", "alerts", "info", "troubleshoot"],
    consultas: [
      "¿cada cuánto mantenimiento?",
      "¿cómo se repara X?",
      "¿qué dice el manual del síntoma Y?",
      "¿qué refacción usa?",
    ],
  },
  {
    id: "instruccion_trabajo",
    fase: "operacion",
    label: "Instrucción de trabajo",
    estado: "falta",
    prioridad: 4,
    audiencia: "Operador en piso, punto de uso",
    norma: "SGC del cliente — ISO 9001 §7.5 + IATF 16949 + NOM-018 seguridad.",
    ontologia: [
      "Procedimiento→Paso (tarea)",
      "Responsable / rol por paso",
      "EquipoProteccion por paso",
      "Especificacion (criterio de aceptación)",
      "Registros requeridos",
      "Documento padre / versión",
    ],
    render: ["steps"],
    consultas: ["¿cómo se hace esta tarea?", "¿quién es responsable?", "¿qué EPP exige?", "¿criterio de aceptación?"],
  },
  {
    id: "certificado_calibracion",
    fase: "calibracion",
    label: "Certificado de calibración",
    estado: "activo",
    prioridad: 1,
    audiencia: "Metrología / calidad",
    norma: "ISO/IEC 17025:2017 §7.8 · trazabilidad CENAM / acreditación EMA (MX).",
    ontologia: [
      "Instrumento (marca/modelo/serie)",
      "MedicionRegistrada (nominal/medido/desviación)",
      "Especificacion (incertidumbre + factor k)",
      "TrazabilidadPatron (NIST/CENAM)",
      "FechaVencimiento / CertificadoVigencia",
      "Responsable (firmante)",
    ],
    render: ["info", "alerts"],
    consultas: ["¿cuándo vence?", "¿trazable a qué patrón?", "¿incertidumbre?", "¿desviación en X punto?"],
  },
  {
    id: "plan_control",
    fase: "calidad",
    label: "Plan de control",
    estado: "falta",
    prioridad: 3,
    audiencia: "Calidad / manufactura",
    norma: "IATF 16949 + manual AIAG (Control Plan) · APQP.",
    nota: "Cruce con calibración: instrumento referenciado ↔ certificado vigente (oro para el lab embajador).",
    ontologia: [
      "Operación / proceso",
      "Característica con clasificación",
      "Especificacion (+tolerancia)",
      "Instrumento (cruce con calibración)",
      "Frecuencia de inspección",
      "Plan de reacción (Procedimiento)",
    ],
    render: ["info", "alerts"],
    consultas: ["¿qué se mide en operación X?", "¿con qué instrumento / frecuencia?", "¿tolerancia?", "¿plan de reacción?"],
  },
  {
    id: "protocolo_inspeccion",
    fase: "calidad",
    label: "Protocolo de inspección",
    estado: "falta",
    prioridad: 5,
    audiencia: "Inspección / calidad",
    norma: "ISO 17020 (organismos de inspección) / protocolos del SGC · checklists.",
    ontologia: [
      "PuntoInspeccion",
      "Especificacion (criterio aceptación/rechazo)",
      "Método / instrumento",
      "Frecuencia",
      "Registro de resultado",
    ],
    render: ["info", "steps"],
    consultas: ["¿qué se inspecciona?", "¿criterio de aceptación?", "¿con qué método?"],
  },
  {
    id: "hoja_seguridad",
    fase: "seguridad",
    label: "Hoja de seguridad (SDS/MSDS)",
    estado: "activo",
    prioridad: 1,
    audiencia: "Operador / EHS",
    norma: "GHS 16 secciones / NOM-018-STPS-2015. Cubre GHS y pre-GHS (hojas viejas ES).",
    nota: 'Datos negativos explícitos se extraen como datos ("punto de inflamación: NINGUNO") — freno de alucinación. Filtra nombres genéricos ("El Material").',
    ontologia: [
      "Sustancia (comercial/químico/NumeroCAS)",
      "Componente (% composición)",
      "Riesgo (categorías GHS)",
      "Procedimiento (primeros auxilios)",
      "Especificacion (PEL/TLV/IDLH)",
      "EquipoProteccion",
      "Propiedades físicas",
      "MedidaProteccion",
    ],
    render: ["info", "steps"],
    consultas: ["¿cómo se llama el químico?", "¿PEL?", "¿punto de inflamación?", "¿EPP?", "¿qué hago si derrame?"],
  },
  {
    id: "norma_ley_reglamento",
    fase: "normativo",
    label: "Norma / ley / reglamento",
    estado: "falta",
    prioridad: 2,
    audiencia: "Cumplimiento / legal",
    norma: "Estructura jurídico-normativa: títulos→capítulos→artículos→fracciones→incisos→transitorios (MX); 29 CFR (OSHA); cláusulas (ISO/NOM).",
    nota: "Habilita el Acervo Normativo precargado (tenant común de solo lectura). Render lleva descargo obligatorio: texto de la norma, no asesoría legal.",
    ontologia: [
      "Articulo / Clausula (número, texto, jerarquía)",
      "Obligacion (con sujeto)",
      "TerminoTecnico (definiciones)",
      "REFERENCIA_NORMATIVA (cruzadas)",
      "Vigencia / reformas (fecha DOF)",
      "Ámbito",
    ],
    render: ["info"],
    consultas: ["¿qué dice el artículo X?", "¿qué obliga a [sujeto]?", "¿cómo define [término]?", "¿vigente?"],
  },
  {
    id: "registro_historico",
    fase: "historico",
    label: "Registro histórico / bitácora",
    estado: "falta",
    prioridad: 6,
    audiencia: "Operación / calidad",
    norma: "ISO 17025 (registros) / retención del SGC · bitácoras O&M.",
    nota: 'Tendencia SOLO como datos presentados (frecuencia-sí / causa-no): muestra la serie citada, jamás "se está degradando".',
    ontologia: ["EventoOperativo (serie fechada)", "Activo asociado", "Resultado por evento"],
    render: ["history"],
    consultas: ["¿última / próxima calibración?", "¿historial del activo X?"],
  },
  {
    id: "memoria_traduccion",
    fase: "linguistico",
    label: "Memoria de traducción",
    estado: "falta",
    prioridad: 6,
    audiencia: "Agencias / lingüístico (Pista B)",
    norma: "Formatos CAT: TMX / XLIFF / TBX / SDLXLIFF / Bilingual DOCX.",
    nota: "Conecta con el sprint de lock terminológico (L2+L3). PTM segregada estricta por par lingüístico.",
    ontologia: [
      "Segmento origen↔destino (por par lingüístico)",
      "Término↔equivalente (lock terminológico)",
      "Metadatos de proyecto",
    ],
    render: ["bilingual"],
    consultas: ["¿equivalente de término X?", "¿segmento previo de Y?"],
  },
];
