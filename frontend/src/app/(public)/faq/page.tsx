"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { FAQ_BLOCKS, FAQ_COUNT } from "@/lib/faq-data";

/* /faq (F3 N1). 4 bloques con anclas + acordeón por pregunta (colapsado por defecto)
   + búsqueda simple + Schema.org FAQPage para SEO + CTA al pie (Freemium + demos).
   Copy canónico ES/EN de DOCYAN_FAQ_Sitio_Publico.md (no retraducido). */

// Schema.org FAQPage (SEO): emite el copy ES (canónico) para los crawlers.
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_BLOCKS.flatMap((b) =>
    b.items.map((it) => ({
      "@type": "Question",
      name: it.q.es,
      acceptedAnswer: { "@type": "Answer", text: it.a.es },
    })),
  ),
};

export default function FaqPage() {
  const t = useT();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const q = query.trim().toLowerCase();
  const blocks = useMemo(() => {
    if (!q) return FAQ_BLOCKS;
    return FAQ_BLOCKS.map((b) => ({
      ...b,
      items: b.items.filter(
        (it) => (t(it.q) + " " + t(it.a)).toLowerCase().includes(q),
      ),
    })).filter((b) => b.items.length > 0);
  }, [q, t]);

  return (
    <div className="wrap narrow" style={{ padding: "56px 20px 80px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <header className="faq-head">
        <span className="eyebrow">{t({ es: "Ayuda", en: "Help" })}</span>
        <h1>{t({ es: "Preguntas frecuentes", en: "Frequently asked questions" })}</h1>
        <p className="sec-lead">
          {t({
            es: "Lo que preguntan quienes evalúan DOCYAN — como compradores y en nombre de su equipo. ¿No está aquí? Escríbenos a hola@docyan.com.",
            en: "What people ask when evaluating DOCYAN — as buyers and on behalf of their team. Not here? Write to hola@docyan.com.",
          })}
        </p>
        <div className="faq-search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({ es: `Buscar en ${FAQ_COUNT} preguntas…`, en: `Search ${FAQ_COUNT} questions…` })}
            aria-label={t({ es: "Buscar en preguntas frecuentes", en: "Search FAQ" })}
          />
        </div>
      </header>

      {!q && (
        <nav className="faq-index" aria-label={t({ es: "Bloques", en: "Sections" })}>
          {FAQ_BLOCKS.map((b) => (
            <a key={b.id} href={`#${b.id}`}>{t(b.title)}</a>
          ))}
        </nav>
      )}

      {blocks.length === 0 && (
        <p className="sec-lead">{t({ es: "Sin resultados. Prueba otra palabra o escríbenos a hola@docyan.com.", en: "No results. Try another word or write to hola@docyan.com." })}</p>
      )}

      {blocks.map((b) => (
        <section className="faq-block" id={b.id} key={b.id}>
          <h2>{t(b.title)}</h2>
          <div className="faq-list">
            {b.items.map((it) => (
              <div className={"faq-item" + (open.has(it.id) ? " open" : "")} key={it.id}>
                <button className="faq-q" aria-expanded={open.has(it.id)} onClick={() => toggle(it.id)}>
                  <span>{t(it.q)}</span>
                  <Icon name={open.has(it.id) ? "minus" : "plus"} size={18} />
                </button>
                {open.has(it.id) && <div className="faq-a"><p>{t(it.a)}</p></div>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="faq-cta">
        <h2>{t({ es: "¿Listo para probarlo con tus documentos?", en: "Ready to try it with your documents?" })}</h2>
        <div className="faq-cta-row">
          <Link className="btn primary lg" href="/signup">
            {t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link className="btn sec lg" href="/demo">{t({ es: "Ver demos por sector", en: "See industry demos" })}</Link>
        </div>
      </div>
    </div>
  );
}
