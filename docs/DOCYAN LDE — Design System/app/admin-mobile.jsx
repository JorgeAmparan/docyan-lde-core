/* DOCYAN — ADMIN DE BOLSILLO (breakpoint angosto de la organización).
   NO es el panel de escritorio encogido: es un subconjunto curado de acciones
   urgentes y atómicas + la consulta/escaneo (el admin también consume).
   Comparte la gramática móvil; tiene sus propios componentes.
   Lo profundo (Crear CoDo, consola de Ingesta, Gobernanza & FAT, QRs, Resumen,
   Usuarios, Plan) redirige a escritorio. */

const ADMIN_GLANCE = [["86%", "Hit-rate caché"], ["$0.011", "Costo / consulta"], ["38", "Consultas hoy"]];
const ADMIN_ALERTS_M = [
  ["warn", "Por vencer · ≤ 7 días", "Calibración — Mezcladora MAXI-10ND", "CODO-OBR-07", "Vence 02 jul · en 4 días", "CAL-22-117"],
  ["warn", "Por vencer · ≤ 7 días", "Certificado del operador A. Ríos", "Org", "Venció 28 jun", "CERT-OP-AR"],
  ["caution", "Próximas · ≤ 30 días", "Cambio de aceite SAE-30 programado", "CODO-OBR-07", "En 22 días", "MTTO-OBR-03"],
  ["caution", "Próximas · ≤ 30 días", "MSDS refrigerante — Centrífuga", "CODO-LAB-04", "Expira 25 jul · en 27 días", "MSDS-REF-03"],
];
const DESK_ONLY = [
  ["folder-plus", "Crear CoDo", "Nombrar entidad, vincular acervo, generar QR"],
  ["upload-cloud", "Consola de ingesta", "Cola, cotización por documento, cupo del plan, reintentos"],
  ["shield-check", "Gobernanza & FAT", "Umbrales GRG, cuarentena, bitácora, exportes"],
  ["qr-code", "Generar lotes de QR", "Imprimir placas y etiquetas físicas"],
  ["layout-dashboard", "Resumen completo", "Métricas PCL, patrones, balance de ingesta"],
  ["users", "Usuarios & asientos", "Roster completo, costos de seat, facturación"],
];
/* Freemium: subconjunto del subconjunto */
const DESK_FREE = [
  ["files", "Gestionar documentos", "Subir, organizar y vincular tu acervo (hasta 3)"],
  ["users", "Usuarios", "Invitar admins y colaboradores"],
  ["gem", "Plan", "Tu uso y opciones de Profesional"],
];
const PRO_LOCKED = [
  ["bell", "Alertas administrativas", "Calibración, certificados y MSDS por vencer"],
  ["shield-check", "Gobernanza & FAT", "Umbrales de confianza y bitácora auditable"],
  ["qr-code", "Generar QRs", "Etiquetas persistentes para tus equipos"],
  ["sparkles", "Patrones & inteligencia", "Rutinas y conocimiento recurrente detectados"],
];
const FREE_LIMIT = 3, FREE_USED = 2, FREE_COLABS = 8;

