"use client";

/* DOCYAN sitio público v2 — LEGAL (placeholder honesto).
   Aviso de privacidad y términos en preparación. Marcador honesto antes que
   texto legal inventado. Port fiel del `LegalPage` de `commercial-v2/shared.jsx`. */

import { useT } from "@/lib/site-i18n";

export default function LegalPage() {
  const t = useT();
  return (
    <div className="wrap narrow" style={{ padding: "64px 20px 96px" }}>
      <span className="eyebrow">{t({ es: "Privacidad · Términos", en: "Privacy · Terms" })}</span>
      <h1 className="page-hero" style={{ padding: 0, fontSize: "clamp(28px,4vw,38px)", fontWeight: 700, letterSpacing: "-.02em", margin: "14px 0 0" }}>
        {t({ es: "Documentos legales en preparación", en: "Legal documents in preparation" })}
      </h1>
      <p className="sec-lead">
        {t({
          es: "El aviso de privacidad y los términos de servicio se publicarán aquí antes del inicio de los pilotos, una vez definida la postura de propiedad intelectual. Preferimos un marcador honesto a un texto legal inventado.",
          en: "The privacy notice and terms of service will be published here before pilots begin, once the intellectual-property position is settled. We prefer an honest placeholder to invented legal text.",
        })}
      </p>
      <p className="sec-lead" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {t({ es: "Contacto: ", en: "Contact: " })}hola@docyan.com
      </p>
    </div>
  );
}
