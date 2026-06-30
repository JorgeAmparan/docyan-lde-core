/* DOCYAN — answer card + consult view (shared org + colaborador web) */

function AnswerCard({ a, saved, onSave }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOpen(true), 340); return () => clearTimeout(id); }, []);
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  return <div className="answer">
    <div className={"mode" + (a.mode === "synth" ? " synth" : "")}><span className="pulse" />{a.mode === "synth" ? "Respuesta sintetizada" : "Respuesta instantánea · caché"}</div>
    <div className="acard"><div className="q">{a.q}</div>
      {a.value ? <><div className="big">{a.value}<span className="u">{a.unit}</span></div><p className="note">{a.note}</p></>
        : <p className="note" style={{ fontSize: 14, color: "var(--fg)" }}>{a.text}</p>}
      <div className="citerow"><button className="cite2" onClick={() => setOpen(o => !o)}><span className="brk" />{a.cite} · pág. {a.page} ↗</button>
        <button className="openpdf"><Icon name="external-link" size={13} />Abrir PDF</button>
        {onSave && <button className={"savebtn" + (saved ? " on" : "")} onClick={onSave}><Icon name={saved ? "check" : "bookmark"} size={14} />{saved ? "Guardada" : "Guardar"}</button>}</div>
      {open && a.span && <div className="src"><span className="thr" /><div className="src2">
        <div className="s-head"><Icon name="file-text" size={12} /><span>Fragmento original</span><span className="pg">pág. {a.page}</span></div>
        <div className="s-span">{parts ? <>{parts[0]}<mark>{a.mark}</mark>{parts[1]}</> : a.span}</div>
        {a.lang !== "ES" && <span className="s-orig"><Icon name="globe" size={11} />Documento original en inglés · preguntaste en español</span>}
        <div className="s-actions"><span className="s-ped"><Icon name="shield-check" size={12} />Pedigree a span · SHA-256</span>
          <button className="openpdf"><Icon name="external-link" size={13} />Abrir PDF</button></div>
      </div></div>}
    </div>
  </div>;
}

/* Consult view: doctabs + contexto/sugeridas-por-documento + "Tus consultas" (izq) + hilo + limpiar (der).
   Paridad con la versión final de Shell-A. */
