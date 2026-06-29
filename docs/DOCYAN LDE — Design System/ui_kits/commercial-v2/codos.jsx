/* DOCYAN sitio público v2 — DEMOS SIN REGISTRO (CoDos).
   5 Conjuntos de Documentos por vertical. Escalón intermedio del embudo:
   el CTA primario del sitio sigue siendo el freemium; aquí se prueba sin
   registro y el CTA de salida es "Ahora con tus documentos →" (/signup).
   Los documentos de muestra están en su idioma original (español). */

/* ---------- renderers por tipo de respuesta ---------- */
function KInfo({ a }) {
  return (
    <div>
      <div className="big">{a.value} <span className="u">{a.unit}</span></div>
      <p className="note">{a.note}</p>
    </div>
  );
}
function KSteps({ a }) {
  return (
    <div>
      <h4 className="k-title">{a.title}</h4>
      {a.ppe && (
        <div className="k-ppe">
          {a.ppe.map(([ic, label], i) => <span key={i}><Icon name={ic === "glasses" ? "glasses" : ic === "hard-hat" ? "hard-hat" : "hand"} size={13} />{label}</span>)}
        </div>
      )}
      <ol className="k-steps">
        {a.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {a.warn && <div className="k-warn"><Icon name="alert-triangle" size={14} /><div><b>{a.warn[0]}</b> {a.warn[1]}</div></div>}
    </div>
  );
}
function KDiagram({ a }) {
  return (
    <div>
      <h4 className="k-title">{a.title}</h4>
      <div className="k-diagram ph">
        <span className="ph-tag">diagrama · {a.title}</span>
        {a.pins.map(([n, x, y, label]) => (
          <span className="k-pin" key={n} style={{ left: x + "%", top: y + "%" }} title={label}>{n}</span>
        ))}
      </div>
      <ul className="k-pinlist">
        {a.pins.map(([n, , , label]) => <li key={n}><b>{n}</b> {label}</li>)}
      </ul>
    </div>
  );
}
function KTroubleshoot({ a }) {
  const [pick, setPick] = React.useState(null);
  return (
    <div>
      <h4 className="k-title">{a.title}</h4>
      <p className="note">{a.ask}</p>
      <div className="k-opts">
        {a.options.map(([label], i) => (
          <button key={i} className={"k-opt" + (pick === i ? " on" : "")} onClick={() => setPick(i)}>{label}</button>
        ))}
      </div>
      {pick !== null && <p className="note k-optnote">{a.options[pick][1]}</p>}
    </div>
  );
}
function KCompare({ a }) {
  return (
    <div>
      <h4 className="k-title">{a.title} · <span className="mono" style={{ fontSize: 12 }}>{a.from} → {a.to}</span></h4>
      <ul className="k-diff">
        {a.diff.map(([kind, txt], i) => (
          <li key={i} className={kind}>
            <Icon name={kind === "add" ? "plus" : kind === "del" ? "minus" : "arrow-right"} size={13} />{txt}
          </li>
        ))}
      </ul>
      <p className="note">{a.summary}</p>
    </div>
  );
}
function KAlerts({ a }) {
  return (
    <div>
      <h4 className="k-title">{a.title}</h4>
      <div className="k-alerts">
        {a.items.map(([lvl, label, when], i) => (
          <div key={i} className={"k-alert " + lvl}>
            <Icon name={lvl === "warn" ? "alert-triangle" : "clock"} size={14} />
            <span>{label}</span><b>{when}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function KHistory({ a }) {
  return (
    <div>
      <h4 className="k-title">{a.title}</h4>
      <div className="k-hist">
        {a.events.map(([when, what], i) => (
          <div key={i} className="k-ev"><span className="mono">{when}</span><span>{what}</span></div>
        ))}
      </div>
      {a.pattern && <p className="note k-pattern"><Icon name="activity" size={13} /> {a.pattern}</p>}
    </div>
  );
}
function KVideo({ a }) {
  return (
    <div>
      <h4 className="k-title">{a.title} <span className="mono" style={{ fontSize: 11, color: "var(--fg-subtle)" }}>{a.dur}</span></h4>
      <div className="k-video ph"><span className="ph-tag">video · {a.title}</span><span className="k-play"><Icon name="play" size={18} /></span></div>
      <ul className="k-chapters">
        {a.chapters.map(([ts, label], i) => <li key={i}><span className="mono">{ts}</span>{label}</li>)}
      </ul>
    </div>
  );
}
const KIND_RENDERERS = { info: KInfo, steps: KSteps, diagram: KDiagram, troubleshoot: KTroubleshoot, compare: KCompare, alerts: KAlerts, history: KHistory, video: KVideo };

/* ---------- reproductor de CoDo ---------- */
function CodoPlayer({ codo }) {
  const t = useT();
  const linkOut = useLinkOut();
  const [qa, setQa] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [showSrc, setShowSrc] = React.useState(false);
  const [docView, setDocView] = React.useState(null);
  const cardRef = React.useRef(null);

  React.useEffect(() => { setQa(null); setLoading(false); setShowSrc(false); }, [codo.key]);

  const ask = (item) => {
    if (loading) return;
    setLoading(true); setQa(item); setShowSrc(false);
    const el = cardRef.current;
    if (el) { const r = el.getBoundingClientRect(); if (r.top < 0) window.scrollBy({ top: r.top - 14, behavior: "smooth" }); }
    setTimeout(() => setLoading(false), 480);
  };

  const Renderer = qa ? KIND_RENDERERS[qa.kind] || KInfo : null;

  return (
    <div className="demo-card2 codo-card" ref={cardRef} data-comment-anchor={"codo-" + codo.key}>
      <div className="dc2-top">
        <span className="t-ico"><Icon name={codo.icon} size={16} /></span>
        <div>
          <div className="ml">{codo.codo} · {codo.label}</div>
          <div className="mn">{codo.entity}</div>
        </div>
        <span className="dc2-live"><span className="dot" />{t({ es: "SIN REGISTRO", en: "NO SIGNUP" })}</span>
      </div>
      <div className="dc2-docs">
        {codo.docs.map((d, i) => (
          <span key={i} className="dc2-doc on" style={{ cursor: "default" }}><Icon name="file-text" size={13} />{d}</span>
        ))}
      </div>
      <div className="dc2-body" aria-live="polite" style={{ minHeight: 170 }}>
        {!qa && (
          <div className="dc2-empty">
            <Icon name="message-circle-question" size={22} />
            <p>{t({ es: "Elige una consulta. Cada respuesta llega con su cita al documento.", en: "Pick a query. Every answer arrives with its citation to the document." })}</p>
          </div>
        )}
        {qa && <div className="dc2-q">{qa.q}</div>}
        {qa && loading && (
          <div className="dc2-shimmer"><span className="dot" />{t({ es: "DOCYAN está leyendo el documento…", en: "DOCYAN is reading the document…" })}</div>
        )}
        {qa && !loading && (
          <div className="dc2-a">
            <Renderer a={qa} />
            <div className="dc2-citerow">
              <button className="cite2" onClick={() => setShowSrc(!showSrc)}>
                <span className="brk" /><span className="ctxt">{qa.cite} · {t({ es: "pág.", en: "p." })} {qa.page}</span> ↗
              </button>
              <button className="openpdf" onClick={() => setDocView(qa)}>
                <Icon name="external-link" size={13} />{t({ es: "Abrir PDF", en: "Open PDF" })}
              </button>
            </div>
            {showSrc && (
              <div className="dc2-src">
                <span className="thread" />
                <div className="src2">
                  <div className="s-head">
                    <Icon name="file-text" size={12} />
                    <span>{t({ es: "Fragmento original", en: "Original fragment" })}</span>
                    <span className="pg">{qa.doc}</span>
                  </div>
                  <div className="s-span">{qa.span}</div>
                  <div className="s-actions">
                    <span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Pedigree a span · SHA-256", en: "Span pedigree · SHA-256" })}</span>
                    <button className="openpdf" onClick={() => setDocView(qa)}>
                      <Icon name="external-link" size={13} />{t({ es: "Abrir PDF", en: "Open PDF" })}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="dc2-sugs">
        {codo.qa.map((item, i) => (
          <button key={i} className={"dc2-sug" + (qa === item ? " onq" : "")} disabled={loading} onClick={() => ask(item)}>{item.q}</button>
        ))}
      </div>
      <div className="codo-exit">
        <span>{t({ es: "Esto, con los documentos de muestra. ", en: "That was with sample documents. " })}</span>
        <button className="btn primary" onClick={() => linkOut("/signup")}>{t({ es: "Ahora con tus documentos", en: "Now with your documents" })}<Icon name="arrow-right" size={15} /></button>
      </div>
      {docView && <DocOverlay a={docView} codo={codo.codo} onClose={() => setDocView(null)} />}
    </div>
  );
}

/* ---------- página de demos ---------- */
function DemosPage({ go, initial }) {
  const t = useT();
  const [key, setKey] = React.useState(initial && CODOS.some((c) => c.key === initial) ? initial : CODOS[0].key);
  React.useEffect(() => { if (initial && CODOS.some((c) => c.key === initial)) setKey(initial); }, [initial]);
  const codo = CODOS.find((c) => c.key === key);
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
      <section className="band" style={{ paddingTop: 20 }} data-screen-label="Demos — CoDo activo">
        <div className="wrap">
          <div className="codo-tabs" role="tablist" aria-label={t({ es: "Sectores de demo", en: "Demo industries" })}>
            {CODOS.map((c) => (
              <button key={c.key} role="tab" aria-selected={c.key === key} className={"codo-tab" + (c.key === key ? " on" : "")} onClick={() => setKey(c.key)}>
                <Icon name={c.icon} size={15} />{c.label}
              </button>
            ))}
          </div>
          <p className="codo-blurb">{codo.blurb}</p>
          <div className="codo-stage">
            <CodoPlayer codo={codo} />
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

/* ---------- puente en la home ---------- */
function CodoBridge({ go }) {
  const t = useT();
  return (
    <section className="band ink codo-bridge" data-screen-label="Home — Puente CoDos">
      <div className="wrap">
        <div className="cb-grid">
          <div>
            <span className="eyebrow">{t({ es: "Demos sin registro", en: "No-signup demos" })}</span>
            <h2 className="sec-title">{t({ es: "¿Quieres verlo con documentos de tu sector?", en: "Want to see it with documents from your industry?" })}</h2>
            <p className="sec-lead">{t({
              es: "Cinco Conjuntos de Documentos ya analizados — pregunta lo que preguntarías en tu operación, sin registrarte.",
              en: "Five Document Sets already analyzed — ask what you'd ask in your operation, without signing up.",
            })}</p>
          </div>
          <div className="cb-list">
            {CODOS.map((c) => (
              <button key={c.key} className="cb-item" onClick={() => go("demos:" + c.key)}>
                <Icon name={c.icon} size={17} />
                <span>{c.label}</span>
                <span className="cb-entity">{c.entity}</span>
                <Icon name="arrow-right" size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { DemosPage, CodoBridge, CodoPlayer });
