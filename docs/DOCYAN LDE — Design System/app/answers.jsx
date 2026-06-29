/* DOCYAN — renderizado de la respuesta por TIPO DE INTENCIÓN (8 tipos).
   Compartido por la consulta de escritorio (consult.jsx) y la móvil (colab-mobile.jsx).
   El chrome base de la tarjeta (.acard/.mode/.citerow/.cite2/.savebtn/.src) ya está
   estilizado por views.css (escritorio) y mobile.css (.dy-mobile). Las clases propias
   de cada tipo van bajo .dc-answer en answer-types.css → idénticas en ambos contextos. */

const { useState: useStateA, useEffect: useEffectA } = React;

/* Traza cada RENDER (eje B) a su TIPO DOCUMENTAL representativo (eje A) cuando la
   respuesta no declara `a.tipo`. Hace visible la relación render↔schema. */
const KIND_SCHEMA = {
  info: "ficha_tecnica", steps: "manual_mantenimiento", troubleshoot: "manual_mantenimiento",
  diagram: "manual_operacion", video: "manual_operacion", history: "registro_historico",
  alerts: "certificado_calibracion", compare: "manual_operacion", bilingual: "memoria_traduccion",
};

/* ---------- piezas compartidas ---------- */
function SaveBtn({ saved, onSave }) {
  if (!onSave) return null;
  return <button className={"savebtn" + (saved ? " on" : "")} onClick={onSave}>
    <Icon name={saved ? "check" : "bookmark"} size={14} />{saved ? t({ es: "Guardada", en: "Saved" }) : t({ es: "Guardar", en: "Save" })}</button>;
}

/* fila de cita + fragmento original revelado inline + Abrir PDF */
function CitedFragment({ a, saved, onSave, onCite }) {
  const [open, setOpen] = useStateA(false);
  useEffectA(() => { const id = setTimeout(() => setOpen(true), 340); return () => clearTimeout(id); }, []);
  if (!a.cite) return onSave ? <div className="citerow">{<SaveBtn saved={saved} onSave={onSave} />}</div> : null;
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  const openSrc = () => window.dispatchEvent(new CustomEvent("dc-open-source", { detail: a }));
  return <>
    <div className="citerow">
      <button className="cite2" onClick={() => setOpen(o => !o)}><span className="brk" />{a.cite}{a.page != null ? " · " + t({ es: "p\u00e1g.", en: "p." }) + " " + a.page : ""} ↗</button>
      <button className="openpdf" onClick={openSrc}><Icon name="external-link" size={13} />{t({ es: "Abrir PDF", en: "Open PDF" })}</button>
      <SaveBtn saved={saved} onSave={onSave} />
    </div>
    {open && a.span && <div className="src"><span className="thr" /><div className="src2">
      <div className="s-head"><Icon name="file-text" size={12} /><span>{t({ es: "Fragmento original", en: "Original excerpt" })}</span>{a.page != null && <span className="pg">{t({ es: "p\u00e1g.", en: "p." })} {a.page}</span>}</div>
      <div className="s-span">{parts ? <>{parts[0]}<mark>{a.mark}</mark>{parts[1]}</> : a.span}</div>
      {a.lang && a.lang !== "ES" && <span className="s-orig"><Icon name="globe" size={11} />{t({ es: "Documento original en ingl\u00e9s · preguntaste en espa\u00f1ol", en: "Source document in English · you asked in English" })}</span>}
      <div className="s-actions"><span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Pedigree a span · SHA-256", en: "Pedigree to span · SHA-256" })}</span>
        <button className="openpdf" onClick={openSrc}><Icon name="external-link" size={13} />{t({ es: "Abrir PDF", en: "Open PDF" })}</button></div>
    </div></div>}
  </>;
}

