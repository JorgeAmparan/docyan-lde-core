/* DOCYAN sitio público v2 — PRECIOS v2.1.
   Fuente única: línea de producto (DOCYAN hoy · Data · Field próximamente)
   + 3 tiers por documentos vivos + ingestas incluidas + dos puertas. */

function PreciosPage({ go }) {
  const t = useT();
  const { band } = useBand();
  const linkOut = useLinkOut();
  const b = BANDS[band];

  const TIERS = [
    {
      key: "esencial", name: "Esencial", docs: { es: "hasta 50 documentos vivos", en: "up to 50 live documents" },
      price: b.tiers.esencial, from: false,
      ing: { es: "Incluye 10 documentos de arranque + 3 al mes", en: "Includes 10 starter documents + 3 per month" },
      feats: [
        { es: "Todas las capacidades del producto", en: "Every product capability" },
        { es: "Usuarios ilimitados", en: "Unlimited users" },
        { es: "Consulta multilingüe con cita al original", en: "Multilingual consultation, cited to the original" },
      ],
      cta: { es: "Empezar con Esencial", en: "Start with Esencial" }, rec: false,
    },
    {
      key: "profesional", name: "Profesional", docs: { es: "hasta 300 documentos vivos", en: "up to 300 live documents" },
      price: b.tiers.profesional, from: false,
      ing: { es: "Incluye 30 documentos de arranque + 10 al mes", en: "Includes 30 starter documents + 10 per month" },
      feats: [
        { es: "Todo lo de Esencial", en: "Everything in Esencial" },
        { es: "Inteligencia organizacional (frecuencia y cobertura)", en: "Organizational intelligence (frequency & coverage)" },
        { es: "Soporte prioritario", en: "Priority support" },
      ],
      cta: { es: "Empezar con Profesional", en: "Start with Profesional" }, rec: true,
    },
    {
      key: "enterprise", name: "Enterprise", docs: { es: "300+ · a la medida", en: "300+ · tailored" },
      price: b.tiers.enterprise, from: true,
      ing: { es: "Documentos de arranque y cupo mensual negociados", en: "Starter documents and monthly quota negotiated" },
      feats: [
        { es: "Todo lo de Profesional", en: "Everything in Profesional" },
        { es: "On-premise / jurisdicción dedicada", en: "On-premise / dedicated jurisdiction" },
        { es: "Acompañamiento de implementación", en: "Implementation support" },
      ],
      cta: { es: "Hablar con nosotros", en: "Talk to us" }, rec: false,
    },
  ];

  return (
    <main data-screen-label="Precios">
      <header className="pr-head">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "Precios", en: "Pricing" })}</span>
          <h1>{t({ es: "Dos decisiones simples. Nada más.", en: "Two simple decisions. Nothing else." })}</h1>
          <p className="sec-lead">{t({
            es: "Qué producto y de qué tamaño. Por documentos vivos, no por usuarios — todas las capacidades en todos los planes, sin add-ons.",
            en: "Which product, and what size. Priced by live documents, not by users — every capability in every plan, no add-ons.",
          })}</p>
        </div>
      </header>

      <section className="band" style={{ paddingTop: 12 }} data-screen-label="Precios — Línea y tiers">
        <div className="wrap">
          {/* decisión 1: producto */}
          <div className="prodline">
            <div className="pl-card on">
              <h3>DOCYAN <span className="now-tag">{t({ es: "Disponible hoy", en: "Available today" })}</span></h3>
              <p>{t({ es: "El entorno de documentos analizados en vivo. Lo que estás viendo en este sitio.", en: "The live document environment. What this site shows." })}</p>
            </div>
            <div className="pl-card soon">
              <h3>DOCYAN Data <span className="soon-tag">{t({ es: "Próximamente", en: "Coming soon" })}</span></h3>
              <p>{t({ es: "Inteligencia organizacional ampliada sobre tu corpus.", en: "Expanded organizational intelligence over your corpus." })}</p>
            </div>
            <div className="pl-card soon">
              <h3>DOCYAN Field <span className="soon-tag">{t({ es: "Próximamente", en: "Coming soon" })}</span></h3>
              <p>{t({ es: "Operación de campo con conectividad intermitente como caso primario.", en: "Field operation with intermittent connectivity as the primary case." })}</p>
            </div>
          </div>

          {/* decisión 2: tamaño + banda */}
          <div className="band-bar">
            <GeoCtl showLang={false} />
            <span className="band-note">{t({ es: "Precios en USD por organización, al mes. Banda según tu región — ajústala si hace falta.", en: "USD pricing per organization, monthly. Band set by your region — adjust if needed." })}</span>
          </div>

          <div className="tiers" data-comment-anchor="tabla-precios">
            {TIERS.map((tier) => (
              <div className={"tier" + (tier.rec ? " rec" : "")} key={tier.key}>
                {tier.rec && <span className="rec-tag">{t({ es: "Más elegido", en: "Most chosen" })}</span>}
                <span className="tn">{tier.name}</span>
                <span className="tdocs">{t(tier.docs)}</span>
                <div className="tp">
                  {tier.from && <span className="per">{t({ es: "desde", en: "from" })}</span>}
                  <span className="amt">{fmtUSD(tier.price)}</span>
                  <span className="per">USD / {t({ es: "mes", en: "mo" })}</span>
                </div>
                <span className="tband">{t({ es: "Banda", en: "Band" })} {b.key} · {t(b.regions)}</span>
                <ul className="tfeat">
                  <li className="ing"><Icon name="file-plus-2" size={16} />{t(tier.ing)}</li>
                  {tier.feats.map((f, i) => <li key={i}><Icon name="check" size={16} />{t(f)}</li>)}
                </ul>
                <button className={"btn lg " + (tier.rec ? "primary" : "sec")} onClick={() => linkOut(tier.key === "enterprise" ? "/codigo" : "/signup")}>{t(tier.cta)}</button>
              </div>
            ))}
          </div>
          <p className="all-feats">{t({
            es: "Los tres planes consultan igual de bien. La diferencia es cuántos documentos viven en tu entorno.",
            en: "All three plans consult equally well. The difference is how many documents live in your environment.",
          })}</p>

          {/* ingestas incluidas */}
          <div className="ingest" data-comment-anchor="ingestas-incluidas">
            <span className="eyebrow">{t({ es: "Ingestas incluidas", en: "Included ingestions" })}</span>
            <h2>{t({ es: "Cada plan incluye documentos listos para consultar", en: "Every plan includes documents ready to consult" })}</h2>
            <p>{t({
              es: "Subir un documento a DOCYAN no es «subir un archivo»: es analizarlo en vivo hasta dejarlo consultable con cita. Cada plan incluye un arranque generoso y un cupo mensual para crecer a tu ritmo.",
              en: "Adding a document to DOCYAN isn't “uploading a file”: it's analyzing it live until it's consultable with citations. Every plan includes a generous start and a monthly quota to grow at your pace.",
            })}</p>
            <div className="ingest-rows">
              <div className="ingest-row"><span className="ir-t">Esencial</span><span className="ir-v">{t({ es: "10 iniciales + 3/mes", en: "10 starters + 3/mo" })}</span></div>
              <div className="ingest-row"><span className="ir-t">Profesional</span><span className="ir-v">{t({ es: "30 iniciales + 10/mes", en: "30 starters + 10/mo" })}</span></div>
              <div className="ingest-row"><span className="ir-t">Enterprise</span><span className="ir-v">{t({ es: "Negociado a tu corpus", en: "Negotiated to your corpus" })}</span></div>
            </div>
            <div className="ingest-note">
              <Icon name="badge-check" size={15} />
              <span>{t({
                es: "¿Necesitas más? Documentos adicionales desde $15 USD, cotizados de forma transparente antes de confirmar. Tú decides el ritmo.",
                en: "Need more? Additional documents from $15 USD, quoted transparently before you confirm. You set the pace.",
              })}</span>
            </div>
          </div>
        </div>
      </section>

      {/* dos puertas */}
      <section className="band paper" data-screen-label="Precios — Puertas">
        <div className="wrap">
          <div className="cta-band">
            <span className="eyebrow">{t({ es: "¿No estás listo para elegir?", en: "Not ready to choose?" })}</span>
            <h2 className="sec-title">{t({ es: "No elijas todavía. Vive el producto.", en: "Don't choose yet. Live the product." })}</h2>
          </div>
          <Doors />
          <div style={{ marginTop: 26, textAlign: "center" }}>
            <a className="vlink" onClick={() => go("seguridad")}><Icon name="shield" size={14} />{t({ es: "¿Compras necesita el detalle de seguridad?", en: "Does procurement need the security detail?" })}</a>
          </div>
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { PreciosPage });
