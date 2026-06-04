/* DOCYAN PWA kit — Acceso (login + CoDo selection) and admin Onboarding wizard. */

/* ── 5.1.2 Login admin + 5.1.3 selección de CoDo ──────────── */
const ORG_CODOS = [
  ["CODO-LAB-04", "Centrífugas & rotores", 24, "warn"],
  ["CODO-LAB-02", "Balanzas analíticas", 31, "ok"],
  ["CODO-LAB-07", "Autoclaves & esterilización", 18, "ok"],
  ["CODO-MAQ-01", "Línea de ensamble A", 40, "warn"],
  ["CODO-MAQ-03", "Prensas hidráulicas", 12, "ok"],
  ["CODO-LAB-11", "Espectrofotómetros", 17, "ok"],
];
function AccessView() {
  const [step, setStep] = useState("login"); // login | select
  return (
    <div className="access-stage">
      {step === "login" ? (
        <div className="login-card">
          <div className="login-brand"><Mark size={34} /><span className="lw">DOCYAN<span className="lde">LDE</span></span></div>
          <h1>Ingresa a tu organización</h1>
          <p className="login-sub">Para admins de organización. Los colaboradores entran escaneando el QR del equipo — sin login.</p>
          <div className="field2"><label>Correo</label><input type="email" defaultValue="jorge.medina@lab-estandar.mx" /></div>
          <div className="field2"><label>Contraseña</label><input type="password" defaultValue="••••••••••" /></div>
          <div className="login-row"><label className="chk"><input type="checkbox" defaultChecked />Recordarme</label><a className="link">¿Olvidaste tu contraseña?</a></div>
          <button className="primary-btn full" onClick={() => setStep("select")}>Entrar</button>
          <div className="qr-alt"><Icon name="scan-line" size={16} /><div><div className="qa-t">¿Eres colaborador?</div><div className="qa-m">Escanea el QR del equipo para consultar directo.</div></div></div>
        </div>
      ) : (
        <div className="codo-select">
          <div className="cs-head">
            <div><span className="eyebrow-m">Selecciona un CoDo</span><h1>Tienes acceso a 6 CoDos</h1></div>
            <div className="search" style={{ marginLeft: "auto" }}><Icon name="search" size={15} /><input placeholder="Buscar CoDo…" /></div>
          </div>
          <div className="cs-grid">
            {ORG_CODOS.map(([id, name, docs, st], i) => (
              <div className="cs-card" key={i} onClick={() => setStep("login")}>
                <div className="cs-top"><Icon name="folder-tree" size={18} />{st === "warn" && <span className="badge warn"><Icon name="alarm-clock" size={11} />alertas</span>}{st === "ok" && <span className="badge ok"><Icon name="check" size={11} />al día</span>}</div>
                <div className="cs-id mono">{id}</div>
                <div className="cs-name">{name}</div>
                <div className="cs-docs">{docs} documentos vivos</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 5.11 · Onboarding inicial del admin ───────────────────── */
const ONB = [
  ["sparkles", "Bienvenido a DOCYAN", "Vamos a dejar tus documentos vivos en unos minutos. Tres pasos para tu primer CoDo consultable.", "welcome"],
  ["building-2", "Nombra tu organización", "Así identificamos tu cuenta y tus pares lingüísticos por defecto.", "org"],
  ["folder-tree", "Crea tu primer CoDo", "Un CoDo es un contexto documental coherente — un equipo y todos sus documentos.", "codo"],
  ["upload-cloud", "Ingiere tu primer documento", "Súbelo como está. DOCYAN lo lee tal cual: PDF, manual, MSDS o ficha.", "ingest"],
  ["qr-code", "Genera tu primer QR", "Imprímelo y pégalo en el equipo. Es la puerta del colaborador al CoDo.", "qr"],
  ["scan-line", "Haz tu primera consulta", "Escanea, pregunta y recibe respuesta con cita a la fuente exacta.", "ask"],
  ["users", "Invita a tus colaboradores", "Ilimitados y sin costo. Entran escaneando — no necesitan cuenta.", "invite"],
];
function OnboardingView() {
  const [step, setStep] = useState(0);
  const cur = ONB[step];
  const last = step === ONB.length - 1;
  return (
    <div className="onboard">
      <aside className="onb-rail">
        <div className="login-brand sm"><Mark size={26} /><span className="lw">DOCYAN<span className="lde">LDE</span></span></div>
        <div className="onb-steps">
          {ONB.map((s, i) => (
            <div key={i} className={"onb-step" + (i === step ? " on" : "") + (i < step ? " done" : "")} onClick={() => setStep(i)}>
              <span className="osn">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>{s[1]}
            </div>
          ))}
        </div>
        <div className="onb-prog mono">{step + 1} / {ONB.length}</div>
      </aside>

      <div className="onb-main">
        <div className="onb-card">
          <div className="onb-ic"><Icon name={cur[0]} size={30} /></div>
          <h1>{cur[1]}</h1>
          <p className="onb-lead">{cur[2]}</p>

          <div className="onb-body">
            {cur[3] === "welcome" && <div className="onb-hl"><div className="hl"><Icon name="zap" size={18} /><span>Time-to-value en días, no meses</span></div><div className="hl"><Icon name="file-check" size={18} /><span>Ingiere tus documentos como están</span></div><div className="hl"><Icon name="link" size={18} /><span>Cada respuesta cita su fuente exacta</span></div></div>}
            {cur[3] === "org" && <><div className="field2"><label>Organización</label><input defaultValue="Laboratorio Estándar SA de CV" /></div><div className="field2"><label>Par lingüístico por defecto</label><div className="sel-box">ES-MX · EN-US<Icon name="chevron-down" size={15} /></div></div></>}
            {cur[3] === "codo" && <><div className="field2"><label>Nombre del CoDo</label><input defaultValue="Centrífugas & rotores" /></div><div className="field2"><label>Vertical</label><div className="sel-box">Laboratorio ISO 17025<Icon name="chevron-down" size={15} /></div></div></>}
            {cur[3] === "ingest" && <div className="dropzone"><Icon name="upload-cloud" size={26} /><div className="dz-t">Arrastra tu primer documento o <b>selecciona</b></div><div className="dz-m">Te mostramos el costo estimado antes de procesar</div></div>}
            {cur[3] === "qr" && <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}><QRPlate seed={4} label="CODO-LAB-04 · Hettich Rotina 380" /></div>}
            {cur[3] === "ask" && <div className="onb-ask"><div className="mctx"><Mark size={20} /><div><div className="ml">Estás consultando</div><div className="mn">CODO-LAB-04 · Centrífuga Hettich</div></div></div><div className="onb-q">¿Torque del perno B?</div><div className="onb-a"><div className="mqlab">85 N·m</div><span className="cite"><span className="brk" />Manual VF-2 · §4.2.1 ↗</span></div></div>}
            {cur[3] === "invite" && <><div className="field2"><label>Correos de colaboradores (opcional)</label><input placeholder="separa con comas — o solo comparte el QR" /></div><div className="manual-note"><Icon name="info" size={15} />Los colaboradores no necesitan cuenta: el QR es su credencial.</div></>}
          </div>

          <div className="onb-nav">
            {step > 0 && <button className="mini-btn" onClick={() => setStep(step - 1)}><Icon name="arrow-left" size={14} />Atrás</button>}
            <button className="primary-btn" style={{ marginLeft: "auto" }} onClick={() => setStep(last ? 0 : step + 1)}>{last ? "Ir al dashboard" : "Continuar"}<Icon name="arrow-right" size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AccessView, OnboardingView });
