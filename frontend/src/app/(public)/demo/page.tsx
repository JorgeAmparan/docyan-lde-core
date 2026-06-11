"use client";

/* DOCYAN sitio público v2 — HUB DE DEMOS SIN REGISTRO (CoDos).
   Lista los 5 Conjuntos de Documentos por vertical como tarjetas que enlazan
   al flujo de consulta en /demo/[vertical] (lab/maq/pharma/min/agri).
   NO reimplementa el reproductor del CoDo — ese vive en /demo/[vertical].
   Escalón intermedio del embudo: el CTA primario sigue siendo el freemium.
   Derivado de `commercial-v2/codos.jsx` + `codo-data.jsx`. */

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";
import { VERTICALS } from "@/lib/demo-data";

/* Fuente única de los CoDos: `VERTICALS` (demo-data.ts), reconciliado con los
   tenants demo REALES sembrados en prod. El hub solo lista y enlaza. */
const CODOS = VERTICALS;

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
                  <div className="mono" style={{ fontSize: 12, color: "var(--fg-subtle)", margin: "2px 0 6px" }}>{c.codo} · {t(c.entity)}</div>
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
