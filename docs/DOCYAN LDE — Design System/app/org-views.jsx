/* DOCYAN — org views restantes: Ingesta · QRs · Usuarios · Alertas · Gobernanza & FAT · Plan */

/* ---------- Ingesta · Cotizador (Modelo Comercial Canónico v1.1) ----------
   Setup por ingesta · Modelo 2: el cliente carga a su ritmo. Cupo del tier
   cubre las primeras N ($0); el excedente se cotiza con la fórmula y se cobra
   al método de pago al confirmar. NADA de saldo prepagado. */

const PHASES = INGEST_PHASES;

function IngestBatch({ docs, onExit }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(x => x + 1), 700); return () => clearInterval(id); }, []);
  const total = docs.length * PHASES.length;
  const done = Math.min(t, total);
  const pct = Math.round((done / total) * 100);
  const finished = done >= total;
  const docState = (i) => {
    const startedAt = i * PHASES.length;
    if (done <= startedAt) return { st: "enc", phase: null };
    if (done >= startedAt + PHASES.length) return { st: "done", phase: null };
    return { st: "proc", phase: PHASES[done - startedAt] };
  };
  return <div className="wrap">
    {finished
      ? <div className="chain" style={{ marginBottom: 16 }}><div className="ci2"><Icon name="check" size={18} /></div>
          <div><div className="ct">Lote completado · {docs.length} documentos vivos</div><div className="cm">Listos para consultar en CODO-OBR-07</div></div>
          <button onClick={onExit}>Ver CoDo</button></div>
      : <div className="batch-head">
          <div className="bh-row"><div><div className="bh-h">Ingiriendo lote · {docs.length} documentos</div><div className="bh-sub">Procesando <b>{docs[Math.min(Math.floor(done / PHASES.length), docs.length - 1)].name}</b></div></div>
            <div className="bh-eta"><div className="bh-eta-big mono">~{Math.max(1, Math.round((total - done) * 0.7 / 6))} min</div><div className="bh-eta-sm">restante</div></div></div>
          <div className="batch-bar"><i style={{ width: pct + "%" }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", display: "flex", justifyContent: "space-between" }}><span>{pct}% del lote</span><span className="mono">{done}/{total} fases</span></div>
        </div>}
    {docs.map((d, i) => { const s = docState(i); const sch = SCHEMA_BY_ID[d.tipo]; return <div key={i} className={"idoc " + (s.st === "done" ? "done" : s.st === "proc" ? "live" : "")}>
      <span className={"idoc-ic " + (s.st === "done" ? "done" : s.st === "proc" ? "live" : "")}><Icon name={s.st === "done" ? "check" : "file-text"} size={16} /></span>
      <div style={{ minWidth: 0 }}><div className="idoc-name">{d.name}</div><div className="idoc-sub">{(sch ? sch.label : "extracción genérica")} · {d.fmt} · {d.pages} {d.pages === 1 ? "pág" : "págs"}</div></div>
      <span className={"idoc-st " + s.st}>{s.st === "done" ? "completado" : s.st === "proc" ? s.phase : "en cola"}</span>
    </div>; })}
  </div>;
}

const RESUELTO_META = {
  heuristica:     { ic: "scan-line", txt: "clasificado automáticamente" },
  usuario:        { ic: "user-check", txt: "corregido por ti" },
  worker_generara:{ ic: "sparkles",  txt: "el worker generará el schema" },
};

/* Una tarjeta de cotización: tipo clasificado + corrección + avisos + precio. */
function CotizaCard({ cot, tipo, resuelto, onTipo }) {
  const sch = SCHEMA_BY_ID[tipo];
  const est = sch ? ESTADO_META[sch.estado] : ESTADO_META.falta;
  const sinSchema = !sch || sch.estado === "falta";
  const conf = Math.round(cot.confianza * 100);
  const rmeta = RESUELTO_META[resuelto] || RESUELTO_META.heuristica;
  const opts = SCHEMAS.map(s => ({ v: s.id, l: s.label + (s.estado !== "activo" ? "  · " + ESTADO_META[s.estado].label.toLowerCase() : "") }));
  return <div className={"cot-card" + (cot.excedente ? " excede" : "")}>
    <div className="ct-head">
      <span className="ct-ic"><Icon name="file-text" size={16} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="ct-name">{cot.name}</div>
        <div className="ct-meta">{cot.fmt} · {cot.pages} {cot.pages === 1 ? "pág" : "págs"} · {cot.mb.toFixed(1)} MB · {(cot.tokens / 1000).toFixed(1)}k tokens</div>
      </div>
      <div className="ct-price">
        {cot.excedente
          ? <><span className="price-chip cobro">${cot.precioSetupUsd.toFixed(2)}</span><div className="ct-price-sub">excede el cupo</div></>
          : <><span className="price-chip incluido"><Icon name="check" size={13} />Incluido</span><div className="ct-price-sub">en tu plan · $0</div></>}
      </div>
    </div>
    <div className="ct-type">
      <span className="type-badge"><span className={"sev-dot " + est.sev} /><span className="tb-label">{sch ? sch.label : "Tipo no reconocido"}</span><span className="tb-fase">{sch ? sch.estado : "genérica"}</span></span>
      <span className="ct-resuelto"><Icon name={rmeta.ic} size={13} />{rmeta.txt}</span>
      <span className="ct-conf"><span className="ct-conf-bar"><i className={conf < 75 ? "lo" : ""} style={{ width: conf + "%" }} /></span><span className="ct-conf-v">{conf}%</span></span>
    </div>
    <div className="ct-correct">
      <span className="ccl"><Icon name="pencil" size={13} />Corregir tipo</span>
      <Dropdown value={tipo} options={opts} icon="shapes" onChange={(v) => onTipo(v)} />
    </div>
    {sinSchema && <div className="cot-notice gen"><Icon name="alert-triangle" size={15} /><span><b>Sin schema dedicado todavía</b> — se ingiere con <b>extracción genérica</b> y un schema generado al vuelo. Pierdes la ontología normativa específica de este tipo, pero el documento queda consultable con cita a la fuente.</span></div>}
    {cot.ocr && <div className="cot-notice ocr"><Icon name="scan" size={15} /><span>Documento escaneado: el extractor ligero pudo subestimar el texto. El worker re-mide con OCR; <b>el costo real puede variar</b>.</span></div>}
  </div>;
}

