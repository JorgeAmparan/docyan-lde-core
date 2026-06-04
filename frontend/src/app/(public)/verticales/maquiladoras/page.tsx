import type { Metadata } from "next";
import { VerticalTemplate, type VerticalData } from "@/components/commercial/vertical-template";

export const metadata: Metadata = {
  title: "Maquiladoras IMMEX · DOCYAN LDE",
};

/* DESIGN: built on the kit VerticalPage template; copy/frameworks derived from
   the landing's vertical card (NOM-018-STPS · IATF 16949). */
const DATA: VerticalData = {
  eyebrow: "Caso de uso · Maquiladoras",
  title: "Maquiladoras IMMEX — corredor T-MEC",
  lead: "Manuales por línea, MSDS y procedimientos de seguridad — bilingües y consultables en el punto de uso, sin sacar al operador del piso.",
  problemTitle: "El procedimiento correcto vive en otro idioma y otra carpeta.",
  problemLead:
    "Cada línea tiene su manual, cada químico su MSDS, cada turno su forma de resolver. El conocimiento no llega al operador cuando lo necesita.",
  problems: [
    ["files", "Manuales y MSDS dispersos por línea y turno"],
    ["languages", "Documentación crítica solo en un idioma"],
    ["shield-alert", "Cumplimiento NOM e IATF auditado a mano"],
  ],
  flowTitle: "Un turno en la línea.",
  flow: [
    ["scan-line", "El operador escanea el QR de la estación", "Llega al CoDo de la línea sin login. Cero fricción en el piso."],
    ["search", "Pregunta en su idioma", "“¿Qué EPP requiere este proceso y dónde está el MSDS del solvente?”"],
    ["link", "Recibe respuesta con cita", "Procedimiento + EPP + pedigree clickeable al manual fuente."],
  ],
  shotTag: "CAPTURA DE PRODUCTO · CONSULTA EN LÍNEA",
  frameworksTitle: "Cumplimiento que el vertical exige.",
  frameworks: ["NOM-018-STPS", "NOM-026-STPS", "IATF 16949", "ISO 9001", "ISO 45001"],
};

export default function MaquiladorasPage() {
  return <VerticalTemplate data={DATA} />;
}
