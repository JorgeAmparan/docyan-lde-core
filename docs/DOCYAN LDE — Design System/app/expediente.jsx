/* DOCYAN — C3 · Expediente esquemático del CoDo (superficie de inmersión del experto).
   README §7: un objeto cognitivo —la entidad y sus relaciones inmediatas— no un dashboard.
   Cuatro condiciones: (1) META CLARA = goal strip siempre visible · (2) FEEDBACK
   INSTANTÁNEO = seleccionar un nodo revela su detalle sin espera · (3) RETO AJUSTABLE
   = densidad compacto/detallado · (4) AGENCIA TOTAL = sugerencias EDB a demanda, nunca
   empujadas. Solo escritorio (el colaborador consulta; el experto navega el acervo). */

/* relaciones inmediatas por CoDo — el resto se deriva de codo.docList */
const EXP_RELATIONS = {
  maxi10: [
    { id: "cal", ic: "ruler", t: "Calibración del motor", tag: "vigente", sev: "ok", note: "2300–2400 rpm · última 18 may · A. Ríos", meta: "CAL-OBR-03" },
    { id: "alert", ic: "alarm-clock", t: "Calibración por vencer", tag: "≤ 7 días", sev: "warn", note: "Vence 02 jul · recordatorio administrativo", meta: "CAL-22-117" },
    { id: "bit", ic: "history", t: "Bitácora de mantenimiento", tag: "12 entradas", sev: "muted", note: "Aceite SAE-30 · banda en V · ciclo de trabajo", meta: "MTTO-OBR" },
  ],
  lab04: [
    { id: "cal", ic: "ruler", t: "Calibración de la centrífuga", tag: "por vencer", sev: "warn", note: "Vence en 4 días · certificado CAL-22-117", meta: "CAL-22-117" },
    { id: "msds", ic: "shield-alert", t: "MSDS del refrigerante", tag: "vigente", sev: "ok", note: "Expira 25 jul · seguridad & MSDS", meta: "MSDS-REF-03" },
    { id: "ver", ic: "git-branch", t: "Versiones del manual", tag: "rev. D vigente", sev: "muted", note: "Rev. C → D · cambia el torque del perno B", meta: "Δ §4.2.1" },
    { id: "rel", ic: "link", t: "Entidad relacionada · rotor de ángulo fijo", tag: "6 × 50 ml", sev: "muted", note: "Comparte diagnóstico de vibración y diagrama", meta: "ENT-ROT-380" },
  ],
  maq02: [
    { id: "cal", ic: "ruler", t: "Calibración del husillo", tag: "vigente", sev: "ok", note: "Última 11 may · dentro de tolerancia", meta: "CAL-MAQ-09" },
    { id: "ver", ic: "git-branch", t: "Versiones del manual VF-2", tag: "rev. D vigente", sev: "muted", note: "Rev. C → D · perno B 80 → 85 N·m", meta: "Δ §4.2.1" },
    { id: "ref", ic: "shield-alert", t: "Refrigerante · filtro", tag: "procedimiento", sev: "muted", note: "Cambio con LOTO · alojamiento presurizado", meta: "§7.3" },
  ],
};

const SEV_DOT = { ok: "var(--success-600)", warn: "var(--warning-600)", caution: "#C0820F", muted: "var(--fg-subtle)" };