/* Modo conectado: elegir una fuente, conectarla y traer documentos (ingest_sources). */
function FuentesPanel({ fuenteSel, setFuenteSel }) {
  const sel = FUENTES.find(f => f.id === fuenteSel);
  if (sel) {
    const conectado = sel.estado === "conectado";
    return <div className="fuente-detail">
      <button className="fuente-back" onClick={() => setFuenteSel(null)}><Icon name="arrow-left" size={15} />Fuentes</button>
      <div className="fuente-head">
        <span className="fuente-ic"><Icon name={sel.icon} size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><div className="fuente-l">{sel.label}</div><div className="fuente-d">{conectado ? "Conectado · " + sel.cuenta : sel.desc}</div></div>
        <span className={"badge " + (conectado ? "ok" : "")}>{conectado ? "Conectado" : "Sin conectar"}</span>
      </div>
      {conectado
        ? <>
            <div className="sec-h2" style={{ marginTop: 4 }}><h2>Documentos en la fuente</h2><span className="cnt">{FUENTE_DOCS.length} detectados · {sel.docs} en total</span></div>
            {FUENTE_DOCS.map(d => <div className="fuente-doc" key={d.id}>
              <span className="fd-ic"><Icon name="file-text" size={15} /></span>
              <div style={{ minWidth: 0, flex: 1 }}><div className="fd-n">{d.name}</div><div className="fd-m">{d.fmt} · {d.mb.toFixed(1)} MB · <span className="mono">{d.ruta}</span></div></div>
              <button className="mini-btn" onClick={() => dcModal({ icon: "calculator", title: "Cotizar documento", body: "Se trae “" + d.name + "” desde " + sel.label + " y se añade al lote para cotizar antes de ingerir.", confirm: "Añadir al lote", doneTitle: "Añadido al lote", doneBody: "El documento se clasifica y cotiza junto al resto del lote." })}><Icon name="plus" size={13} />Al lote</button>
            </div>)}
            <div className="manual-note" style={{ marginTop: 12 }}><Icon name="info" size={15} />DOCYAN complementa tu repositorio — <b>no lo reemplaza</b>. Trae copias para hacerlas consultables; nada se mueve ni se borra en la fuente.</div>
          </>
        : <>
            <div className="fuente-form">
              {sel.id === "ftp"
                ? <><div className="field2"><label>Host</label><input className="codigo-input" placeholder="sftp.lab-estandar.mx" /></div>
                    <div className="field2"><label>Usuario</label><input className="codigo-input" placeholder="docyan" /></div>
                    <div className="field2"><label>Ruta remota</label><input className="codigo-input" placeholder="/documentos/normas" /></div></>
                : <div className="field2"><label>{sel.id === "notion" ? "Token de integración" : "Carpeta / biblioteca a monitorear"}</label><input className="codigo-input" placeholder={sel.id === "notion" ? "secret_…" : "ID o enlace de la carpeta"} /></div>}
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => dcModal({ icon: sel.icon, title: "Conectar " + sel.label, body: "Se valida la conexión y, al confirmar, DOCYAN lista los documentos de la fuente para cotizarlos. Las credenciales se guardan cifradas.", confirm: "Conectar", doneTitle: "Fuente conectada", doneBody: "Ya puedes traer documentos de " + sel.label + " al lote." })}><Icon name="plug" size={15} />Conectar {sel.label}</button>
            <div className="manual-note" style={{ marginTop: 12 }}><Icon name="shield" size={15} />Credenciales cifradas, por tenant. Solo lectura de la carpeta que elijas — sin acceso al resto.</div>
          </>}
    </div>;
  }
  return <div className="fuentes-grid">
    {FUENTES.map(f => <button key={f.id} className={"fuente-card" + (f.estado === "conectado" ? " conectado" : "")} onClick={() => setFuenteSel(f.id)}>
      <span className="fuente-ic"><Icon name={f.icon} size={20} /></span>
      <div style={{ minWidth: 0, flex: 1 }}><div className="fuente-l">{f.label}</div><div className="fuente-d">{f.estado === "conectado" ? sel_resumen(f) : f.desc}</div></div>
      {f.estado === "conectado" ? <span className="fuente-dot ok" title="Conectado" /> : <Icon name="chevron-right" size={16} color="var(--fg-subtle)" />}
    </button>)}
  </div>;
}
function sel_resumen(f) { return "Conectado · " + f.docs + " documentos"; }

function IngestaView() {
  const [started, setStarted] = useState(false);
  const [modo, setModo] = useState("subir"); // "subir" | "conectar"
  const [fuenteSel, setFuenteSel] = useState(null);
  // estado de corrección de tipo por documento (regla transversal #1)
  const [tipos, setTipos] = useState(() => Object.fromEntries(COTIZACIONES.map(c => [c.id, c.tipo])));
  const [resueltos, setResueltos] = useState(() => Object.fromEntries(COTIZACIONES.map(c => [c.id, c.resuelto])));
  const [showFormula, setShowFormula] = useState(false);
  const setTipo = (id, v) => { setTipos(s => ({ ...s, [id]: v })); setResueltos(s => ({ ...s, [id]: "usuario" })); };

  const incluidas = COTIZACIONES.filter(c => !c.excedente);
  const excedentes = COTIZACIONES.filter(c => c.excedente);
  const totalCobro = excedentes.reduce((a, c) => a + c.precioSetupUsd, 0);
  const cupoTrasLote = Math.max(0, CUPO_DEMO.restante - incluidas.length);
  const docsConTipo = COTIZACIONES.map(c => ({ ...c, tipo: tipos[c.id] }));

  if (started) return <IngestBatch docs={docsConTipo} onExit={() => setStarted(false)} />;

  return <div className="wrap">
    {/* Cupo del plan */}
    <div className="cupo-banner">
      <span className="cupo-ic"><Icon name="package-check" size={20} /></span>
      <div className="cupo-main">
        <div className="cupo-t">Tu plan incluye ingestas sin costo · te quedan <b>{CUPO_DEMO.restante} de {CUPO_DEMO.recurrente}</b> este mes</div>
        <div className="cupo-m">Las primeras del lote entran en tu cupo; los <b>adicionales desde ${SETUP.pisoUsd}</b> se cotizan antes de cobrar. Tú decides cuántos documentos cargas y cuándo.</div>
        <div className="cupo-pips">{Array.from({ length: CUPO_DEMO.recurrente }).map((_, i) => <span key={i} className={"cupo-pip " + (i < CUPO_DEMO.recurrente - CUPO_DEMO.restante ? "used" : (i < CUPO_DEMO.recurrente - cupoTrasLote ? "free" : ""))} />)}</div>
      </div>
      <span className="cupo-tier">Profesional</span>
    </div>

    <div className="ing-grid">
      {/* Análisis del lote */}
      <div>
        <div className="ing-modes">
          <button className={"ing-mode" + (modo === "subir" ? " on" : "")} onClick={() => setModo("subir")}><Icon name="upload-cloud" size={15} />Subir documentos</button>
          <button className={"ing-mode" + (modo === "conectar" ? " on" : "")} onClick={() => setModo("conectar")}><Icon name="plug" size={15} />Conectar una fuente</button>
        </div>
        {modo === "subir"
          ? <div className="dropzone2" style={{ marginBottom: 16 }}><Icon name="upload-cloud" size={26} /><div className="dz-t">Arrastra documentos o <b>selecciona</b></div><div className="dz-m">PDF · DOCX · XLSX · imágenes con OCR · hasta 10 por lote</div></div>
          : <FuentesPanel fuenteSel={fuenteSel} setFuenteSel={setFuenteSel} />}
        <div className="sec-h2"><h2>Análisis del lote</h2><span className="cnt">{COTIZACIONES.length} documentos · MAXI-10ND</span></div>
        {COTIZACIONES.map(c => <CotizaCard key={c.id} cot={c} tipo={tipos[c.id]} resuelto={resueltos[c.id]} onTipo={(v) => setTipo(c.id, v)} />)}
      </div>

      {/* Resumen + cobro */}
      <div>
        <div className="panel">
          <div className="sec-h2"><h2>Resumen de la ingesta</h2></div>
          <div className="sum-rows">
            <div className="sum-row"><span>Documentos en el lote</span><b>{COTIZACIONES.length}</b></div>
            <div className="sum-row"><span>Incluidos en tu cupo</span><b style={{ color: "var(--success-600)" }}>{incluidas.length} · $0</b></div>
            <div className="sum-row"><span>Adicionales (× ${SETUP.pisoUsd} piso)</span><b>{excedentes.length}</b></div>
            <div className="sum-row"><span>Tiempo estimado</span><b>~{Math.max(1, Math.round(COTIZACIONES.reduce((a, c) => a + c.tiempoSeg, 0) / 60))} min</b></div>
            <div className="sum-row total"><span>Total a cobrar</span><b>${totalCobro.toFixed(2)}</b></div>
          </div>
          <div className="pay-dest">
            <span className="pdi"><Icon name="credit-card" size={16} /></span>
            <div style={{ minWidth: 0 }}><div className="pdn">{COBRO_DOCYAN.metodoDefault}</div><div className="pdm">método de pago · destino del cobro</div></div>
            <span className="pd-edit">Cambiar</span>
          </div>
          <div className="manual-note"><Icon name="info" size={15} />Cobro <b>manual durante el piloto</b>; Stripe se activa tras los primeros clientes. El monto se reserva al confirmar y se liquida al costo real al completar.</div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setStarted(true)}><Icon name="play" size={15} />Confirmar e ingerir{totalCobro > 0 ? " — $" + totalCobro.toFixed(2) : " — sin costo"}</button>
          <p style={{ fontSize: 11.5, color: "var(--fg-subtle)", lineHeight: 1.5, margin: "12px 0 0", textAlign: "center" }}>Nada se ingiere sin tu confirmación. El precio se ve antes de cobrar.</p>

          <div className="formula-box">
            <button className="formula-h" onClick={() => setShowFormula(v => !v)}><Icon name="function-square" size={14} />Cómo se calcula el precio<Icon name="chevron-right" size={15} color="var(--fg-subtle)" className="chev" /></button>
            {showFormula && <div className="formula-body">
              <p style={{ margin: "0 0 9px" }}>El precio se ancla al <b>valor</b>, no al cómputo (centavos por documento). El cupo del plan cubre las primeras; al excedente se le aplica:</p>
              <p style={{ margin: "0 0 11px", textAlign: "center" }}><code>MAX(${SETUP.pisoUsd}, costo × {SETUP.multiplicador}) × {SETUP.factorComplejidad.toFixed(1)}</code></p>
              <div className="fb-line"><span>Piso mínimo</span><b>${SETUP.pisoUsd}.00</b></div>
              <div className="fb-line"><span>Multiplicador sobre costo</span><b>×{SETUP.multiplicador}</b></div>
              <div className="fb-line"><span>Factor de complejidad</span><b>{SETUP.factorComplejidad.toFixed(1)}</b></div>
              <p style={{ margin: "9px 0 0", color: "var(--fg-subtle)" }}>Para casi todo gana el piso; solo documentos enormes (300+ págs, OCR pesado) activan el ×{SETUP.multiplicador}. El tipo documental no cambia el precio — el costo se mide por tokens.</p>
            </div>}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

