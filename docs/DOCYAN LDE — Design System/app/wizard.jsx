/* DOCYAN — Crear CoDo wizard (content; vive dentro del shell de org, ruta hija de CoDos) */

function StepEntidad({ codo, set }) {
  const CRITS = [["sec", "Seguridad ≥0.95"], ["cal", "Calidad ≥0.85"], ["op", "Operacional ≥0.75"]];
  return <div className="panel">
    <div className="sec-eyebrow">Paso 1 · Entidad</div>
    <div className="sec-lead"><h2>Define la entidad del CoDo</h2>
      <p>Un CoDo agrupa todos los documentos que describen una entidad — un equipo, un proceso o un lugar. Empieza por nombrarla; los colaboradores la verán al escanear el QR.</p></div>
    <div className="form-grid">
      <div className="field col2"><label>Nombre de la entidad <span className="req">*</span></label>
        <input value={codo.nombre} placeholder="Ej. Mezcladora de concreto MAXI-10ND" onChange={e => set({ nombre: e.target.value })} /></div>
      <div className="field"><label>ID del CoDo · auto</label>
        <span className="id-chip"><Icon name="hash" size={14} />{codo.id}</span>
        <span className="hint">Generado por vertical y secuencia. Editable más tarde.</span></div>
      <div className="field"><label>Tipo / categoría</label>
        <input value={codo.tipo} placeholder="Ej. Revolvedora para concreto · CIPSA" onChange={e => set({ tipo: e.target.value })} /></div>
      <div className="field"><label>Ubicación / área</label>
        <input value={codo.ubicacion} placeholder="Ej. Obra · cuadrilla 2" onChange={e => set({ ubicacion: e.target.value })} /></div>
      <div className="field"><label>Vertical</label>
        <div className="selbox" onClick={() => set({ vertical: VERTICALES[(VERTICALES.indexOf(codo.vertical) + 1) % VERTICALES.length] })}>{codo.vertical}<Icon name="chevron-down" size={15} /></div>
        <span className="hint">Define umbrales de gobernanza y plantilla de segmentos.</span></div>
      <div className="field col2"><label>Par lingüístico default</label>
        <div className="chips">{PARES.map(p => <button key={p} className={"chip" + (codo.par === p ? " on" : "")} onClick={() => set({ par: p })}>{p}</button>)}</div></div>
      <div className="field col2"><label><Icon name="shield-check" size={12} />Criticidad del segmento de seguridad</label>
        <div className="chips">{CRITS.map(([k, l]) => <button key={k} className={"chip crit" + (codo.crit === k ? " on" : "")} onClick={() => set({ crit: k })}><Icon name={k === "sec" ? "shield-alert" : k === "cal" ? "badge-check" : "settings"} size={14} />{l}</button>)}</div>
        <span className="hint">Confianza mínima del caché para emitir respuesta. Seguridad exige el umbral más alto.</span></div>
    </div>
  </div>;
}

