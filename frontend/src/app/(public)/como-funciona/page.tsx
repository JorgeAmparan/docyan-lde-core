import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "Cómo funciona · DOCYAN LDE",
};

/* Recreated from the commercial kit `HowPage` (pages.jsx §6.3.2). Audience:
   CIOs, jefes de TI y arquitectos. Architecture flow without black box. */

const ARCH: [icon: string, heading: string, body: string][] = [
  ["upload-cloud", "Ingesta", "Documentos como están — PDF, DOCX, imágenes con OCR."],
  ["git-fork", "Grafo de conocimiento", "Entidades, spans y relaciones — no solo chunks de texto."],
  ["scan-search", "Consulta clasificada", "8 tipos de intención → render específico por tipo."],
  ["link", "Respuesta con pedigree", "Cada salida cita el span exacto de la fuente."],
];

const TECH: [icon: string, label: string][] = [
  ["zap", "Caché semántico con umbral de confianza configurable"],
  ["scan-search", "Clasificación de intención antes de responder"],
  ["shield-check", "Cadena criptográfica SHA-256 para auditoría"],
  ["languages", "Multi-idioma nativo a nivel de consulta"],
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Cómo funciona</span>
          <h1 className="page-h1">De documento muerto a respuesta citada.</h1>
          <p className="sec-lead">
            Para CIOs, jefes de TI y arquitectos. El recorrido de un documento
            desde que entra hasta que responde — sin caja negra.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="arch">
            {ARCH.map(([ic, h, p], i) => (
              <div className="arch-step" key={h} style={{ display: "contents" }}>
                <div className="arch-node">
                  <div className="an-ic">
                    <Icon name={ic} size={22} />
                  </div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
                {i < ARCH.length - 1 && (
                  <div className="arch-arrow">
                    <Icon name="arrow-right" size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band paper">
        <div className="wrap two-col">
          <div>
            <span className="eyebrow">Posicionamiento técnico</span>
            <h2 className="sec-title">Por qué un grafo, no solo RAG.</h2>
            <p className="sec-lead">
              Un grafo de conocimiento preserva la estructura del documento —
              secciones, entidades y sus relaciones — así la cita apunta al span
              exacto, no a un fragmento aproximado.
            </p>
          </div>
          <div className="tech-list">
            {TECH.map(([ic, t]) => (
              <div className="pl-item" key={t}>
                <Icon name={ic} size={18} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band ink">
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 className="sec-title" style={{ maxWidth: "20ch", margin: "0 auto" }}>
            ¿Lo evaluamos con tus documentos?
          </h2>
          <div className="cta" style={{ justifyContent: "center", marginTop: 24 }}>
            <Link href="/signup" className="btn primary lg">
              <Icon name="calendar" size={17} />
              Agendar demo técnica
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
