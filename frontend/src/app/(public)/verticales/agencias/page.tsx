import type { Metadata } from "next";
import { VerticalTemplate, type VerticalData } from "@/components/commercial/vertical-template";

export const metadata: Metadata = {
  title: "Agencias de traducción · DOCYAN LDE",
};

/* DESIGN: built on the kit VerticalPage template. This is Pista B — ingesta
   bilingüe (TMX/XLIFF/etc.) + consulta multilingüe. SIN motor de traducción:
   DOCYAN no traduce aquí, ingiere pares existentes y los vuelve consultables.
   Frameworks → formatos/estándares de intercambio que el vertical maneja. */
const DATA: VerticalData = {
  eyebrow: "Caso de uso · Agencias de traducción",
  title: "Agencias de traducción profesional",
  lead: "Ingiere tus memorias y pares bilingües (TMX, XLIFF, TBX, SDLXLIFF) y vuélvelos un grafo consultable en cualquier idioma — sin sustituir tu flujo de traducción.",
  problemTitle: "El activo lingüístico está, pero no se puede consultar.",
  problemLead:
    "Años de memorias y glosarios viven en archivos por proyecto y por par. Recuperar cómo se tradujo un término, y en qué contexto, depende de abrir herramientas CAT una por una.",
  problems: [
    ["files", "Memorias y glosarios dispersos por proyecto y par"],
    ["languages", "Consulta multilingüe imposible sin abrir cada CAT"],
    ["link", "Sin pedigree de en qué documento se usó un término"],
  ],
  flowTitle: "Un proyecto en la agencia.",
  flow: [
    ["upload-cloud", "Cargas tus pares bilingües", "TMX, XLIFF, TBX, SDLXLIFF o DOCX bilingüe — se alinean e ingieren tal cual."],
    ["search", "Consultas en cualquier idioma del par", "“¿Cómo tradujimos este término regulatorio en proyectos previos?”"],
    ["link", "Recibes respuesta con cita", "Equivalente + contexto + pedigree clickeable al segmento fuente."],
  ],
  shotTag: "CAPTURA DE PRODUCTO · CONSULTA MULTILINGÜE",
  frameworksTitle: "Formatos y estándares que el vertical maneja.",
  frameworks: ["TMX", "XLIFF", "TBX", "SDLXLIFF", "DOCX bilingüe"],
};

export default function AgenciasPage() {
  return <VerticalTemplate data={DATA} />;
}
