import type { Metadata } from "next";
import { VerticalTemplate, type VerticalData } from "@/components/commercial/vertical-template";

export const metadata: Metadata = {
  title: "Minería · DOCYAN LDE",
};

/* DESIGN: built on the kit VerticalPage template; copy/frameworks derived from
   the landing's vertical card (AS/NZS — safety & compliance en piso de mina). */
const DATA: VerticalData = {
  eyebrow: "Caso de uso · Minería",
  title: "Minería — safety & compliance en el piso",
  lead: "Procedimientos de seguridad, fichas de equipo y permisos consultables donde el trabajo ocurre — en el frente, no en la oficina del supervisor.",
  problemTitle: "El procedimiento de seguridad está lejos del riesgo.",
  problemLead:
    "En el frente de mina, el documento correcto vive en una oficina a kilómetros. El conocimiento crítico no llega a quien opera el equipo.",
  problems: [
    ["files", "Procedimientos de seguridad dispersos"],
    ["alarm-clock", "Permisos y certificaciones sin alertas de vigencia"],
    ["clipboard-list", "Trazabilidad de cumplimiento armada a mano"],
  ],
  flowTitle: "Una jornada en el frente.",
  flow: [
    ["scan-line", "El operador escanea el QR del equipo", "Llega al CoDo de la máquina sin login. Cero fricción en el frente."],
    ["search", "Pregunta en lenguaje natural", "“¿Qué procedimiento de bloqueo aplica antes de mantenimiento?”"],
    ["link", "Recibe respuesta con cita", "Procedimiento + permisos + pedigree clickeable al documento fuente."],
  ],
  shotTag: "CAPTURA DE PRODUCTO · CONSULTA EN MINA",
  frameworksTitle: "Cumplimiento que el vertical exige.",
  frameworks: ["AS/NZS 4801", "AS/NZS ISO 45001", "ISO 14001", "ICMM"],
};

export default function MiningPage() {
  return <VerticalTemplate data={DATA} />;
}
