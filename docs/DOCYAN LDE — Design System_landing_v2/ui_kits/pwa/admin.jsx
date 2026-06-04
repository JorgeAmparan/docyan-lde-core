/* DOCYAN PWA kit — admin org dashboard shell + Resumen view (desktop, dense). */

const ADMIN_NAV = [
  ["grp", "Operación"],
  ["layout-dashboard", "Resumen", "resumen"],
  ["folder-tree", "CoDos", "codos"],
  ["bell", "Alertas", "alertas"],
  ["grp", "Administración"],
  ["upload", "Ingesta", "ingesta"],
  ["shield-check", "Gobernanza & FAT", "gobernanza"],
  ["qr-code", "Generar QRs", "qrs"],
  ["users", "Usuarios", "usuarios"],
];

const VIEW_TITLES = {
  resumen: "Resumen general",
  codos: "CoDos",
  alertas: "Alertas administrativas",
  ingesta: "Ingesta de documentos",
  gobernanza: "Gobernanza & FAT",
  qrs: "Generar QRs",
  usuarios: "Usuarios",
};

function AdminDashboard() {
  const [view, setView] = useState("resumen");
  return (
    <div className="admin">
      <aside className="side">
        <div className="side-logo"><Mark size={24} /><span className="w">DOCYAN</span><span className="lde">LDE</span></div>
        <nav className="nav">
          {ADMIN_NAV.map((n, i) =>
            n[0] === "grp"
              ? <div className="grp" key={i}>{n[1]}</div>
              : <a className={view === n[2] ? "on" : ""} key={i} onClick={() => setView(n[2])}><Icon name={n[0]} size={17} />{n[1]}</a>
          )}
        </nav>
        <div className="org">
          <div className="av">LE</div>
          <div style={{ minWidth: 0 }}>
            <div className="ot">Laboratorio Estándar</div>
            <div className="om">Plan Profesional</div>
          </div>
          <Icon name="chevrons-up-down" size={15} color="var(--fg-subtle)" />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{VIEW_TITLES[view]}</h1>
          <div className="search"><Icon name="search" size={15} /><input placeholder="Buscar en todos los CoDos…" /></div>
          <div className="av-user">JM</div>
        </header>

        <div className="content">
          {view === "resumen" && <ResumenView go={setView} />}
          {view === "codos" && <CodosView />}
          {view === "alertas" && <AdminAlertsView />}
          {view === "ingesta" && <IngestaView />}
          {view === "gobernanza" && <GobernanzaView />}
          {view === "qrs" && <QRsView />}
          {view === "usuarios" && <UsuariosView />}
        </div>
      </div>
    </div>
  );
}

function ResumenView({ go }) {
  const [verified, setVerified] = useState(false);
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="sl"><Icon name="folder" size={12} />CoDos activos</div><div className="sv">7</div><div className="sd">142 documentos vivos</div></div>
        <div className="stat"><div className="sl"><Icon name="zap" size={12} />Hit rate caché</div><div className="sv">86%</div><div className="sd"><span className="up">▲ 4%</span> vs. mes pasado</div></div>
        <div className="stat"><div className="sl"><Icon name="coins" size={12} />Costo / consulta</div><div className="sv">$0.011</div><div className="sd">promedio 30 días</div></div>
        <div className="stat"><div className="sl"><Icon name="timer" size={12} />Latencia P95</div><div className="sv">1.4s</div><div className="sd">P50 · 0.3s</div></div>
      </div>

      <div className="sec-h"><h2>CoDos</h2><span className="more" onClick={() => go("codos")}>Ver todos →</span></div>
      <div className="codos">
        <div className="codo-card" onClick={() => go("codos")}>
          <div className="ch"><div style={{ minWidth: 0 }}><div className="cid">CODO-LAB-04</div><div className="cn">Centrífugas & rotores</div></div><span className="badge warn" style={{ marginLeft: "auto" }}><Icon name="alarm-clock" size={12} />2 alertas</span></div>
          <div className="crow"><div className="ci"><span className="civ">24</span><span className="cil">docs vivos</span></div><div className="ci"><span className="civ">318</span><span className="cil">consultas / 30d</span></div><div className="ci"><span className="civ">9</span><span className="cil">colaboradores</span></div></div>
        </div>
        <div className="codo-card" onClick={() => go("codos")}>
          <div className="ch"><div style={{ minWidth: 0 }}><div className="cid">CODO-LAB-02</div><div className="cn">Balanzas analíticas</div></div><span className="badge ok" style={{ marginLeft: "auto" }}><Icon name="check" size={12} />Al día</span></div>
          <div className="crow"><div className="ci"><span className="civ">31</span><span className="cil">docs vivos</span></div><div className="ci"><span className="civ">204</span><span className="cil">consultas / 30d</span></div><div className="ci"><span className="civ">6</span><span className="cil">colaboradores</span></div></div>
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <div className="sec-h"><h2>Patrones detectados</h2></div>
          <div className="pattern"><div className="pic"><Icon name="repeat" size={16} /></div><div><div className="pt">3 colaboradores repiten la misma secuencia de arranque en la Hettich</div><div className="pm">Sugerencia de Playbook · últimos 14 días</div></div></div>
          <div className="pattern"><div className="pic"><Icon name="message-square" size={16} /></div><div><div className="pt">Consultas sobre calibración suben antes de cada auditoría</div><div className="pm">Patrón estacional · CODO-LAB-02</div></div></div>
          <div className="pattern"><div className="pic"><Icon name="file-warning" size={16} /></div><div><div className="pt">2 personas anotaron holgura en el mismo acople</div><div className="pm">Observación recurrente · 30 días</div></div></div>
        </div>
        <div className="panel">
          <div className="sec-h"><h2>Saldo de ingesta</h2><span className="more" onClick={() => go("ingesta")}>Recargar →</span></div>
          <div className="bal-row"><span className="bv">$184</span><span style={{ fontSize: 13, color: "var(--fg-muted)" }}>USD disponibles</span></div>
          <div className="bar"><i style={{ width: "37%" }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 7 }}>Consumido $316 de $500 este ciclo</div>
          <div className="chain">
            <div className="ci2"><Icon name="shield-check" size={18} /></div>
            <div><div className="ct">Cadena criptográfica</div><div className="cm">{verified ? "SHA-256 · íntegra · 8,412 eventos" : "FAT · SHA-256"}</div></div>
            <button onClick={() => setVerified(true)}>{verified ? "✓ Verificada" : "Verificar"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { AdminDashboard, ResumenView });