function ExpedienteView({ codo, onConsult, onBack }) {
  const [sel, setSel] = useState({ type: "entity" });
  const [den, setDen] = useState("detallado");      // reto ajustable
  const [edb, setEdb] = useState(false);            // EDB a demanda (agencia total)
  const compact = den === "compacto";
  const rels = EXP_RELATIONS[codo.key] || [];
  const docs = codo.docList || [];
  const isDoc = (d) => sel.type === "doc" && sel.doc.key === d.key;
  const isRel = (r) => sel.type === "rel" && sel.rel.id === r.id;

  return <div className="exp">
    {/* META CLARA — goal strip siempre visible */}
    <div className="exp-strip">
      <button className="exp-back" onClick={onBack}><Icon name="arrow-left" size={17} /></button>
      <div className="exp-strip-t">
        <div className="exp-eyebrow"><span className="dot" />EXPEDIENTE · {codo.id}{codo.alert ? " · 2 alertas" : ""}</div>
        <div className="exp-name">{codo.name}</div>
      </div>
      <div className="exp-den" role="group" aria-label="Densidad">
        <button className={compact ? "" : "on"} onClick={() => setDen("detallado")}>Detallado</button>
        <button className={compact ? "on" : ""} onClick={() => setDen("compacto")}>Compacto</button>
      </div>
      <button className="btn btn-primary exp-consult" onClick={onConsult}><Icon name="messages-square" size={15} />Consultar</button>
    </div>

    <div className="exp-body">
      {/* navegación granular del acervo */}
      <aside className="exp-tree">
        <div className="exp-tg">Entidad</div>
        <button className={"exp-node" + (sel.type === "entity" ? " on" : "")} onClick={() => setSel({ type: "entity" })}>
          <span className="en-ic"><Icon name={codo.icon} size={17} /></span><span className="en-t">{codo.name}</span></button>

        <div className="exp-tg">Acervo · {docs.length} docs</div>
        {docs.map(d => <button key={d.key} className={"exp-node" + (isDoc(d) ? " on" : "")} onClick={() => setSel({ type: "doc", doc: d })}>
          <span className="en-ic doc"><Icon name={d.icon || "file-text"} size={16} /></span>
          <span className="en-t">{d.name}<span className="en-m">{d.lang} · {d.meta}</span></span></button>)}

        <div className="exp-tg">Relaciones inmediatas</div>
        {rels.map(r => <button key={r.id} className={"exp-node" + (isRel(r) ? " on" : "")} onClick={() => setSel({ type: "rel", rel: r })}>
          <span className="en-ic"><Icon name={r.ic} size={16} /></span>
          <span className="en-t">{r.t}<span className="en-tag" style={{ color: SEV_DOT[r.sev] }}>{r.tag}</span></span></button>)}
      </aside>

      {/* FEEDBACK INSTANTÁNEO — el detalle del nodo seleccionado */}
      <main className="exp-detail">
        {sel.type === "entity" && <div className="exp-entity">
          <div className="ee-head"><span className="ee-ic"><Icon name={codo.icon} size={30} /></span>
            <div><div className="ee-id">{codo.id}</div><h2>{codo.name}</h2>
              <div className="ee-meta">{codo.loc} · {codo.docs} docs vivos · {codo.colab} colaboradores · {codo.consultas} consultas</div></div></div>

          {!compact && <p className="ee-lead">El objeto de trabajo: esta entidad y sus relaciones inmediatas. Navega el acervo a la izquierda; cada nodo revela su detalle aquí. Para preguntar en lenguaje natural con cita a la fuente, entra a <button className="ee-link" onClick={onConsult}>Consultar</button>.</p>}

          <div className="ee-grid">
            <div className="ee-card"><div className="ee-cl"><Icon name="files" size={14} />Acervo por segmento</div>
              <div className="ee-chips">{docs.map(d => <span className="ee-chip" key={d.key} onClick={() => setSel({ type: "doc", doc: d })}><Icon name={d.icon || "file-text"} size={13} />{d.name}</span>)}</div></div>
            <div className="ee-card"><div className="ee-cl"><Icon name="git-branch" size={14} />Relaciones</div>
              <div className="ee-rels">{rels.map(r => <button className="ee-rel" key={r.id} onClick={() => setSel({ type: "rel", rel: r })}>
                <span className="rd" style={{ background: SEV_DOT[r.sev] }} /><span className="rt">{r.t}</span><span className="rtag">{r.tag}</span></button>)}</div></div>
          </div>

          <div className="ee-qr"><QRPlate size={92} seed={3} /><div className="ee-qrt"><div className="ee-qrl">QR PERSISTENTE</div>
            <div className="ee-qrn">La puerta del colaborador a este CoDo</div>
            {!compact && <div className="ee-qrm">Pegado en el equipo · escanear abre la consulta de esta entidad</div>}</div></div>
        </div>}

        {sel.type === "doc" && <DocDetail doc={sel.doc} codo={codo} compact={compact} onConsult={onConsult} />}
        {sel.type === "rel" && <RelDetail rel={sel.rel} compact={compact} />}
      </main>
    </div>

    {/* AGENCIA TOTAL — EDB a demanda, visible pero nunca empujado */}
    <div className={"exp-edb" + (edb ? " open" : "")}>
      <button className="edb-toggle" onClick={() => setEdb(e => !e)}>
        <Icon name="sparkles" size={15} /><span>Sugerencias de DOCYAN</span><span className="edb-hint">a demanda</span>
        <Icon name={edb ? "chevron-down" : "chevron-up"} size={16} /></button>
      {edb && <div className="edb-panel">
        <div className="edb-item"><Icon name="repeat" size={15} /><div><b>3 colaboradores</b> repiten la misma secuencia de arranque en esta entidad. Podría volverse un Playbook.</div></div>
        <div className="edb-item"><Icon name="message-square" size={15} /><div>Las consultas de <b>calibración</b> suben antes de cada auditoría — patrón estacional.</div></div>
        <div className="edb-foot"><Icon name="info" size={13} />Las sugerencias viven aquí, a demanda. DOCYAN no interrumpe tu trabajo.</div>
      </div>}
    </div>
  </div>;
}