/* ---------- Subir documento rápido (micro-flujo móvil) ---------- */
const SOURCES = [
  ["mail", "Desde el correo", "El PDF que acabas de recibir en tu buzón"],
  ["folder", "Desde archivos", "Documentos guardados en este dispositivo"],
  ["camera", "Escanear con la cámara", "Foto de un documento físico (OCR)"],
];
function SubirDoc({ onCancel }) {
  const [step, setStep] = useState("source");
  const [codoKey, setCodoKey] = useState(null);
  const [seg, setSeg] = useState(2);
  const [pct, setPct] = useState(0);
  const picked = { name: "MSDS — Refrigerante R-410A.pdf", meta: "pdf · 4 págs · 0.6 MB" };
  const codo = CODOS.find(c => c.key === codoKey);
  useEffect(() => {
    if (step !== "progress") return;
    setPct(0);
    const id = setInterval(() => setPct(p => { if (p >= 100) { clearInterval(id); setTimeout(() => setStep("done"), 350); return 100; } return p + 8; }), 180);
    return () => clearInterval(id);
  }, [step]);

  return <div className="ph-body">
    <div className="cons-top"><button className="back-btn" onClick={onCancel}><Icon name="arrow-left" size={18} /></button>
      <div className="cons-ctx"><div className="cc"><span className="dot" />ACCIÓN RÁPIDA</div><div className="cnm">Subir documento</div></div></div>

    {step === "source" && <>
      <div className="sec-lab"><Icon name="upload" size={14} />¿De dónde lo subes?</div>
      {SOURCES.map(s => <button key={s[0]} className="src-tile" onClick={() => setStep("assign")}>
        <span className="sti"><Icon name={s[0]} size={22} /></span>
        <div style={{ minWidth: 0 }}><div className="stt">{s[1]}</div><div className="stm">{s[2]}</div></div>
        <span className="car" style={{ marginLeft: "auto", color: "var(--fg-subtle)" }}><Icon name="chevron-right" size={18} /></span>
      </button>)}
    </>}

    {step === "assign" && <>
      <div className="picked"><span className="pic"><Icon name="file-text" size={20} /></span>
        <div style={{ minWidth: 0 }}><div className="pn">{picked.name}</div><div className="pm">{picked.meta}</div></div></div>
      <div className="m-field"><label>Asignar a un CoDo</label>
        {CODOS.map(c => <button key={c.key} className={"m-sel" + (codoKey === c.key ? " on" : "")} onClick={() => setCodoKey(c.key)} style={{ marginBottom: 8 }}>
          <Icon name={c.icon} size={18} /><span className="ml"><div>{c.name}</div><div className="mc">{c.id}</div></span>
          {codoKey === c.key && <Icon name="check" size={18} />}</button>)}
      </div>
      <div className="m-field"><label>Segmento</label>
        <div className="seg">{SEGMENTS.map((s, i) => <button key={s.key} className={seg === i ? "on" : ""} onClick={() => setSeg(i)}>{s.label.split(" ")[0]}</button>)}</div></div>
      <button className="m-cta" disabled={!codoKey} onClick={() => setStep("progress")}><Icon name="zap" size={17} color="#fff" />Ingerir ahora</button>
      <p style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center", margin: "12px 4px 0", lineHeight: 1.5 }}>Entra en tu <b>cupo del plan</b> · setup $0. Sobre el cupo se cotiza antes de cobrar. Cobro manual durante el piloto.</p>
    </>}

    {step === "progress" && <div style={{ paddingTop: 20 }}>
      <div className="picked"><span className="pic"><Icon name="file-text" size={20} /></span>
        <div style={{ minWidth: 0 }}><div className="pn">{picked.name}</div><div className="pm">{picked.meta}</div></div></div>
      <div className="sec-lab" style={{ marginTop: 6 }}><Icon name="loader" size={14} />Procesando · {codo ? codo.id : ""}</div>
      <div className="ingbar"><i style={{ width: pct + "%" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)" }}>
        <span>{pct < 30 ? "Conversión" : pct < 65 ? "Extracción" : pct < 95 ? "Escritura a grafo" : "Deduplicación"}</span><span>{pct}%</span></div>
    </div>}

    {step === "done" && <div className="done-card">
      <div className="dc-ic"><Icon name="check" size={30} /></div>
      <div className="dc-t">Documento vivo</div>
      <div className="dc-m">Quedó disponible en <b>{codo ? codo.name : "el CoDo"}</b>.<br />Los colaboradores ya pueden consultarlo con cita a la fuente.</div>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="m-cta" onClick={onCancel}><Icon name="check" size={17} color="#fff" />Listo</button>
        <button className="m-cta ghost" onClick={() => setStep("source")}>Subir otro documento</button>
      </div>
    </div>}
  </div>;
}

/* ---------- Alertas (móvil) ---------- */
function AlertasMobile({ onBack }) {
  const [read, setRead] = useState([]);
  const groups = [...new Set(ADMIN_ALERTS_M.map(a => a[1]))];
  return <div className="ph-body">
    <div className="cons-top"><button className="back-btn" onClick={onBack}><Icon name="arrow-left" size={18} /></button>
      <div className="cons-ctx"><div className="cc"><span className="dot" />ADMINISTRACIÓN</div><div className="cnm">Alertas</div></div></div>
    <div className="admin-banner"><Icon name="info" size={15} />Recordatorio administrativo — no es una instrucción operativa. DOCYAN no emite decisiones clínicas u operativas.</div>
    {groups.map(g => <div key={g}>
      <div className="ag-lab">{g}</div>
      {ADMIN_ALERTS_M.map((a, i) => a[1] === g && <div key={i} className={"alert-card s-" + a[0] + (read.includes(i) ? " read" : "")}>
        <div className="ah"><span className="aico"><Icon name={a[0] === "warn" ? "alarm-clock" : "clock"} size={16} /></span>
          <div style={{ minWidth: 0 }}><div className="at">{a[2]}</div><div className="am"><span className="codo-pill">{a[3]}</span>{a[4]}</div></div></div>
        <div className="a-cite"><span className="brk" />{a[5]} ↗</div>
        <div className="a-acts">
          <button className={read.includes(i) ? "on" : ""} onClick={() => setRead(r => r.includes(i) ? r.filter(x => x !== i) : [...r, i])}><Icon name="check" size={14} />{read.includes(i) ? "Leída" : "Marcar leída"}</button>
          <button>Posponer</button>
          <button>Asignar</button>
        </div>
      </div>)}
    </div>)}
  </div>;
}

/* ---------- Invitar usuario (móvil) ---------- */
function InviteMobile({ onBack }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(0);
  const [lang, setLang] = useState(0);
  const [sent, setSent] = useState(false);
  const ROLES = ["Colaborador", "Admin"];
  const LANGS = ["ES-MX", "EN-US"];
  return <div className="ph-body">
    <div className="cons-top"><button className="back-btn" onClick={onBack}><Icon name="arrow-left" size={18} /></button>
      <div className="cons-ctx"><div className="cc"><span className="dot" />ADMINISTRACIÓN</div><div className="cnm">Invitar usuario</div></div></div>
    {!sent ? <>
      <div className="m-field"><label>Correo a invitar</label>
        <input className="m-input" type="email" placeholder="nombre@laboratorio.mx" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="m-field"><label>Rol</label>
        <div className="seg">{ROLES.map((r, i) => <button key={i} className={role === i ? "on" : ""} onClick={() => setRole(i)}>{r}</button>)}</div>
        <p style={{ fontSize: 11.5, color: "var(--fg-muted)", margin: "8px 2px 0", lineHeight: 1.4 }}>{role === 0 ? "Entra por QR, sin costo. Consulta y guarda." : "Suma un costo de seat según el plan."}</p></div>
      <div className="m-field"><label>Par lingüístico</label>
        <div className="seg">{LANGS.map((l, i) => <button key={i} className={lang === i ? "on" : ""} onClick={() => setLang(i)}>{l}</button>)}</div></div>
      <button className="m-cta" disabled={!email.trim()} onClick={() => setSent(true)}><Icon name="send" size={16} color="#fff" />Enviar invitación</button>
    </> : <>
      <div className="invite-sent"><Icon name="check-circle" size={22} />
        <div><div className="ist">Invitación enviada</div><div className="ism">{email} · {ROLES[role]} · {LANGS[lang]}</div></div></div>
      <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "16px 4px", lineHeight: 1.5 }}>Recibirá un enlace para activar su cuenta. Si es colaborador, también podrá entrar escaneando el QR de cualquier equipo asignado.</p>
      <button className="m-cta ghost" onClick={() => { setSent(false); setEmail(""); }}>Invitar a otra persona</button>
      <button className="m-cta" style={{ marginTop: 10 }} onClick={onBack}>Listo</button>
    </>}
  </div>;
}

