/* DOCYAN — colaborador web views: Inicio · Guardadas · Perfil (consulta = ConsultView compartida) */

function ColabInicio({ openCodo, saved, goConsult }) {
  return <div className="wrap"><div className="colab-home">
    <div className="colab-hi">{t({ es: "Hola, Andr\u00e9s", en: "Hi, Andr\u00e9s" })}</div>
    <div className="colab-sub">{t({ es: "Escanea el QR del equipo o entra a un CoDo para consultar.", en: "Scan the equipment QR or enter a CoDo to consult." })}</div>
    <div className="scan-row">
      <button className="scan-cta" onClick={() => goConsult(CODOS[0])}>
        <span className="si"><Icon name="scan-line" size={24} color="#fff" /></span>
        <div><div className="st">{t({ es: "Escanear QR", en: "Scan QR" })}</div><div className="sm">{t({ es: "Apunta al equipo y pregunta", en: "Point at the equipment and ask" })}</div></div>
        <span className="sar"><Icon name="arrow-right" size={20} color="#fff" /></span>
      </button>
      <button className="ask-cta" onClick={() => goConsult(CODOS[0])}><Icon name="search" size={20} />
        <div><div className="at">{t({ es: "Pregunta directo", en: "Ask directly" })}</div><div className="am">{t({ es: "Busca en los documentos de un CoDo", en: "Search a CoDo\u2019s documents" })}</div></div></button>
    </div>

    <div className="sec-lab"><Icon name="folder-tree" size={14} />{t({ es: "Tus CoDos", en: "Your CoDos" })}<span className="cnt">{CODOS.length} {t({ es: "con acceso", en: "with access" })}</span></div>
    <div className="colab-codos">{CODOS.map(c => <button key={c.key} className="cc-card" onClick={() => openCodo(c)}>
      <span className="ci"><Icon name={c.icon} size={22} /></span>
      <div className="cid">{c.id}</div><div className="cn">{c.name}</div>
      <div className="cm"><span className="badge-vivo"><span className="bd" />{c.docs} {t({ es: "docs vivos", en: "live docs" })}</span><span>·</span><span>{c.loc}</span></div>
    </button>)}</div>

    <div className="sec-lab"><Icon name="bookmark" size={14} />{t({ es: "Consultas guardadas", en: "Saved queries" })}</div>
    {saved.length === 0
      ? <div style={{ fontSize: 13.5, color: "var(--fg-subtle)", padding: "0 2px 4px", lineHeight: 1.5 }}>{t({ es: "A\u00fan no guardas consultas. Toca ", en: "No saved queries yet. Tap " })}<b>{t({ es: "Guardar", en: "Save" })}</b>{t({ es: " en una respuesta para tenerla a la mano.", en: " on an answer to keep it handy." })}</div>
      : saved.slice(0, 4).map((s, i) => <button key={i} className="saved-q" style={{ maxWidth: 640 }} onClick={() => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)}>
          <span className="qi"><Icon name="bookmark" size={16} /></span>
          <div style={{ minWidth: 0 }}><div className="qt">{s.q}</div><div className="qm">{s.codoId}</div></div>
          <span className="car"><Icon name="chevron-right" size={18} /></span></button>)}

    <div className="readonly-note"><Icon name="info" size={16} />{t({ es: "Como colaborador, consultas y guardas — la organizaci\u00f3n gestiona los documentos y los CoDos.", en: "As a collaborator, you consult and save — the organization manages the documents and CoDos." })}</div>
  </div></div>;
}

function ColabGuardadas({ saved, openCodo }) {
  const [run, setRun] = useState(false);
  const isPlaybook = saved.length >= PB_MIN;
  if (run) return <div className="wrap"><div style={{ maxWidth: 640 }}><PlaybookRun items={saved} onBack={() => setRun(false)} /></div></div>;
  return <div className="wrap">
    <div className="scr-head">{isPlaybook ? t({ es: "Tus consultas", en: "Your queries" }) : t({ es: "Consultas guardadas", en: "Saved queries" })}</div>
    <div className="scr-sub">{t({ es: "Tus respuestas a la mano, con su cita a la fuente.", en: "Your answers at hand, with their citation to the source." })}</div>
    {saved.length === 0
      ? <div className="empty-thread"><Icon name="bookmark" size={26} /><p>{t({ es: "A\u00fan no guardas consultas.", en: "No saved queries yet." })}<br />{t({ es: "Toca ", en: "Tap " })}<b>{t({ es: "Guardar", en: "Save" })}</b>{t({ es: " en cualquier respuesta.", en: " on any answer." })}</p></div>
      : <div style={{ maxWidth: 640 }}>{saved.map((s, i) => <button key={i} className="saved-q" onClick={() => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)}>
          {isPlaybook ? <span className="pb-listnum">{i + 1}</span> : <span className="qi"><Icon name="bookmark" size={16} /></span>}
          <div style={{ minWidth: 0 }}><div className="qt">{s.q}</div><div className="qm">{s.codoId} · {s.cite}</div></div>
          <span className="car"><Icon name="chevron-right" size={18} /></span></button>)}
          {isPlaybook && <PlaybookNudge onRun={() => setRun(true)} />}</div>}
  </div>;
}

function ColabPerfil() {
  return <div className="wrap">
    <div className="scr-head">{t({ es: "Perfil", en: "Profile" })}</div>
    <div className="scr-sub">{t({ es: "Tu cuenta de colaborador.", en: "Your collaborator account." })}</div>
    <div className="prof"><div className="pav">AR</div><div><div className="pn">Andrés Ríos</div><div className="pr">{t({ es: "COLABORADOR · ENTRA POR QR", en: "COLLABORATOR · ENTERS BY QR" })}</div></div></div>
    <div className="prof-row"><Icon name="globe" size={18} />{t({ es: "Idioma", en: "Language" })}<span className="pv">{window.__LANG === "en" ? "EN-US" : "ES-MX"}</span></div>
    <div className="prof-row"><Icon name="sparkles" size={18} />{t({ es: "Sugerencias de IA", en: "AI suggestions" })}<span className="pv">{t({ es: "Activadas", en: "On" })}</span></div>
    <div className="prof-row"><Icon name="building-2" size={18} />{t({ es: "Organizaci\u00f3n", en: "Organization" })}<span className="pv">Laboratorio Estándar</span></div>
    <div className="prof-row"><Icon name="bell" size={18} />{t({ es: "Notificaciones", en: "Notifications" })}<span className="pv">{t({ es: "Solo alertas", en: "Alerts only" })}</span></div>
    <div className="readonly-note"><Icon name="info" size={16} />{t({ es: "No gestionas documentos ni CoDos. Si necesitas acceso a un equipo, p\u00eddelo a tu admin de organizaci\u00f3n.", en: "You don\u2019t manage documents or CoDos. If you need access to equipment, ask your organization admin." })}</div>
  </div>;
}

Object.assign(window, { ColabInicio, ColabGuardadas, ColabPerfil });
