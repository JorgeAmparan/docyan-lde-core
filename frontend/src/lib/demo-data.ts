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

export interface DemoVertical {
  key: string;            // clave del CoDo y del tenant demo (/demo/query codo=...)
  label: Bilingual;       // sector
  icon: string;
  codo: string;           // id del CoDo (display)
  entity: Bilingual;      // de qué trata el CoDo (su documento real)
  blurb: Bilingual;
  docs: string[];         // documentos del CoDo (nombre en su idioma original)
  questions: Bilingual[]; // preguntas sugeridas — verificadas: cada una cita real
}

export const VERTICALS: DemoVertical[] = [
  {
    key: "lab",
    label: { es: "Laboratorios", en: "Laboratories" },
    icon: "flask-conical",
    codo: "CODO-LAB-04",
    entity: { es: "Reactivos de laboratorio (etanol, metanol)", en: "Lab reagents (ethanol, methanol)" },
    blurb: {
      es: "Hojas de seguridad (SDS) de reactivos: límites de exposición, inflamabilidad y manejo seguro.",
      en: "Reagent safety data sheets (SDS): exposure limits, flammability and safe handling.",
    },
    docs: ["Ethanol — Safety Data Sheet", "Methanol — Safety Data Sheet"],
    questions: [
      { es: "¿Cuál es el límite de exposición?", en: "What is the exposure limit?" },
      { es: "¿Cuál es el punto de inflamación?", en: "What is the flash point?" },
      { es: "¿Cuál es la presión de vapor?", en: "What is the vapor pressure?" },
    ],
  },
  {
    key: "maq",
    label: { es: "Maquiladoras", en: "Maquiladoras" },
    icon: "factory",
    codo: "CODO-MAQ-12",
    entity: { es: "Solvente de limpieza (isopropanol)", en: "Cleaning solvent (isopropanol)" },
    blurb: {
      es: "SDS del fluido de limpieza de línea: exposición ocupacional, inflamabilidad y EPP.",
      en: "Line-cleaning fluid SDS: occupational exposure, flammability and PPE.",
    },
    docs: ["Isopropyl Alcohol — Safety Data Sheet"],
    questions: [
      { es: "¿Cuál es el límite de exposición?", en: "What is the exposure limit?" },
      { es: "¿Cuál es la presión de vapor?", en: "What is the vapor pressure?" },
      { es: "¿Cuál es el punto de inflamación?", en: "What is the flash point?" },
    ],
  },
  {
    key: "pharma",
    label: { es: "Farma", en: "Pharma" },
    icon: "pill",
    codo: "CODO-PHARMA-03",
    entity: { es: "Agente de limpieza CIP (hidróxido de sodio)", en: "CIP cleaning agent (sodium hydroxide)" },
    blurb: {
      es: "SDS del cáustico de limpieza CIP: concentraciones peligrosas y controles.",
      en: "CIP caustic cleaner SDS: hazardous concentrations and controls.",
    },
    docs: ["Sodium Hydroxide — Safety Data Sheet"],
    questions: [
      { es: "¿Cuál es la concentración IDLH?", en: "What is the IDLH concentration?" },
      { es: "¿Cuál es la concentración inmediatamente peligrosa para la salud?", en: "What concentration is immediately dangerous to health?" },
      { es: "¿Cuál es la concentración máxima?", en: "What is the maximum concentration?" },
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
    docs: ["Hydrochloric Acid — Safety Data Sheet"],
    questions: [
      { es: "¿Cuál es el límite de exposición?", en: "What is the exposure limit?" },
      { es: "¿Qué protección personal se requiere?", en: "What personal protection is required?" },
      { es: "¿Cuál es la presión de vapor?", en: "What is the vapor pressure?" },
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
    docs: ["Sodium Hypochlorite — Safety Data Sheet"],
    questions: [
      { es: "¿Cuál es el límite de exposición?", en: "What is the exposure limit?" },
      { es: "¿A qué concentración se requiere respirador?", en: "At what concentration is a respirator required?" },
      { es: "¿Cuál es la concentración para aire suministrado?", en: "What concentration requires supplied air?" },
    ],
  },
];
