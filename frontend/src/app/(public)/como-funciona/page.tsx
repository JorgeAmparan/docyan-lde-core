"use client";

/* DOCYAN sitio público v2 — CÓMO FUNCIONA.
   Sin caja negra, para CIOs/TI: pipeline, grafo-vs-RAG, intención,
   línea multilingüe completa, SHA-256, CTA del embudo nuevo.
   Port fiel de `commercial-v2/como.jsx`. */

import { Fragment } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";

export default function ComoPage() {
  const t = useT();
  return (
    <main data-screen-label="Cómo funciona">
      <header className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "Cómo funciona · para tu equipo de TI", en: "How it works · for your IT team" })}</span>
          <h1>{t({ es: "Sin caja negra: así llega una respuesta a su cita", en: "No black box: how an answer reaches its citation" })}</h1>
          <p className="sec-lead">{t({
            es: "DOCYAN no «busca parecidos» en tus PDFs. Analiza cada documento en una estructura viva y responde desde ella — por eso cada respuesta sabe exactamente de dónde viene.",
            en: "DOCYAN doesn't “look for similarities” in your PDFs. It analyzes every document into a living structure and answers from it — which is why every answer knows exactly where it came from.",
          })}</p>
        </div>
      </header>

      {/* pipeline */}
      <section className="band" data-screen-label="Cómo — Pipeline">
        <div className="wrap">
          <div className="arch2">
            {[
              { ic: "file-up", h: { es: "Ingesta", en: "Ingestion" }, p: { es: "El documento entra y se registra con hash SHA-256 — su identidad criptográfica desde el minuto cero.", en: "The document enters and is registered with a SHA-256 hash — its cryptographic identity from minute zero." } },
              { ic: "scan-text", h: { es: "Análisis vivo", en: "Live analysis" }, p: { es: "Estructura, tablas, unidades y relaciones se vuelven un grafo del documento, no una bolsa de fragmentos.", en: "Structure, tables, units and relationships become a graph of the document, not a bag of fragments." } },
              { ic: "git-branch", h: { es: "Clasificación de intención", en: "Intent classification" }, p: { es: "Cada pregunta se clasifica: dato puntual, procedimiento, comparación. La ruta de respuesta depende de la intención.", en: "Each question is classified: point fact, procedure, comparison. The answer path depends on the intent." } },
              { ic: "quote", h: { es: "Respuesta con pedigree", en: "Answer with pedigree" }, p: { es: "La respuesta se compone desde el grafo, con cita a span y umbral de confianza según la criticidad del dato.", en: "The answer is composed from the graph, with a span citation and a confidence threshold set by the data's criticality." } },
            ].map((n, i, arr) => (
              <Fragment key={i}>
                <div className="anode">
                  <span className="ic"><Icon name={n.ic} size={22} /></span>
                  <h3>{t(n.h)}</h3>
                  <p>{t(n.p)}</p>
                </div>
                {i < arr.length - 1 && <span className="aarr"><Icon name="arrow-right" size={18} /></span>}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* grafo vs RAG */}
      <section className="band paper" data-screen-label="Cómo — Grafo vs RAG">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "La diferencia técnica", en: "The technical difference" })}</span>
          <h2 className="sec-title">{t({ es: "Grafo de documento vivo, no RAG genérico", en: "Live document graph, not generic RAG" })}</h2>
          <div className="vs-table">
            <div className="vs-row vs-head">
              <div>{t({ es: "Dimensión", en: "Dimension" })}</div>
              <div>{t({ es: "RAG genérico", en: "Generic RAG" })}</div>
              <div className="vs-doc">DOCYAN LDE</div>
            </div>
            {[
              { d: { es: "Unidad de análisis", en: "Unit of analysis" }, r: { es: "Fragmentos sueltos por similitud", en: "Loose chunks by similarity" }, doc: { es: "El documento completo como grafo: estructura, tablas, unidades", en: "The whole document as a graph: structure, tables, units" } },
              { d: { es: "Trazabilidad", en: "Traceability" }, r: { es: "«Fuentes» aproximadas, a veces inventadas", en: "Approximate “sources,” sometimes invented" }, doc: { es: "Pedigree a span: cada dato apunta al fragmento exacto", en: "Span pedigree: every datum points to the exact fragment" } },
              { d: { es: "Cuando no sabe", en: "When it doesn't know" }, r: { es: "Responde igual, con seguridad fingida", en: "Answers anyway, with feigned confidence" }, doc: { es: "Umbral por criticidad: por debajo, lo dice y orienta dónde buscar", en: "Criticality threshold: below it, it says so and points where to look" } },
              { d: { es: "Idioma", en: "Language" }, r: { es: "Mezcla idiomas o pierde el original", en: "Mixes languages or loses the original" }, doc: { es: "Respuesta en el idioma del usuario; el span original, intacto, a un toque", en: "Answer in the user's language; the original span, intact, one tap away" } },
              { d: { es: "Integridad", en: "Integrity" }, r: { es: "Sin cadena verificable", en: "No verifiable chain" }, doc: { es: "SHA-256 de documento a respuesta, auditable", en: "SHA-256 from document to answer, auditable" } },
            ].map((r, i) => (
              <div className="vs-row" key={i}>
                <div className="vs-dim">{t(r.d)}</div>
                <div className="vs-rag">{t(r.r)}</div>
                <div className="vs-doc">{t(r.doc)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* línea multilingüe */}
      <section className="band" data-screen-label="Cómo — Línea multilingüe">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "La línea multilingüe", en: "The multilingual line" })}</span>
          <h2 className="sec-title">{t({ es: "La pregunta viaja; el original no se mueve", en: "The question travels; the original never moves" })}</h2>
          <p className="sec-lead">{t({
            es: "El documento se analiza en su idioma original y así se queda. Cuando alguien pregunta en otro idioma, DOCYAN responde en el idioma de la pregunta — y la cita lleva siempre al span original, intacto. La fuente nunca se reescribe.",
            en: "The document is analyzed in its original language and stays that way. When someone asks in another language, DOCYAN answers in the language of the question — and the citation always leads to the original span, intact. The source is never rewritten.",
          })}</p>
          <div className="steps3">
            {[
              { n: "·", ic: "file-text", h: { es: "El original es sagrado", en: "The original is sacred" }, p: { es: "El MSDS que vino en inglés vive en inglés. Su hash lo fija; nadie consulta una copia reescrita.", en: "The MSDS that came in English lives in English. Its hash pins it; nobody consults a rewritten copy." } },
              { n: "·", ic: "message-circle", h: { es: "La consulta, en tu idioma", en: "The consultation, in your language" }, p: { es: "El operador pregunta en español y lee la respuesta en español, de un vistazo, sin fricción.", en: "The operator asks in Spanish and reads the answer in Spanish, at a glance, without friction." } },
              { n: "·", ic: "quote", h: { es: "El span original, a un toque", en: "The original span, one tap away" }, p: { es: "La cita abre el fragmento exacto tal como vino. Verificable por cualquiera, en cualquier auditoría.", en: "The citation opens the exact fragment as it came. Verifiable by anyone, in any audit." } },
            ].map((s, i) => (
              <div className="step3" key={i}>
                <span className="si"><Icon name={s.ic} size={22} /></span>
                <h3>{t(s.h)}</h3>
                <p>{t(s.p)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* línea regulatoria + CTA */}
      <section className="band paper" data-screen-label="Cómo — Cierre">
        <div className="wrap">
          <div className="unsafe" style={{ marginTop: 0 }}>
            <Icon name="scale" size={20} />
            <div>
              <h3>{t({ es: "Dónde termina DOCYAN", en: "Where DOCYAN ends" })}</h3>
              <p>{t({
                es: "DOCYAN es capa de conocimiento, no sistema de registro primario. Emite alertas administrativas; la decisión clínica u operativa es siempre de tu gente y tus sistemas de registro.",
                en: "DOCYAN is a knowledge layer, not a primary system of record. It raises administrative alerts; clinical and operational decisions always belong to your people and your systems of record.",
              })}</p>
            </div>
          </div>
          <div className="cta-band" style={{ marginTop: 44 }}>
            <h2 className="sec-title">{t({ es: "Pruébalo con tus propios documentos", en: "Try it with your own documents" })}</h2>
          </div>
          <Doors compact />
          <div style={{ marginTop: 26, textAlign: "center" }}>
            <Link className="vlink" href="/seguridad"><Icon name="shield" size={14} />{t({ es: "Seguridad y gobernanza en detalle", en: "Security & governance in detail" })}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