/* ---------- Home (admin de bolsillo) ---------- */
function AdminMobileHome({ plan, openAction, openCodo, scan, openPro, alertCount }) {
  const free = plan === "free";
  const term = free ? "Documentos" : "CoDos";
  return <div className="ph-body">
    <div className="greet"><div className="hi">Hola, Jorge</div>
      <div className="sub">{free ? "Plan gratuito · Laboratorio Estándar" : "Admin · Laboratorio Estándar · resuelve lo urgente desde aquí."}</div></div>

    {free
      ? <div className="usage">
          <div className="us-row"><span>{term} vivos</span><b>{FREE_USED} de {FREE_LIMIT}</b></div>
          <div className="us-bar"><i style={{ width: (FREE_USED / FREE_LIMIT * 100) + "%" }} /></div>
          <div className="us-foot"><span>{FREE_COLABS} colaboradores · ilimitados</span><button className="us-up" onClick={() => openPro("Profesional")}><Icon name="gem" size={13} />Subir a Profesional</button></div>
        </div>
      : <div className="glance">{ADMIN_GLANCE.map((m, i) => <div className="gm" key={i}><div className="gv">{m[0]}</div><div className="gl">{m[1]}</div></div>)}</div>}

    <div className="sec-lab"><Icon name="zap" size={14} />Acciones rápidas</div>
    <div className="qa-grid">
      <button className="qa primary" onClick={() => openAction("subir")}><span className="qa-ic"><Icon name="upload" size={22} color="#fff" /></span>
        <div><div className="qa-t">Subir documento</div><div className="qa-m">Vivo en minutos</div></div></button>
      <button className="qa" onClick={() => openAction("invitar")}><span className="qa-ic"><Icon name="user-plus" size={22} /></span>
        <div><div className="qa-t">Invitar usuario</div><div className="qa-m">Sin ir a la oficina</div></div></button>
      {free
        ? <button className="qa upsell" onClick={() => openPro("Profesional")}><span className="qa-ic"><Icon name="gem" size={22} /></span>
            <div><div className="qa-t">Profesional</div><div className="qa-m">Alertas, QRs y más</div></div></button>
        : <button className="qa" onClick={() => openAction("alertas")}>{alertCount > 0 && <span className="qa-badge">{alertCount}</span>}<span className="qa-ic"><Icon name="bell" size={22} /></span>
            <div><div className="qa-t">Alertas</div><div className="qa-m">Por vencer y próximas</div></div></button>}
      <button className="qa" onClick={scan}><span className="qa-ic"><Icon name="scan-line" size={22} /></span>
        <div><div className="qa-t">Escanear QR</div><div className="qa-m">Consulta en piso</div></div></button>
    </div>

    <div className="sec-lab"><Icon name="folder-tree" size={14} />Tus {term}<span className="cnt">consultar</span></div>
    {CODOS.map(c => <button key={c.key} className="codo-card" onClick={() => openCodo(c)}>
      <span className="ci"><Icon name={c.icon} size={24} /></span>
      <div style={{ minWidth: 0 }}><div className="cid">{c.id}</div><div className="cn">{c.name}</div>
        <div className="cm"><span className="badge-vivo"><span className="bd" />{c.docs} docs vivos</span><span>·</span><span>{c.consultas} consultas</span></div></div>
      <span className="car"><Icon name="chevron-right" size={20} /></span>
    </button>)}

    <div className="readonly-note"><Icon name="monitor" size={16} />La configuración profunda {free ? "—gestionar documentos, usuarios, plan—" : "—crear CoDos, consola de ingesta, gobernanza, lotes de QR—"} se hace en escritorio. Aquí resuelves lo urgente.</div>
  </div>;
}