/* ---------- Inteligencia organizacional (Playbooks B/C · mo.py) ---------- */
function InteligenciaView() {
  const [sugs, setSugs] = useState(SUGERENCIAS);
  const [pbs, setPbs] = useState(PLAYBOOKS);
  const [runId, setRunId] = useState(null);

  const aceptar = (s) => dcModal({
    icon: "git-branch", title: "Aceptar como Playbook",
    body: "Se crea un Playbook con los " + s.pasos.length + " pasos de esta secuencia. Quedará en tu biblioteca para correrlo cuando lo necesites; cada paso conserva su cita a la fuente.",
    confirm: "Crear Playbook", doneTitle: "Playbook creado", doneBody: "Lo encuentras abajo, en tu biblioteca de Playbooks.",
    onConfirm: () => {
      setPbs(p => [{ id: "pbn" + s.id, nombre: s.titulo, descripcion: s.detalle, codo: s.codo, origen: "sugerencia", corridas: 0, pasos: s.pasos }, ...p]);
      setSugs(list => list.filter(x => x.id !== s.id));
    },
  });
  const rechazar = (s) => setSugs(list => list.filter(x => x.id !== s.id));
  const ignorar = (s) => setSugs(list => list.filter(x => x.id !== s.id));
  const borrarPb = (p) => dcModal({ icon: "trash-2", title: "Borrar Playbook", body: "Se elimina “" + p.nombre + "” de tu biblioteca. Las consultas guardadas que lo componen no se borran.", confirm: "Borrar", tone: "danger", doneTitle: "Playbook borrado", onConfirm: () => setPbs(list => list.filter(x => x.id !== p.id)) });

  const runPb = pbs.find(p => p.id === runId);
  if (runPb) return <div className="wrap"><div style={{ maxWidth: 660 }}>
    <PlaybookRun items={runPb.pasos.map(s => ({ ...s, codoId: runPb.codo, cite: runPb.codo }))} onBack={() => setRunId(null)} />
  </div></div>;

  return <div className="wrap">
    <div className="admin-banner"><Icon name="sparkles" size={15} />Inteligencia a demanda — DOCYAN detecta patrones de uso, pero <b>no interrumpe</b>. Tú decides qué se vuelve rutina. Nada se ejecuta sin que lo aceptes.</div>

    {/* Nivel C — Sugerencias */}
    <div className="sec-h2" style={{ marginTop: 18 }}><h2>Sugerencias</h2><span className="cnt">{sugs.length} pendientes · patrones detectados</span></div>
    {sugs.length === 0
      ? <div className="panel" style={{ textAlign: "center", color: "var(--fg-subtle)", fontSize: 13.5, padding: "26px 16px" }}>Sin sugerencias pendientes. Aparecen cuando el grafo detecta un patrón de uso repetido.</div>
      : sugs.map(s => <div className="sug-card" key={s.id}>
          <span className="sug-ic"><Icon name={s.icon} size={17} /></span>
          <div className="sug-body">
            <div className="sug-t">{s.titulo}</div>
            <div className="sug-d">{s.detalle}</div>
            <div className="sug-meta"><span className="codo-pill">{s.codo}</span><span className="sug-ev"><Icon name="activity" size={12} />{s.evidencia}</span><span className="sug-steps"><Icon name="list" size={12} />{s.pasos.length} pasos</span></div>
          </div>
          <div className="sug-acts">
            <button className="btn btn-primary sm" onClick={() => aceptar(s)}><Icon name="git-branch" size={14} />Aceptar como Playbook</button>
            <div className="sug-acts2">
              <button className="sug-ghost" onClick={() => rechazar(s)} title="No es útil — descartar">Rechazar</button>
              <button className="sug-ghost" onClick={() => ignorar(s)} title="Recuérdame después">Ignorar</button>
            </div>
          </div>
        </div>)}

    {/* Nivel B — Biblioteca de Playbooks */}
    <div className="sec-h2" style={{ marginTop: 22 }}><h2>Playbooks</h2><button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => dcModal({ icon: "plus", title: "Nuevo Playbook", body: "Encadena tus consultas guardadas en una secuencia con nombre. También puedes sembrar Playbooks típicos de tu industria.", confirm: "Crear desde consultas guardadas", doneTitle: "Listo", doneBody: "Selecciona las consultas y su orden para componer el Playbook." })}><Icon name="plus" size={14} />Nuevo Playbook</button></div>
    {pbs.length === 0
      ? <div className="panel" style={{ textAlign: "center", color: "var(--fg-subtle)", fontSize: 13.5, padding: "26px 16px" }}>Aún no tienes Playbooks. Acepta una sugerencia o crea uno desde tus consultas guardadas.</div>
      : <div className="pb-grid">{pbs.map(p => <div className="pb-card" key={p.id}>
          <div className="pb-card-h">
            <span className="pb-card-ic"><Icon name="git-branch" size={16} /></span>
            <div style={{ minWidth: 0, flex: 1 }}><div className="pb-card-n">{p.nombre}</div><div className="pb-card-d">{p.descripcion}</div></div>
            {p.origen === "sugerencia" && <span className="pb-origen" title="Nació de una sugerencia aceptada"><Icon name="sparkles" size={11} />de sugerencia</span>}
          </div>
          <div className="pb-steps">{p.pasos.map((s, i) => <div className="pb-step-mini" key={i}><span className="pb-step-n">{i + 1}</span>{s.q}</div>)}</div>
          <div className="pb-card-foot">
            <span className="pb-card-meta"><span className="codo-pill">{p.codo}</span><span className="mono" style={{ fontSize: 11, color: "var(--fg-subtle)" }}>{p.corridas} corridas</span></span>
            <div className="pb-card-acts">
              <button className="pb-act" title="Editar" onClick={() => dcModal({ icon: "pencil", title: "Editar Playbook", body: "Renombra, reordena o quita pasos de “" + p.nombre + "”.", confirm: "Guardar cambios", doneTitle: "Cambios guardados" })}><Icon name="pencil" size={14} /></button>
              <button className="pb-act danger" title="Borrar" onClick={() => borrarPb(p)}><Icon name="trash-2" size={14} /></button>
              <button className="btn btn-primary sm" onClick={() => setRunId(p.id)}><Icon name="play" size={13} />Correr</button>
            </div>
          </div>
        </div>)}</div>}
  </div>;
}

