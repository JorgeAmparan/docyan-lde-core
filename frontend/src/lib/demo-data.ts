/**
 * DOCYAN sitio público v2 — CoDos demo (F3). RECONCILIADO con los tenants demo
 * REALES sembrados en producción (SDS públicos NJ DOH, tipo=msds). Cada CoDo se
 * enmarca por su documento real; las preguntas sugeridas son las VERIFICADAS que
 * devuelven respuesta citada vía POST /demo/query (ver runbook_siembra_demo.md).
 * NADA enlatado: el clic consulta el grafo real y cita el span original. Etiquetas
 * bilingües (siguen el idioma del sitio); la respuesta llega en el idioma del sitio
 * con la cita al fragmento original del documento (los SDS demo están en inglés).
 */
import type { Bilingual } from "@/lib/site-i18n";

/** Tipo documental de un doc del CoDo (para el badge del chip expandible). */
export type DocTipo = "msds" | "manual_tecnico" | "calibracion";

export interface DemoDoc {
  name: string;   // nombre del documento (idioma original)
  tipo: DocTipo;  // tipo documental (define schema de extracción + badge)
}

export interface DemoVertical {
  key: string;            // clave del CoDo y del tenant demo (/demo/query codo=...)
  label: Bilingual;       // sector
  icon: string;
  codo: string;           // id del CoDo (display)
  entity: Bilingual;      // de qué trata el CoDo (su documento real)
  blurb: Bilingual;
  docs: DemoDoc[];        // documentos del CoDo (nombre + tipo); el chip los lista
  questions: Bilingual[]; // preguntas sugeridas — verificadas: cada una cita real
}

/** Etiqueta bilingüe del tipo documental para el badge del chip. */
export const DOC_TIPO_LABEL: Record<DocTipo, Bilingual> = {
  msds: { es: "Hoja de seguridad", en: "Safety data sheet" },
  manual_tecnico: { es: "Manual técnico", en: "Technical manual" },
  calibracion: { es: "Certificado de calibración", en: "Calibration certificate" },
};