function DocDetail({ doc, codo, compact, onConsult }) {
  const [recursos, setRecursos] = useState([{ titulo: "Recorrido en video — " + doc.name, dur: "4:20", caps: 3 }]);
  const adjuntar = () => dcModal({
    icon: "video", title: "Adjuntar video de apoyo",
    body: "El video se sirve como apoyo del documento — DOCYAN no lo analiza ni lo transcribe. Pega el enlace y, si quieres, marca capítulos para saltar a una sección.",
    confirm: "Adjuntar video", doneTitle: "Video adjuntado", doneBody: "Aparece como recurso de apoyo; el colaborador lo ve junto a la respuesta.",
    onConfirm: () => setRecursos(r => [...r, { titulo: "Video de apoyo " + (r.length + 1), dur: "—", caps: 0 }]),
  });
  return <div className="exp-doc">
    <div className="ed-head"><span className="ed-ic"><Icon name={doc.icon || "file-text"} size={24} /></span>
      <div><div className="ed-eyebrow">DOCUMENTO · {doc.lang}</div><h2>{doc.name}</h2>
        <div className="ed-meta">{doc.meta} · documento vivo</div></div></div>
    {!compact && <div className="ed-row"><span className="badge-vivo"><span className="bd" />vivo</span><span className="ed-seg">Acervo de {codo.name}</span></div>}
    <div className="ed-block"><div className="ed-bl"><Icon name="sparkles" size={13} />Consultas sugeridas sobre este documento</div>
      {(doc.sugs || []).map((s, i) => <button key={i} className="ed-sug" onClick={onConsult}><Icon name={s[0]} size={15} /><span>{s[1]}</span><Icon name="arrow-right" size={14} /></button>)}</div>
    <div className="ed-block"><div className="ed-bl"><Icon name="video" size={13} />Recursos de apoyo<span className="ed-bl-note">no se analizan · se sirven junto al documento</span></div>
      {recursos.map((rc, i) => <div className="rec-item" key={i}><span className="rec-ic"><Icon name="play" size={14} /></span>
        <div style={{ minWidth: 0, flex: 1 }}><div className="rec-t">{rc.titulo}</div><div className="rec-m">{rc.dur !== "—" ? rc.dur + " · " : ""}{rc.caps > 0 ? rc.caps + " capítulos" : "video de apoyo"}</div></div>
        <Icon name="external-link" size={14} color="var(--fg-subtle)" /></div>)}
      <button className="add-q" onClick={adjuntar}><Icon name="plus" size={15} />Adjuntar video</button>
    </div>
    <button className="btn btn-primary ed-cta" onClick={onConsult}><Icon name="messages-square" size={15} />Consultar este documento</button>
  </div>;
}

function RelDetail({ rel, compact }) {
  return <div className="exp-rel">
    <div className="er-head"><span className="er-ic" style={{ color: SEV_DOT[rel.sev] }}><Icon name={rel.ic} size={24} /></span>
      <div><div className="er-eyebrow">RELACIÓN · {rel.meta}</div><h2>{rel.t}</h2>
        <span className="er-tag" style={{ color: SEV_DOT[rel.sev], borderColor: "currentColor" }}>{rel.tag}</span></div></div>
    {!compact && <p className="er-note">{rel.note}</p>}
    {rel.sev === "warn" && <div className="er-banner"><Icon name="info" size={14} />Recordatorio administrativo — no es una instrucción operativa.</div>}
    <div className="er-cite"><span className="brk" />{rel.meta} ↗</div>
  </div>;
}

Object.assign(window, { ExpedienteView });