/* ---------- Acciones (hub) ---------- */
function AdminMobileActions({ plan, openAction, openDesk, openPro, alertCount }) {
  const free = plan === "free";
  return <div className="ph-body">
    <div className="scr-head">Acciones</div>
    <div className="scr-sub">Lo que puedes resolver desde el teléfono.</div>
    <div className="sec-lab"><Icon name="zap" size={14} />Rápidas</div>
    <button className="act-row" onClick={() => openAction("subir")}><span className="ari"><Icon name="upload" size={20} /></span>
      <div style={{ minWidth: 0 }}><div className="at">Subir documento</div><div className="am">Desde correo, archivos o cámara → vivo en minutos</div></div><span className="car"><Icon name="chevron-right" size={18} /></span></button>
    <button className="act-row" onClick={() => openAction("invitar")}><span className="ari"><Icon name="user-plus" size={20} /></span>
      <div style={{ minWidth: 0 }}><div className="at">Invitar usuario</div><div className="am">Colaborador o admin, con par lingüístico</div></div><span className="car"><Icon name="chevron-right" size={18} /></span></button>
    {!free && <button className="act-row" onClick={() => openAction("alertas")}><span className="ari"><Icon name="bell" size={20} /></span>
      <div style={{ minWidth: 0 }}><div className="at">Alertas</div><div className="am">Recordatorios administrativos por vencer y próximos</div></div>{alertCount > 0 ? <span className="ar-badge">{alertCount}</span> : <span className="car"><Icon name="chevron-right" size={18} /></span>}</button>}

    {free && <>
      <div className="sec-lab" style={{ marginTop: 22 }}><Icon name="gem" size={14} />Disponible en Profesional</div>
      {PRO_LOCKED.map(d => <button key={d[1]} className="desk-row locked" onClick={() => openPro(d[1])}><span className="dri"><Icon name={d[0]} size={18} /></span>
        <div style={{ minWidth: 0 }}><div className="dt">{d[1]}</div><div className="dm">{d[2]}</div></div>
        <span className="dpill pro"><Icon name="lock" size={12} />Pro</span></button>)}
    </>}

    <div className="sec-lab" style={{ marginTop: 22 }}><Icon name="monitor" size={14} />Solo en escritorio</div>
    {(free ? DESK_FREE : DESK_ONLY).map(d => <button key={d[1]} className="desk-row" onClick={() => openDesk(d[1])}><span className="dri"><Icon name={d[0]} size={18} /></span>
      <div style={{ minWidth: 0 }}><div className="dt">{d[1]}</div><div className="dm">{d[2]}</div></div>
      <span className="dpill"><Icon name="monitor" size={12} />Escritorio</span></button>)}
  </div>;
}

