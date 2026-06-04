/* DOCYAN PWA kit — collaborator consult flow (the product's face). */

const ANSWERS = {
  torque: {
    kind: "info", q: "Torque del perno B — cabezal", value: "85", unit: "N·m", mode: "cache",
    note: "Aplicado en cruz, en tres etapas progresivas (40 → 65 → 85 N·m).",
    cite: "Manual VF-2 · §4.2.1",
  },
  filtro: {
    kind: "steps", title: "Cambio del filtro de refrigerante", mode: "synth",
    ppe: [["hand", "Guantes nitrilo"], ["glasses", "Gafas de seguridad"]],
    steps: [
      "Detén la máquina y aplica bloqueo/etiquetado (LOTO) en el interruptor principal.",
      "Cierra la válvula de suministro y deja drenar 2 min al depósito.",
      "Retira la tapa del alojamiento del filtro girando en sentido antihorario.",
      "Extrae el cartucho usado y deséchalo según el MSDS del refrigerante.",
      "Coloca el cartucho nuevo, vuelve a sellar y reabre la válvula.",
    ],
    warn: { lab: "Advertencia", text: "No retires la tapa sin haber drenado: el alojamiento permanece presurizado." },
    cite: "Manual VF-2 · §7.3",
  },
  vibra: { kind: "troubleshoot", mode: "synth" },
  diagrama: { kind: "diagram", mode: "cache", title: "Diagrama del rotor" },
  video: { kind: "video", mode: "cache", title: "Video · montaje del rotor" },
  historial: { kind: "history", mode: "synth", title: "Historial de la centrífuga" },
  alertas: { kind: "alerts", mode: "synth", title: "Alertas pendientes" },
  compara: { kind: "compare", mode: "synth", title: "Comparativa rev. C vs D" },
};

const SUGGESTIONS = [
  ["gauge", "¿Torque del perno B?", "torque"],
  ["wrench", "¿Cómo cambio el filtro de refrigerante?", "filtro"],
  ["activity", "La centrífuga vibra al arrancar", "vibra"],
  ["image", "Muéstrame el diagrama del rotor", "diagrama"],
  ["play-circle", "Video: montaje del rotor", "video"],
  ["history", "Historial de esta centrífuga", "historial"],
  ["bell", "¿Qué alertas tengo pendientes?", "alertas"],
  ["git-compare", "Compara la rev. C y D del manual", "compara"],
];

function ModeLine({ mode }) {
  const synth = mode === "synth";
  return (
    <div className={"mode" + (synth ? " synth" : "")}>
      <span className="pulse" />{synth ? "Respuesta sintetizada" : "Respuesta instantánea · caché"}
    </div>
  );
}

function SaveBtn({ saved, onSave }) {
  return (
    <button className={"save-btn" + (saved ? " saved" : "")} onClick={onSave}>
      <Icon name={saved ? "check" : "bookmark"} size={14} />{saved ? "Guardada" : "Guardar consulta"}
    </button>
  );
}

