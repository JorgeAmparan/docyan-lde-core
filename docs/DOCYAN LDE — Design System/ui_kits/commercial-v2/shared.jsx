/* DOCYAN sitio público v2 — infraestructura compartida.
   i18n ES/EN, bandas de precio A/B/C, Nav (fila + hamburguesa),
   banner geo de primera visita, footer, puertas a /signup y /codigo. */

const { useState, useEffect, useRef, useContext, createContext } = React;

/* ---------- iconos + marca ---------- */
function Icon({ name, size = 18 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { "stroke-width": 1.75 } });
    }
  }, [name]);
  return <span className="lic" ref={ref} style={{ width: size, height: size }} aria-hidden="true"></span>;
}

function Mark({ size = 26, color = "var(--cinnabar-500)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 10 V6 a2 2 0 0 1 2-2 h4" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M28 22 v4 a2 2 0 0 1 -2 2 h-4" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
      <rect x="11" y="11" width="10" height="10" rx="2.4" fill={color} />
    </svg>
  );
}

/* ---------- i18n ---------- */
const LangCtx = createContext({ lang: "es", setLang: () => {} });
function useLang() { return useContext(LangCtx); }
/* t({es:"…", en:"…"}) */
function useT() {
  const { lang } = useLang();
  return (o) => (o && (o[lang] !== undefined ? o[lang] : o.es)) ?? "";
}

/* ---------- bandas de precio (fuente única) ---------- */
const BANDS = {
  A: {
    key: "A", regions: { es: "MX · LatAm", en: "MX · LatAm" }, cc: "MX",
    tiers: { esencial: 250, profesional: 550, enterprise: 1200 },
    piloto: { list: 250, off: 175 },
  },
  B: {
    key: "B", regions: { es: "EE. UU. · Canadá", en: "US · Canada" }, cc: "US",
    tiers: { esencial: 349, profesional: 770, enterprise: 1680 },
    piloto: { list: 349, off: 244 },
  },
  C: {
    key: "C", regions: { es: "UE · UK · Australia", en: "EU · UK · Australia" }, cc: "EU",
    tiers: { esencial: 375, profesional: 825, enterprise: 1800 },
    piloto: { list: 375, off: 262 },
  },
};
const fmtUSD = (n) => "$" + n.toLocaleString("en-US");

const BandCtx = createContext({ band: "A", setBand: () => {} });
function useBand() { return useContext(BandCtx); }

