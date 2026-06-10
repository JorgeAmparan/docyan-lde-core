"use client";

/* DOCYAN sitio público v2 — HUB DE DEMOS SIN REGISTRO (CoDos).
   Lista los 5 Conjuntos de Documentos por vertical como tarjetas que enlazan
   al flujo de consulta en /demo/[vertical] (lab/maq/pharma/min/agri).
   NO reimplementa el reproductor del CoDo — ese vive en /demo/[vertical].
   Escalón intermedio del embudo: el CTA primario sigue siendo el freemium.
   Derivado de `commercial-v2/codos.jsx` + `codo-data.jsx`. */

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT, type Bilingual } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";

interface CodoCard {
  key: string;
  label: Bilingual;
  icon: string;
  codo: string;
  entity: string;
  blurb: Bilingual;
  docs: string[];
}

const CODOS: CodoCard[] = [
  {
    key: "lab",
    label: { es: "Laboratorios", en: "Laboratories" },
    icon: "flask-conical",
    codo: "CODO-LAB-04",
    entity: "Centrífuga Hettich Rotina 380",
    blurb: {
      es: "Centrífugas, balanzas, calibraciones vigentes y MSDS de reactivos.",
      en: "Centrifuges, balances, current calibrations and reagent MSDS.",
    },
    docs: ["Manual de calibración de centrífuga", "MSDS de reactivo común", "Certificado de trazabilidad de patrón"],
  },
  {
    key: "maq",
    label: { es: "Maquiladoras", en: "Maquiladoras" },
    icon: "factory",
    codo: "CODO-MAQ-12",
    entity: "Línea CNC Haas VF-4",
    blurb: {
      es: "Manuales por línea, cambios de herramienta y MSDS de fluidos de corte.",
      en: "Per-line manuals, tool changes and cutting-fluid MSDS.",
    },
    docs: ["Manual operativo de CNC", "Procedimiento de cambio de herramienta", "Hoja MSDS de fluido de corte"],
  },
  {
    key: "pharma",
    label: { es: "Farma", en: "Pharma" },
    icon: "pill",
    codo: "CODO-PHARMA-03",
    entity: "Bioreactor B-3",
    blurb: {
      es: "SOPs, Batch Records y validaciones de limpieza bajo GMP.",
      en: "SOPs, Batch Records and cleaning validations under GMP.",
    },
    docs: ["SOP de operación de bioreactor", "Plantilla Batch Manufacturing Record", "Validación de limpieza CIP"],
  },
  {
    key: "min",
    label: { es: "Minería", en: "Mining" },
    icon: "mountain",
    codo: "CODO-MIN-08",
    entity: "Excavadora Komatsu PC-2000",
    blurb: {
      es: "Operación segura, inspección pre-uso y MSDS de combustibles.",
      en: "Safe operation, pre-use inspection and fuel MSDS.",
    },
    docs: ["Procedimiento de operación segura de excavadora", "MSDS de combustible diésel", "Reporte de inspección pre-uso"],
  },
  {
    key: "agri",
    label: { es: "Agroindustria", en: "Agribusiness" },
    icon: "sprout",
    codo: "CODO-AGRI-02",
    entity: "Tanque enfriamiento leche T-7",
    blurb: {
      es: "Especificaciones de producto, muestreo y certificados por mercado.",
      en: "Product specs, sampling and per-market certificates.",
    },
    docs: ["Especificación de producto leche cruda", "Protocolo de muestreo", "Certificado de calidad para mercado destino"],
  },
];

export default function DemosPage() {
  const t = useT();
  return (
    <main data-screen-label="Demos sin registro">
      <header className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "Demos sin registro · CoDos", en: "No-signup demos · CoDos" })}</span>
          <h1>{t({ es: "Pruébalo ahora, con documentos reales de tu sector", en: "Try it now, with real documents from your industry" })}</h1>
          <p className="sec-lead">{t({
            es: "Cinco Conjuntos de Documentos (CoDos) ya analizados en vivo. Sin registro, sin tarjeta: elige tu sector y pregunta. Los documentos de muestra están en su idioma original.",
            en: "Five Document Sets (CoDos) already analyzed live. No signup, no card: pick your industry and ask. Sample documents are in their original language.",
          })}</p>
        </div>
      </header>

      <section className="band" style={{ paddingTop: 20 }} data-screen-label="Demos — Hub de CoDos">
        <div className="wrap">
          <div className="sec-grid2">
            {CODOS.map((c) => (
              <Link key={c.key} href={`/demo/${c.key}`} className="sec-item2 codo-link">
                <span className="ic"><Icon name={c.icon} size={20} /></span>
                <div>
                  <h3>{t(c.label)}</h3>
                  <div className="mono" style={{ fontSize: 12, color: "var(--fg-subtle)", margin: "2px 0 6px" }}>{c.codo} · {c.entity}</div>
                  <p>{t(c.blurb)}</p>
                  <div className="dc2-docs" style={{ marginTop: 10 }}>
                    {c.docs.map((d, i) => (
                      <span key={i} className="dc2-doc on" style={{ cursor: "default" }}><Icon name="file-text" size={13} />{d}</span>
                    ))}
                  </div>
                  <span className="codo-cta" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontWeight: 600 }}>
                    {t({ es: "Probar este CoDo", en: "Try this CoDo" })}<Icon name="arrow-right" size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band paper" data-screen-label="Demos — CTA">
        <div className="wrap">
          <div className="cta-band">
            <span className="eyebrow">{t({ es: "El siguiente escalón", en: "The next step" })}</span>
            <h2 className="sec-title">{t({ es: "Lo mismo, con tus propios documentos", en: "The same, with your own documents" })}</h2>
          </div>
          <Doors compact />
        </div>
      </section>
    </main>
  );
}
