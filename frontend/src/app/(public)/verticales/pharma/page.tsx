import type { Metadata } from "next";
import { VerticalTemplate, type VerticalData } from "@/components/commercial/vertical-template";

export const metadata: Metadata = {
  title: "Farmacéutica · DOCYAN LDE",
};

/* DESIGN: built on the kit VerticalPage template; copy/frameworks derived from
   the landing's vertical card (FDA · TGA · COFEPRIS) plus GMP. */
const DATA: VerticalData = {
  eyebrow: "Caso de uso · Farmacéutica",
  title: "Farmacéutica — documentación auditada GMP",
  lead: "POEs, especificaciones y registros maestros consultables en el punto de uso, con cadena criptográfica que vuelve cada consulta verificable ante el auditor.",
  problemTitle: "El registro existe, pero probar su integridad es el trabajo.",
  problemLead:
    "La industria regulada no solo necesita el dato correcto: necesita demostrar que no se alteró. La trazabilidad manual no resiste una inspección.",
  problems: [
    ["files", "POEs y especificaciones dispersos por área"],
    ["shield-alert", "Integridad de datos difícil de demostrar"],
    ["clipboard-list", "Trazabilidad GMP/FDA armada a mano"],
  ],
  flowTitle: "Una consulta en planta.",
  flow: [
    ["scan-line", "El técnico escanea el QR del equipo", "Llega al CoDo del proceso sin login. Cero fricción en el área limpia."],
    ["search", "Pregunta en lenguaje natural", "“¿Cuál es la especificación vigente y su POE asociado?”"],
    ["shield-check", "Recibe respuesta con cita verificable", "Valor + vigencia + pedigree con cadena SHA-256 al documento maestro."],
  ],
  shotTag: "CAPTURA DE PRODUCTO · CONSULTA AUDITADA",
  frameworksTitle: "Cumplimiento que el vertical exige.",
  frameworks: ["FDA 21 CFR Part 11", "TGA", "COFEPRIS", "GMP", "ICH Q7"],
};

export default function PharmaPage() {
  return <VerticalTemplate data={DATA} />;
}