function InfoAnswer({ a, saved, onSave, onCite }) {
  return (
    <div className="acard">
      <div className="q">{a.q}</div>
      <div className="big">{a.value}<span className="u">{a.unit}</span></div>
      <p>{a.note}</p>
      <div className="acard-foot">
        <Cite label={a.cite} onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}

function StepsAnswer({ a, saved, onSave, onCite }) {
  return (
    <div className="acard">
      <div className="q">{a.title}</div>
      <div className="ppe">
        {a.ppe.map(([ic, t], i) => <span className="chip" key={i}><Icon name={ic} size={13} />{t}</span>)}
      </div>
      <ol className="steps">{a.steps.map((s, i) => <li key={i}><span className="st">{s}</span></li>)}</ol>
      <div className="warn">
        <Icon name="triangle-alert" size={16} />
        <div className="wt"><span className="wlab">{a.warn.lab}</span>{a.warn.text}</div>
      </div>
      <div className="acard-foot">
        <Cite label={a.cite} onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}

function TroubleshootAnswer({ saved, onSave, onCite }) {
  const [node, setNode] = useState(0);
  return (
    <div className="acard">
      <div className="q">Diagnóstico · vibración al arrancar</div>
      {node === 0 && (
        <>
          <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>¿La vibración aparece solo en vacío o también con carga?</p>
          <div className="ppe" style={{ marginTop: 12, gap: 8 }}>
            <button className="sug" style={{ background: "var(--surface)" }} onClick={() => setNode(1)}>Solo en vacío<span className="ar">→</span></button>
            <button className="sug" style={{ background: "var(--surface)" }} onClick={() => setNode(2)}>También con carga<span className="ar">→</span></button>
          </div>
        </>
      )}
      {node === 1 && (
        <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>
          <strong>Causa probable:</strong> desbalance del rotor. Revisa el asiento de los tubos y verifica que las masas estén pareadas antes de continuar.
        </p>
      )}
      {node === 2 && (
        <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>
          <strong>Causa probable:</strong> holgura en el acople motor-eje. Inspecciona el acople y el par de apriete de la base.
        </p>
      )}
      <div className="acard-foot">
        <Cite label="Guía de fallas · §3.5" onOpen={onCite} />
        {node !== 0 && <SaveBtn saved={saved} onSave={onSave} />}
      </div>
    </div>
  );
}

/* ── Tipo 3 · Gráficos / Diagramas ───────────────────────── */
const DIAG_PINS = [
  { n: 1, x: 33, y: 26, label: "Tapa del rotor", note: "Cierre de bayoneta. Alinear la marca con el punto antes de girar." },
  { n: 2, x: 58, y: 47, label: "Rotor de ángulo fijo", note: "6 × 50 ml. No exceder el desbalance máximo de carga." },
  { n: 3, x: 44, y: 72, label: "Acople motor-eje", note: "Inspeccionar ante vibración (ver diagnóstico §3.5)." },
];
function DiagramAnswer({ saved, onSave, onCite }) {
  const [active, setActive] = useState(null);
  const toggle = (n) => setActive(active === n ? null : n);
  return (
    <div className="acard">
      <div className="q">Diagrama · rotor y cabezal</div>
      <div className="diag-img">
        <span className="ph-tag">DIAGRAMA TÉCNICO · DROP IMAGE</span>
        {DIAG_PINS.map((p) => (
          <button key={p.n} className={"pin" + (active === p.n ? " on" : "")} style={{ left: p.x + "%", top: p.y + "%" }} onClick={() => toggle(p.n)} aria-label={p.label}>{p.n}</button>
        ))}
        <span className="diag-zoom"><Icon name="zoom-in" size={14} />Pellizca para acercar</span>
      </div>
      <ol className="legend">
        {DIAG_PINS.map((p) => (
          <li key={p.n} className={active === p.n ? "on" : ""} onClick={() => toggle(p.n)}>
            <span className="ln">{p.n}</span>
            <div className="lc"><span className="lt">{p.label}</span>{active === p.n && <span className="lnote">{p.note}</span>}</div>
            <Icon name="chevron-right" size={15} />
          </li>
        ))}
      </ol>
      <div className="acard-foot">
        <Cite label="Plano VF-2 · fig. 4" onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}

/* ── Tipo 4 · Video ──────────────────────────────────────── */
const VID_CH = [["00:00", "Preparación y EPP"], ["01:12", "Extracción del rotor"], ["02:40", "Limpieza del eje"], ["03:55", "Montaje y balanceo"]];
const VID_TR = [["02:40", "Con el rotor fuera, limpia el eje con un paño sin pelusa."], ["02:52", "Verifica que no queden residuos en el asiento cónico.", true], ["03:08", "Aplica una capa fina del lubricante indicado."]];
function VideoAnswer({ saved, onSave, onCite }) {
  const [ch, setCh] = useState(2);
  const [tab, setTab] = useState("cap");
  return (
    <div className="acard">
      <div className="q">Video · montaje del rotor</div>
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
      {tab === "cap" && (
        <ul className="chapters">
          {VID_CH.map(([t, l], i) => (
            <li key={i} className={ch === i ? "on" : ""} onClick={() => setCh(i)}>
              <span className="tc">{t}</span><span className="cl">{l}</span>{ch === i && <Icon name="play" size={13} />}
            </li>
          ))}
        </ul>
      )}
      {tab === "tr" && (
        <div className="transcript">
          {VID_TR.map(([t, l, cur], i) => (
            <p key={i} className={cur ? "on" : ""}><span className="tc">{t}</span>{l}</p>
          ))}
        </div>
      )}
      <div className="acard-foot">
        <Cite label="Capacitación VF-2 · cap. 3" onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}

/* ── Tipo 6 · Historial ──────────────────────────────────── */
const HIST_F = ["Todo", "Esta semana", "Calibración", "Mantenimiento"];
const HIST_EV = [
  ["Hoy · 09:14", "Torque del perno B", "info", "gauge", [0, 1]],
  ["Ayer · 16:02", "Cambio del filtro de refrigerante", "guía", "wrench", [0, 1, 3]],
  ["12 may", "Vibración al arrancar — diagnóstico", "diagnóstico", "activity", [0]],
  ["08 may", "Calibración registrada · A. Ríos", "registro", "shield-check", [0, 2]],
];
function HistoryAnswer({ saved, onSave }) {
  const [f, setF] = useState(0);
  const ev = HIST_EV.filter((e) => e[4].includes(f));
  return (
    <div className="acard">
      <div className="q">Historial · CODO-LAB-04</div>
      <div className="hist-filters">
        {HIST_F.map((l, i) => (
          <button key={i} className={f === i ? "on" : ""} onClick={() => setF(i)}>{l}</button>
        ))}
      </div>
      <ul className="timeline">
        {ev.map(([d, t, tag, ic], i) => (
          <li key={i}>
            <span className="dot"><Icon name={ic} size={13} /></span>
            <div className="tl-c">
              <span className="tl-d">{d}</span>
              <span className="tl-t">{t}</span>
              <span className="tl-tag">{tag}</span>
            </div>
          </li>
        ))}
        {ev.length === 0 && <li className="tl-empty">Sin registros para este filtro.</li>}
      </ul>
      <div className="patterns">
        <div className="ph"><Icon name="sparkles" size={15} />Patrones detectados</div>
        <p>Consultas el <strong>torque del perno B</strong> antes de cada arranque de turno. DOCYAN puede unir tus consultas recurrentes en un Playbook.</p>
        <button className="sug pat-cta" onClick={onSave}><Icon name="git-branch" size={14} />Proponer Playbook</button>
      </div>
    </div>
  );
}

/* ── Tipo 7 · Alertas ────────────────────────────────────── */
const ALERTS = [
  { sev: "warn", grp: "Por vencer · ≤ 7 días", title: "Calibración de la centrífuga", meta: "Vence en 4 días · 07 jun", cite: "Certificado CAL-22-117" },
  { sev: "caution", grp: "Próximas · ≤ 30 días", title: "MSDS del refrigerante", meta: "Expira en 22 días · 25 jun", cite: "DOC-MSDS-REF-03" },
  { sev: "caution", grp: "Próximas · ≤ 30 días", title: "Certificación del colaborador", meta: "Renovación en 28 días · A. Ríos", cite: "RH · CERT-OP-AR" },
];
function AlertCard({ a, onCite }) {
  const [state, setState] = useState(null);
  return (
    <div className={"alert-card s-" + a.sev + (state ? " done" : "")}>
      <div className="al-top">
        <span className="al-t">{a.title}</span>
        {state && <span className="al-state">{state === "read" ? "Leída" : "Pospuesta"}</span>}
      </div>
      <span className="al-m">{a.meta}</span>
      <div className="al-foot">
        <Cite label={a.cite} onOpen={onCite} />
        {!state && (
          <div className="al-acts">
            <button onClick={() => setState("read")}>Marcar leída</button>
            <button onClick={() => setState("snooze")}>Posponer</button>
          </div>
        )}
      </div>
    </div>
  );
}
function AlertsAnswer({ saved, onSave, onCite }) {
  const groups = [...new Set(ALERTS.map((a) => a.grp))];
  return (
    <div className="acard">
      <div className="q">Alertas administrativas</div>
      <div className="admin-banner"><Icon name="info" size={15} />Recordatorio administrativo — no es una instrucción operativa.</div>
      {groups.map((g) => (
        <div className="alert-group" key={g}>
          <div className="ag-lab">{g}</div>
          {ALERTS.filter((a) => a.grp === g).map((a, i) => <AlertCard key={i} a={a} onCite={onCite} />)}
        </div>
      ))}
      <div className="acard-foot">
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}

/* ── Tipo 8 · Comparativa ────────────────────────────────── */
const DIFF = [
  { k: "chg", lab: "Torque del perno B", from: "80 N·m", to: "85 N·m" },
  { k: "add", text: "Etapa de apriete en cruz en 3 pasos (40 → 65 → 85)." },
  { k: "del", text: "Lubricación del perno antes del montaje." },
];
function CompareAnswer({ saved, onSave, onCite }) {
  return (
    <div className="acard">
      <div className="q">Comparativa · Manual VF-2</div>
      <div className="cmp-vers">
        <span className="ver old">Rev. C<small>mar 2025</small></span>
        <Icon name="arrow-right" size={15} />
        <span className="ver new">Rev. D<small>vigente</small></span>
      </div>
      <ul className="diff">
        {DIFF.map((d, i) => (
          <li key={i} className={"d-" + d.k}>
            {d.k === "chg" ? (
              <><span className="dm">~</span><span className="dt">{d.lab}: <s>{d.from}</s> → <b>{d.to}</b></span></>
            ) : (
              <><span className="dm">{d.k === "add" ? "+" : "−"}</span><span className="dt">{d.text}</span></>
            )}
          </li>
        ))}
      </ul>
      <div className="cmp-sum"><span className="cs-lab">Resumen</span>La Rev. D endurece el apriete del perno B y formaliza el patrón en cruz; elimina la lubricación previa.</div>
      <div className="patterns slim">
        <div className="ph"><Icon name="sparkles" size={15} />Insight</div>
        <p>3 consultas usaron el valor antiguo (80 N·m) esta semana. DOCYAN sugiere notificar al turno.</p>
      </div>
      <div className="acard-foot">
        <Cite label="VF-2 · §4.2.1 · Δ rev." onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}

function ConsultScreen({ saved, onSave, onOpenSheet, onOpenSource }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const convoRef = useRef(null);

  const ask = useCallback((key, label) => {
    const a = ANSWERS[key] || { kind: "info", q: label, value: "—", unit: "", mode: "synth", note: "Consulta de ejemplo. En producto real, DOCYAN clasifica la intención y renderiza la respuesta.", cite: "Documento fuente · §" };
    setMsgs((m) => [...m, { role: "user", text: label }, { role: "answer", a, id: Date.now() }]);
    setText("");
  }, []);

  useEffect(() => { const c = convoRef.current; if (c) c.scrollTop = c.scrollHeight; }, [msgs]);

  const answeredCount = msgs.filter((m) => m.role === "answer").length;
  const showNudge = saved.length >= 2;

  return (
    <>
      <div className="ctx">
        <Mark size={26} />
        <div className="ctx-t">
          <div className="ctx-lab">Estás consultando</div>
          <div className="ctx-name"><span className="ctx-codo">CODO-LAB-04</span> · Centrífuga Hettich</div>
        </div>
        <button className="icon-btn" onClick={onOpenSheet} aria-label="Mis consultas"><Icon name="bookmark" size={19} /></button>
      </div>

      <div className="convo" ref={convoRef}>
        <div className="entity-card">
          <div className="eh">
            <div className="ic"><Icon name="scan-line" size={21} /></div>
            <div>
              <h3>Centrífuga Hettich Rotina 380</h3>
              <div className="meta">QR escaneado · 4 documentos vivos</div>
            </div>
          </div>
          <div className="sugs">
            {SUGGESTIONS.map(([ic, q, key]) => (
              <button className="sug" key={key} onClick={() => ask(key, q)}>
                <Icon name={ic} size={15} />{q}<span className="ar">→</span>
              </button>
            ))}
          </div>
        </div>

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div className="bubble-user" key={i}>{m.text}</div>
          ) : (
            <div className="answer" key={i}>
              <ModeLine mode={m.a.mode} />
              {m.a.kind === "info" && <InfoAnswer a={m.a} saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.q || m.a.title)} onCite={onOpenSource} />}
              {m.a.kind === "steps" && <StepsAnswer a={m.a} saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.title)} onCite={onOpenSource} />}
              {m.a.kind === "troubleshoot" && <TroubleshootAnswer saved={saved.includes(m.id)} onSave={() => onSave(m.id, "Vibración al arrancar")} onCite={onOpenSource} />}
              {m.a.kind === "diagram" && <DiagramAnswer saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.title)} onCite={onOpenSource} />}
              {m.a.kind === "video" && <VideoAnswer saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.title)} onCite={onOpenSource} />}
              {m.a.kind === "history" && <HistoryAnswer saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.title)} />}
              {m.a.kind === "alerts" && <AlertsAnswer saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.title)} onCite={onOpenSource} />}
              {m.a.kind === "compare" && <CompareAnswer saved={saved.includes(m.id)} onSave={() => onSave(m.id, m.a.title)} onCite={onOpenSource} />}
            </div>
          )
        )}

        {showNudge && (
          <div className="nudge">
            <div className="nh"><Icon name="git-branch" size={17} />Encadena tus consultas</div>
            <p>Guardaste varias consultas sobre la centrífuga. Un <strong>Playbook</strong> es una secuencia que repites como rutina — DOCYAN puede unirlas en una.</p>
            <div className="acts">
              <button className="sug" style={{ background: "var(--cinnabar-500)", color: "#fff", border: "none", justifyContent: "center", fontWeight: 600 }} onClick={onOpenSheet}>Crear Playbook</button>
            </div>
          </div>
        )}
      </div>

      <div className="qbar">
        <form className="qbox" onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask("free", text.trim()); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Pregunta sobre este equipo…" />
          <button type="button" className="mic" aria-label="Voz a texto"><Icon name="mic" size={19} /></button>
          <button type="submit" className="send" aria-label="Enviar"><Icon name="arrow-up" size={19} /></button>
        </form>
      </div>
    </>
  );
}

Object.assign(window, { ConsultScreen });