/* ---------- Consult picker (cuando entra por la pestaña Consultar) ---------- */
function AdminConsultPicker({ openCodo }) {
  return <div className="ph-body">
    <div className="scr-head">Consultar</div>
    <div className="scr-sub">Elige un CoDo o escanea su QR para preguntar.</div>
    {CODOS.map(c => <button key={c.key} className="codo-card" onClick={() => openCodo(c)}>
      <span className="ci"><Icon name={c.icon} size={24} /></span>
      <div style={{ minWidth: 0 }}><div className="cid">{c.id}</div><div className="cn">{c.name}</div>
        <div className="cm"><span className="badge-vivo"><span className="bd" />{c.docs} docs vivos</span><span>·</span><span>{c.loc}</span></div></div>
      <span className="car"><Icon name="chevron-right" size={20} /></span>
    </button>)}
  </div>;
}

function AdminMobilePerfil({ plan, openPro }) {
  const free = plan === "free";
  return <div className="ph-body">
    <div className="scr-head">Mi cuenta</div>
    <div className="scr-sub">Admin de organización.</div>
    <div className="prof"><div className="pav">JM</div><div><div className="pn">Jorge Medina</div><div className="pr">ADMIN · PROPIETARIO</div></div></div>
    <div className="prof-row"><Icon name="building-2" size={19} />Organización<span className="pv">Laboratorio Estándar</span></div>
    <div className="prof-row"><Icon name="globe" size={19} />Idioma<span className="pv">ES-MX</span></div>
    <div className="prof-row"><Icon name="gem" size={19} />Plan<span className="pv">{free ? "Gratuito" : "Profesional"}</span></div>
    {free
      ? <button className="m-cta" style={{ marginTop: 6 }} onClick={() => openPro("Profesional")}><Icon name="gem" size={16} color="#fff" />Subir a Profesional</button>
      : <div className="prof-row"><Icon name="package-check" size={19} />Cupo de ingestas<span className="pv">{CUPO_DEMO.restante} de {CUPO_DEMO.recurrente} este mes</span></div>}
    <div className="readonly-note"><Icon name="monitor" size={16} />Facturación, asientos y configuración de la organización se gestionan en escritorio.</div>
    <button className="logout-row"><Icon name="log-out" size={17} />Cerrar sesión</button>
  </div>;
}

const ADMIN_TABS = [["home", "Inicio", "house"], ["scan", "Escanear", "scan-line"], ["consult", "Consultar", "messages-square"], ["actions", "Acciones", "layout-grid"]];