export const VERTICALS: DemoVertical[] = [
  {
    key: "lab",
    label: { es: "Metrología", en: "Metrology" },
    icon: "ruler",
    codo: "CODO-LAB-04",
    entity: { es: "Calibrador Mitutoyo 500 — banco dimensional", en: "Mitutoyo 500 caliper — dimensional bench" },
    blurb: {
      es: "El expediente vivo de UN instrumento: manual de operación + su certificado de calibración. Lo que el laboratorio entrega a su cliente maquilador.",
      en: "The living file of ONE instrument: operating manual + its calibration certificate. What the lab hands its maquila client.",
    },
    docs: [
      { name: "Mitutoyo Caliper 500 — Operating Manual", tipo: "manual_tecnico" },
      { name: "Mitutoyo Caliper 500 — Calibration Certificate", tipo: "calibracion" },
    ],
    // B13.3 cerrado: con DEF-1 (lee :Especificacion/:CertificadoCalibracion/
    // :FechaVencimiento) + DEF-2 (híbrido), las tres preguntas naturales del
    // expediente Mitutoyo citan verbatim LIMPIO. Verificadas contra prod (ES+EN,
    // ≥1 cita cada una) antes de publicar — regla #6. "Vence" responde 2027 (§2.4).
    questions: [
      { es: "¿Cuál es el rango de medición?", en: "What is the measuring range?" },
      { es: "¿Cuándo vence la calibración?", en: "When does the calibration expire?" },
      { es: "¿A qué patrón es trazable?", en: "What standard is it traceable to?" },
    ],
  },
  {
    key: "maq",
    label: { es: "Manufactura", en: "Manufacturing" },
    icon: "factory",
    codo: "CODO-MAQ-12",
    entity: { es: "Solvente de limpieza (isopropanol)", en: "Cleaning solvent (isopropanol)" },
    blurb: {
      es: "SDS del fluido de limpieza de línea: exposición ocupacional, inflamabilidad y EPP.",
      en: "Line-cleaning fluid SDS: occupational exposure, flammability and PPE.",
    },
    docs: [{ name: "Isopropyl Alcohol — Safety Data Sheet", tipo: "msds" }],
    questions: [
      { es: "En la línea, ¿cuál es el límite de exposición ocupacional del solvente?", en: "On the line, what is the solvent's occupational exposure limit?" },
      { es: "¿Cuál es la presión de vapor del isopropanol?", en: "What is the vapor pressure of isopropanol?" },
      { es: "¿Cuál es el punto de inflamación del solvente?", en: "What is the solvent's flash point?" },
    ],
  },
  {
    key: "pharma",
    label: { es: "Farma", en: "Pharma" },
    icon: "pill",
    codo: "CODO-PHARMA-03",
    entity: { es: "Línea CIP — SDS del cáustico (NaOH) + SOP de limpieza", en: "CIP line — caustic (NaOH) SDS + cleaning SOP" },
    blurb: {
      es: "Expediente CIP: el SDS del cáustico (concentraciones, controles) y el SOP de limpieza (pasos del procedimiento).",
      en: "CIP file: the caustic SDS (concentrations, controls) and the cleaning SOP (procedure steps).",
    },
    docs: [
      { name: "Sodium Hydroxide — Safety Data Sheet", tipo: "msds" },
      { name: "Clean-in-Place (CIP) — Cleaning SOP", tipo: "manual_tecnico" },
    ],
    questions: [
      { es: "¿Cuál es la concentración IDLH del cáustico?", en: "What is the IDLH concentration of sodium hydroxide?" },
      { es: "¿Cuál es el límite OSHA del hidróxido de sodio?", en: "What is the OSHA PEL for sodium hydroxide?" },
      { es: "¿Cuál es el procedimiento CIP?", en: "What is the CIP procedure?" },
    ],
  },
  {
    key: "min",
    label: { es: "Minería", en: "Mining" },
    icon: "mountain",
    codo: "CODO-MIN-08",
    entity: { es: "Ácido de procesamiento (ácido clorhídrico)", en: "Processing acid (hydrochloric acid)" },
    blurb: {
      es: "SDS del ácido de proceso: límites de exposición, EPP requerido y presión de vapor.",
      en: "Process-acid SDS: exposure limits, required PPE and vapor pressure.",
    },
    docs: [{ name: "Hydrochloric Acid — Safety Data Sheet", tipo: "msds" }],
    questions: [
      { es: "En el proceso, ¿cuál es el límite de exposición por inhalación del ácido?", en: "In the process, what is the acid's inhalation exposure limit?" },
      { es: "¿Cuál es la presión de vapor del ácido?", en: "What is the vapor pressure of the acid?" },
      { es: "¿Qué protección personal requiere con el ácido?", en: "What personal protection is required with the acid?" },
    ],
  },
  {
    key: "agri",
    label: { es: "Agroindustria", en: "Agribusiness" },
    icon: "sprout",
    codo: "CODO-AGRI-02",
    entity: { es: "Sanitizante (hipoclorito de sodio)", en: "Sanitizer (sodium hypochlorite)" },
    blurb: {
      es: "SDS del sanitizante de equipo: límites de exposición y umbrales de protección respiratoria.",
      en: "Equipment-sanitizer SDS: exposure limits and respiratory-protection thresholds.",
    },
    docs: [{ name: "Sodium Hypochlorite — Safety Data Sheet", tipo: "msds" }],
    questions: [
      { es: "Al sanitizar el equipo, ¿cuál es el límite de exposición del operador?", en: "When sanitizing equipment, what is the operator's exposure limit?" },
      { es: "¿A qué nivel se requiere aire suministrado al sanitizar?", en: "At what level is supplied air required when sanitizing?" },
      { es: "¿Cuál es el techo NIOSH del sanitizante?", en: "What is the NIOSH ceiling for the sanitizer?" },
    ],
  },
];
