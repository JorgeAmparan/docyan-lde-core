/* DOCYAN — Colaborador MÓVIL (breakpoint angosto del colaborador).
   Reusa datos compartidos (CODOS, ANSWERS) y el estado saved del harness.
   Exporta primitivas móviles (MobileAnswerCard / MobileConsult / MobileScan /
   MobileStatus) que el Admin de Bolsillo también consume. */

/* ---- status bar (compartida) ---- */
function MobileStatus() {
  return <div className="ph-status"><span>9:41</span>
    <span className="rt"><Icon name="signal" size={15} /><Icon name="wifi" size={15} /><Icon name="battery-full" size={17} /></span></div>;
}

/* ---- answer card (móvil) ---- */
function MobileAnswerCard({ a, saved, onSave }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOpen(true), 360); return () => clearTimeout(id); }, []);
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  return <div>
    <div className={"mode" + (a.mode === "synth" ? " synth" : "")}><span className="pulse" />{a.mode === "synth" ? "Respuesta sintetizada" : "Respuesta instantánea · caché"}</div>
    <div className="acard"><div className="q">{a.q}</div>
      {a.value ? <><div className="big">{a.value}<span className="u">{a.unit}</span></div><p className="note">{a.note}</p></>
        : <p className="note" style={{ fontSize: 15.5, color: "var(--fg)" }}>{a.text}</p>}
      <div className="citerow"><button className="cite2" onClick={() => setOpen(o => !o)}><span className="brk" />{a.cite} · pág. {a.page} ↗</button>
        {onSave && <button className={"savebtn" + (saved ? " on" : "")} onClick={onSave}><Icon name={saved ? "check" : "bookmark"} size={15} />{saved ? "Guardada" : "Guardar"}</button>}</div>
      {open && a.span && <div className="src"><span className="thr" /><div className="src2">
        <div className="s-head"><Icon name="file-text" size={13} /><span>Fragmento original</span><span className="pg">pág. {a.page}</span></div>
        <div className="s-span">{parts ? <>{parts[0]}<mark>{a.mark}</mark>{parts[1]}</> : a.span}</div>
        {a.lang !== "ES" && <span className="s-orig"><Icon name="globe" size={12} />Documento original en inglés · preguntaste en español</span>}
        <div className="s-actions"><span className="s-ped"><Icon name="shield-check" size={13} />Pedigree a span · SHA-256</span>
          <button className="openpdf"><Icon name="external-link" size={13} />Abrir PDF</button></div>
      </div></div>}
    </div>
  </div>;
}