/* ---------- selector banda + idioma ---------- */
function GeoCtl({ onInk = false, showLang = true }) {
  const { band, setBand } = useBand();
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div className="geo-ctl">
      <span className={"gc-group" + (onInk ? " onink" : "")} role="group" aria-label={t({ es: "Banda de precios", en: "Price band" })}>
        {Object.values(BANDS).map((b) => (
          <button key={b.key} className={"gc" + (band === b.key ? " on" : "")} onClick={() => setBand(b.key)}>{t(b.regions)}</button>
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

/* ---------- banner geo primera visita ---------- */
function GeoBanner({ onDismiss }) {
  const { band } = useBand();
  const t = useT();
  const b = BANDS[band];
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
          <GeoCtlMini />
          <button className="gb-x" onClick={onDismiss} aria-label={t({ es: "Cerrar aviso", en: "Dismiss notice" })}><Icon name="x" size={14} /></button>
        </span>
      </div>
    </div>
  );
}
function GeoCtlMini() {
  const { band, setBand } = useBand();
  const { lang, setLang } = useLang();
  const t = useT();
  const next = band === "A" ? "B" : band === "B" ? "C" : "A";
  return (
    <>
      <button className="gb-btn" onClick={() => setBand(next)}>{t({ es: "Cambiar región", en: "Change region" })}</button>
      <button className="gb-btn" onClick={() => setLang(lang === "es" ? "en" : "es")}>{lang === "es" ? "English" : "Español"}</button>
    </>
  );
}

/* ---------- puertas a producción (/signup · /codigo) ---------- */
const LinkOutCtx = createContext(() => {});
function useLinkOut() { return useContext(LinkOutCtx); }

function LinkOutModal({ route, onClose }) {
  const t = useT();
  if (!route) return null;
  const isSignup = route === "/signup";
  return (
    <div className="linkout" onClick={onClose}>
      <div className="lo-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className="lo-route">{route}</span>
        <h3>{isSignup
          ? t({ es: "Aquí continúa el registro freemium", en: "The freemium signup continues here" })
          : t({ es: "Aquí continúa el canje de código piloto", en: "The pilot code redemption continues here" })}</h3>
        <p>{isSignup
          ? t({ es: "3 documentos vivos, 30 días, registro mínimo. El flujo ya está construido y en producción — este prototipo solo enlaza a él.", en: "3 live documents, 30 days, minimal signup. The flow is already built and in production — this prototype only links to it." })
          : t({ es: "Acceso asistido con código: Esencial −30% por 60 días. El flujo ya está construido y en producción — este prototipo solo enlaza a él.", en: "Assisted access with a code: Esencial −30% for 60 days. The flow is already built and in production — this prototype only links to it." })}</p>
        <div className="lo-row">
          <button className="btn primary" onClick={onClose}><Icon name="external-link" size={15} />{t({ es: "Ir a producción", en: "Go to production" })}</button>
          <button className="btn ghost" onClick={onClose}>{t({ es: "Volver", en: "Back" })}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- NAV ---------- */
const NAV_LINKS = [
  ["producto", { es: "Producto", en: "Product" }],
  ["como", { es: "Cómo funciona", en: "How it works" }],
  ["verticales", { es: "Verticales", en: "Industries" }],
  ["seguridad", { es: "Seguridad", en: "Security" }],
  ["precios", { es: "Precios", en: "Pricing" }],
];

function Nav2({ page, go }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const linkOut = useLinkOut();
  const [open, setOpen] = useState(false);
  const nav = (p) => { setOpen(false); go(p); };
  return (
    <>
      <nav className="nav2" aria-label={t({ es: "Navegación principal", en: "Main navigation" })}>
        <div className="nrow">
          <button className="brand" onClick={() => nav("home")} aria-label="DOCYAN — inicio">
            <Mark size={26} /><span>DOCYAN</span><span className="lde">LDE</span>
          </button>
          <div className="links">
            {NAV_LINKS.map(([k, l]) => (
              <a key={k} className={page === k || (k === "verticales" && page.indexOf("vert:") === 0) ? "on" : ""} onClick={() => nav(k)}>{t(l)}</a>
            ))}
          </div>
          <div className="nright">
            <button className="lang-pill" onClick={() => setLang(lang === "es" ? "en" : "es")} aria-label="Idioma / Language">
              <Icon name="globe" size={12} /><b>{lang.toUpperCase()}</b>
            </button>
            <button className="btn ghost login" onClick={() => linkOut("/login")}>{t({ es: "Entrar", en: "Sign in" })}</button>
            <button className="btn primary ncta" onClick={() => linkOut("/signup")}>{t({ es: "Pruébalo gratis", en: "Try it free" })}</button>
            <button className="hamb" onClick={() => setOpen(true)} aria-label={t({ es: "Abrir menú", en: "Open menu" })}><Icon name="menu" size={22} /></button>
          </div>
        </div>
      </nav>
      {open && (
        <div className="msheet" onClick={() => setOpen(false)}>
          <div className="mpanel" onClick={(e) => e.stopPropagation()}>
            <div className="mtop">
              <button className="brand" onClick={() => nav("home")}><Mark size={24} /><span style={{ fontWeight: 700 }}>DOCYAN</span></button>
              <button className="hamb" onClick={() => setOpen(false)} aria-label={t({ es: "Cerrar menú", en: "Close menu" })}><Icon name="x" size={22} /></button>
            </div>
            {NAV_LINKS.map(([k, l]) => (
              <a key={k} className={"mlink" + (page === k ? " on" : "")} onClick={() => nav(k)}>{t(l)}<Icon name="chevron-right" size={18} /></a>
            ))}
            <div className="mctas">
              <button className="btn primary lg" onClick={() => { setOpen(false); linkOut("/signup"); }}>{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}</button>
              <button className="btn sec lg" onClick={() => { setOpen(false); linkOut("/codigo"); }}>{t({ es: "Agendar demo", en: "Book a demo" })}</button>
            </div>
            <div className="mlang"><GeoCtl /></div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- dos puertas (CTA reutilizable) ---------- */
function Doors({ compact = false }) {
  const t = useT();
  const { band } = useBand();
  const linkOut = useLinkOut();
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
        <button className="btn primary lg" onClick={() => linkOut("/signup")}>{t({ es: "Crear cuenta gratis", en: "Create free account" })}<Icon name="arrow-right" size={16} /></button>
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
        <button className="btn sec lg" onClick={() => linkOut("/codigo")}>{t({ es: "Agendar demo · canjear código", en: "Book a demo · redeem code" })}</button>
      </div>
    </div>
  );
}

/* ---------- FOOTER ---------- */
function Footer2({ go }) {
  const t = useT();
  const linkOut = useLinkOut();
  return (
    <footer className="footer2">
      <div className="wrap">
        <div className="fgrid">
          <div className="fbrand">
            <div className="brand"><Mark size={24} color="var(--cinnabar-400)" /><span>DOCYAN</span></div>
            <p className="fdesc">{t({ es: "Live Document Environment. Tus documentos, consultables al instante, con cita a la fuente.", en: "Live Document Environment. Your documents, instantly consultable, with a citation to the source." })}</p>
            <GeoCtl onInk />
          </div>
          <div>
            <h4>{t({ es: "Producto", en: "Product" })}</h4>
            <a onClick={() => go("producto")}>{t({ es: "Qué es DOCYAN", en: "What DOCYAN is" })}</a>
            <a onClick={() => go("como")}>{t({ es: "Cómo funciona", en: "How it works" })}</a>
            <a onClick={() => go("seguridad")}>{t({ es: "Seguridad", en: "Security" })}</a>
            <a onClick={() => go("precios")}>{t({ es: "Precios", en: "Pricing" })}</a>
          </div>
          <div>
            <h4>{t({ es: "Sectores", en: "Industries" })}</h4>
            <a onClick={() => go("vert:lab")}>{t({ es: "Laboratorios", en: "Laboratories" })}</a>
            <a onClick={() => go("vert:maq")}>{t({ es: "Maquila y manufactura", en: "Maquila & manufacturing" })}</a>
            <a onClick={() => go("vert:flot")}>{t({ es: "Flotillas de técnicos", en: "Field technician fleets" })}</a>
            <a onClick={() => go("verticales")}>{t({ es: "Todos los sectores", en: "All industries" })}</a>
          </div>
          <div>
            <h4>{t({ es: "Empezar", en: "Get started" })}</h4>
            <a onClick={() => linkOut("/signup")}>{t({ es: "Pruébalo gratis", en: "Try it free" })}</a>
            <a onClick={() => go("demos")}>{t({ es: "Demos sin registro", en: "No-signup demos" })}</a>
            <a onClick={() => linkOut("/codigo")}>{t({ es: "Canjear código piloto", en: "Redeem pilot code" })}</a>
            <a onClick={() => linkOut("/login")}>{t({ es: "Entrar", en: "Sign in" })}</a>
            <a onClick={() => go("legal")}>{t({ es: "Privacidad y términos", en: "Privacy & terms" })}</a>
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

/* ---------- página legal placeholder honesto ---------- */
function LegalPage() {
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

Object.assign(window, {
  Icon, Mark, LangCtx, useLang, useT, BANDS, fmtUSD, BandCtx, useBand,
  GeoCtl, GeoBanner, LinkOutCtx, useLinkOut, LinkOutModal, Nav2, Doors, Footer2, LegalPage,
});
