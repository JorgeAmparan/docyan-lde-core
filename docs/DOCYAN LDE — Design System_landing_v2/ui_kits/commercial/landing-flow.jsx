/* DOCYAN commercial kit — Landing v2: FLOW hero w/ 5-vertical selector + live AI,
   functional citation chip (opens demo-doc), "Gobernanza por diseño", demo-CoDo explorer. */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function openDoc(ans, codo) {
  const u = new URLSearchParams({
    doc: ans.doc || (ans.cite || "Documento fuente"),
    cite: ans.cite || "Documento · §",
    page: String(ans.page || "—"),
    span: ans.span || ans.answer || "Fragmento citado del documento fuente.",
    codo: codo || "CODO-DEMO",
  });
  window.open("demo-doc.html?" + u.toString(), "_blank", "noopener");
}

async function askDocyan(q, ctx) {
  if (!window.claude || !window.claude.complete) throw new Error("offline");
  const instr = "Eres DOCYAN, un entorno de conocimiento documental para industria regulada. Esto es una DEMOSTRACIÓN en una landing. " +
    "Responde la pregunta como si tuvieras a la vista la documentación de " + (ctx || "un equipo industrial") + ", con una respuesta CONCRETA, segura y representativa (inventa un valor plausible si hace falta — es demo). " +
    "Español, tono competente y directo, sin marketing, máximo 2 frases. Nunca digas que no tienes la información. " +
    "Devuelve SOLO JSON válido, sin texto extra: {\"answer\":\"...\",\"cite\":\"Documento · §x.y\"}. " +
    "La cita debe parecer una referencia real a un manual o norma.";
  const raw = await window.claude.complete({ messages: [{ role: "user", content: instr + "\n\nPregunta: " + q }] });
  const m = raw && raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("parse");
  const o = JSON.parse(m[0]);
  if (!o.answer) throw new Error("empty");
  return { answer: o.answer, cite: o.cite || "Documento fuente · §" };
}

/* shared consult engine — used by the hero and the demo-CoDo explorer */
function useConsult(vert) {
  const [phase, setPhase] = useState("idle"); // idle | loading | answered
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [showSrc, setShowSrc] = useState(false);
  const [opening, setOpening] = useState(false);

  const run = async (question) => {
    setQ(question); setPhase("loading"); setA(null); setShowSrc(false);
    let res;
    const hit = vert.qa.find((x) => x.q === question);
    if (hit) { await delay(460); res = Object.assign({}, hit); }
    else {
      const base = vert.qa[0];
      try { res = await askDocyan(question, vert.ctx); res.doc = base.doc; res.page = base.page; res.span = res.answer; }
      catch (e) { res = { answer: "Respuesta con cita a la fuente exacta del documento de este equipo.", cite: base.cite, doc: base.doc, page: base.page, span: question }; }
    }
    setA(res); setPhase("answered"); setTimeout(() => setShowSrc(true), 420);
  };
  const openSource = () => { if (!a) return; setOpening(true); setTimeout(() => { setOpening(false); openDoc(a, vert.codo); }, 220); };
  const reset = () => { setPhase("idle"); setA(null); setQ(""); setShowSrc(false); setOpening(false); };
  return { phase, q, a, showSrc, opening, run, openSource, reset };
}

function AnswerCard({ c }) {
  const { phase, q, a, showSrc, opening, openSource } = c;
  return (
    <>
      <div className="demo-q">{q}</div>
      {phase === "loading" && <div className="demo-shimmer"><span className="sh-dot" />DOCYAN está buscando en el documento…</div>}
      {phase === "answered" && a && (
        <div className="demo-a">
          <p className="da-text">{a.answer}</p>
          <div className="da-cite-row">
            <span className="tipwrap" data-tip={"Abrir documento · pág. " + (a.page || "—") + "  ↗"}>
              <button className={"cite chip-fn" + (showSrc ? " threaded" : "")} onClick={openSource}><span className="brk" />{a.cite} <span className="ext">↗</span></button>
            </span>
            <button className="openpdf" onClick={openSource}><Icon name="external-link" size={13} />Abrir PDF</button>
          </div>
          {opening && <div className="demo-shimmer op"><span className="sh-dot" />Abriendo documento fuente…</div>}
          {showSrc && !opening && (
            <div className="da-src"><span className="thread" /><div className="src-doc"><Icon name="file-text" size={13} /><span>Fuente · <mark>{a.cite}</mark></span><span className="src-tag">span resaltado</span></div></div>
          )}
        </div>
      )}
    </>
  );
}

