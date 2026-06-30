/* DOCYAN — Superficie de ENTRADA (pre-login) · portada de ui_kits/onboarding/
   {atoms,auth,onboarding-flow}.jsx al prototipo (fuente de verdad única).
   Todo local salvo EntryFlow (window) para no colisionar con el prototipo.
   Estilos en app/entry.css, todos prefijados con `.entry`. */
const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

/* ── átomos ──────────────────────────────────────────────── */
function EMark({ size = 26, tone = "ink" }) {
  const stroke = tone === "light" ? "var(--amate-50)" : "var(--fg)";
  const dot = tone === "light" ? "#D9633F" : "#CF4124";
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="DOCYAN">
    <g stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 23 V13 H23" /><path d="M41 13 H51 V23" /><path d="M51 41 V51 H41" /><path d="M23 51 H13 V41" />
    </g>
    <rect x="25.5" y="25.5" width="13" height="13" rx="3" fill={dot} />
  </svg>;
}
function EBrandRow({ size = 26, tone = "ink" }) {
  return <div className={"brand-row" + (tone === "light" ? " light" : "")}><EMark size={size} tone={tone} /><span className="wm">DOCYAN<span className="lde">LDE</span></span></div>;
}
function ECite({ label, dark, onClick }) {
  return <button className={"cite" + (dark ? " dark" : "")} onClick={onClick}><span className="brk" />{label} <span style={{ opacity: .6 }}>↗</span></button>;
}
function ePwScore(v) { if (!v) return 0; let s = 0; if (v.length >= 8) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/[0-9\W]/.test(v)) s++; return s; }
function EPwField({ label = "Contraseña", value, onChange, show, setShow, strength, placeholder = "Mínimo 8 caracteres" }) {
  const sc = ePwScore(value);
  return <div className="field"><label>{label}</label>
    <div className="inp">
      <input type={show ? "text" : "password"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <button className="eye" type="button" aria-label={show ? "Ocultar" : "Mostrar"} onClick={() => setShow(!show)}><Icon name={show ? "eye-off" : "eye"} size={17} /></button>
    </div>
    {strength && value && <div className="pwbar"><i className={sc >= 1 ? (sc === 1 ? "mid" : "on") : ""} /><i className={sc >= 2 ? (sc === 2 ? "mid" : "on") : ""} /><i className={sc >= 3 ? "on" : ""} /></div>}
  </div>;
}

/* ── value aside (panel tinta) ───────────────────────────── */
function ValueAside({ tag, title, sub, points, object }) {
  return <aside className="auth-aside">
    <div className="aside-top"><EBrandRow tone="light" size={28} />{tag && <span className="aside-tag">{tag}</span>}</div>
    <div className="aside-mid">
      <h1>{title}</h1>
      {sub && <p className="aside-sub">{sub}</p>}
      {points && <ul className="aside-points">{points.map((p, i) => <li key={i}><span className="ap-ic"><Icon name={p[0]} size={16} /></span><span><b>{p[1]}</b><span className="ap-m">{p[2]}</span></span></li>)}</ul>}
      {object}
    </div>
    <div className="aside-foot"><span className="d" />XCID SA de CV · México · multi-tenant aislado por organización</div>
  </aside>;
}
function AsideMock() {
  return <div className="aside-object">
    <span className="ao-q">¿Torque del perno B?</span>
    <div className="ao-a"><div className="ao-big">85 <small>N·m</small></div><span className="cite dark"><span className="brk" />Manual VF-2 · §4.2.1 ↗</span></div>
  </div>;
}

/* ── 1 · Signup freemium ─────────────────────────────────── */
function SignupFreemium({ go }) {
  const [email, setEmail] = useStateE("");
  const [pw, setPw] = useStateE("");
  const [show, setShow] = useStateE(false);
  return <div className="auth-stage"><div className="auth-split">
    <ValueAside tag="Gratis · sin tarjeta" title="Empieza hoy. Sin fricción."
      sub="Crea tu cuenta y vive el producto: ingiere un documento y haz tu primera consulta con cita a la fuente. El plan viene después."
      points={[["file-check", "3 documentos vivos · 30 días", "Suficiente para ver el valor en tu propia operación."], ["scan-line", "Ingiere tus documentos como están", "PDF, manual, MSDS o ficha. DOCYAN los lee tal cual."], ["link", "Cada respuesta cita su fuente exacta", "Pedigree a span exacto, no resúmenes opacos."]]}
      object={<AsideMock />} />
    <div className="auth-form"><div className="auth-card">
      <div className="ac-head"><EBrandRow size={26} /><h2>Crea tu cuenta</h2><p className="ac-sub">Solo necesitas un correo y una contraseña. Sin plan, sin datos fiscales, sin pago.</p></div>
      <div className="field"><label>Correo de trabajo</label><input type="email" placeholder="nombre@laboratorio.mx" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <EPwField value={pw} onChange={setPw} show={show} setShow={setShow} strength />
      <button className="btn primary full lg" style={{ marginTop: 6 }} onClick={() => go("onboarding")}>Crear cuenta gratis<Icon name="arrow-right" size={17} /></button>
      <p className="auth-foot" style={{ marginTop: 14 }}>Al crear tu cuenta aceptas los términos y el aviso de privacidad de DOCYAN.</p>
      <div className="auth-div">o</div>
      <button className="btn sec full" onClick={() => go("redeem")}><Icon name="ticket" size={16} />Tengo un código de acceso</button>
      <p className="auth-foot">¿Ya tienes cuenta? <span className="link" onClick={() => go("login")}>Inicia sesión</span></p>
    </div></div>
  </div></div>;
}

/* ── 2 · Login ───────────────────────────────────────────── */
function Login({ go }) {
  const [show, setShow] = useStateE(false);
  return <div className="auth-stage"><div className="auth-form" style={{ width: "100%" }}>
    <div className="auth-card auth-centered">
      <div className="ac-head" style={{ textAlign: "center" }}><div style={{ display: "inline-flex" }}><EBrandRow size={30} /></div><h2>Bienvenido de vuelta</h2><p className="ac-sub">Ingresa a tu organización para gestionar documentos, CoDos e invitaciones.</p></div>
      <div className="field"><label>Correo</label><input type="email" defaultValue="jorge.medina@lab-estandar.mx" /></div>
      <EPwField label="Contraseña" value={"contraseña"} onChange={() => {}} show={show} setShow={setShow} placeholder="••••••••••" />
      <div className="field-row"><label className="chk"><input type="checkbox" defaultChecked />Recordarme</label><span className="link">¿Olvidaste tu contraseña?</span></div>
      <button className="btn primary full lg" onClick={() => go("enter")}>Entrar<Icon name="arrow-right" size={17} /></button>
      <div className="qr-alt"><Icon name="scan-line" size={18} /><div><div className="qa-t">¿Eres colaborador?</div><div className="qa-m">Escanea el QR del equipo para consultar — sin cuenta ni login.</div></div></div>
      <p className="auth-foot">¿Aún no tienes cuenta? <span className="link" onClick={() => go("signup")}>Empieza gratis</span></p>
    </div>
  </div></div>;
}

/* ── 3 · Canje de código (puerta Piloto, −30%) ───────────── */
function RedeemCode({ go }) {
  const [code, setCode] = useStateE(["", "", "", "", "", ""]);
  const [validated, setValidated] = useStateE(false);
  const [show, setShow] = useStateE(false);
  const [pw, setPw] = useStateE("");
  const refs = useRefE([]);
  const filled = code.every((c) => c);
  const setChar = (i, v) => { const c = [...code]; c[i] = v.slice(-1).toUpperCase(); setCode(c); if (v && i < 5) refs.current[i + 1]?.focus(); };
  const onKey = (i, e) => { if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus(); };
  return <div className="auth-stage"><div className="auth-split">
    <ValueAside tag="Acceso piloto" title="Entras con tu plan ya activo."
      sub="A diferencia del registro gratuito, un código de acceso piloto activa de inmediato el plan Esencial con tu precio especial. Listo para ingerir y consultar."
      points={[["badge-check", "Plan Esencial-piloto activo al entrar", "Sin periodo de prueba ni límite de 3 documentos."], ["percent", "Precio piloto bloqueado", "Tu tarifa preferente se mantiene durante el programa."], ["headset", "Acompañamiento directo de DOCYAN", "Onboarding y soporte cercano del equipo XCID."]]} />
    <div className="auth-form"><div className="auth-card">
      <div className="ac-head"><EBrandRow size={26} /><h2>Canjea tu código</h2><p className="ac-sub">Ingresa el código de acceso que te compartió DOCYAN.</p></div>
      <div className="field" style={{ marginBottom: 10 }}><label>Código de acceso</label>
        <div className="code-input">{code.map((c, i) => <React.Fragment key={i}><input ref={(el) => (refs.current[i] = el)} value={c} maxLength={1} onChange={(e) => setChar(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} />{i === 2 && <span className="dash">–</span>}</React.Fragment>)}</div>
        <span className="hint" style={{ textAlign: "center" }}>Pista de demo: escribe <b className="mono">PIL-OTO</b></span>
      </div>
      {!validated && <button className="btn primary full lg" disabled={!filled} onClick={() => setValidated(true)}>Validar código<Icon name="arrow-right" size={17} /></button>}
      {validated && <>
        <div className="pilot-card">
          <div className="pc-top"><Icon name="badge-check" size={18} /><span className="pc-t">Código válido — Plan Esencial-piloto</span><span className="pc-tag">Activo</span></div>
          <div className="pc-body">
            <div className="pc-row"><span className="pc-list">$250 USD/mes</span><span className="pc-now">$175<span className="pc-per"> USD/mes</span></span><span className="pc-save">−30% piloto</span></div>
            <ul className="pc-feat">
              <li><Icon name="check" size={15} />Hasta 50 documentos vivos</li>
              <li><Icon name="check" size={15} />10 documentos de arranque + 3/mes</li>
              <li><Icon name="check" size={15} />Colaboradores con QR ilimitados</li>
              <li><Icon name="check" size={15} />Precio bloqueado durante el programa piloto</li>
            </ul>
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}><label>Correo de trabajo</label><input type="email" placeholder="nombre@laboratorio.mx" /></div>
        <EPwField value={pw} onChange={setPw} show={show} setShow={setShow} strength />
        <button className="btn primary full lg" style={{ marginTop: 6 }} onClick={() => go("onboarding")}>Activar mi cuenta piloto<Icon name="arrow-right" size={17} /></button>
      </>}
      <p className="auth-foot">¿No tienes código? <span className="link" onClick={() => go("signup")}>Empieza gratis</span></p>
    </div></div>
  </div></div>;
}

/* ── overlay de fuente (pedigree) ────────────────────────── */
function SourceModal({ onClose }) {
  return <div className="src-overlay" onClick={onClose}><div className="src-modal" onClick={(e) => e.stopPropagation()}>
    <div className="src-head"><div><h3>Manual operativo de CNC</h3><div className="sh-eyebrow">PLAN DE MANTENIMIENTO · §9</div></div><button className="sh-x" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={20} /></button></div>
    <div className="src-doc-body">
      <p>Antes de aplicar cualquier valor, verifica que las superficies de contacto estén limpias y que el equipo se encuentre en estado seguro. Confirma la vigencia de los registros asociados del CoDo.</p>
      <p>En las condiciones definidas para esta entidad operativa, aplica lo siguiente. <span className="hl-span">Mantenimiento programado: cambio de aceite del husillo cada 500 h; calibración del palpador semestral.</span> Repite la verificación una segunda vez para asegurar el asentamiento y la consistencia del registro.</p>
      <p>Tras completar el procedimiento, registra el valor y la fecha en la bitácora del equipo. La trazabilidad de cada acción queda encadenada criptográficamente en el FAT de DOCYAN.</p>
    </div>
    <div className="src-foot"><span className="sf-l"><Icon name="shield-check" size={15} />Pedigree a span exacto · cadena SHA-256</span><button className="openpdf">Abrir PDF<Icon name="external-link" size={13} /></button></div>
  </div></div>;
}
const ONB_SUGS = ["¿Qué mantenimiento tengo pendiente?", "¿Cada cuánto cambio el aceite del husillo?", "¿Cuándo calibro el palpador?"];
function OnbConsult({ onAha }) {
  const [phase, setPhase] = useStateE("idle");
  const [q, setQ] = useStateE("");
  const [src, setSrc] = useStateE(false);
  const ask = (question) => { setQ(question); setPhase("asking"); setTimeout(() => { setPhase("done"); onAha && onAha(); }, 1150); };
  return <>
    <div className="consult">
      <div className="consult-top"><span className="mctx-ic"><Icon name="folder-tree" size={17} /></span><div><div className="ml">Estás consultando</div><div className="mn">CODO-MAQ-02 · Línea CNC Haas VF-4</div></div><span className="live"><span className="d" />en vivo</span></div>
      <div className="consult-body">
        {phase === "idle" && <div className="consult-empty"><Icon name="message-square-text" size={26} /><p>Elige una pregunta para ver cómo DOCYAN responde con cita a la fuente.</p></div>}
        {phase !== "idle" && <div className="cq">{q}</div>}
        {phase === "asking" && <div className="shimmer"><span className="d" />DOCYAN está buscando en tu documento…</div>}
        {phase === "done" && <div className="ca">
          <div className="ca-big">500 <span className="u">h</span></div>
          <p className="ca-note">Cambio de aceite del husillo cada <b>500 horas</b>; calibración del palpador semestral. Recordatorio administrativo — no es una instrucción operativa.</p>
          <div className="ca-cite-row"><ECite label="Manual operativo de CNC · §9" onClick={() => setSrc(true)} /><button className="openpdf" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--fg)", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", padding: "7px 12px", cursor: "pointer" }} onClick={() => setSrc(true)}><Icon name="file-text" size={13} />Ver fuente</button></div>
        </div>}
      </div>
      <div className="consult-sugs">{ONB_SUGS.map((s) => <button key={s} className="consult-sug" disabled={phase !== "idle"} onClick={() => ask(s)}>{s}</button>)}</div>
    </div>
    {src && <SourceModal onClose={() => setSrc(false)} />}
  </>;
}
function OnbProcessing({ onDone }) {
  const stages = ["Leyendo el documento como está", "Extrayendo entidades operativas", "Indexando y encadenando (FAT)"];
  const [i, setI] = useStateE(0);
  const [done, setDone] = useStateE(false);
  useEffectE(() => {
    if (done) return;
    if (i >= stages.length) { setDone(true); onDone && onDone(); return; }
    const t = setTimeout(() => setI(i + 1), 850);
    return () => clearTimeout(t);
  }, [i, done]);
  return <div>
    <div className="proc"><div className="proc-steps">{stages.map((s, k) => {
      const cls = done || k < i ? "done" : k === i ? "active" : "pending";
      return <div key={k} className={"proc-step " + cls}>
        <span className="ps-ic">{(done || k < i) ? <Icon name="check" size={14} /> : k === i ? <Icon name="loader-2" size={14} className="spin" /> : <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--border-strong)" }} />}</span>
        <span className="ps-t">{s}</span>
        {(done || k < i) && <span className="ps-stat">listo</span>}
        {k === i && !done && <span className="ps-stat">en curso…</span>}
      </div>;
    })}</div></div>
    {done && <div className="entity-out" style={{ animation: "rise .3s var(--ease-out)" }}>
      <span className="eo-ic"><Icon name="check" size={20} /></span>
      <div><div className="eo-t">CoDo creado · entidad detectada</div><div className="eo-n">Línea CNC Haas VF-4</div><div className="eo-id">CODO-MAQ-02 · 1 documento vivo</div></div>
    </div>}
  </div>;
}
const ONB_STEPS = [["sparkles", "Bienvenida"], ["upload-cloud", "Tu primer documento"], ["cpu", "DOCYAN lo procesa"], ["scan-line", "Tu primera consulta"], ["check-circle-2", "Listo"]];
function OnboardingFlow({ go }) {
  const [step, setStep] = useStateE(0);
  const [picked, setPicked] = useStateE(false);
  const [processed, setProcessed] = useStateE(false);
  const [aha, setAha] = useStateE(false);
  const cur = ONB_STEPS[step];
  const pct = Math.round(((step + 1) / ONB_STEPS.length) * 100);
  const canNext = step === 1 ? picked : step === 2 ? processed : step === 3 ? aha : true;
  const next = () => { if (step === ONB_STEPS.length - 1) { go("enter"); return; } setStep(step + 1); };
  return <div className="onb">
    <aside className="onb-rail">
      <EBrandRow tone="light" size={26} />
      <span className="onb-free"><Icon name="gift" size={13} />Plan gratuito · 3 docs · 30 días</span>
      <div className="onb-steps">{ONB_STEPS.map((s, i) => <div key={i} className={"onb-step" + (i === step ? " on" : "") + (i < step ? " done" : "")} onClick={() => i < step && setStep(i)}><span className="osn">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>{s[1]}</div>)}</div>
      <div className="rail-foot">El objetivo de hoy: llegar a tu primera respuesta con cita a la fuente. Eso es DOCYAN.</div>
    </aside>
    <div className="onb-main"><div className="onb-card">
      <div className="onb-progress"><span>{String(step + 1).padStart(2, "0")} / {String(ONB_STEPS.length).padStart(2, "0")}</span><span className="opbar"><i style={{ width: pct + "%" }} /></span><span>{pct}%</span></div>
      <div className="onb-ic"><Icon name={cur[0]} size={27} /></div>
      {step === 0 && <>
        <h1>Bienvenido a DOCYAN</h1>
        <p className="onb-lead">Tus documentos dejan de estar muertos y dispersos. En los próximos minutos vas a ingerir uno y a hacer tu primera consulta con respuesta citada — el momento que lo explica todo.</p>
        <div className="onb-body"><div className="onb-hl">{[["zap", "Time-to-value en días, no meses", "Sin proyecto de implementación de seis meses."], ["file-check", "Ingiere tu documento como está", "DOCYAN lo lee tal cual: PDF, manual, MSDS o ficha."], ["link", "Cada respuesta cita su fuente", "Pedigree a span exacto, encadenado criptográficamente."]].map((h) => <div className="hl" key={h[1]}><span className="hi"><Icon name={h[0]} size={18} /></span><div><div className="ht">{h[1]}</div><div className="hm">{h[2]}</div></div></div>)}</div></div>
      </>}
      {step === 1 && <>
        <h1>Sube tu primer documento</h1>
        <p className="onb-lead">Súbelo como está. DOCYAN lo lee tal cual — no necesitas prepararlo ni reformatearlo. Te mostramos el costo estimado antes de procesar.</p>
        <div className="doc-counter"><span className="dots"><i className={picked ? "used" : ""} /><i /><i /></span><span>Documento <span className="dc-num">{picked ? "1" : "0"} de 3</span></span></div>
        <div className="onb-body">{!picked
          ? <div className="dropzone" onClick={() => setPicked(true)}><div className="dz-ic"><Icon name="upload-cloud" size={24} /></div><div className="dz-t">Arrastra tu documento o <b>selecciona un archivo</b></div><div className="dz-m">Para esta demo, haz clic para usar un manual de ejemplo.</div><div className="dz-formats"><span>PDF</span><span>DOCX</span><span>MANUAL</span><span>MSDS</span><span>FICHA</span></div></div>
          : <><div className="doc-sel"><span className="ds-ic"><Icon name="file-text" size={20} /></span><div><div className="ds-n">Manual operativo de CNC.pdf</div><div className="ds-m">2.4 MB · 48 páginas · ES-MX</div></div><button className="ds-x" aria-label="Quitar" onClick={() => setPicked(false)}><Icon name="x" size={17} /></button></div>
            <div className="cost-row"><Icon name="calculator" size={17} /><span className="cr-t">Costo estimado de ingesta</span><span className="cr-v">incluido en tu plan gratuito</span></div></>}</div>
      </>}
      {step === 2 && <>
        <h1>DOCYAN procesa tu documento</h1>
        <p className="onb-lead">Lo leemos como está, detectamos la entidad operativa que describe y lo dejamos consultable. Sin que tú lo prepares.</p>
        <div className="onb-body"><OnbProcessing onDone={() => setProcessed(true)} /></div>
      </>}
      {step === 3 && <>
        <h1>Haz tu primera consulta</h1>
        <p className="onb-lead">Este es el momento. Pregunta en tu idioma y recibe la respuesta con una cita cliqueable al span exacto de tu documento.</p>
        <div className="onb-body"><OnbConsult onAha={() => setAha(true)} />{aha && <div className="aha"><span className="aha-ic"><Icon name="sparkles" size={20} /></span><div><div className="aha-t">Eso es DOCYAN.</div><div className="aha-m">Tu colaborador obtiene lo mismo escaneando el QR del equipo — sin cuenta, al pie de la máquina.</div></div></div>}</div>
      </>}
      {step === 4 && <>
        <h1>Listo. Tu primer CoDo está vivo.</h1>
        <p className="onb-lead">Ya viste el valor: una consulta citada en minutos. Desde aquí puedes gestionar tus documentos, invitar a tu equipo o elegir un plan cuando lo necesites.</p>
        <div className="onb-body"><div className="onb-hl">
          <div className="hl" style={{ cursor: "pointer" }} onClick={() => go("enter")}><span className="hi"><Icon name="files" size={18} /></span><div><div className="ht">Gestiona tus documentos</div><div className="hm">Te quedan 2 de 3 documentos en el plan gratuito.</div></div><Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} /></div>
          <div className="hl" style={{ cursor: "pointer" }} onClick={() => go("enter")}><span className="hi"><Icon name="users" size={18} /></span><div><div className="ht">Invita a tu equipo</div><div className="hm">Suma admins y editores; los colaboradores entran por QR.</div></div><Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} /></div>
          <div className="hl" style={{ cursor: "pointer" }} onClick={() => go("enter")}><span className="hi"><Icon name="gem" size={18} /></span><div><div className="ht">Elige un plan</div><div className="hm">Cuando estés listo para más documentos y CoDos.</div></div><Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} /></div>
        </div></div>
      </>}
      <div className="onb-nav">
        {step > 0 && step < 4 && <button className="btn ghost" onClick={() => setStep(step - 1)}><Icon name="arrow-left" size={16} />Atrás</button>}
        <button className="btn primary" style={{ marginLeft: "auto" }} disabled={!canNext} onClick={next}>{step === 0 ? "Empezar" : step === 3 ? "Continuar" : step === 4 ? "Ir a mis documentos" : "Continuar"}<Icon name="arrow-right" size={16} /></button>
      </div>
    </div></div>
  </div>;
}

/* ── EntryFlow: ruteo interno + sub-switcher de revisión ──── */
const ENTRY_SCREENS = [["signup", "Registro"], ["login", "Iniciar sesión"], ["redeem", "Código"], ["onboarding", "Onboarding"]];
function EntryFlow({ onEnter, mobile }) {
  const [screen, setScreen] = useStateE("signup");
  const go = (dest) => {
    if (dest === "enter" || dest === "documents" || dest === "plan" || dest === "invite") { onEnter && onEnter(); return; }
    setScreen(dest);
  };
  let view;
  if (screen === "login") view = <Login go={go} />;
  else if (screen === "redeem") view = <RedeemCode go={go} />;
  else if (screen === "onboarding") view = <OnboardingFlow go={go} />;
  else view = <SignupFreemium go={go} />;
  return <div className={"entry" + (mobile ? " is-mobile" : "")}>
    <div className="entry-subnav">
      {ENTRY_SCREENS.map(([k, l]) => <button key={k} className={"esub" + (screen === k ? " on" : "")} onClick={() => setScreen(k)}>{l}</button>)}
      <span className="esub-note">Pre-login · al terminar entras al producto</span>
    </div>
    {view}
  </div>;
}
Object.assign(window, { EntryFlow });
