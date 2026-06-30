/* DOCYAN — org views: CoDos list + placeholders (vistas profundas: después) */

function CodosEmpty({ isFree, onNew }) {
  const steps = [
    ["pencil", "Nombra la entidad", "El equipo, lugar o proceso: una mezcladora, una celda CNC, una centrífuga."],
    ["upload", "Vincula sus documentos", "Sube manuales, fichas, MSDS y registros como están — DOCYAN los deja consultables."],
    ["qr-code", "Genera su QR persistente", "Pégalo en el equipo. El colaborador escanea y pregunta, con cita a la fuente."],
  ];
  return <div className="wrap"><div className="codo-empty">
    <div className="ce-mark"><Icon name={isFree ? "files" : "folder-tree"} size={30} /></div>
    <h2>{isFree ? "Aún no tienes documentos vivos" : "Crea tu primer CoDo"}</h2>
    <p className="ce-lead">Un <b>CoDo</b> (Contexto Documental) agrupa los documentos de una entidad en su contexto. Es la unidad con la que tu organización vuelve consultable su conocimiento.</p>
    <div className="ce-steps">{steps.map((s, i) => <div className="ce-step" key={i}>
      <span className="ce-n">{i + 1}</span><span className="ce-ic"><Icon name={s[0]} size={18} /></span>
      <div className="ce-st"><div className="ce-stt">{s[1]}</div><div className="ce-stm">{s[2]}</div></div></div>)}</div>
    <button className="btn btn-primary ce-cta" onClick={onNew}><Icon name="plus" size={16} />{isFree ? "Crear mi primer documento vivo" : "Crear mi primer CoDo"}</button>
    {isFree && <div className="ce-note"><Icon name="gem" size={14} />Plan gratuito · hasta 3 CoDos. Colaboradores ilimitados, sin costo.</div>}
  </div></div>;
}

function CodosList({ plan, openCodo, onNew }) {
  const isFree = plan === "free";
  if (!CODOS.length) return <CodosEmpty isFree={isFree} onNew={onNew} />;
  return <div className="wrap">
    <div className="list-head">
      <div className="lh-t"><h2>{isFree ? "Documentos vivos" : "CoDos"}</h2>
        <p>{isFree ? "Tus documentos consultables, agrupados por entidad." : "Cada CoDo agrupa los documentos de una entidad. Ábrelo para ver su expediente o créalo desde cero."}</p></div>
      <button className="btn btn-primary" onClick={onNew}><Icon name="plus" size={16} />Nuevo CoDo</button>
    </div>
    {isFree && <div className="usage">
      <div><div className="ut">Plan gratuito</div><div className="um">Te queda 1 CoDo · 27 días</div></div>
      <div className="track"><i style={{ width: "66%" }} /></div><div className="num"><b>2</b> / 3</div></div>}
    <div className="codo-grid">
      {CODOS.map(c => <div key={c.key} className="codo-card" onClick={() => openCodo(c)}>
        <div className="ch"><span className="ci"><Icon name={c.icon} size={21} /></span>
          <div style={{ minWidth: 0 }}><div className="cid">{c.id}</div><div className="cn">{c.name}</div></div>
          {c.alert ? <span className="badge warn"><Icon name="alarm-clock" size={12} />2 alertas</span> : <span className="badge ok"><Icon name="check" size={12} />Al día</span>}</div>
        <div className="crow">
          <div className="cstat"><div className="cv">{c.docs}</div><div className="cl">docs vivos</div></div>
          <div className="cstat"><div className="cv">{c.consultas}</div><div className="cl">consultas / 30d</div></div>
          <div className="cstat"><div className="cv">{c.colab}</div><div className="cl">colaboradores</div></div>
        </div>
      </div>)}
      <div className="codo-card new-codo" onClick={onNew}>
        <span className="ni"><Icon name="plus" size={21} /></span>
        <div className="nt">Nuevo CoDo</div>
        <div className="nm">Nombra una entidad, vincula sus documentos y genera su QR.</div>
      </div>
    </div>
  </div>;
}

function Placeholder({ eyebrow, title, lead, icon, exists, feats }) {
  return <div className="wrap"><div className="ph-view">
    <div className="ph-eyebrow">{eyebrow}</div>
    <h2>{title}</h2>
    <p className="lead">{lead}</p>
    <div className="ph-box">
      <span className="pic"><Icon name={icon} size={24} /></span>
      <div className="pt">Vista pendiente de desarrollo</div>
      <div className="pm">Esta es la siguiente capa del prototipo. Aquí entra el detalle de esta sección — la dejamos como placeholder hasta validar el ensamble general.</div>
      {feats && <div className="ph-feat">{feats.map((f, i) => <span key={i}>{f}</span>)}</div>}
      {exists && <div className="exists"><Icon name="check-circle-2" size={13} />Ya existe en el kit PWA · {exists}</div>}
    </div>
  </div></div>;
}