function StepDocumentos({ codo, addDoc, removeDoc }) {
  const [q, setQ] = useState("");
  const added = new Set(codo.docs.map(d => d.id));
  const filtered = ACERVO.filter(d => d.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="panel">
    <div className="sec-eyebrow">Paso 2 · Documentos</div>
    <div className="sec-lead"><h2>Vincula los documentos de la entidad</h2>
      <p>Relaciona documentos ya ingeridos en tu acervo, o sube nuevos. Esto es lo que vuelve consultable al CoDo — cada respuesta citará a uno de estos documentos.</p></div>
    <div className="docs-grid">
      <div>
        <div className="col-head"><h3>Acervo disponible</h3><span className="cnt">{filtered.length} documentos vivos</span></div>
        <div className="acervo-search"><Icon name="search" size={15} /><input value={q} placeholder="Filtra tu acervo…" onChange={e => setQ(e.target.value)} /></div>
        {filtered.map(d => {
          const isAdded = added.has(d.id);
          return <div key={d.id} className={"doc-pick" + (isAdded ? " added" : "")} onClick={() => !isAdded && addDoc(d)}>
            <span className="di"><Icon name="file-text" size={17} /></span>
            <div style={{ minWidth: 0 }}><div className="dn">{d.name}<span className="dlang">{d.lang}</span></div>
              <div className="dm">{d.kind} · {d.pages} {d.pages === 1 ? "pág" : "págs"} · <span className="badge-vivo"><span className="bd" />vivo</span></div></div>
            <span className="act"><Icon name={isAdded ? "check" : "plus"} size={16} /></span>
          </div>;
        })}
        <div className="dropzone"><Icon name="upload-cloud" size={24} />
          <div className="dz-t">Arrastra o <b>sube documentos nuevos</b></div>
          <div className="dz-m">PDF · DOCX · XLSX · imágenes con OCR — se ingieren y se vinculan al CoDo</div></div>
      </div>
      <div>
        <div className="col-head"><h3>Documentos de este CoDo</h3><span className="cnt">{codo.docs.length} vinculados</span></div>
        <div className="set-panel">
          {codo.docs.length === 0
            ? <div className="empty-set"><Icon name="folder-plus" size={24} /><p>Aún no vinculas documentos.<br />Elige del acervo o sube nuevos a la izquierda.</p></div>
            : codo.docs.map(d => <div key={d.id} className="set-doc">
                <span className="di"><Icon name="file-text" size={17} /></span>
                <div style={{ minWidth: 0 }}><div className="dn">{d.name}</div><div className="dm">{SEG_LABEL[d.seg]} · {d.lang}</div></div>
                <button className="rm" onClick={() => removeDoc(d.id)}><Icon name="x" size={15} /></button>
              </div>)}
        </div>
      </div>
    </div>
  </div>;
}

function StepRelaciones({ codo, moveDoc }) {
  return <div className="panel">
    <div className="sec-eyebrow">Paso 3 · Relaciones</div>
    <div className="sec-lead"><h2>Organiza el expediente del CoDo</h2>
      <p>Agrupa los documentos por segmento. Así verá el colaborador la entidad, y así aplica DOCYAN la criticidad de gobernanza a cada respuesta.</p></div>
    <div className="seg-cols">
      {SEGMENTS.map(seg => {
        const docs = codo.docs.filter(d => d.seg === seg.key);
        return <div key={seg.key} className="seg-card">
          <div className="sh"><span className="si"><Icon name={seg.icon} size={15} /></span><span className="stt">{seg.label}</span>
            <span className={"scrit " + seg.crit}>{seg.crit === "sec" ? "Seguridad ≥0.95" : "Operacional ≥0.75"}</span></div>
          {docs.length === 0 ? <div className="seg-empty">Sin documentos en este segmento.</div>
            : docs.map(d => {
              const nextSeg = SEGMENTS[(SEGMENTS.findIndex(s => s.key === d.seg) + 1) % SEGMENTS.length];
              return <div key={d.id} className="rel-doc"><span className="di"><Icon name="file-text" size={15} /></span>
                <div style={{ minWidth: 0 }}><div className="dn">{d.name}</div><div className="dm">{d.kind} · {d.lang}</div></div>
                <button className="move" onClick={() => moveDoc(d.id, nextSeg.key)} title={"Mover a " + nextSeg.label}><Icon name="corner-down-right" size={13} />Mover</button></div>;
            })}
        </div>;
      })}
    </div>
  </div>;
}

function StepPublicar({ codo, fmt, setFmt }) {
  const FMTS = ["Etiqueta 5×5cm", "Placa 10×10cm", "Lámina A5"];
  const segCount = SEGMENTS.filter(s => codo.docs.some(d => d.seg === s.key)).length;
  const critLabel = codo.crit === "sec" ? "Seguridad ≥0.95" : codo.crit === "cal" ? "Calidad ≥0.85" : "Operacional ≥0.75";
  return <div className="panel">
    <div className="sec-eyebrow">Paso 4 · Publicar</div>
    <div className="sec-lead"><h2>Revisa y genera el QR persistente</h2>
      <p>El QR es la puerta del colaborador al CoDo. Al crear, se imprime y se pega físicamente en la entidad.</p></div>
    <div className="pub-grid">
      <div>
        <div className="summary-row"><span className="sl">Entidad</span><span className="sv">{codo.nombre || "—"}</span></div>
        <div className="summary-row"><span className="sl">ID del CoDo</span><span className="sv" style={{ fontFamily: "var(--font-mono)" }}>{codo.id}</span></div>
        <div className="summary-row"><span className="sl">Tipo · ubicación</span><span className="sv">{codo.tipo || "—"} · {codo.ubicacion || "—"}</span></div>
        <div className="summary-row"><span className="sl">Vertical</span><span className="sv">{codo.vertical}</span></div>
        <div className="summary-row"><span className="sl">Documentos</span><span className="sv"><Icon name="files" size={14} />{codo.docs.length} vivos · {segCount} segmentos</span></div>
        <div className="summary-row"><span className="sl">Par lingüístico</span><span className="sv">{codo.par}</span></div>
        <div className="summary-row"><span className="sl">Criticidad seguridad</span><span className="sv"><span className="chip crit on" style={{ cursor: "default", padding: "5px 11px" }}><Icon name="shield-alert" size={13} />{critLabel}</span></span></div>
      </div>
      <div className="qr-card">
        <div className="qh">Previsualización del QR</div>
        <QRPlate seed={7} label={codo.id + " · " + (codo.nombre || "entidad sin nombre")} />
        <div className="seg-lab" style={{ marginTop: 16 }}>Formato físico</div>
        <div className="fmt-seg">{FMTS.map((f, i) => <button key={f} className={fmt === i ? "on" : ""} onClick={() => setFmt(i)}>{f}</button>)}</div>
      </div>
    </div>
  </div>;
}

const WIZ_STEPS = [["Entidad", "nombre + metadatos"], ["Documentos", "vincular acervo"], ["Relaciones", "organizar expediente"], ["Publicar", "revisar + QR"]];
const BLANK_CODO = { id: "CODO-OBR-07", nombre: "", tipo: "", ubicacion: "", vertical: VERTICALES[0], par: PARES[1], crit: "sec", docs: [] };
const PREFILL_CODO = { ...BLANK_CODO, nombre: "Mezcladora de concreto MAXI-10ND", tipo: "Revolvedora para concreto · CIPSA", ubicacion: "Obra · cuadrilla 2", docs: ACERVO.slice(0, 3).map(d => ({ ...d })) };

function CrearCoDo({ onExit, prefill }) {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [codo, setCodo] = useState(prefill ? PREFILL_CODO : { ...BLANK_CODO });
  const [fmt, setFmt] = useState(1);
  const [created, setCreated] = useState(false);

  const set = (patch) => setCodo(c => ({ ...c, ...patch }));
  const addDoc = (d) => setCodo(c => c.docs.some(x => x.id === d.id) ? c : ({ ...c, docs: [...c.docs, { ...d }] }));
  const removeDoc = (id) => setCodo(c => ({ ...c, docs: c.docs.filter(d => d.id !== id) }));
  const moveDoc = (id, seg) => setCodo(c => ({ ...c, docs: c.docs.map(d => d.id === id ? { ...d, seg } : d) }));
  const canNext = step === 0 ? codo.nombre.trim().length > 0 : step === 1 ? codo.docs.length > 0 : true;
  const next = () => { if (step < 3) { const n = step + 1; setStep(n); setMaxStep(m => Math.max(m, n)); } };

  if (created) return <div className="wrap"><div className="done-card">
    <div className="dic"><Icon name="check" size={30} /></div>
    <h1>CoDo creado</h1>
    <div className="dcodo">{codo.id} · {codo.nombre}</div>
    <p>{codo.docs.length} documentos vivos quedaron vinculados y consultables. Imprime el QR y pégalo en la entidad para que los colaboradores entren.</p>
    <div className="done-acts">
      <button className="btn btn-primary"><Icon name="printer" size={16} />Imprimir QR</button>
      <button className="btn btn-ghost" onClick={() => onExit()}><Icon name="folder-tree" size={16} />Ver CoDos</button>
    </div>
  </div></div>;

  return <div className="wrap">
    <div className="goal-strip">
      <span className="gs-ic"><Icon name="disc-3" size={20} /></span>
      <div className="gs-t"><span className="gs-codo">{codo.id} · nuevo</span>
        <span className={"gs-name" + (codo.nombre ? "" : " ph")}>{codo.nombre || "Entidad sin nombre"}</span></div>
      <div className="gs-facts">
        <span className="gs-fact"><Icon name="files" size={13} />{codo.docs.length} docs</span>
        <span className="gs-fact warn"><Icon name="shield-alert" size={13} />{codo.crit === "sec" ? "Seguridad ≥0.95" : codo.crit === "cal" ? "Calidad ≥0.85" : "Operacional ≥0.75"}</span>
      </div>
    </div>
    <div className="stepper">
      {WIZ_STEPS.map(([t, m], i) => <React.Fragment key={i}>
        <div className={"step" + (i === step ? " on" : "") + (i < step ? " done" : "")} onClick={() => { if (i <= maxStep) setStep(i); }}>
          <span className="sn">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
          <div><div className="st">{t}</div><div className="stm">{m}</div></div>
        </div>
        {i < 3 && <div className={"step-line" + (i < step ? " done" : "")} />}
      </React.Fragment>)}
    </div>
    {step === 0 && <StepEntidad codo={codo} set={set} />}
    {step === 1 && <StepDocumentos codo={codo} addDoc={addDoc} removeDoc={removeDoc} />}
    {step === 2 && <StepRelaciones codo={codo} moveDoc={moveDoc} />}
    {step === 3 && <StepPublicar codo={codo} fmt={fmt} setFmt={setFmt} />}
    <div className="foot">
      {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><Icon name="arrow-left" size={16} />Atrás</button>
        : <button className="btn btn-ghost" onClick={() => onExit()}><Icon name="x" size={16} />Cancelar</button>}
      {step < 3
        ? <button className="btn btn-primary" disabled={!canNext} onClick={next}>Siguiente<Icon name="arrow-right" size={16} /></button>
        : <button className="btn btn-primary" onClick={() => setCreated(true)}><Icon name="check" size={16} />Crear CoDo y generar QR</button>}
      <button className="btn btn-draft">Guardar borrador</button>
    </div>
  </div>;
}

Object.assign(window, { CrearCoDo });