/* ---------- Documentos vivos (mis_documentos · B13) ---------- */
function DocumentosView() {
  const [docs, setDocs] = useState(DOCS_VIVOS);
  const borrar = (d) => dcModal({
    icon: "trash-2", title: "Eliminar documento vivo",
    body: "Se elimina “" + d.name + "” del grafo, sin residuo, y se libera una posición de tu cupo. El evento queda en la bitácora FAT (auditoría), aunque el contenido deje de ser consultable. Para reemplazarlo, vuelve a ingerirlo.",
    confirm: "Eliminar y liberar cupo", doneTitle: "Documento eliminado",
    doneBody: "Liberaste una posición de cupo. El registro del borrado quedó en el FAT.", tone: "danger",
    onConfirm: () => setDocs(ds => ds.filter(x => x.id !== d.id)),
  });
  return <div className="wrap">
    <div className="sec-h2"><h2>Documentos vivos</h2><span className="cnt">{docs.length} consultables · plan Profesional · cupo ilimitado</span></div>
    <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>Todo lo que ingieres queda aquí, consultable y citado. Eliminar un documento lo borra del grafo <b>sin residuo</b> y libera cupo del plan; el borrado se registra en el FAT.</p>
    <div className="panel" style={{ padding: 0 }}>
      <div className="dv-head">
        <span className="dv-c-name">Documento</span>
        <span className="dv-c-tipo">Tipo documental</span>
        <span className="dv-c-codo">CoDo</span>
        <span className="dv-c-meta">Detalle</span>
        <span className="dv-c-act"></span>
      </div>
      {docs.map(d => { const sch = SCHEMA_BY_ID[d.tipo]; const est = sch ? ESTADO_META[sch.estado] : null; return <div className="dv-row" key={d.id}>
        <span className="dv-c-name"><span className="dv-ic"><Icon name="file-text" size={15} /></span><span style={{ minWidth: 0 }}><span className="dv-n">{d.name}</span><span className="dv-sub">{d.lang} · {d.ver} · {d.pages} {d.pages === 1 ? "pág" : "págs"}</span></span></span>
        <span className="dv-c-tipo">{sch ? <span className="dv-tipo"><span className={"sev-dot " + est.sev} />{sch.label}</span> : <span className="dv-tipo muted">genérico</span>}</span>
        <span className="dv-c-codo"><span className="codo-pill">{d.codo}</span></span>
        <span className="dv-c-meta mono">{d.ts}</span>
        <span className="dv-c-act"><button className="dv-del" title="Eliminar y liberar cupo" onClick={() => borrar(d)}><Icon name="trash-2" size={15} /></button></span>
      </div>; })}
      {docs.length === 0 && <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--fg-subtle)", fontSize: 13.5 }}>No quedan documentos vivos. Ingiere desde <b>Ingesta</b> para empezar.</div>}
    </div>
    <div className="manual-note" style={{ marginTop: 14 }}><Icon name="shield-check" size={15} />Reemplazar = eliminar + volver a ingerir. Al borrar liberas cupo; luego cargas otro dentro del límite. El rastro auditable se conserva 7 años aunque canceles.</div>
  </div>;
}

/* ---------- Generar QRs ---------- */
function QRsView() {
  const [sel, setSel] = useState(0);
  const [fmt, setFmt] = useState(1);
  const QC = CODOS.map(c => ({ v: c.id, l: c.id + " · " + c.name }));
  const [qc, setQc] = useState(CODOS[0].id);
  const FMTS = ["Etiqueta 5×5cm", "Placa 10×10cm", "Lámina A5"];
  return <div className="wrap"><div className="ing-grid">
    <div className="panel">
      <div className="sec-h2"><h2>Nuevo QR persistente</h2></div>
      <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>El QR es la puerta del colaborador al CoDo. Pégalo físicamente en el equipo, lugar o proceso.</p>
      <div className="field2"><label>CoDo</label><Dropdown value={qc} options={QC} onChange={setQc} icon="folder-tree" /></div>
      <div className="field2"><label>Entidad referenciada</label><Dropdown value={(CODOS.find(c => c.id === qc) || CODOS[0]).name} options={CODOS.map(c => ({ v: c.name, l: c.name }))} icon="box" /></div>
      <div className="field2"><label>Formato físico</label><div className="fmt-seg2">{FMTS.map((o, i) => <button key={i} className={fmt === i ? "on" : ""} onClick={() => setFmt(i)}>{o}</button>)}</div></div>
      <div className="qr-acts"><button className="btn btn-primary" onClick={() => dcModal({ icon: "printer", title: "Imprimir QR", body: "Se enviará el QR de " + qc + " a la cola de impresión en el formato seleccionado.", confirm: "Imprimir", doneTitle: "Enviado a impresión", doneBody: "El QR está en la cola. Pégalo en el equipo cuando salga." })}><Icon name="printer" size={15} />Imprimir</button><button className="mini-btn" onClick={() => dcModal({ icon: "download", title: "Descargar QR", body: "El QR se guarda listo para imprimir, en PNG y SVG vectorial.", confirm: "Descargar PNG / SVG", doneTitle: "Descarga lista" })}><Icon name="download" size={14} />PNG / SVG</button></div>
    </div>
    <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div className="sec-h2"><h2>Previsualización</h2></div>
      <div style={{ alignSelf: "center", margin: "4px 0 18px" }}><QRPlate seed={7} label="CODO-OBR-07 · MAXI-10ND" /></div>
      <div className="sec-h2"><h2>Generados recientemente</h2></div>
      {[["CODO-OBR-07", "Mezcladora MAXI-10ND", 4], ["CODO-LAB-04", "Centrífuga Hettich", 7], ["CODO-MAQ-02", "CNC Haas VF-2", 11]].map((q, i) =>
        <div className={"qr-item" + (sel === i ? " on" : "")} key={i} onClick={() => setSel(i)}>
          <QRPlate size={40} seed={i + 2} />
          <div style={{ minWidth: 0 }}><div className="qi-ent">{q[1]}</div><div className="qi-codo">{q[0]} · {q[2]} impresos</div></div>
          <Icon name="printer" size={15} color="var(--fg-subtle)" /></div>)}
    </div>
  </div></div>;
}

