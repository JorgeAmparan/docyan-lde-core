"use client";

/**
 * DOCYAN sitio público v2 — chrome compartido (F3 §A/§B).
 * Nav (fila + hamburguesa <980px), banner geo de primera visita, selector
 * banda/idioma (GeoCtl), dos puertas (Doors), footer. Port fiel de `shared.jsx`,
 * con `<Link>` directos a /signup · /codigo · /login (sin LinkOutModal, §A4).
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { BANDS, BAND_KEYS, fmtUSD } from "@/lib/bands";
import { useSite, useT } from "@/lib/site-i18n";

const NAV_LINKS: [string, string, { es: string; en: string }][] = [
  ["producto", "/producto", { es: "Producto", en: "Product" }],
  ["como", "/como-funciona", { es: "Cómo funciona", en: "How it works" }],
  // C1: "Verticales" → "Sectores" en toda la superficie pública (slug /verticales se
  // conserva; /sectores redirige). C3: "Demo" entra a la nav entre Sectores y Precios.
  ["verticales", "/verticales", { es: "Sectores", en: "Industries" }],
  ["demo", "/demo", { es: "Demo", en: "Demo" }],
  ["seguridad", "/seguridad", { es: "Seguridad", en: "Security" }],
  ["precios", "/precios", { es: "Precios", en: "Pricing" }],
];

export function GeoCtl({ onInk = false, showLang = true }: { onInk?: boolean; showLang?: boolean }) {
  const { band, setBand, lang, setLang } = useSite();
  const t = useT();
  return (
    <div className="geo-ctl">
      <span className={"gc-group" + (onInk ? " onink" : "")} role="group" aria-label={t({ es: "Banda de precios", en: "Price band" })}>
        {BAND_KEYS.map((k) => (
          <button key={k} className={"gc" + (band === k ? " on" : "")} onClick={() => setBand(k)}>{t(BANDS[k].regions)}</button>
        ))}
      </span>
      {showLang && (
        <span className={"gc-group" + (onInk ? " onink" : "")} role="group" aria-label="Idioma / Language">
          <button className={"gc" + (lang === "es" ? " on" : "")} onClick={() => setLang("es")}>Español</button>
          <button className={"gc" + (lang === "en" ? " on" : "")} onClick={() => setLang("en")}>English</button>
        </span>
      )}
    </div>
  );
}

export function GeoBanner({ onDismiss }: { onDismiss: () => void }) {
  const { band, setBand, lang, setLang } = useSite();
  const t = useT();
  const b = BANDS[band];
  const next = band === "A" ? "B" : band === "B" ? "C" : "A";
  return (
    <div className="geoband" role="status">
      <div className="gb">
        <Icon name="map-pin" size={14} />
        <span>
          {t({ es: "Detectamos tu región: ", en: "We detected your region: " })}
          <b>{t(b.regions)}</b>
          {t({ es: " — precios y idioma ajustados. Puedes cambiarlos cuando quieras.", en: " — pricing and language set accordingly. Change them anytime." })}
        </span>
        <span className="gb-act">
          <button className="gb-btn" onClick={() => setBand(next)}>{t({ es: "Cambiar región", en: "Change region" })}</button>
          <button className="gb-btn" onClick={() => setLang(lang === "es" ? "en" : "es")}>{lang === "es" ? "English" : "Español"}</button>
          <button className="gb-x" onClick={onDismiss} aria-label={t({ es: "Cerrar aviso", en: "Dismiss notice" })}><Icon name="x" size={14} /></button>
        </span>
      </div>
    </div>
  );
}

export function SiteNav2() {
  const t = useT();
  const { lang, setLang } = useSite();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const isOn = (href: string) => (href === "/producto" ? pathname === "/producto" : pathname.startsWith(href));
  return (
    <>
      <nav className="nav2" aria-label={t({ es: "Navegación principal", en: "Main navigation" })}>
        <div className="nrow">
          <Link href="/" className="brand" aria-label="DOCYAN — inicio">
            <DocyanMark size={26} /><span>DOCYAN</span><span className="lde">LDE</span>
          </Link>
          <div className="links">
            {NAV_LINKS.map(([k, href, l]) => (
              <Link key={k} href={href} className={isOn(href) ? "on" : ""}>{t(l)}</Link>
            ))}
          </div>
          <div className="nright">
            <button className="lang-pill" onClick={() => setLang(lang === "es" ? "en" : "es")} aria-label="Idioma / Language">
              <Icon name="globe" size={12} /><b>{lang.toUpperCase()}</b>
            </button>
            <Link className="btn ghost login" href="/login">{t({ es: "Entrar", en: "Sign in" })}</Link>
            <Link className="btn primary ncta" href="/signup">{t({ es: "Pruébalo gratis", en: "Try it free" })}</Link>
            <button className="hamb" onClick={() => setOpen(true)} aria-label={t({ es: "Abrir menú", en: "Open menu" })}><Icon name="menu" size={22} /></button>
          </div>
        </div>
      </nav>
      {open && (
        <div className="msheet" onClick={() => setOpen(false)}>
          <div className="mpanel" onClick={(e) => e.stopPropagation()}>
            <div className="mtop">
              <Link href="/" className="brand" onClick={() => setOpen(false)}><DocyanMark size={24} /><span style={{ fontWeight: 700 }}>DOCYAN</span></Link>
              <button className="hamb" onClick={() => setOpen(false)} aria-label={t({ es: "Cerrar menú", en: "Close menu" })}><Icon name="x" size={22} /></button>
            </div>
            {NAV_LINKS.map(([k, href, l]) => (
              <Link key={k} href={href} className={"mlink" + (isOn(href) ? " on" : "")} onClick={() => setOpen(false)}>{t(l)}<Icon name="chevron-right" size={18} /></Link>
            ))}
            <div className="mctas">
              <Link className="btn primary lg" href="/signup" onClick={() => setOpen(false)}>{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}</Link>
              <Link className="btn sec lg" href="/codigo" onClick={() => setOpen(false)}>{t({ es: "Agendar demo", en: "Book a demo" })}</Link>
            </div>
            <div className="mlang"><GeoCtl /></div>
          </div>
        </div>
      )}
    </>
  );
}

export function Doors({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { band } = useSite();
  const b = BANDS[band];
  return (
    <div className="doors">
      <div className="door main">
        <span className="d-lab">{t({ es: "Puerta principal · autoservicio", en: "Main door · self-serve" })}</span>
        <h3>{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}</h3>
        <p>{t({ es: "Registro mínimo. Sube hasta 3 documentos vivos y consúltalos durante 30 días. Eliges plan después de vivir el producto.", en: "Minimal signup. Upload up to 3 live documents and consult them for 30 days. Pick a plan after you've lived the product." })}</p>
        <div className="d-meta">
          <span><Icon name="check" size={13} />{t({ es: "Sin tarjeta", en: "No card" })}</span>
          <span><Icon name="check" size={13} />{t({ es: "30 días", en: "30 days" })}</span>
          <span><Icon name="check" size={13} />{t({ es: "Todas las capacidades", en: "All capabilities" })}</span>
        </div>
        <Link className="btn primary lg" href="/signup">{t({ es: "Crear cuenta gratis", en: "Create free account" })}<Icon name="arrow-right" size={16} /></Link>
      </div>
      <div className="door side">
        <span className="d-lab">{t({ es: "Puerta asistida · piloto", en: "Assisted door · pilot" })}</span>
        <h3>{t({ es: "Piloto con acompañamiento", en: "Guided pilot" })}</h3>
        <p>
          {t({ es: "Con código de acceso: Esencial por ", en: "With an access code: Esencial at " })}
          <span className="strike mono">{fmtUSD(b.piloto.list)}</span>{" "}
          <b className="mono">{fmtUSD(b.piloto.off)}/{t({ es: "mes", en: "mo" })}</b>
          {t({ es: " durante 60 días, con tu equipo y tus documentos reales.", en: " for 60 days, with your team and your real documents." })}
        </p>
        {!compact && (
          <div className="d-meta">
            <span><Icon name="check" size={13} />{t({ es: "−30% precio de lista", en: "−30% off list" })}</span>
            <span><Icon name="check" size={13} />{t({ es: "60 días", en: "60 days" })}</span>
          </div>
        )}
        <Link className="btn sec lg" href="/codigo">{t({ es: "Agendar demo · canjear código", en: "Book a demo · redeem code" })}</Link>
      </div>
    </div>
  );
}

export function SiteFooter2() {
  const t = useT();
  return (
    <footer className="footer2">
      <div className="wrap">
        <div className="fgrid">
          <div className="fbrand">
            <div className="brand"><DocyanMark size={24} /><span>DOCYAN</span></div>
            <p className="fdesc">{t({ es: "Live Document Environment. Tus documentos, consultables al instante, con cita a la fuente.", en: "Live Document Environment. Your documents, instantly consultable, with a citation to the source." })}</p>
            <GeoCtl onInk />
          </div>
          <div>
            <h4>{t({ es: "Producto", en: "Product" })}</h4>
            <Link href="/producto">{t({ es: "Qué es DOCYAN", en: "What DOCYAN is" })}</Link>
            <Link href="/como-funciona">{t({ es: "Cómo funciona", en: "How it works" })}</Link>
            <Link href="/seguridad">{t({ es: "Seguridad", en: "Security" })}</Link>
            <Link href="/precios">{t({ es: "Precios", en: "Pricing" })}</Link>
          </div>
          <div>
            <h4>{t({ es: "Sectores", en: "Industries" })}</h4>
            <Link href="/verticales/laboratorios">{t({ es: "Laboratorios", en: "Laboratories" })}</Link>
            <Link href="/verticales/maquila">{t({ es: "Maquila y manufactura", en: "Maquila & manufacturing" })}</Link>
            <Link href="/verticales/flotillas">{t({ es: "Flotillas de técnicos", en: "Field technician fleets" })}</Link>
            <Link href="/verticales">{t({ es: "Todos los sectores", en: "All industries" })}</Link>
          </div>
          <div>
            <h4>{t({ es: "Empezar", en: "Get started" })}</h4>
            <Link href="/signup">{t({ es: "Pruébalo gratis", en: "Try it free" })}</Link>
            <Link href="/demo">{t({ es: "Demos sin registro", en: "No-signup demos" })}</Link>
            <Link href="/codigo">{t({ es: "Canjear código piloto", en: "Redeem pilot code" })}</Link>
            <Link href="/login">{t({ es: "Entrar", en: "Sign in" })}</Link>
          </div>
          <div>
            <h4>{t({ es: "Recursos", en: "Resources" })}</h4>
            <Link href="/faq">{t({ es: "Preguntas frecuentes", en: "FAQ" })}</Link>
            <Link href="/privacidad">{t({ es: "Aviso de privacidad", en: "Privacy notice" })}</Link>
            <Link href="/terminos">{t({ es: "Términos del servicio", en: "Terms of service" })}</Link>
          </div>
        </div>
        <div className="fbottom">
          <span>© 2026 XCID SA de CV · DOCYAN LDE™</span>
          <span className="sp">
            <span className="status"><span className="d" />{t({ es: "Todos los sistemas operativos", en: "All systems operational" })}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
