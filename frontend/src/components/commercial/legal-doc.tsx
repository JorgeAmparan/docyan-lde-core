"use client";

/**
 * Layout de documento legal con índice lateral (F3 N2). Listo para recibir el
 * contenido real de Jorge (aviso de privacidad / términos) tras su revisión. NO
 * inventa contenido legal: sin `sections`, muestra un placeholder honesto.
 */
import { useT, type Bilingual } from "@/lib/site-i18n";

export interface LegalSection {
  id: string;
  heading: Bilingual;
  body: Bilingual[];
}

export function LegalDoc({
  eyebrow,
  title,
  updated,
  sections,
}: {
  eyebrow: Bilingual;
  title: Bilingual;
  updated?: Bilingual;
  sections: LegalSection[];
}) {
  const t = useT();
  const hasContent = sections.length > 0;
  return (
    <div className="legaldoc wrap" style={{ padding: "56px 20px 96px" }}>
      <header className="legaldoc-head">
        <span className="eyebrow">{t(eyebrow)}</span>
        <h1>{t(title)}</h1>
        {updated && <p className="legaldoc-upd mono">{t(updated)}</p>}
      </header>

      {!hasContent ? (
        <p className="sec-lead" style={{ maxWidth: 640 }}>
          {t({
            es: "Este documento se publicará aquí antes del inicio de los pilotos, una vez definida la postura de propiedad intelectual. Preferimos un marcador honesto a un texto legal inventado. Para dudas: hola@docyan.com",
            en: "This document will be published here before pilots begin, once the intellectual-property position is settled. We prefer an honest placeholder to invented legal text. Questions: hola@docyan.com",
          })}
        </p>
      ) : (
        <div className="legaldoc-grid">
          <aside className="legaldoc-index" aria-label={t({ es: "Índice", en: "Index" })}>
            <ol>
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{t(s.heading)}</a></li>
              ))}
            </ol>
          </aside>
          <article className="legaldoc-body">
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{t(s.heading)}</h2>
                {s.body.map((p, i) => <p key={i}>{t(p)}</p>)}
              </section>
            ))}
          </article>
        </div>
      )}
    </div>
  );
}