/* ---------- Usuarios ---------- */
const ADMINS = [["JM", "Jorge Medina", "Admin · propietario", "—"], ["RC", "Rosa Cantú", "Admin", "$12 / mes"]];
const OPERATORS = [["AR", "Andrés Ríos", "ES-MX", true], ["LP", "L. Peña", "ES-MX", true], ["DK", "D. Kim", "EN-US", false]];
function UsuariosView() {
  return <div className="wrap">
    <div className="panel">
      <div className="sec-h2"><h2>Admins</h2><button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => dcModal({ icon: "user-plus", title: "Invitar admin", body: "Se enviará una invitación por correo. Cada admin suma un costo de seat según el plan.", confirm: "Enviar invitación", doneTitle: "Invitación enviada" })}><Icon name="plus" size={14} />Invitar admin</button></div>
      <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>Cada admin adicional suma un costo de seat según el plan. Los colaboradores son ilimitados y sin costo.</p>
      {ADMINS.map(([av, name, role, cost], i) => <div className="urow" key={i}><span className="uav ink">{av}</span>
        <div className="uinfo"><div className="un">{name}</div><div className="ur">{role}</div></div>
        <span className="useat">{cost}</span><Icon name="more-horizontal" size={16} color="var(--fg-subtle)" /></div>)}
    </div>
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="sec-h2"><h2>Colaboradores <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)", fontWeight: 400 }}>21</span></h2><button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => dcModal({ icon: "user-plus", title: "Invitar colaborador", body: "Entra por QR, sin costo. Recibirá un enlace para activar su cuenta.", confirm: "Enviar invitación", doneTitle: "Invitación enviada" })}><Icon name="plus" size={14} />Invitar colaborador</button></div>
      {OPERATORS.map(([av, name, lang, ai], i) => <div className="urow" key={i}><span className="uav cin">{av}</span>
        <div className="uinfo"><div className="un">{name}</div><div className="ur">Colaborador · entra por QR</div></div>
        <div className="uprefs"><span className="pref">{lang}</span><span className={"pref" + (ai ? " on" : "")}><Icon name="sparkles" size={12} />IA {ai ? "on" : "off"}</span></div>
        <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" /></div>)}
      <div className="manual-note" style={{ marginTop: 14, marginBottom: 0 }}><Icon name="settings" size={15} />Por usuario: par lingüístico default, variante regional, permiso de IA proactiva y "silenciar sugerencias".</div>
    </div>
  </div>;
}

/* ---------- Alertas ---------- */
const ADMIN_ALERTS = [
  ["warn", "Por vencer · ≤ 7 días", "Calibración — Mezcladora MAXI-10ND", "CODO-OBR-07", "Vence 02 jul · en 4 días", "CAL-22-117"],
  ["warn", "Por vencer · ≤ 7 días", "Certificado del operador A. Ríos", "Org", "Venció 28 jun", "CERT-OP-AR"],
  ["caution", "Próximas · ≤ 30 días", "Cambio de aceite SAE-30 programado", "CODO-OBR-07", "En 22 días", "MTTO-OBR-03"],
  ["caution", "Próximas · ≤ 30 días", "MSDS refrigerante — Centrífuga", "CODO-LAB-04", "Expira 25 jul · en 27 días", "MSDS-REF-03"],
];
function AlertasView() {
  const groups = [...new Set(ADMIN_ALERTS.map(a => a[1]))];
  const [cfg, setCfg] = useState(false);
  const [dias, setDias] = useState({ 10: true, 5: true, 3: true, 2: false, 1: true });
  const [mails, setMails] = useState(["jorge@lab-estandar.mx", "rosa@lab-estandar.mx"]);
  const [mailVal, setMailVal] = useState("");
  const [adding, setAdding] = useState(false);
  const toggleDia = (d) => setDias(s => ({ ...s, [d]: !s[d] }));
  const addMail = () => { const v = mailVal.trim(); if (!v || mails.includes(v)) { setAdding(false); setMailVal(""); return; } setMails(m => [...m, v]); setMailVal(""); setAdding(false); };
  const delMail = (m) => setMails(list => list.filter(x => x !== m));
  const diasActivos = Object.keys(dias).filter(d => dias[d]).map(Number).sort((a, b) => b - a);
  return <div className="wrap">
    <div className="admin-banner"><Icon name="info" size={15} />Recordatorio administrativo — no es una instrucción operativa. DOCYAN no emite decisiones clínicas u operativas.</div>

    {/* Configuración de avisos automáticos pre-vencimiento */}
    <div className="panel" style={{ marginTop: 16 }}>
      <button className="alert-cfg-h" onClick={() => setCfg(v => !v)}>
        <span className="acfg-ic"><Icon name="mail" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div className="acfg-t">Avisos automáticos por correo</div>
          <div className="acfg-s">{mails.length} destinatarios · {diasActivos.length ? diasActivos.join(" · ") + " días hábiles antes" : "sin avisos activos"}</div>
        </div>
        <Icon name="chevron-right" size={16} color="var(--fg-subtle)" className={"chev" + (cfg ? " open" : "")} />
      </button>
      {cfg && <div className="alert-cfg-body">
        <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>DOCYAN envía el recordatorio a esta lista, los días hábiles que elijas antes de cada vencimiento. Sigue siendo administrativo — avisa, no instruye.</p>
        <div className="acfg-field"><label>Enviar aviso · días hábiles antes del vencimiento</label>
          <div className="dias-seg">{[10, 5, 3, 2, 1].map(d => <button key={d} className={"dia-chip" + (dias[d] ? " on" : "")} onClick={() => toggleDia(d)}>{dias[d] && <Icon name="check" size={12} />}{d} {d === 1 ? "día" : "días"}</button>)}</div>
        </div>
        <div className="acfg-field"><label>Destinatarios</label>
          <div className="mail-list">
            {mails.map(m => <span className="mail-chip" key={m}><Icon name="user" size={12} />{m}<button onClick={() => delMail(m)}><Icon name="x" size={12} /></button></span>)}
            {adding
              ? <span className="mail-add"><input autoFocus type="email" value={mailVal} placeholder="correo@empresa.mx" onChange={e => setMailVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addMail(); if (e.key === "Escape") { setAdding(false); setMailVal(""); } }} /><button className="ok" onMouseDown={e => { e.preventDefault(); addMail(); }}><Icon name="check" size={14} /></button></span>
              : <button className="mail-addbtn" onClick={() => setAdding(true)}><Icon name="plus" size={13} />Agregar correo</button>}
          </div>
        </div>
        <div className="acfg-foot">
          <span className="acfg-note"><Icon name="info" size={13} />Aplica a todas las alertas por vencer (calibraciones, MSDS, certificados). Días hábiles: omite fines de semana.</span>
          <button className="btn btn-primary" onClick={() => dcModal({ icon: "check", title: "Avisos guardados", body: "Los avisos se enviarán a " + mails.length + " destinatarios, " + (diasActivos.join(", ") || "—") + " días hábiles antes de cada vencimiento.", confirm: "Entendido" })}>Guardar avisos</button>
        </div>
      </div>}
    </div>

    {groups.map(g => <div key={g} style={{ marginTop: 18 }}>
      <div className="ag-lab">{g}</div>
      <div className="panel" style={{ padding: 0 }}>
        {ADMIN_ALERTS.filter(a => a[1] === g).map((a, i) => <div className={"arow s-" + a[0]} key={i}>
          <span className="aico"><Icon name={a[0] === "warn" ? "alarm-clock" : "clock"} size={16} /></span>
          <div className="ainfo"><div className="at">{a[2]}</div><div className="am"><span className="codo-pill">{a[3]}</span>{a[4]}</div></div>
          <span className="cite-mini"><span className="brk" />{a[5]} ↗</span>
          <div className="arow-acts"><button>Marcar leída</button><button>Posponer</button></div>
        </div>)}
      </div>
    </div>)}
  </div>;
}

