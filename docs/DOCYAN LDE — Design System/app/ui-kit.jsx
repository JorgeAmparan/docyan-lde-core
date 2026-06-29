/* DOCYAN — B · UI kit del prototipo: modal global de acciones, dropdown custom y
   búsqueda command-palette. Todo por eventos globales (no se pasa props por el árbol).
   Montar <DCModalHost/>, <DCSearchHost/> una vez. Disparar con dispatch de eventos. */

/* ---------- Modal global de acciones ---------- */
/* dispara: window.dispatchEvent(new CustomEvent('dc-modal',{detail:{icon,title,body,confirm,onConfirm,tone}})) */
function dcModal(detail) { window.dispatchEvent(new CustomEvent("dc-modal", { detail })); }
function DCModalHost() {
  const [m, setM] = useState(null);
  useEffect(() => { const h = e => setM(e.detail); window.addEventListener("dc-modal", h); return () => window.removeEventListener("dc-modal", h); }, []);
  if (!m) return null;
  const close = () => setM(null);
  const done = m.done;
  return <div className="dcm-scrim" onClick={close}>
    <div className="dcm" onClick={e => e.stopPropagation()}>
      <button className="dcm-x" onClick={close}><Icon name="x" size={18} /></button>
      <div className={"dcm-ic" + (done ? " ok" : "")}><Icon name={done ? "check" : (m.icon || "info")} size={24} /></div>
      <div className="dcm-t">{done ? (m.doneTitle || m.title) : m.title}</div>
      {(done ? m.doneBody : m.body) && <div className="dcm-b">{done ? m.doneBody : m.body}</div>}
      <div className="dcm-acts">
        {!done && m.confirm
          ? <>
              <button className="btn btn-ghost" onClick={close}>{t({ es: "Cancelar", en: "Cancel" })}</button>
              <button className={"btn " + (m.tone === "danger" ? "btn-danger" : "btn-primary")} onClick={() => { if (m.onConfirm) m.onConfirm(); if (m.doneTitle) setM({ ...m, done: true }); else close(); }}>{m.confirm}</button>
            </>
          : <button className="btn btn-primary" onClick={close}>{t({ es: "Entendido", en: "Got it" })}</button>}
      </div>
    </div>
  </div>;
}

/* ---------- Dropdown custom (reemplaza los sel-box que no abrían) ---------- */
function Dropdown({ value, options, onChange, icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find(o => (o.v ?? o) === value) || options[0];
  const lab = cur ? (cur.l ?? cur) : "";
  return <div className={"dc-dd" + (open ? " open" : "")} ref={ref}>
    <button type="button" className="dc-dd-btn" onClick={() => setOpen(o => !o)}>
      {icon && <Icon name={icon} size={15} />}<span className="dc-dd-lab">{lab}</span><Icon name="chevron-down" size={15} />
    </button>
    {open && <div className="dc-dd-menu">{options.map((o, i) => { const v = o.v ?? o, l = o.l ?? o; return (
      <button type="button" key={i} className={"dc-dd-item" + (v === value ? " on" : "")} onClick={() => { onChange && onChange(v); setOpen(false); }}>
        <span>{l}</span>{v === value && <Icon name="check" size={15} />}</button>); })}</div>}
  </div>;
}

/* ---------- Búsqueda command-palette ---------- */
/* índice de documentos con su CoDo (derivado de CODOS) */
function dcSearchIndex() {
  const out = [];
  CODOS.forEach(c => (c.docList || []).forEach(d => out.push({ kind: "doc", name: d.name, lang: d.lang, codo: c, docKey: d.key })));
  CODOS.forEach(c => out.push({ kind: "codo", name: c.name, codo: c }));
  return out;
}
/* abrir: window.dispatchEvent(new CustomEvent('dc-search-open',{detail:{onDoc,onCodo,onAsk,placeholder}})) */
function DCSearchHost() {
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState("");
  const inRef = useRef(null);
  useEffect(() => { const h = e => { setCfg(e.detail); setQ(""); }; window.addEventListener("dc-search-open", h); return () => window.removeEventListener("dc-search-open", h); }, []);
  useEffect(() => { if (cfg && inRef.current) inRef.current.focus(); }, [cfg]);
  if (!cfg) return null;
  const close = () => setCfg(null);
  const idx = dcSearchIndex();
  const ql = q.trim().toLowerCase();
  const hits = ql ? idx.filter(x => x.name.toLowerCase().includes(ql) || x.codo.id.toLowerCase().includes(ql)) : idx;
  const docs = hits.filter(x => x.kind === "doc").slice(0, 6);
  const codos = hits.filter(x => x.kind === "codo").slice(0, 4);
  const pick = (fn, ...args) => { close(); fn && fn(...args); };
  return <div className="dcs-scrim" onClick={close}>
    <div className="dcs" onClick={e => e.stopPropagation()}>
      <div className="dcs-bar"><Icon name="search" size={18} />
        <input ref={inRef} value={q} onChange={e => setQ(e.target.value)} placeholder={cfg.placeholder || t({ es: "Busca un documento, un CoDo, o pregunta directo…", en: "Search a document, a CoDo, or ask directly…" })}
          onKeyDown={e => { if (e.key === "Escape") close(); if (e.key === "Enter" && ql) pick(cfg.onAsk, q.trim()); }} />
        <kbd className="dcs-esc">esc</kbd></div>
      <div className="dcs-body">
        {ql && cfg.onAsk && <button className="dcs-ask" onClick={() => pick(cfg.onAsk, q.trim())}>
          <span className="dcs-ic cin"><Icon name="messages-square" size={16} /></span>
          <span className="dcs-asktxt">{t({ es: "Preguntar", en: "Ask" })}: <b>“{q.trim()}”</b></span><Icon name="corner-down-left" size={15} /></button>}
        {docs.length > 0 && <div className="dcs-grp">{t({ es: "Documentos", en: "Documents" })}</div>}
        {docs.map((x, i) => <button className="dcs-row" key={"d" + i} onClick={() => pick(cfg.onDoc, x.codo, x.docKey)}>
          <span className="dcs-ic"><Icon name="file-text" size={16} /></span>
          <span className="dcs-rtxt"><span className="dcs-rn">{x.name}</span><span className="dcs-rm"><span className="dcs-codo">{x.codo.id}</span>{x.codo.name} · {x.lang}</span></span>
          <Icon name="arrow-right" size={15} /></button>)}
        {codos.length > 0 && <div className="dcs-grp">CoDos</div>}
        {codos.map((x, i) => <button className="dcs-row" key={"c" + i} onClick={() => pick(cfg.onCodo, x.codo)}>
          <span className="dcs-ic"><Icon name={x.codo.icon} size={16} /></span>
          <span className="dcs-rtxt"><span className="dcs-rn">{x.codo.name}</span><span className="dcs-rm"><span className="dcs-codo">{x.codo.id}</span>{x.codo.docs} docs · {x.codo.loc}</span></span>
          <Icon name="arrow-right" size={15} /></button>)}
        {docs.length === 0 && codos.length === 0 && !ql && <div className="dcs-empty">{t({ es: "Escribe para buscar en tus CoDos y documentos.", en: "Type to search your CoDos and documents." })}</div>}
        {docs.length === 0 && codos.length === 0 && ql && !cfg.onAsk && <div className="dcs-empty">{t({ es: "Sin resultados.", en: "No results." })}</div>}
      </div>
    </div>
  </div>;
}
function dcSearch(detail) { window.dispatchEvent(new CustomEvent("dc-search-open", { detail })); }

Object.assign(window, { DCModalHost, dcModal, Dropdown, DCSearchHost, dcSearch });