function HeroFlow({ go }) {
  const [vkey, setVkey] = useState("lab");
  const vert = VERTICALS.find((v) => v.key === vkey) || VERTICALS[0];
  const c = useConsult(vert);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus({ preventScroll: true }); }, []);

  const pickVert = (k) => { setVkey(k); c.reset(); setText(""); };
  const submit = (e) => { e.preventDefault(); if (text.trim()) { c.run(text.trim()); setText(""); } };

  return (
    <div className="wrap">
      <div className="hero hero-flow">
        <div className="hero-copy">
          <div className="hero-brand"><Mark size={30} /><span className="hb-wm">DOCYAN<span className="hb-lde">LDE</span></span><span className="hb-by">by XCID</span></div>
          <span className="eyebrow">Live Document Environment</span>
          <h1>Pregúntale a tus documentos. Te responden con la fuente.</h1>
          <p className="sub">Escanea el QR del equipo, pregunta en lenguaje natural y obtén respuesta con cita al fragmento exacto. Pruébalo aquí — con tu vertical.</p>
          <div className="cta">
            <button className="btn primary lg" onClick={() => go("signup")}><Icon name="calendar" size={17} />Agendar demo de 30 min</button>
            <button className="btn sec lg" onClick={() => go("pricing")}>Ver planes</button>
          </div>
          <div className="hero-trust">
            <span><Icon name="scan-line" size={14} />QR persistente</span>
            <span><Icon name="link" size={14} />Cita cliqueable</span>
            <span><Icon name="globe" size={14} />ES · EN nativo</span>
            <span><Icon name="zap" size={14} />Time-to-value en días</span>
            <span><Icon name="shield-check" size={14} />Sin alucinaciones por diseño</span>
            <span><Icon name="scale" size={14} />Gobernanza activa por criticidad</span>
          </div>
        </div>

        <div className="hero-demo">
          <div className="vsel" role="tablist">
            {VERTICALS.map((v) => (
              <button key={v.key} className={"vtab" + (v.key === vkey ? " on" : "")} onClick={() => pickVert(v.key)}><Icon name={v.icon} size={14} />{v.label}</button>
            ))}
          </div>

          <div className="demo-wrap">
            <div className="demo-card" key={vkey}>
              <div className="demo-top">
                <div className="mctx"><Mark size={20} /><div><div className="ml">Estás consultando</div><div className="mn">{vert.codo} · {vert.entity}</div></div></div>
                <span className="demo-live"><span className="lv-dot" />DEMO EN VIVO</span>
              </div>

              <div className="demo-body">
                {c.phase === "idle" ? (
                  <div className="demo-empty"><Icon name={vert.icon} size={22} /><p>Toca una pregunta — o escribe la tuya — y mira cómo DOCYAN responde con su cita.</p></div>
                ) : <AnswerCard c={c} />}
              </div>

              <div className="demo-sugs">
                {vert.qa.map((x) => <button key={x.q} className="demo-sug" onClick={() => c.run(x.q)} disabled={c.phase === "loading"}>{x.q}</button>)}
              </div>
              <form className="demo-box" onSubmit={submit}>
                {!text && !focused && <span className="dcaret" aria-hidden="true" />}
                <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Escribe tu propia pregunta…" />
                <button type="submit" className="db-send" aria-label="Preguntar" disabled={c.phase === "loading"}><Icon name="arrow-up" size={17} /></button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* below the hero — explore a full demo CoDo */
function DemoExplore({ go }) {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Demo sin registro</span>
        <h2 className="sec-title">Explora un CoDo demo completo.</h2>
        <p className="sec-lead">Sin registro. Sin cargar nada. Navega documentación real de tu vertical como si fuera tu acervo.</p>
        <div className="demo-grid">
          {VERTICALS.map((v) => (
            <div className="dx-card" key={v.key}>
              <div className="dx-ic"><Icon name={v.icon} size={20} /></div>
              <h3>{v.label}</h3>
              <p>{v.blurb}</p>
              <div className="dx-count">3 documentos · 1 entidad operativa · ~12 consultas posibles</div>
              <button className="btn primary" onClick={() => go("demo:" + v.key)}>Explorar este CoDo<Icon name="arrow-right" size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* three levels — connected progression (1 → 2 → 3) */
function ThreeLevelsFlow() {
  return (
    <section className="band ink">
      <div className="wrap">
        <span className="eyebrow">Tres niveles</span>
        <h2 className="sec-title">De la consulta de hoy al foso de mañana.</h2>
        <div className="levels-flow">
          <div className="lvl-card">
            <div className="lv-badge"><span className="lv-n">01</span>Nivel 1</div>
            <div className="lv-vis v1">
              <div className="lvq">¿Torque del perno B?</div>
              <div className="lva"><span className="lvbig">85<small> N·m</small></span><span className="cite sm"><span className="brk" />§4.2.1</span></div>
            </div>
            <h3>Consulta viva</h3>
            <p>Documento consultable en tiempo real, en el punto de uso, con cita cliqueable a la fuente.</p>
          </div>
          <div className="lvl-arrow"><Icon name="chevron-right" size={20} /></div>
          <div className="lvl-card">
            <div className="lv-badge"><span className="lv-n">02</span>Nivel 2</div>
            <div className="lv-vis v2">
              <div className="lvstep"><span>1</span>Pregunta</div>
              <div className="lvstep"><span>2</span>Calibración</div>
              <div className="lvstep"><span>3</span>Arranque</div>
            </div>
            <h3>Conocimiento capturado</h3>
            <p>El colaborador captura cómo consulta — qué pregunta y en qué orden — como un Playbook reutilizable.</p>
          </div>
          <div className="lvl-arrow"><Icon name="chevron-right" size={20} /></div>
          <div className="lvl-card">
            <div className="lv-badge"><span className="lv-n">03</span>Nivel 3</div>
            <div className="lv-vis v3">
              <span className="lvnode n1" /><span className="lvnode n2" /><span className="lvnode n3" />
              <div className="lvhub"><Icon name="disc-3" size={20} /></div>
              <div className="lvpat">3 equipos · mismo patrón</div>
            </div>
            <h3>Inteligencia organizacional</h3>
            <p>Las consultas y anotaciones retienen el saber tácito cuando la gente se va.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* gobernanza por diseño — 4 connected layers */
const GOV = [
  ["link-2", "Pedigree cliqueable a span", "Cada respuesta liga a la fuente exacta en el documento. Si el sistema no puede ligarla, no la sirve.", "abre el PDF y revisa"],
  ["scale", "Umbrales por criticidad", "Cada respuesta lleva un score de confianza. Seguridad ≥0.95, regulatorio ≥0.90, calidad ≥0.85 — si no alcanza, escala a humano.", "no la sirve como cierta"],
  ["octagon-x", "Freno de alucinación", "Si detecta una cifra, una norma o un identificador fabricado, bloquea la respuesta antes de servirla. Es función del sistema, no opción.", "bloquea antes de servir"],
  ["lock", "Cadena criptográfica SHA-256", "Cada respuesta y cada decisión de gobernanza queda en una cadena inmutable. Alterar un evento la rompe. Un auditor lo verifica en segundos.", "verificable en segundos"],
];
function GovernanceSection() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Gobernanza por diseño</span>
        <h2 className="sec-title">No solo cita. Gobierna lo que sirve y bloquea lo que no puede sustentar.</h2>
        <div className="gov-flow">
          {GOV.map(([ic, h, p, tag], i) => (
            <React.Fragment key={h}>
              <div className="gov-card">
                <div className="gov-top"><span className="gov-n">0{i + 1}</span><span className="gov-ic"><Icon name={ic} size={19} /></span></div>
                <h3>{h}</h3><p>{p}</p>
                <span className="gov-tag"><Icon name="check" size={12} />{tag}</span>
              </div>
              {i < GOV.length - 1 && <div className="gov-link"><Icon name="chevron-right" size={18} /></div>}
            </React.Fragment>
          ))}
        </div>
        <p className="gov-close">Las cuatro capas operan en runtime, en cada consulta, por cada usuario. No son promesas de marketing. Son el sistema.</p>
      </div>
    </section>
  );
}

/* the moat — expediente esquemático as marketing visual */
const MOAT_NODES = [
  ["top", "file-text", "Documentos"], ["right", "ruler", "Calibración"],
  ["bottom", "bell", "Alertas"], ["left", "list-checks", "Procedimientos"],
];
function MoatSchematic() {
  return (
    <section className="band">
      <div className="wrap two-col moat">
        <div>
          <span className="eyebrow">El foso</span>
          <h2 className="sec-title">Cada equipo se vuelve un expediente vivo.</h2>
          <p className="sec-lead">DOCYAN conecta cada entidad operativa con sus documentos, procedimientos, calibraciones y alertas — un objeto cognitivo que retiene el conocimiento de tu organización, no una carpeta más.</p>
          <div className="moat-pts">
            {[["Relaciones, no archivos sueltos", "git-fork"], ["Patrones detectados por uso", "sparkles"], ["El saber tácito se queda", "brain"]].map(([t, ic]) => (
              <div className="moat-pt" key={t}><Icon name={ic} size={17} />{t}</div>
            ))}
          </div>
        </div>
        <div className="moat-vis">
          <div className="moat-grid">
            {MOAT_NODES.map(([pos, ic, label]) => (
              <div className={"moat-node " + pos} key={pos}><Icon name={ic} size={15} /><span>{label}</span></div>
            ))}
            <div className="moat-hub"><Icon name="disc-3" size={24} /><span className="mh-id">CODO-LAB-04</span><span className="mh-n">Centrífuga Hettich</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFlow({ go }) {
  return (
    <>
      <HeroFlow go={go} />
      <DemoExplore go={go} />
      <Problem />
      <HowItWorks />
      <ThreeLevelsFlow />
      <GovernanceSection />
      <MoatSchematic />
      <Verticals />
      <Differentiators />
      <Regulatory />
      <Footer go={go} />
    </>
  );
}

Object.assign(window, { LandingFlow, HeroFlow, DemoExplore, GovernanceSection, delay, askDocyan, openDoc });