/* ---------- Gobernanza & FAT ---------- */
const GRG = [["Seguridad", 0.95, "warn"], ["Regulatorio", 0.90, "warn"], ["Calidad", 0.85, "caution"], ["Operacional", 0.75, "ok"], ["Informativa", 0.60, "ok"]];
const FAT = [
  ["09:14:22", "consulta", "RPM de la olla respondido", "A. Ríos", "CODO-OBR-07", "ok"],
  ["09:02:10", "gobernanza", "Output bloqueado · confianza 0.71 < 0.95", "sistema", "CODO-OBR-07", "block"],
  ["08:51:03", "alertas", "Alerta de calibración generada", "sistema", "CODO-OBR-07", "ok"],
  ["08:40:55", "onboarding", "Colaborador invitado", "J. Medina", "Org", "ok"],
];
function GobernanzaView() {
  return <div className="wrap">
    <div className="ing-grid">
      <div className="panel">
        <div className="sec-h2"><h2>Configuración GRG</h2><span className="badge ok" style={{ marginLeft: "auto" }}>Tier Profesional</span></div>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 10px", lineHeight: 1.5 }}>Umbral de confianza mínimo para emitir respuesta, por criticidad. Editables por organización.</p>
        {GRG.map(([name, th, sev], i) => <div className="grg-row" key={i}><span className={"sev-dot " + sev} /><span className="grg-name">{name}</span>
          <div className="grg-bar"><i style={{ width: th * 100 + "%" }} /></div><span className="grg-th">≥{th.toFixed(2)}</span></div>)}
      </div>
      <div className="panel">
        <div className="sec-h2"><h2>Eventos en cuarentena</h2><span className="badge warn" style={{ marginLeft: "auto" }}>1</span></div>
        <div className="quar">
          <div className="quar-h"><Icon name="shield-alert" size={16} /><span>Output bloqueado por el GRG</span></div>
          <p className="quar-q">"¿Puedo operar la mezcladora sin la guarda de la olla?"</p>
          <div className="quar-meta"><div><span>Regla</span><b>Seguridad ≥ 0.95</b></div><div><span>Confianza</span><b className="mono">0.71</b></div><div><span>Motivo</span><b>Bajo umbral + tema de seguridad</b></div></div>
          <div className="quar-acts"><button className="link-btn">Ver razonamiento</button><button className="link-btn">Escalar a admin</button></div>
        </div>
      </div>
    </div>
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="sec-h2"><h2>FAT — bitácora de auditoría</h2><div className="exports">{["PDF", "XML", "JSON", "CSV"].map(f => <button key={f} className="exp-btn" onClick={() => dcModal({ icon: "download", title: "Exportar FAT · " + f, body: "Se exporta la bitácora de auditoría completa en " + f + ", con la cadena SHA-256 incluida.", confirm: "Exportar " + f, doneTitle: "Exportación lista" })}>{f}</button>)}</div></div>
      <table className="mini-tbl"><thead><tr><th>Hora</th><th>Familia</th><th>Evento</th><th>Actor</th><th>Entidad</th><th></th></tr></thead>
        <tbody>{FAT.map((r, i) => <tr key={i}><td className="mono">{r[0]}</td><td><span className="fam">{r[1]}</span></td><td>{r[2]}</td><td>{r[3]}</td><td className="mono">{r[4]}</td>
          <td>{r[5] === "block" ? <span className="badge warn">bloqueado</span> : <Icon name="check" size={14} color="var(--success-600)" />}</td></tr>)}</tbody></table>
      <div className="chain" style={{ marginTop: 16 }}><div className="ci2"><Icon name="shield-check" size={18} /></div>
        <div><div className="ct">Cadena criptográfica</div><div className="cm">SHA-256 · íntegra · 8,412 eventos encadenados</div></div><button onClick={() => dcModal({ icon: "shield-check", title: "Verificar cadena", body: "DOCYAN recomputa el hash SHA-256 de los 8,412 eventos y lo compara con el sello.", confirm: "Verificar ahora", doneTitle: "Cadena íntegra", doneBody: "Los 8,412 eventos verifican. Ningún evento fue alterado." })}>Verificar</button></div>
    </div>
  </div>;
}

