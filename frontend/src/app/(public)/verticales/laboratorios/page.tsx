import type { Metadata } from "next";
import { VerticalTemplate, type VerticalData } from "@/components/commercial/vertical-template";

export const metadata: Metadata = {
  title: "Laboratorios ISO/IEC 17025 · DOCYAN LDE",
};

/* Reproduced closely from the commercial kit `VerticalPage` (pages.jsx §6.3.1). */
const DATA: VerticalData = {
  eyebrow: "Caso de uso · Laboratorios",
  title: "Laboratorios ISO/IEC 17025",
  lead: "Calibraciones vigentes, procedimientos por equipo y trazabilidad de auditoría — consultables en el punto de uso, no enterrados en una carpeta de red.",
  problemTitle: "La calibración venció y nadie lo vio a tiempo.",
  problemLead:
    "El conocimiento del equipo vive en PDFs dispersos, hojas de cálculo y la cabeza del metrólogo. El auditor llega y empieza la búsqueda.",
  problems: [
    ["files", "Documentación fragmentada por instrumento"],
    ["alarm-clock", "Vigencias de calibración sin alertas"],
    ["clipboard-list", "Trazabilidad manual ante auditoría 17025"],
  ],
  flowTitle: "Un día en el laboratorio.",
  flow: [
    ["scan-line", "El colaborador escanea el QR de la centrífuga", "Llega al CoDo del equipo sin login. Cero fricción en el piso."],
    ["search", "Pregunta en lenguaje natural", "“¿Cada cuándo se calibra y cuál es el último certificado?”"],
    ["link", "Recibe respuesta con cita", "Valor + vigencia + pedigree clickeable al certificado fuente."],
  ],
  shotTag: "CAPTURA DE PRODUCTO · CONSULTA EN PISO",
  frameworksTitle: "Cumplimiento que el vertical exige.",
  frameworks: ["ISO/IEC 17025", "ISO 9001", "NMX-EC-17025", "ema (acreditación)", "ILAC-MRA"],
};

export default function LaboratoriosPage() {
  return <VerticalTemplate data={DATA} />;
}