function AdminMobile({ saved, toggleSave, plan, setPlan }) {
  const [tab, setTab] = useState("home");
  const [consult, setConsult] = useState(null);   // {codo, initialKey, viaQR}
  const [action, setAction] = useState(null);      // 'subir'|'alertas'|'invitar'|'perfil'
  const [sheet, setSheet] = useState(null);        // {kind:'desk'|'pro', title}
  const alertCount = ADMIN_ALERTS_M.length;
  const openCodo = (codo, viaQR) => setConsult({ codo, viaQR: !!viaQR });
  const openDesk = (title) => setSheet({ kind: "desk", title });
  const openPro = (title) => setSheet({ kind: "pro", title });
  const reset = () => { setConsult(null); setAction(null); };

  let body;
  if (consult) body = <MobileConsult codo={consult.codo} back={() => setConsult(null)} saved={saved} toggleSave={toggleSave} viaQR={consult.viaQR} />;
  else if (action === "subir") body = <SubirDoc onCancel={() => setAction(null)} />;
  else if (action === "alertas") body = <AlertasMobile onBack={() => setAction(null)} />;
  else if (action === "invitar") body = <InviteMobile onBack={() => setAction(null)} />;
  else if (action === "perfil") body = <AdminMobilePerfil plan={plan} openPro={openPro} />;
  else if (tab === "home") body = <AdminMobileHome plan={plan} openAction={setAction} openCodo={(c) => openCodo(c, false)} scan={() => setTab("scan")} openPro={openPro} alertCount={alertCount} />;
  else if (tab === "scan") body = <MobileScan pick={(c) => openCodo(c, true)} title="Escanear QR" sub="Apunta al equipo para consultar o verificar en piso." />;
  else if (tab === "consult") body = <AdminConsultPicker openCodo={(c) => openCodo(c, false)} />;
  else body = <AdminMobileActions plan={plan} openAction={setAction} openDesk={openDesk} openPro={openPro} alertCount={alertCount} />;

  const activeTab = (consult || action) ? null : tab;
  return <div className="dy-mobile">
    <MobileStatus />
    <div className="ph-top"><Mark size={22} /><span className="w">DOCYAN</span><span className="lde">LDE</span><span className="role-tag">{plan === "free" ? "Admin · Free" : "Admin"}</span>
      <button className={"av ink" + (action === "perfil" ? " on" : "")} onClick={() => { reset(); setAction("perfil"); }}>JM</button></div>
    {body}
    <div className="tabbar">{ADMIN_TABS.map(t => <button key={t[0]} className={"tab" + (t[0] === "scan" ? " scan" : "") + (activeTab === t[0] ? " on" : "")}
      onClick={() => { reset(); setTab(t[0]); }}><Icon name={t[2]} size={t[0] === "scan" ? 30 : 24} />{t[1]}</button>)}</div>

    {sheet && <div className="dy-sheet-scrim" onClick={() => setSheet(null)}>
      <div className="dy-sheet" onClick={e => e.stopPropagation()}>
        {sheet.kind === "pro"
          ? <>
              <div className="dy-sheet-ic pro"><Icon name="gem" size={26} /></div>
              <div className="dy-sheet-t">{sheet.title}</div>
              <div className="dy-sheet-m">Es una función del plan <b>Profesional</b>: alertas administrativas, gobernanza & FAT, generación de QRs e inteligencia organizacional. Reactívala desde Plan.</div>
              <button className="m-cta" onClick={() => { setPlan("pro"); setSheet(null); }}><Icon name="gem" size={16} color="#fff" />Subir a Profesional</button>
              <button className="m-cta ghost" style={{ marginTop: 10 }} onClick={() => setSheet(null)}>Ahora no</button>
            </>
          : <>
              <div className="dy-sheet-ic"><Icon name="monitor" size={26} /></div>
              <div className="dy-sheet-t">{sheet.title}</div>
              <div className="dy-sheet-m">Esta función es densa y deliberada — se hace mejor en la versión de escritorio, con teclado y pantalla amplia. Ábrela desde tu computadora.</div>
              <button className="m-cta" onClick={() => setSheet(null)}>Entendido</button>
            </>}
      </div>
    </div>}
  </div>;
}

Object.assign(window, { AdminMobile });