/* ---------- Plan ---------- */
function PlanView({ plan, setPlan }) {
  const actual = plan === "free" ? "free" : "pro";
  const [metodos, setMetodos] = useState(METODOS_PAGO);
  const [addCard, setAddCard] = useState(false);
  const [form, setForm] = useState({ titular: "", num: "", exp: "", cvv: "" });
  const setPrincipal = (id) => setMetodos(ms => ms.map(m => ({ ...m, principal: m.id === id })));
  const delMetodo = (m) => { if (m.principal) { dcModal({ icon: "info", title: "No se puede eliminar", body: "Es tu método principal. Marca otro como principal antes de eliminar este.", confirm: "Entendido" }); return; } dcModal({ icon: "trash-2", title: "Eliminar método de pago", body: "Se elimina “" + m.marca + (m.num ? " ···· " + m.num : "") + "” de tu cuenta.", confirm: "Eliminar", tone: "danger", doneTitle: "Método eliminado", onConfirm: () => setMetodos(ms => ms.filter(x => x.id !== m.id)) }); };
  const guardarCard = () => {
    const num = form.num.replace(/\s/g, "").slice(-4);
    if (num.length < 4) { setAddCard(false); return; }
    setMetodos(ms => [...ms, { id: "mp" + Date.now(), tipo: "card", marca: "Tarjeta", num, exp: form.exp || "—", titular: form.titular || "—", principal: false }]);
    setForm({ titular: "", num: "", exp: "", cvv: "" }); setAddCard(false);
  };
  const planActualLabel = actual === "pro" ? "Profesional" : "Gratuito";
  const [banda, setBanda] = useState(BANDA_DEFAULT);
  const b = BANDAS[banda];
  const precioTier = (p) => p.tier ? b.tiers[p.tier] : 0;

  return <div className="wrap">
    {/* C · Planes canónicos por documentos vivos × banda geográfica */}
    <div className="sec-h2"><h2>Tu plan</h2><span className="cnt">Por documentos vivos, no por usuarios · {PLAN_ADICIONAL}</span></div>
    <div className="banda-bar">
      <span className="banda-lab"><Icon name="globe" size={14} />Banda de precio</span>
      <div className="banda-seg">{Object.values(BANDAS).map(bn => <button key={bn.key} className={"banda-chip" + (banda === bn.key ? " on" : "")} onClick={() => setBanda(bn.key)}>{bn.key} · {bn.regions}</button>)}</div>
    </div>
    <div className="planes4">
      {PLANES.map(p => {
        const esActual = (p.id === "free" && actual === "free") || (p.id === "pro" && actual === "pro");
        const precio = precioTier(p);
        return <div className={"plan4" + (p.rec ? " rec" : "") + (esActual ? " on" : "")} key={p.id}>
          {p.rec && !esActual && <span className="p4-tag rec">Más elegido</span>}
          {esActual && <span className="p4-tag">Tu plan</span>}
          <div className="p4-name">{p.label}</div>
          <div className="p4-docs">{p.docs}</div>
          <div className="p4-price">{p.id === "free" ? <>$0<small>/mes</small></> : <>{p.from && <span className="p4-from">desde</span>}{fmtUSDDocyan(precio)}<small>/mes</small></>}</div>
          <div className="p4-band">Banda {b.key} · {b.regions}</div>
          <div className="p4-cupo">{p.cupo === null ? "Sin cupo de ingestas" : p.cupo === "negociado" ? "Cupo de ingestas negociado" : <><b>{p.cupo[0]}</b> de arranque + <b>{p.cupo[1]}</b>/mes</>}</div>
          <div className="p4-blurb">{p.blurb}</div>
          <div className="p4-feats">{p.feats.map((f, i) => <div className="p4-f" key={i}><Icon name="check" size={14} />{f}</div>)}</div>
          {esActual
            ? <button className="btn btn-ghost" style={{ width: "100%" }} disabled>Plan actual</button>
            : p.from
              ? <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => dcModal({ icon: "layers", title: "Hablar con ventas", body: "Enterprise se cotiza a la medida: documentos vivos, cupo de ingestas, SSO/SAML, residencia de datos y on-premise.", confirm: "Contactar a ventas", doneTitle: "Solicitud enviada" })}>Hablar con ventas</button>
              : <button className={"btn " + (p.rec ? "btn-primary" : "btn-ghost")} style={{ width: "100%" }} onClick={() => setPlan(p.id === "free" ? "free" : "pro")}>{p.id === "free" ? "Cambiar a Gratuito" : (p.rec ? <><Icon name="gem" size={15} />Subir a {p.label}</> : "Cambiar a " + p.label)}</button>}
        </div>;
      })}
    </div>
    <p style={{ fontSize: 12, color: "var(--fg-subtle)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>Los tres planes consultan igual de bien. La diferencia es cuántos documentos viven en tu entorno. Banda según región · precios en USD/mes por organización.</p>

    {/* B · Método de pago — configuración completa */}
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="sec-h2"><h2>Método de pago</h2><button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => setAddCard(v => !v)}><Icon name={addCard ? "x" : "plus"} size={14} />{addCard ? "Cancelar" : "Agregar tarjeta"}</button></div>
      {addCard && <div className="mp-form">
        <div className="mp-form-grid">
          <div className="field2" style={{ gridColumn: "1 / -1" }}><label>Titular (nombre completo)</label><input className="codigo-input" placeholder="Nombre del titular" value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))} /></div>
          <div className="field2" style={{ gridColumn: "1 / -1" }}><label>Número de tarjeta</label><input className="codigo-input" placeholder="4242 4242 4242 4242" value={form.num} onChange={e => setForm(f => ({ ...f, num: e.target.value }))} /></div>
          <div className="field2"><label>Vencimiento</label><input className="codigo-input" placeholder="MM/AA" value={form.exp} onChange={e => setForm(f => ({ ...f, exp: e.target.value }))} /></div>
          <div className="field2"><label>CVV</label><input className="codigo-input" placeholder="3 dígitos" inputMode="numeric" maxLength={4} value={form.cvv} onChange={e => setForm(f => ({ ...f, cvv: e.target.value }))} /></div>
        </div>
        <button className="btn btn-primary" onClick={guardarCard}><Icon name="check" size={15} />Guardar tarjeta</button>
      </div>}
      {metodos.map(m => <div className="mp-row" key={m.id}>
        <span className="mp-ic"><Icon name={m.tipo === "card" ? "credit-card" : "building-2"} size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><div className="mp-n">{m.marca}{m.num ? " ···· " + m.num : ""}</div><div className="mp-m">{m.tipo === "card" ? "Vence " + m.exp + " · " + m.titular : m.detalle}</div></div>
        {m.principal ? <span className="badge ok">Principal</span> : <button className="mp-link" onClick={() => setPrincipal(m.id)}>Hacer principal</button>}
        <button className="mp-del" title="Eliminar" onClick={() => delMetodo(m)}><Icon name="trash-2" size={14} /></button>
      </div>)}
      <div className="mp-info"><Icon name="info" size={15} />Aceptamos tarjeta, SPEI y OXXO. El cobro de ingestas (Modelo 2: cupo + excedente desde $15) y la suscripción se cargan a tu método principal. Durante el piloto el cobro es manual.</div>
    </div>

    {/* Código de acceso · piloto */}
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="sec-h2"><h2>Código de acceso</h2><span className="badge ok" style={{ marginLeft: "auto" }}>Piloto −30%</span></div>
      <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>¿Tienes un código de piloto? Canjéalo para activar el plan <b>Esencial con −30%</b> por 60 días, con cupo de ingestas incluido (10 + 3/mes).</p>
      <div className="codigo-row">
        <input className="codigo-input" placeholder="DOCYAN-PILOTO-XXXX" />
        <button className="btn btn-ghost" onClick={() => dcModal({ icon: "ticket", title: "Canjear código de acceso", body: "Se valida el código y, si es válido, activa el plan piloto (Esencial −30%) con su cupo de ingestas y ventana de 60 días.", confirm: "Canjear código", doneTitle: "Código canjeado", doneBody: "Plan piloto activo. Tu cupo de ingestas ya está disponible en Ingesta." })}><Icon name="ticket" size={15} />Canjear</button>
      </div>
    </div>
  </div>;
}

Object.assign(window, { IngestaView, QRsView, UsuariosView, AlertasView, GobernanzaView, PlanView });
function SchemasView() {
  const counts = SCHEMAS.reduce((a, s) => { a[s.estado] = (a[s.estado] || 0) + 1; return a; }, {});
  const renderLabel = { info: "info_card", steps: "procedure_card", alerts: "alerts", history: "timeline", troubleshoot: "árbol del manual", bilingual: "vista bilingüe", diagram: "diagrama", video: "video", compare: "comparativa" };
  return <div className="wrap">
    <div className="sch-head">
      <div>
        <div className="sh-t">Catálogo normativo de schemas</div>
        <div className="sh-m">14 tipos documentales, cerrados, organizados por fase del ciclo de vida del activo. Cada schema se deriva de la norma que rige el documento — la ontología de extracción es lo que la norma exige, ni más ni menos.</div>
      </div>
      <div className="sch-legend">
        {Object.entries(ESTADO_META).map(([k, m]) => <span className="sl" key={k}><span className={"sev-dot " + m.sev} />{m.label} · {counts[k] || 0}</span>)}
      </div>
    </div>
    <div className="admin-banner" style={{ marginBottom: 18 }}><Icon name="info" size={15} />Línea absoluta — DOCYAN presenta lo que el documento dice (vencimientos, faltantes, fechas: sí). Diagnóstico, decisión clínica/operativa o asesoría legal: jamás. El profesional decide.</div>
    {FASES.map(f => {
      const items = SCHEMAS.filter(s => s.fase === f.key);
      if (!items.length) return null;
      return <div className="sch-fase" key={f.key}>
        <div className="sch-fase-h"><Icon name={f.icon} size={15} /><span className="sf-l">{f.label}</span><span className="sf-q">{f.q}</span></div>
        <div className="sch-grid">
          {items.map(s => { const est = ESTADO_META[s.estado]; return <div className={"sch-card " + s.estado} key={s.id}>
            <div className="sch-card-h"><span className="sc-id">{s.id}</span></div>
            <div className="sch-card-h" style={{ marginTop: -4 }}><span className="sc-l">{s.label}</span><span className={"badge " + est.sev}><span className={"sev-dot " + est.sev} />{est.label}</span></div>
            <div className="sch-norma">{s.norma}</div>
            {s.nota && <div className="sch-nota"><Icon name="alert-circle" size={14} />{s.nota}</div>}
            <div className="sch-onto">{s.ontologia.map((o, i) => <span className="onto-chip" key={i}>{o}</span>)}</div>
            <div className="sch-foot">
              {s.render.map((r, i) => <span className="sf-render" key={i}><Icon name="layout-template" size={11} />{renderLabel[r] || r}</span>)}
              <span className="sf-prio">prioridad {s.prioridad}</span>
            </div>
          </div>; })}
        </div>
      </div>;
    })}
  </div>;
}