/* ── Tipo 1 · Informativa (valor o texto) ───────────────── */
function InfoAnswer({ a, saved, onSave, onCite }) {
  return <div className="acard"><div className="q">{a.q}</div>
    {a.value
      ? <><div className="big">{a.value}<span className="u">{a.unit}</span></div><p className="note">{a.note}</p></>
      : <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>{a.text}</p>}
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ── Tipo 2 · Procedimiento paso a paso (tono ANSI Z535) ── */
function StepsAnswer({ a, saved, onSave, onCite }) {
  return <div className="acard"><div className="q">{a.title}</div>
    {a.ppe && <div className="ppe">{a.ppe.map(([ic, t], i) => <span className="chip" key={i}><Icon name={ic} size={13} />{t}</span>)}</div>}
    <ol className="steps">{a.steps.map((s, i) => <li key={i}><span className="st">{s}</span></li>)}</ol>
    {a.warn && <div className="warn"><Icon name="triangle-alert" size={16} />
      <div className="wt"><span className="wlab">{a.warn.lab}</span>{a.warn.text}</div></div>}
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ── Tipo 3 · Troubleshooting DEL MANUAL (NO diagnóstico del caso) ─────────
   Línea absoluta: se presenta el árbol síntoma→causa→acción TAL COMO LO DICE EL
   MANUAL. No interroga al usuario ni dictamina su caso — el profesional decide. */
function TroubleshootAnswer({ a, saved, onSave, onCite }) {
  const [open, setOpen] = useStateA(null);
  const RAMAS = [
    { cond: "Si la vibración aparece solo en vacío", causa: "El manual la asocia a desbalance del rotor.", accion: "Indica revisar el asiento de los tubos y que las masas estén pareadas." },
    { cond: "Si la vibración persiste también con carga", causa: "El manual la asocia a holgura en el acople motor-eje.", accion: "Indica inspeccionar el acople y el par de apriete de la base." },
  ];
  return <div className="acard"><div className="q">Lo que dice el manual · vibración al arrancar</div>
    <div className="ans-banner"><Icon name="book-open" size={15} />Árbol de fallas <b>tal como aparece en el manual</b>. No es un diagnóstico de tu equipo — DOCYAN presenta el texto; el profesional decide.</div>
    <ul className="ts-tree">
      {RAMAS.map((r, i) => <li key={i} className={"ts-branch" + (open === i ? " on" : "")} onClick={() => setOpen(open === i ? null : i)}>
        <div className="tsb-cond"><Icon name="git-branch" size={14} /><span>{r.cond}</span><Icon name="chevron-right" size={15} className="tsb-chev" /></div>
        {open === i && <div className="tsb-body">
          <p><span className="tsb-lab">El manual indica</span>{r.causa}</p>
          <p><span className="tsb-lab">Acción del manual</span>{r.accion}</p>
        </div>}
      </li>)}
    </ul>
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ── Tipo 4 · Diagrama con pines ────────────────────────── */
const DIAG_PINS = [
  { n: 1, x: 33, y: 26, label: "Tapa del rotor", note: "Cierre de bayoneta. Alinea la marca con el punto antes de girar." },
  { n: 2, x: 58, y: 47, label: "Rotor de ángulo fijo", note: "6 × 50 ml. No exceder el desbalance máximo de carga." },
  { n: 3, x: 44, y: 72, label: "Acople motor-eje", note: "Inspeccionar ante vibración (ver diagnóstico §3.5)." },
];
function DiagramAnswer({ a, saved, onSave, onCite }) {
  const [active, setActive] = useStateA(null);
  const toggle = (n) => setActive(active === n ? null : n);
  return <div className="acard"><div className="q">{a.title}</div>
    <div className="diag-img">
      <span className="ph-tag">DIAGRAMA TÉCNICO · DROP IMAGE</span>
      {DIAG_PINS.map(p => <button key={p.n} className={"pin" + (active === p.n ? " on" : "")} style={{ left: p.x + "%", top: p.y + "%" }} onClick={() => toggle(p.n)} aria-label={p.label}>{p.n}</button>)}
      <span className="diag-zoom"><Icon name="zoom-in" size={14} />Pellizca para acercar</span>
    </div>
    <ol className="legend">{DIAG_PINS.map(p => <li key={p.n} className={active === p.n ? "on" : ""} onClick={() => toggle(p.n)}>
      <span className="ln">{p.n}</span><div className="lc"><span className="lt">{p.label}</span>{active === p.n && <span className="lnote">{p.note}</span>}</div>
      <Icon name="chevron-right" size={15} /></li>)}</ol>
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ── Tipo 5 · Video con capítulos / transcripción ───────── */
const VID_CH = [["00:00", "Preparación y EPP"], ["01:12", "Extracción del rotor"], ["02:40", "Limpieza del eje"], ["03:55", "Montaje y balanceo"]];
const VID_TR = [["02:40", "Con el rotor fuera, limpia el eje con un paño sin pelusa."], ["02:52", "Verifica que no queden residuos en el asiento cónico.", true], ["03:08", "Aplica una capa fina del lubricante indicado."]];
function VideoAnswer({ a, saved, onSave, onCite }) {
  const [ch, setCh] = useStateA(2);
  const [tab, setTab] = useStateA("cap");
  return <div className="acard"><div className="q">{a.title}</div>
    <div className="vid-player">
      <span className="ph-tag">VIDEO · 04:30 · DROP CLIP</span>
      <button className="vid-play" aria-label="Reproducir"><Icon name="play" size={20} /></button>
      <div className="vid-scrub"><span style={{ width: "58%" }} /></div>
      <span className="vid-cc"><Icon name="captions" size={13} />CC · ES</span>
    </div>
    <div className="vid-tabs">
      <button className={tab === "cap" ? "on" : ""} onClick={() => setTab("cap")}>Capítulos</button>
      <button className={tab === "tr" ? "on" : ""} onClick={() => setTab("tr")}>Transcripción</button>
    </div>
    {tab === "cap" && <ul className="chapters">{VID_CH.map(([t, l], i) => <li key={i} className={ch === i ? "on" : ""} onClick={() => setCh(i)}>
      <span className="tc">{t}</span><span className="cl">{l}</span>{ch === i && <Icon name="play" size={13} />}</li>)}</ul>}
    {tab === "tr" && <div className="transcript">{VID_TR.map(([t, l, cur], i) => <p key={i} className={cur ? "on" : ""}><span className="tc">{t}</span>{l}</p>)}</div>}
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ── Tipo 6 · Historial / timeline + patrón → Playbook ──── */
const HIST_F = ["Todo", "Esta semana", "Calibración", "Mantenimiento"];
const HIST_EV = [
  ["Hoy · 09:14", "Velocidad máxima del rotor", "info", "gauge", [0, 1]],
  ["Ayer · 16:02", "Vibración al arrancar — diagnóstico", "diagnóstico", "activity", [0, 1]],
  ["12 may", "Cambio de tubos de la centrífuga", "mantenimiento", "wrench", [0, 3]],
  ["08 may", "Calibración registrada · A. Ríos", "registro", "shield-check", [0, 2]],
];
function HistoryAnswer({ saved, onSave }) {
  const [f, setF] = useStateA(0);
  const ev = HIST_EV.filter(e => e[4].includes(f));
  return <div className="acard"><div className="q">Historial · CODO-LAB-04</div>
    <div className="hist-filters">{HIST_F.map((l, i) => <button key={i} className={f === i ? "on" : ""} onClick={() => setF(i)}>{l}</button>)}</div>
    <ul className="timeline">
      {ev.map(([d, t, tag, ic], i) => <li key={i}><span className="dot"><Icon name={ic} size={13} /></span>
        <div className="tl-c"><span className="tl-d">{d}</span><span className="tl-t">{t}</span><span className="tl-tag">{tag}</span></div></li>)}
      {ev.length === 0 && <li className="tl-empty">Sin registros para este filtro.</li>}
    </ul>
    <div className="patterns"><div className="ph"><Icon name="sparkles" size={15} />Patrones detectados</div>
      <p>Consultas la <strong>velocidad del rotor</strong> antes de cada arranque de turno. DOCYAN puede unir tus consultas recurrentes en un Playbook.</p>
      <button className="sug pat-cta" onClick={onSave}><Icon name="git-branch" size={14} />Proponer Playbook</button></div>
  </div>;
}

/* ── Tipo 7 · Alertas administrativas ───────────────────── */
const ANS_ALERTS = [
  { sev: "warn", grp: "Por vencer · ≤ 7 días", title: "Calibración de la centrífuga", meta: "Vence en 4 días · 02 jul", cite: "Certificado CAL-22-117" },
  { sev: "caution", grp: "Próximas · ≤ 30 días", title: "MSDS del refrigerante", meta: "Expira en 22 días · 25 jul", cite: "DOC-MSDS-REF-03" },
  { sev: "caution", grp: "Próximas · ≤ 30 días", title: "Certificación del colaborador", meta: "Renovación en 28 días · A. Ríos", cite: "RH · CERT-OP-AR" },
];
function AnsAlertCard({ a }) {
  const [state, setState] = useStateA(null);
  return <div className={"al-card s-" + a.sev + (state ? " done" : "")}>
    <div className="al-top"><span className="al-t">{a.title}</span>{state && <span className="al-state">{state === "read" ? "Leída" : "Pospuesta"}</span>}</div>
    <span className="al-m">{a.meta}</span>
    <div className="al-foot"><span className="al-cite"><span className="brk" />{a.cite} ↗</span>
      {!state && <div className="al-acts"><button onClick={() => setState("read")}>Marcar leída</button><button onClick={() => setState("snooze")}>Posponer</button></div>}</div>
  </div>;
}
function AlertsAnswer({ a, saved, onSave }) {
  const groups = [...new Set(ANS_ALERTS.map(x => x.grp))];
  return <div className="acard"><div className="q">{a.title}</div>
    <div className="ans-banner"><Icon name="info" size={15} />Recordatorio administrativo — no es una instrucción operativa.</div>
    {groups.map(g => <div className="al-group" key={g}><div className="al-glab">{g}</div>
      {ANS_ALERTS.filter(x => x.grp === g).map((x, i) => <AnsAlertCard key={i} a={x} />)}</div>)}
    <div className="citerow"><SaveBtn saved={saved} onSave={onSave} /></div>
  </div>;
}

/* ── Tipo 8 · Comparativa de versiones ──────────────────── */
const DIFF = [
  { k: "chg", lab: "Torque del perno B", from: "80 N·m", to: "85 N·m" },
  { k: "add", text: "Etapa de apriete en cruz en 3 pasos (40 → 65 → 85)." },
  { k: "del", text: "Lubricación del perno antes del montaje." },
];
function CompareAnswer({ a, saved, onSave, onCite }) {
  return <div className="acard"><div className="q">{a.title}</div>
    <div className="cmp-vers"><span className="ver old">Rev. C<small>mar 2025</small></span>
      <Icon name="arrow-right" size={15} /><span className="ver new">Rev. D<small>vigente</small></span></div>
    <ul className="diff">{DIFF.map((d, i) => <li key={i} className={"d-" + d.k}>
      {d.k === "chg"
        ? <><span className="dm">~</span><span className="dt">{d.lab}: <s>{d.from}</s> → <b>{d.to}</b></span></>
        : <><span className="dm">{d.k === "add" ? "+" : "−"}</span><span className="dt">{d.text}</span></>}</li>)}</ul>
    <div className="cmp-sum"><span className="cs-lab">Resumen</span>La Rev. D endurece el apriete del perno B y formaliza el patrón en cruz; elimina la lubricación previa.</div>
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ── Tipo 9 · Vista bilingüe alineada (memoria_traduccion · Pista B) ───────
   Segmentos origen↔destino por par lingüístico, con lock terminológico. */
const TM_PAIRS = [
  { src: "Stop the machine and apply lock-out/tag-out before service.", tgt: "Detén la máquina y aplica bloqueo/etiquetado (LOTO) antes del servicio.", lock: ["lock-out/tag-out", "bloqueo/etiquetado (LOTO)"] },
  { src: "The housing remains pressurized until fully drained.", tgt: "El alojamiento permanece presurizado hasta drenarse por completo.", lock: null },
  { src: "Replace the coolant filter cartridge every 500 hours.", tgt: "Reemplaza el cartucho del filtro de refrigerante cada 500 horas.", lock: ["coolant filter", "filtro de refrigerante"] },
];
function BilingualAnswer({ a, saved, onSave, onCite }) {
  const pairs = (a && a.pairs) || TM_PAIRS;
  return <div className="acard"><div className="q">{(a && a.title) || "Memoria de traducción · EN-US → ES-MX"}</div>
    <div className="ans-banner"><Icon name="languages" size={15} />Segmentos alineados de la memoria. Los términos con <b>candado</b> son equivalencias fijadas (lock terminológico).</div>
    <ul className="tm-list">{pairs.map((p, i) => <li className="tm-seg" key={i}>
      <div className="tm-side src"><span className="tm-lang">EN-US</span><span className="tm-txt">{p.src}</span></div>
      <div className="tm-side tgt"><span className="tm-lang">ES-MX</span><span className="tm-txt">{p.tgt}</span></div>
      {p.lock && <div className="tm-lock"><Icon name="lock" size={11} /><span className="tm-term">{p.lock[0]}</span><Icon name="arrow-right" size={11} /><span className="tm-term">{p.lock[1]}</span></div>}
    </li>)}</ul>
    <CitedFragment a={a} saved={saved} onSave={onSave} onCite={onCite} />
  </div>;
}

/* ---------- despachador ---------- */
function AnswerBody({ a, saved, onSave, onCite }) {
  const synth = a.mode === "synth";
  let card;
  switch (a.kind) {
    case "steps": card = <StepsAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />; break;
    case "troubleshoot": card = <TroubleshootAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />; break;
    case "diagram": card = <DiagramAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />; break;
    case "video": card = <VideoAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />; break;
    case "history": card = <HistoryAnswer a={a} saved={saved} onSave={onSave} />; break;
    case "alerts": card = <AlertsAnswer a={a} saved={saved} onSave={onSave} />; break;
    case "compare": card = <CompareAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />; break;
    case "bilingual": card = <BilingualAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />; break;
    default: card = <InfoAnswer a={a} saved={saved} onSave={onSave} onCite={onCite} />;
  }
  const sch = SCHEMA_BY_ID[a.tipo || KIND_SCHEMA[a.kind] || "ficha_tecnica"];
  return <div className="dc-answer">
    <div className="dc-prov">
      <div className={"mode" + (synth ? " synth" : "")}><span className="pulse" />{synth ? t({ es: "Respuesta sintetizada", en: "Synthesized answer" }) : t({ es: "Respuesta instant\u00e1nea · cach\u00e9", en: "Instant answer · cache" })}</div>
      {sch && <span className="prov-tipo" title="Tipo documental del que proviene esta respuesta"><Icon name="library" size={11} />{sch.label}</span>}
    </div>
    {card}
  </div>;
}

Object.assign(window, { AnswerBody });
