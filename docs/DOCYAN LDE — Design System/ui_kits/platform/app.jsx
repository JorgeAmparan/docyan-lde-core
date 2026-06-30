/* DOCYAN — Consola del fundador (platform_admin). Shell + navegación + montaje. */

const PNAV = [
  ["grp", "Operación"],
  ["layout-dashboard", "Resumen", "resumen"],
  ["building-2", "Organizaciones", "orgs"],
  ["server", "Jobs de ingesta", "jobs", "jobsAlert"],
  ["grp", "Comercial"],
  ["ticket", "Códigos de acceso", "codigos"],
  ["banknote", "Ingresos", "ingresos"],
  ["grp", "Relación"],
  ["life-buoy", "Soporte", "soporte", "soporteCount"],
];

const VIEW_META = {
  resumen:  { title: "Resumen de plataforma", crumb: "PLATAFORMA / RESUMEN" },
  orgs:     { title: "Organizaciones", crumb: "PLATAFORMA / ORGANIZACIONES" },
  jobs:     { title: "Jobs de ingesta", crumb: "PLATAFORMA / JOBS" },
  codigos:  { title: "Códigos de acceso", crumb: "PLATAFORMA / CÓDIGOS" },
  ingresos: { title: "Ingresos", crumb: "PLATAFORMA / INGRESOS" },
  soporte:  { title: "Soporte", crumb: "PLATAFORMA / SOPORTE" },
};

function PlatformConsole() {
  const [view, setView] = useState("resumen");
  const go = (v) => setView(v);

  const badges = {
    jobsAlert: JOBS.filter((j) => j.estado === "error").length,
    soporteCount: SUPPORT.filter((t) => t.estado === "abierto").length,
  };
  const meta = VIEW_META[view];

  return (
    <div className="papp">
      <aside className="pside">
        <div className="pslogo"><Mark size={24} tone="light" /><span className="w">DOCYAN</span><span className="pl">PLATAFORMA</span></div>

        <div className="psbadge">
          <Icon name="shield-half" size={16} />
          <div style={{ minWidth: 0 }}>
            <div className="pb-t">platform_admin</div>
            <div className="pb-s">Fuera del aislamiento de cliente</div>
          </div>
        </div>

        <nav className="pnav">
          {PNAV.map((n, i) => n[0] === "grp"
            ? <div className="grp" key={i}>{n[1]}</div>
            : (
              <a key={i} className={view === n[2] ? "on" : ""} onClick={() => go(n[2])}>
                <Icon name={n[0]} size={17} />{n[1]}
                {n[3] && badges[n[3]] > 0 && <span className={"ncount" + (n[3] === "jobsAlert" ? " alert" : "")}>{badges[n[3]]}</span>}
              </a>
            )
          )}
        </nav>

        <div className="psfoot">
          <div className="pf-id">
            <div className="av">XC</div>
            <div style={{ minWidth: 0 }}>
              <div className="pf-n">XCID · Fundador</div>
              <div className="pf-r">platform_admin</div>
            </div>
          </div>
          <div className="pf-guard"><Icon name="shield-check" size={13} />Metadata · nunca contenido</div>
        </div>
      </aside>

      <div className="pmain">
        <header className="ptop">
          <div>
            <h1>{meta.title}</h1>
          </div>
          <span className="crumb">{meta.crumb}</span>
          <div className="psearch"><Icon name="search" size={15} /><input placeholder="Buscar organización, código, job…" /></div>
          <div className="period"><Icon name="calendar" size={14} />{PLATFORM_KPIS.periodo}</div>
        </header>

        <div className="pcontent">
          {view === "resumen" && <ResumenView go={go} />}
          {view === "orgs" && <OrgsView go={go} />}
          {view === "jobs" && <JobsView go={go} />}
          {view === "codigos" && <CodesView />}
          {view === "ingresos" && <IngresosView />}
          {view === "soporte" && <SupportView />}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PlatformConsole />);