/* ---------- Glosario terminológico + lock ---------- */
function GlosTerm({ g }) {
  const [vars, setVars] = useState(g.variantes);
  const [canon, setCanon] = useState(g.canonica);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editIx, setEditIx] = useState(-1);
  const [editVal, setEditVal] = useState("");
  const ob = g.modal ? OBLIGATORIEDAD[g.modal] : null;
  const orig = GLOSARIO_ORIGEN[origenCanonico({ ...g, variantes: vars }, canon)] || GLOSARIO_ORIGEN.cliente;

  const addOwn = () => {
    const t = draft.trim();
    if (!t) { setAdding(false); return; }
    if (!vars.some(v => v.t === t)) setVars([...vars, { t, o: "cliente" }]);
    setCanon(t); setDraft(""); setAdding(false);
  };
  const saveEdit = (i) => {
    const t = editVal.trim();
    if (!t) { setEditIx(-1); return; }
    const prev = vars[i].t;
    // renombrar = localizar → pasa a ser nomenclatura validada por el cliente
    setVars(vars.map((v, k) => k === i ? { t, o: "cliente" } : v));
    if (canon === prev) setCanon(t);
    setEditIx(-1);
  };

  return <div className={"glos-row" + (g.critico ? " critico" : "")}>
    <div className="gr-src">
      <span className="gr-lock" title="Término gobernado — el lock lo impone como restricción dura"><Icon name="lock" size={12} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="gr-term">{g.src}</div>
        <div className="gr-lang">{GLOSARIO_PAR.src}</div>
      </div>
    </div>
    <Icon name="arrow-right" size={16} color="var(--fg-subtle)" />
    <div className="gr-tgt">
      <div className="gr-variants">
        {vars.map((v, i) => editIx === i
          ? <span className="gr-edit" key={i}>
              <input autoFocus className="gr-input" value={editVal} onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveEdit(i); if (e.key === "Escape") setEditIx(-1); }} />
              <button className="gr-ic ok" onMouseDown={e => { e.preventDefault(); saveEdit(i); }} title="Guardar"><Icon name="check" size={13} /></button>
              <button className="gr-ic" onMouseDown={e => { e.preventDefault(); setEditIx(-1); }} title="Cancelar"><Icon name="x" size={13} /></button>
            </span>
          : <span key={i} className={"gr-var o-" + v.o + (v.t === canon ? " on" : "")}>
              <button className="gr-var-pick" onClick={() => setCanon(v.t)} title={v.t === canon ? "Variante canónica del tenant" : "Fijar como canónica"}>
                <span className="gr-vdot" title={GLOSARIO_ORIGEN[v.o].label} />
                {v.t === canon && <Icon name="check" size={12} />}{v.t}
              </button>
              <button className="gr-var-edit" onClick={() => { setEditIx(i); setEditVal(v.t); }} title="Editar / renombrar"><Icon name="pencil" size={11} /></button>
            </span>)}
        {adding
          ? <span className="gr-edit add">
              <input autoFocus className="gr-input" placeholder="tu término…" value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addOwn(); if (e.key === "Escape") { setAdding(false); setDraft(""); } }} />
              <button className="gr-ic ok" onMouseDown={e => { e.preventDefault(); addOwn(); }} title="Agregar"><Icon name="check" size={13} /></button>
              <button className="gr-ic" onMouseDown={e => { e.preventDefault(); setAdding(false); setDraft(""); }} title="Cancelar"><Icon name="x" size={13} /></button>
            </span>
          : <button className="gr-add" onClick={() => setAdding(true)} title="Agregar tu término propio (validado por el cliente)"><Icon name="plus" size={12} />término propio</button>}
      </div>
      <div className="gr-tgt-lang">{GLOSARIO_PAR.tgt} · el lock impone <b>{canon}</b> en cada consulta</div>
    </div>
    <div className="gr-meta">
      <span className="gr-dom">{g.dom}</span>
      <span className={"gr-origen " + orig.sev} title={orig.desc}><span className={"sev-dot " + orig.sev} />{orig.label}</span>
      <span className="gr-anillo" title={g.anillo === 1 ? "Anillo 1 — NOM pública, sembrable" : "Anillo 2 — norma licenciada, confinada al tenant"}>Anillo {g.anillo}</span>
      {ob && <span className={"gr-modal " + ob.sev} title={ob.regla}><Icon name="shield-alert" size={11} />{ob.label}</span>}
    </div>
  </div>;
}

function GlosarioView() {
  const counts = GLOSARIO.reduce((a, g) => { const o = origenCanonico(g); a[o] = (a[o] || 0) + 1; return a; }, {});
  const conVariantes = GLOSARIO.filter(g => g.variantes.length > 1).length;
  const regulatorios = GLOSARIO.filter(g => g.modal).length;
  return <div className="wrap">
    <div className="sch-head">
      <div>
        <div className="sh-t">Glosario terminológico · lock de consulta</div>
        <div className="sh-m">Los términos gobernados de tu organización. Antes de mostrar un fragmento traducido al idioma del usuario, el <b>lock</b> impone estos términos al modelo como restricción dura — no como sugerencia. El cliente fija su nomenclatura una vez; DOCYAN la respeta en todas las consultas.</div>
      </div>
      <div className="sch-legend">
        {Object.entries(GLOSARIO_ORIGEN).map(([k, m]) => <span className="sl" key={k}><span className={"sev-dot " + m.sev} />{m.label} · {counts[k] || 0}</span>)}
      </div>
    </div>

    <div className="glos-toolbar">
      <Dropdown value={GLOSARIO_PAR.label} options={[{ v: GLOSARIO_PAR.label, l: GLOSARIO_PAR.label }, { v: "es", l: "Español (MX) → Inglés" }]} icon="languages" onChange={() => {}} />
      <div className="glos-stats">
        <span><b>{GLOSARIO.length}</b> términos</span>
        <span><b>{conVariantes}</b> con variantes</span>
        <span><b>{regulatorios}</b> con carga regulatoria</span>
      </div>
    </div>

    <div className="glos-hint"><Icon name="info" size={13} />Cada variante muestra su origen — <span className="gh-dot o-publico" />público (NOM) · <span className="gh-dot o-grafo" />del grafo · <span className="gh-dot o-cliente" />tuyo. Elige la canónica, <b>agrega tu término propio</b> o renómbralo: editar una sugerida la convierte en nomenclatura validada por ti.</div>

    <div className="admin-banner" style={{ marginBottom: 14 }}><Icon name="shield-alert" size={15} />Carga de obligatoriedad — <b>shall</b> ≠ <b>should</b>. Colapsar una obligación en recomendación (o al revés) en un MSDS o una NOM cambia el significado regulatorio. El lock preserva la carga; es obligatorio, no opcional.</div>

    <div className="glos-list">
      {GLOSARIO.map(g => <GlosTerm key={g.id} g={g} />)}
    </div>

    <div className="glos-foot">
      <div className="glos-foot-card">
        <div className="gf-h"><Icon name="git-compare" size={15} />No es una CAT tool</div>
        <p>Una CAT tool gobierna la terminología de un proyecto de traducción cerrado, para producir un documento entregable. El lock de DOCYAN gobierna la terminología de una <b>consulta viva</b> en el punto de uso — el operador lee el fragmento con su fuente al lado, vía QR. Distinta naturaleza, no "mejor lock".</p>
      </div>
      <div className="glos-foot-card">
        <div className="gf-h"><Icon name="badge-alert" size={15} />Informa, no certifica</div>
        <p>El render asistido siempre lleva su marca <span className="mono">"traducción asistida — fuente en [idioma]"</span>. Para criticidad alta —valores de seguridad, límites de exposición, obligaciones normativas— se muestra <b>junto</b> al original, nunca en reemplazo.</p>
      </div>
    </div>
  </div>;
}

Object.assign(window, { IngestaView, QRsView, UsuariosView, AlertasView, GobernanzaView, PlanView, SchemasView, GlosarioView, DocumentosView, InteligenciaView });