/* ---- consult (móvil) — usado por colaborador y admin ---- */
function MobileConsult({ codo, back, initialKey, saved, toggleSave, viaQR = true }) {
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const ref = useRef(null);
  const sugs = codo.sugs || [];
  const ask = (label, key) => {
    const a = ANSWERS[key] || { q: label, text: "DOCYAN clasifica tu pregunta y responde con cita a la fuente.", mode: "synth", cite: codo.id, page: "—", span: null, lang: "ES" };
    setThread(t => [...t, { role: "u", text: label }, { role: "a", a, id: Date.now() + Math.random() }]);
  };
  useEffect(() => { if (initialKey && ANSWERS[initialKey]) ask(ANSWERS[initialKey].q, initialKey); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [thread]);
  return <>
    <div className="ph-body" ref={ref}>
      <div className="cons-top"><button className="back-btn" onClick={back}><Icon name="arrow-left" size={18} /></button>
        <div className="cons-ctx"><div className="cc"><span className="dot" />{codo.id}</div><div className="cnm">{codo.name}</div></div></div>
      {viaQR && <div className="qr-banner"><Icon name="scan-line" size={15} /><span>{t({ es: "QR escaneado", en: "QR scanned" })} · {codo.docs} {t({ es: "docs vivos", en: "live docs" })}</span></div>}
      {thread.length === 0 && <>
        <div className="sec-lab"><Icon name="sparkles" size={14} />{t({ es: "Preguntas frecuentes aqu\u00ed", en: "Frequent questions here" })}</div>
        {sugs.map((s, i) => <button key={i} className="sug" onClick={() => ask(s[1], s[2])}><Icon name={s[0]} size={18} /><span className="tx">{s[1]}</span><span className="ar">→</span></button>)}
      </>}
      {thread.map((m, i) => m.role === "u"
        ? <div className="bubble" key={i}>{m.text}</div>
        : <AnswerBody key={m.id} a={m.a} saved={saved.some(s => s.q === m.a.q)} onSave={() => toggleSave(m.a, codo)} />)}
    </div>
    <div className="dock"><form className="qbar" onSubmit={e => { e.preventDefault(); const v = text.trim(); if (v) { ask(v, null); setText(""); } }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder={t({ es: "Pregunta sobre este equipo\u2026", en: "Ask about this equipment\u2026" })} />
      <button type="button" className="mic" title={t({ es: "Dictar", en: "Dictate" })}><Icon name="mic" size={18} /></button>
      <button type="submit" className="send"><Icon name="arrow-up" size={18} /></button>
    </form></div>
  </>;
}

/* ---- scan (móvil) — usado por colaborador y admin ---- */
function MobileScan({ pick, title, sub }) {
  const ttl = title || t({ es: "Escanear QR", en: "Scan QR" });
  const sb = sub || t({ es: "Apunta la c\u00e1mara al QR pegado en el equipo.", en: "Point the camera at the QR on the equipment." });
  return <div className="ph-body" style={{ display: "flex", flexDirection: "column" }}>
    <div className="greet" style={{ marginBottom: 18 }}><div className="hi">{ttl}</div><div className="sub">{sb}</div></div>
    <div style={{ aspectRatio: "1", borderRadius: 22, background: "var(--ink-950)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 18 }}>
      {["tl", "tr", "bl", "br"].map(p => <span key={p} style={{ position: "absolute", width: 44, height: 44,
        borderColor: "var(--cinnabar-500)", borderStyle: "solid",
        borderWidth: p === "tl" ? "4px 0 0 4px" : p === "tr" ? "4px 4px 0 0" : p === "bl" ? "0 0 4px 4px" : "0 4px 4px 0",
        borderTopLeftRadius: p === "tl" ? 12 : 0, borderTopRightRadius: p === "tr" ? 12 : 0, borderBottomLeftRadius: p === "bl" ? 12 : 0, borderBottomRightRadius: p === "br" ? 12 : 0,
        top: p[0] === "t" ? 26 : "auto", bottom: p[0] === "b" ? 26 : "auto", left: p[1] === "l" ? 26 : "auto", right: p[1] === "r" ? 26 : "auto" }} />)}
      <Icon name="scan-line" size={56} color="rgba(250,247,241,.5)" />
    </div>
    <div className="sec-lab"><Icon name="zap" size={14} />{t({ es: "Detectados cerca de ti", en: "Detected near you" })}</div>
    {CODOS.map(c => <button key={c.key} className="codo-card" onClick={() => pick(c)}>
      <span className="ci"><Icon name={c.icon} size={24} /></span>
      <div style={{ minWidth: 0 }}><div className="cid">{c.id}</div><div className="cn">{c.name}</div>
        <div className="cm"><span>{c.loc}</span></div></div>
      <span className="car"><Icon name="chevron-right" size={20} /></span>
    </button>)}
  </div>;
}

/* ---- colaborador: home / saved / perfil ---- */
function ColabMobileHome({ go, openCodo, saved }) {
  return <div className="ph-body">
    <div className="greet"><div className="hi">{t({ es: "Hola, Andr\u00e9s", en: "Hi, Andr\u00e9s" })}</div><div className="sub">{t({ es: "Escanea el QR del equipo o entra a un CoDo.", en: "Scan the equipment QR or enter a CoDo." })}</div></div>
    <button className="scan-cta" onClick={() => go("scan")}>
      <span className="si"><Icon name="scan-line" size={26} color="#fff" /></span>
      <div><div className="st">{t({ es: "Escanear QR", en: "Scan QR" })}</div><div className="sm">{t({ es: "Apunta al equipo y pregunta", en: "Point at the equipment and ask" })}</div></div>
      <span className="sar"><Icon name="arrow-right" size={20} color="#fff" /></span>
    </button>
    <button className="ask" onClick={() => openCodo(CODOS[0])}><Icon name="search" size={19} /><span>{t({ es: "Pregunta directo a un documento\u2026", en: "Ask a document directly\u2026" })}</span></button>

    <div className="sec-lab"><Icon name="folder-tree" size={14} />{t({ es: "Tus CoDos", en: "Your CoDos" })}<span className="cnt">{CODOS.length} {t({ es: "con acceso", en: "with access" })}</span></div>
    {CODOS.map(c => <button key={c.key} className="codo-card" onClick={() => openCodo(c)}>
      <span className="ci"><Icon name={c.icon} size={24} /></span>
      <div style={{ minWidth: 0 }}><div className="cid">{c.id}</div><div className="cn">{c.name}</div>
        <div className="cm"><span className="badge-vivo"><span className="bd" />{c.docs} {t({ es: "docs vivos", en: "live docs" })}</span><span>·</span><span>{c.loc}</span></div></div>
      <span className="car"><Icon name="chevron-right" size={20} /></span>
    </button>)}

    <div className="sec-lab" style={{ marginTop: 22 }}><Icon name="bookmark" size={14} />{t({ es: "Consultas guardadas", en: "Saved queries" })}</div>
    {saved.length === 0
      ? <div style={{ fontSize: 13.5, color: "var(--fg-subtle)", padding: "4px 4px 0", lineHeight: 1.5 }}>{t({ es: "A\u00fan no guardas consultas. Toca ", en: "No saved queries yet. Tap " })}<b>{t({ es: "Guardar", en: "Save" })}</b>{t({ es: " en una respuesta para tenerla a la mano.", en: " on an answer to keep it handy." })}</div>
      : saved.slice(0, 3).map((s, i) => <button key={i} className="saved-q" onClick={() => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)}>
          <span className="qi"><Icon name="bookmark" size={17} /></span>
          <div style={{ minWidth: 0 }}><div className="qt">{s.q}</div><div className="qm">{s.codoId}</div></div>
          <span className="car"><Icon name="chevron-right" size={18} /></span>
        </button>)}

    <div className="readonly-note"><Icon name="info" size={16} />{t({ es: "Como colaborador, consultas y guardas — la organizaci\u00f3n gestiona los documentos y los CoDos.", en: "As a collaborator, you consult and save — the organization manages the documents and CoDos." })}</div>
  </div>;
}

function ColabMobileSaved({ saved, openCodo }) {
  const [run, setRun] = useState(false);
  const isPlaybook = saved.length >= PB_MIN;
  if (run) return <div className="ph-body"><PlaybookRun items={saved} onBack={() => setRun(false)} /></div>;
  return <div className="ph-body">
    <div className="scr-head">{isPlaybook ? t({ es: "Tus consultas", en: "Your queries" }) : t({ es: "Consultas guardadas", en: "Saved queries" })}</div>
    <div className="scr-sub">{t({ es: "Tus respuestas a la mano, con su cita a la fuente.", en: "Your answers at hand, with their citation to the source." })}</div>
    {saved.length === 0
      ? <div className="empty-thread"><Icon name="bookmark" size={26} /><p>{t({ es: "A\u00fan no guardas consultas.", en: "No saved queries yet." })}<br />{t({ es: "Toca ", en: "Tap " })}<b>{t({ es: "Guardar", en: "Save" })}</b>{t({ es: " en cualquier respuesta.", en: " on any answer." })}</p></div>
      : <>{saved.map((s, i) => <button key={i} className="saved-q" onClick={() => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)}>
          {isPlaybook ? <span className="pb-listnum">{i + 1}</span> : <span className="qi"><Icon name="bookmark" size={17} /></span>}
          <div style={{ minWidth: 0 }}><div className="qt">{s.q}</div><div className="qm">{s.codoId} · {s.cite}</div></div>
          <span className="car"><Icon name="chevron-right" size={18} /></span>
        </button>)}
        {isPlaybook && <PlaybookNudge onRun={() => setRun(true)} />}</>}
  </div>;
}

function ColabMobilePerfil() {
  return <div className="ph-body">
    <div className="scr-head">{t({ es: "Perfil", en: "Profile" })}</div>
    <div className="scr-sub">{t({ es: "Tu cuenta de colaborador.", en: "Your collaborator account." })}</div>
    <div className="prof"><div className="pav">AR</div><div><div className="pn">Andrés Ríos</div><div className="pr">{t({ es: "COLABORADOR · ENTRA POR QR", en: "COLLABORATOR · ENTERS BY QR" })}</div></div></div>
    <div className="prof-row"><Icon name="globe" size={19} />{t({ es: "Idioma", en: "Language" })}<span className="pv">{window.__LANG === "en" ? "EN-US" : "ES-MX"}</span></div>
    <div className="prof-row"><Icon name="sparkles" size={19} />{t({ es: "Sugerencias de IA", en: "AI suggestions" })}<span className="pv">{t({ es: "Activadas", en: "On" })}</span></div>
    <div className="prof-row"><Icon name="building-2" size={19} />{t({ es: "Organizaci\u00f3n", en: "Organization" })}<span className="pv">Laboratorio Estándar</span></div>
    <div className="prof-row"><Icon name="bell" size={19} />{t({ es: "Notificaciones", en: "Notifications" })}<span className="pv">{t({ es: "Solo alertas", en: "Alerts only" })}</span></div>
    <div className="readonly-note"><Icon name="info" size={16} />{t({ es: "No gestionas documentos ni CoDos. Si necesitas acceso a un equipo, p\u00eddelo a tu admin de organizaci\u00f3n.", en: "You don\u2019t manage documents or CoDos. If you need access to equipment, ask your organization admin." })}</div>
  </div>;
}

const COLAB_TABS = [["home", "Inicio", "house"], ["scan", "Escanear", "scan-line"], ["saved", "Guardadas", "bookmark"], ["perfil", "Perfil", "user"]];
const COLAB_TAB_EN = { home: "Home", scan: "Scan", saved: "Saved", perfil: "Profile" };

function ColabMobile({ saved, toggleSave }) {
  const [tab, setTab] = useState("home");
  const [consult, setConsult] = useState(null);
  const openCodo = (codo, initialKey) => setConsult({ codo, initialKey });

  let body;
  if (consult) body = <MobileConsult codo={consult.codo} initialKey={consult.initialKey} back={() => setConsult(null)} saved={saved} toggleSave={toggleSave} />;
  else if (tab === "home") body = <ColabMobileHome go={setTab} openCodo={openCodo} saved={saved} />;
  else if (tab === "scan") body = <MobileScan pick={openCodo} />;
  else if (tab === "saved") body = <ColabMobileSaved saved={saved} openCodo={openCodo} />;
  else body = <ColabMobilePerfil />;

  const activeTab = consult ? null : tab;
  return <div className="dy-mobile">
    <MobileStatus />
    <div className="ph-top"><Mark size={22} /><span className="w">DOCYAN</span><span className="lde">LDE</span>
      <button className={"av" + (tab === "perfil" && !consult ? " on" : "")} onClick={() => { setConsult(null); setTab("perfil"); }}>AR</button></div>
    {body}
    <div className="tabbar">{COLAB_TABS.map(tb => <button key={tb[0]} className={"tab" + (tb[0] === "scan" ? " scan" : "") + (activeTab === tb[0] ? " on" : "")}
      onClick={() => { setConsult(null); setTab(tb[0]); }}><Icon name={tb[2]} size={tb[0] === "scan" ? 30 : 24} />{t({ es: tb[1], en: COLAB_TAB_EN[tb[0]] })}</button>)}</div>
  </div>;
}

Object.assign(window, { MobileStatus, MobileAnswerCard, MobileConsult, MobileScan, ColabMobile });
