/* DOCYAN — Consola del fundador. Jobs de ingesta cross-org (metadata operativa).
   org, estado, fase, progreso, tiempo — en vivo. Nunca el contenido del documento. */

const JOB_STATE = {
  procesando: { tone: "info",   label: "Procesando" },
  encolado:   { tone: "muted",  label: "En cola" },
  completado: { tone: "ok",     label: "Completado" },
  error:      { tone: "danger", label: "Error" },
};
const PHASE_ORDER = ["descarga", "conversion", "extraccion", "grafo", "dedup"];

function JobsView({ go }) {
  const [jobs, setJobs] = useState(JOBS);

  /* Tic en vivo: los jobs en proceso avanzan; el feedback respira. Cosmético —
     en producción esto se sustituye por SSE/polling del backend (ver INGESTA-HANDOFF). */
  useEffect(() => {
    const id = setInterval(() => {
      setJobs((prev) => prev.map((j) => {
        if (j.estado !== "procesando") return j;
        let pct = j.pct + Math.random() * 2.4;
        let fase = j.fase;
        if (pct >= 100) { pct = 8; const idx = (PHASE_ORDER.indexOf(j.fase) + 1) % PHASE_ORDER.length; fase = PHASE_ORDER[idx]; }
        return { ...j, pct, fase };
      }));
    }, 1100);
    return () => clearInterval(id);
  }, []);

  const counts = {
    procesando: jobs.filter((j) => j.estado === "procesando").length,
    encolado: jobs.filter((j) => j.estado === "encolado").length,
    error: jobs.filter((j) => j.estado === "error").length,
    completado: jobs.filter((j) => j.estado === "completado").length,
  };

  return (
    <div className="pwrap">
      <div className="psec">
        <h2>Jobs de ingesta</h2>
        <span className="live-tag" style={{ marginLeft: "auto" }}><span className="live-dot" />En vivo · cross-org</span>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 18 }}>
        <div className="kpi"><div className="kpi-l"><Icon name="loader" size={13} />Procesando</div><div className="kpi-v">{counts.procesando}</div></div>
        <div className="kpi"><div className="kpi-l"><Icon name="list-ordered" size={13} />En cola</div><div className="kpi-v">{counts.encolado}</div></div>
        <div className="kpi"><div className="kpi-l"><Icon name="x-octagon" size={13} />Con error</div><div className="kpi-v" style={{ color: counts.error ? "var(--danger-600)" : "var(--fg)" }}>{counts.error}</div></div>
        <div className="kpi"><div className="kpi-l"><Icon name="circle-check" size={13} />Completados hoy</div><div className="kpi-v">{counts.completado}</div></div>
      </div>

      <div className="ptbl-wrap">
        <table className="ptbl">
          <thead><tr><th>Job</th><th>Organización</th><th>Estado</th><th>Fase</th><th>Progreso</th><th className="num">Docs</th><th>Tiempo</th><th></th></tr></thead>
          <tbody>
            {jobs.map((j) => {
              const s = JOB_STATE[j.estado];
              const barCls = j.estado === "completado" ? "done" : j.estado === "error" ? "err" : "";
              return (
                <tr key={j.id} className={j.estado === "completado" ? "dim" : ""}>
                  <td><div className="t-id" style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>{j.id}</div><div className="t-sub">{j.lote}</div></td>
                  <td className="t-name" style={{ fontWeight: 600 }}>{j.org}</td>
                  <td>
                    <Badge tone={s.tone} icon={j.estado === "procesando" ? "loader" : j.estado === "error" ? "x" : j.estado === "completado" ? "check" : "clock"}>{s.label}</Badge>
                  </td>
                  <td>
                    {j.fase
                      ? <span className="phase-tag"><span className="pix" style={{ background: j.estado === "error" ? "var(--danger-600)" : "var(--accent)" }} />{PHASE_LABELS[j.fase]}</span>
                      : <span className="t-sub" style={{ color: "var(--fg-subtle)" }}>—</span>}
                    {j.estado === "error" && j.error && <div className="job-err"><Icon name="alert-triangle" size={12} />{j.error}</div>}
                  </td>
                  <td>
                    {j.estado === "encolado"
                      ? <span className="t-sub">{j.eta}</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span className="job-bar"><i className={barCls} style={{ width: Math.round(j.pct) + "%" }} /></span>
                          <span className="t-num t-sub">{Math.round(j.pct)}%</span>
                        </span>}
                  </td>
                  <td className="num t-num">{j.docs}</td>
                  <td className="t-num t-sub">{j.estado === "procesando" ? <>{j.transcurrido} · queda {j.eta}</> : j.transcurrido}</td>
                  <td style={{ textAlign: "right" }}>
                    {j.estado === "error"
                      ? <button className="btn ghost sm" onClick={() => go("soporte")}><Icon name="external-link" size={13} />Revisar</button>
                      : <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="privacy">
        <Icon name="shield" size={14} />
        Solo metadata operativa: organización, estado, fase y tiempo. La consola del fundador nunca ve el contenido de los documentos que estos jobs procesan.
      </div>
    </div>
  );
}

Object.assign(window, { JobsView });
