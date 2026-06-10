"use client";

/**
 * Acordeón de Preguntas Frecuentes (F3 N1). Estructura y componente listos; el copy
 * (los `items`) llega en un commit siguiente. Sin `items`, muestra un placeholder
 * honesto en vez de inventar respuestas.
 */
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useT, type Bilingual } from "@/lib/site-i18n";

export interface FaqItem {
  q: Bilingual;
  a: Bilingual;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);
  if (items.length === 0) {
    return (
      <p className="sec-lead" style={{ maxWidth: 640 }}>
        {t({
          es: "Estamos redactando las preguntas frecuentes. Mientras tanto, escríbenos a hola@docyan.com y te respondemos directo.",
          en: "We're drafting the FAQ. In the meantime, write to hola@docyan.com and we'll answer directly.",
        })}
      </p>
    );
  }
  return (
    <div className="faq-list">
      {items.map((it, i) => (
        <div className={"faq-item" + (open === i ? " open" : "")} key={i}>
          <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{t(it.q)}</span>
            <Icon name={open === i ? "minus" : "plus"} size={18} />
          </button>
          {open === i && <div className="faq-a"><p>{t(it.a)}</p></div>}
        </div>
      ))}
    </div>
  );
}