const ORG_PLACEHOLDERS = {
  resumen: { eyebrow: "Operación", title: "Resumen general", icon: "layout-dashboard",
    lead: "El pulso de la organización: CoDos activos, hit-rate de caché, costo por consulta y latencia P95.",
    exists: "ResumenView", feats: ["KPIs (hit-rate, costo, P95)", "CoDos destacados", "Patrones detectados", "Cupo de ingestas"] },
  alertas: { eyebrow: "Operación", title: "Alertas administrativas", icon: "bell",
    lead: "Recordatorios administrativos por vencer — nunca instrucciones operativas. Cada alerta cita su fuente.",
    exists: "AdminAlertsView", feats: ["Por vencer ≤7d / ≤30d", "Banner administrativo obligatorio", "Cita por alerta", "Marcar / posponer"] },
  ingesta: { eyebrow: "Administración", title: "Ingesta de documentos", icon: "upload",
    lead: "Sube documentos como están: clasificación + cotización por documento, cupo del plan y progreso en vivo por fases.",
    exists: "IngestaView + IngestBatch", feats: ["Clasificación + corrección de tipo", "Cupo del plan · fórmula al excedente", "Progreso 5 fases en vivo", "OCR para PDFs de imagen"] },
  gobernanza: { eyebrow: "Administración", title: "Gobernanza & FAT", icon: "shield-check",
    lead: "Umbrales de confianza por criticidad, eventos en cuarentena y bitácora de auditoría encadenada con SHA-256.",
    exists: "GobernanzaView", feats: ["Umbrales GRG por criticidad", "Cuarentena de outputs", "FAT exportable (PDF/XML/JSON/CSV)", "Cadena criptográfica"] },
  qrs: { eyebrow: "Administración", title: "Generar QRs", icon: "qr-code",
    lead: "El QR persistente es la puerta del colaborador al CoDo. Genéralo por entidad y formato físico.",
    exists: "QRsView", feats: ["Selección CoDo + entidad", "Formato físico (etiqueta/placa/lámina)", "Imprimir · PNG/SVG", "Generados recientes"] },
  usuarios: { eyebrow: "Administración", title: "Usuarios", icon: "users",
    lead: "Admins (con costo de seat) y colaboradores (ilimitados, entran por QR). Preferencias por usuario.",
    exists: "UsuariosView", feats: ["Admins + seats", "Colaboradores ilimitados", "Par lingüístico por usuario", "IA proactiva on/off"] },
  plan: { eyebrow: "Cuenta", title: "Plan y facturación", icon: "gem",
    lead: "Tu plan, consumo de documentos y opciones para crecer de freemium a profesional.",
    exists: null, feats: ["Plan actual + límites", "Consumo de CoDos", "Cupo de ingestas", "Código de acceso · piloto"] },
};

function CuentaOrg({ plan, setPlan }) {
  return <div className="wrap"><div className="acct">
    <h2>Mi cuenta</h2><p className="lead">Tu perfil, tu organización y tu seguridad.</p>
    <div className="acct-sec"><h3>Perfil</h3>
      <div className="acct-prof"><div className="pav">JM</div><div><div className="pn">Jorge Medina</div><div className="pe">jorge.medina@lab-estandar.mx</div><div className="pr">ADMIN · PROPIETARIO</div></div></div>
    </div>
    <div className="acct-sec"><h3>Organización</h3>
      <div className="acct-row"><span className="l">Organización</span><span className="v">Laboratorio Estándar SA de CV</span></div>
      <div className="acct-row"><span className="l">Par lingüístico default</span><span className="v">ES-MX · EN-US</span></div>
      <div className="acct-row"><span className="l">Plan</span><span className="v">{plan === "free" ? "Gratuito · 2 de 3 CoDos" : "Profesional"}</span>
        <button className="btn-sec" onClick={() => setPlan(plan === "free" ? "pro" : "free")}><Icon name="gem" size={15} />{plan === "free" ? "Subir a Profesional" : "Gestionar en módulo Plan"}</button></div>
    </div>
    <div className="acct-sec"><h3>Seguridad</h3>
      <div className="acct-row"><span className="l">Contraseña</span><span className="v">••••••••••</span><button className="btn-sec"><Icon name="key-round" size={15} />Cambiar</button></div>
      <div className="acct-row"><span className="l">Sesión</span><span className="v" /><button className="btn-logout-lg"><Icon name="log-out" size={15} />Cerrar sesión</button></div>
    </div>
  </div></div>;
}

Object.assign(window, { CodosList, Placeholder, ORG_PLACEHOLDERS, CuentaOrg });
