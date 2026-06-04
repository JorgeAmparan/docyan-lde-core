import type { Metadata } from "next";
import { VerticalTemplate, type VerticalData } from "@/components/commercial/vertical-template";

export const metadata: Metadata = {
  title: "Agroexportación · DOCYAN LDE",
};

/* DESIGN: built on the kit VerticalPage template; copy/frameworks derived from
   the landing's vertical card (EU Organic — documentación viva por mercado). */
const DATA: VerticalData = {
  eyebrow: "Caso de uso · Agroexportación",
  title: "Agroexportación — documentación por mercado destino",
  lead: "Certificaciones, fichas de producto y requisitos por mercado consultables en campo y empaque — vivos y al día para cada destino de exportación.",
  problemTitle: "Cada mercado pide algo distinto, y el requisito cambia.",
  problemLead:
    "Un mismo producto exporta a destinos con reglas distintas. Mantener la documentación correcta por mercado, vigente y a la mano, se vuelve inmanejable en carpetas.",
  problems: [
    ["files", "Requisitos por mercado dispersos y duplicados"],
    ["alarm-clock", "Certificaciones sin alertas de vigencia"],
    ["languages", "Documentación destino en varios idiomas"],
  ],
  flowTitle: "Un día en empaque.",
  flow: [
    ["scan-line", "El supervisor escanea el QR del lote", "Llega al CoDo del producto y su destino sin login. Cero fricción en empaque."],
    ["search", "Pregunta en lenguaje natural", "“¿Qué certificación exige este lote para el mercado de la UE?”"],
    ["link", "Recibe respuesta con cita", "Requisito + vigencia + pedigree clickeable al certificado fuente."],
  ],
  shotTag: "CAPTURA DE PRODUCTO · CONSULTA EN CAMPO",
  frameworksTitle: "Cumplimiento que el vertical exige.",
  frameworks: ["EU Organic", "USDA Organic", "GlobalG.A.P.", "SENASICA", "Primus GFS"],
};

export default function AgribusinessPage() {
  return <VerticalTemplate data={DATA} />;
}