const CONSULT_LS = "docyan_proto_userq";
const OBS_LS = "docyan_proto_obs";
function ConsultView({ codo, initialKey, saved, toggleSave }) {
  const c = codo || CODOS[0];
  const [docIdx, setDocIdx] = useState(0);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const [userQ, setUserQ] = useState(() => { try { return JSON.parse(localStorage.getItem(CONSULT_LS)) || {}; } catch (e) { return {}; } });
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState("");
  const [savedKeys, setSavedKeys] = useState([]);
  const [obs, setObs] = useState(() => { try { return JSON.parse(localStorage.getItem(OBS_LS)) || {}; } catch (e) { return {}; } });
  const [obsAdding, setObsAdding] = useState(false);
  const [obsVal, setObsVal] = useState("");
  const threadRef = useRef(null);
  const doc = c.docList[docIdx] || c.docList[0];
  const mine = userQ[doc.key] || [];
  const misObs = obs[c.id] || [];

  useEffect(() => { localStorage.setItem(CONSULT_LS, JSON.stringify(userQ)); }, [userQ]);
  useEffect(() => { localStorage.setItem(OBS_LS, JSON.stringify(obs)); }, [obs]);
  useEffect(() => { const el = threadRef.current; if (el) el.scrollTop = el.scrollHeight; }, [thread]);

  const addObs = () => { const v = obsVal.trim(); if (!v) return; setObs(o => ({ ...o, [c.id]: [...(o[c.id] || []), { t: v, at: t({ es: "ahora", en: "now" }) }] })); setObsVal(""); setObsAdding(false); };
  const delObs = (i) => setObs(o => ({ ...o, [c.id]: (o[c.id] || []).filter((_, k) => k !== i) }));

  const ask = (label, key) => {
    const a = ANSWERS[key] || { q: label, text: "En el producto real, DOCYAN clasifica la intención y responde con cita a la fuente.", mode: "synth", cite: doc.name + " · §", page: "—", span: null, lang: "ES" };
    setThread(t => [...t, { role: "u", text: label }, { role: "a", a, id: Date.now() + Math.random() }]);
  };
  const addUser = () => { const v = addVal.trim(); if (!v) return; setUserQ(u => ({ ...u, [doc.key]: [...(u[doc.key] || []), v] })); setAddVal(""); setAdding(false); ask(v, null); };
  const delUser = (i) => setUserQ(u => ({ ...u, [doc.key]: (u[doc.key] || []).filter((_, k) => k !== i) }));
  const saveFromCard = (m) => {
    if (savedKeys.includes(m.id)) return;
    setSavedKeys(s => [...s, m.id]);
    setUserQ(u => ({ ...u, [doc.key]: [...(u[doc.key] || []), m.a.q] }));
    if (toggleSave && !(saved && saved.some(s => s.q === m.a.q))) toggleSave(m.a, c);
  };
  useEffect(() => { if (initialKey && ANSWERS[initialKey]) ask(ANSWERS[initialKey].q, initialKey); /* eslint-disable-next-line */ }, [c.key]);

  return <div className="consult-wrap">
    <div className="ctxbar"><div className="eyebrow"><span className="dot" />{t({ es: "Consultando", en: "Consulting" })} · {c.id}</div><h1>{c.name}</h1></div>
    <div className="doctabs">{c.docList.map((d, i) =>
      <button key={d.key} className={"doctab" + (i === docIdx ? " on" : "")} onClick={() => setDocIdx(i)}><Icon name="file-text" size={14} />{d.name}<span className="lt">{d.lang}</span></button>)}
    </div>
    <div className="cwrap">
      <div className="col-left">
        <div className="doc-card2"><div className="dh"><span className="di"><Icon name={doc.icon || "file-text"} size={19} /></span>
          <div style={{ minWidth: 0 }}><div className="dn">{doc.name}</div><div className="dm">{doc.meta} · {t({ es: "idioma", en: "language" })} {doc.lang}</div>
            {doc.tipo && SCHEMA_BY_ID[doc.tipo] && <span className="doc-tipo"><span className={"sev-dot " + ESTADO_META[SCHEMA_BY_ID[doc.tipo].estado].sev} />{SCHEMA_BY_ID[doc.tipo].label}</span>}</div></div>
          <span className="badge-vivo"><span className="bd" />{t({ es: "documento vivo", en: "live document" })}</span></div>
        <div className="cb-group"><div className="cb-lab"><Icon name="sparkles" size={13} />{t({ es: "Sugeridas por DOCYAN", en: "Suggested by DOCYAN" })}</div>
          {(doc.sugs || []).map((s, i) => <button className="sug" key={i} onClick={() => ask(s[1], s[2])}><Icon name={s[0]} size={15} /><span className="tx">{s[1]}</span><span className="ar">→</span></button>)}
        </div>
        <div className="cb-group"><div className="cb-lab"><Icon name="bookmark" size={13} />{t({ es: "Tus consultas", en: "Your queries" })}</div>
          {mine.map((q, i) => <button className="sug saved" key={i} onClick={() => ask(q, Object.keys(ANSWERS).find(k => ANSWERS[k].q === q))}><Icon name="bookmark" size={15} /><span className="tx">{q}</span><span className="del" onClick={(e) => { e.stopPropagation(); delUser(i); }}><Icon name="x" size={13} /></span></button>)}
          {adding
            ? <div className="add-row"><input autoFocus value={addVal} placeholder={t({ es: "Escribe una consulta para guardar\u2026", en: "Type a query to save\u2026" })} onChange={e => setAddVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addUser(); if (e.key === "Escape") setAdding(false); }} /><button className="ok" onClick={addUser}><Icon name="check" size={16} /></button></div>
            : <button className="add-q" onClick={() => setAdding(true)}><Icon name="plus" size={15} />{t({ es: "Agregar consulta", en: "Add query" })}</button>}
        </div>
        <div className="cb-group"><div className="cb-lab"><Icon name="pencil-line" size={13} />{t({ es: "Observaciones", en: "Observations" })}</div>
          <p className="obs-hint">{t({ es: "Anota algo que viste en el equipo. Queda registrado en la entidad; no es una instrucción, es tu nota.", en: "Note something you saw on the equipment. It's logged on the entity; not an instruction, your note." })}</p>
          {misObs.map((o, i) => <div className="obs-item" key={i}><span className="obs-ic"><Icon name="message-square-text" size={14} /></span><div style={{ minWidth: 0, flex: 1 }}><div className="obs-t">{o.t}</div><div className="obs-m">{t({ es: "tú", en: "you" })} · {o.at}</div></div><button className="obs-del" onClick={() => delObs(i)}><Icon name="x" size={13} /></button></div>)}
          {obsAdding
            ? <div className="add-row"><input autoFocus value={obsVal} placeholder={t({ es: "Ej. holgura en el acople motor-eje\u2026", en: "E.g. play in the motor-shaft coupling\u2026" })} onChange={e => setObsVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addObs(); if (e.key === "Escape") setObsAdding(false); }} /><button className="ok" onClick={addObs}><Icon name="check" size={16} /></button></div>
            : <button className="add-q" onClick={() => setObsAdding(true)}><Icon name="plus" size={15} />{t({ es: "Anotar observaci\u00f3n", en: "Add observation" })}</button>}
        </div>
      </div>
      <div className="col-right">
        <div className="threadbar"><span className="tb-l"><Icon name="messages-square" size={14} />{t({ es: "Conversaci\u00f3n", en: "Conversation" })} · {doc.name}</span>{thread.length > 0 && <button className="clearbtn" onClick={() => setThread([])}><Icon name="eraser" size={14} />{t({ es: "Limpiar conversaci\u00f3n", en: "Clear conversation" })}</button>}</div>
        <div className="thread" ref={threadRef}>
          {thread.length === 0 && <div className="empty"><Icon name="message-circle-question" size={26} /><p>{t({ es: "Toca una consulta sugerida o escribe tu pregunta sobre ", en: "Tap a suggested query or type your question about " })}<b>{doc.name}</b>. {t({ es: "La respuesta llega con su cita a la fuente.", en: "The answer arrives with its citation to the source." })}</p></div>}
          {thread.map((m, i) => m.role === "u"
            ? <div className="bubble" key={i}>{m.text}</div>
            : <AnswerBody key={m.id} a={m.a} saved={savedKeys.includes(m.id)} onSave={() => saveFromCard(m)} />)}
        </div>
        <form className="qbar" onSubmit={e => { e.preventDefault(); const v = text.trim(); if (v) { ask(v, null); setText(""); } }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={t({ es: "Pregunta sobre " + doc.name + "\u2026", en: "Ask about " + doc.name + "\u2026" })} />
          <button type="submit" className="send"><Icon name="arrow-up" size={16} /></button>
        </form>
      </div>
    </div>
  </div>;
}

Object.assign(window, { AnswerCard, ConsultView });
