"use client";

import { FaqAccordion, type FaqItem } from "@/components/commercial/faq-accordion";
import { useT } from "@/lib/site-i18n";

/* /faq (F3 N1). Estructura + componente listos; el copy (FAQ_ITEMS) llega en un
   commit siguiente — lo redacta Jorge/Claude. No se inventan respuestas. */
const FAQ_ITEMS: FaqItem[] = [];

export default function FaqPage() {
  const t = useT();
  return (
    <div className="wrap narrow" style={{ padding: "56px 20px 96px" }}>
      <span className="eyebrow">{t({ es: "Ayuda", en: "Help" })}</span>
      <h1 style={{ fontSize: "clamp(28px,4vw,38px)", fontWeight: 700, letterSpacing: "-.02em", margin: "14px 0 24px" }}>
        {t({ es: "Preguntas frecuentes", en: "Frequently asked questions" })}
      </h1>
      <FaqAccordion items={FAQ_ITEMS} />
    </div>
  );
}
