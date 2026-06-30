/* DOCYAN — Consola del fundador. Resumen de plataforma:
   banda crítica (acción) arriba → KPIs de un vistazo → tendencias. */

function CriticalBand({ go }) {
  return (
    <div className="panel" style={{ borderColor: "var(--cinnabar-200)", background: "linear-gradient(180deg, #FEFBF8, var(--surface) 60%)" }}>
      <div className="crit-head">
        <Icon name="siren" size={18} />
        <span className="ct">Requiere acción</span>
        <span className="cs">· estado crítico y oportunidades comerciales con fecha límite</span>
      </div>
      <div className="crit-grid">
        {CRITICAL.map((c, i) => (
          <div className={"crit-card k-" + c.kind} key={i}>
            <div className="crit-ic"><Icon name={c.icon} size={16} /></div>
            <div className="crit-body">
              <div className="crit-t"><span className="cn mono">{c.n}</span>{c.label}</div>
              <div className="crit-d">{c.detail}</div>
              <button className="crit-cta" onClick={() => go(c.to)}>{c.cta}<Icon name="arrow-right" size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCards() {
  const k = PLATFORM_KPIS;
  return (
    <div className="kpis">
      <div className="kpi">
        <div className="kpi-l"><Icon name="building-2" size={13} />Organizaciones</div>
        <div className="kpi-v">{k.orgs.value}</div>
        <div className="kpi-foot"><div className="kpi-d"><span className="up">▲ {k.orgs.delta}</span> {k.orgs.sub}</div><Spark data={TRENDS.orgs} color="var(--success-600)" /></div>
      </div>
      <div className="kpi">
        <div className="kpi-l"><Icon name="users" size={13} />Usuarios</div>
        <div className="kpi-v">{k.usuarios.value.toLocaleString("en-US")}</div>
        <div className="kpi-foot"><div className="kpi-d"><span className="up">▲ {k.usuarios.delta}</span> {k.usuarios.sub}</div></div>
      </div>
      <div className="kpi">
        <div className="kpi-l"><Icon name="hard-drive" size={13} />Almacenamiento</div>
        <div className="kpi-v">{k.almacenamiento.value}<span className="u">{k.almacenamiento.unit}</span></div>
        <div className="kpi-foot"><div className="kpi-d"><span className="up">▲ {k.almacenamiento.delta} TB</span> {k.almacenamiento.sub}</div></div>
      </div>
      <div className="kpi">
        <div className="kpi-l"><Icon name="loader" size={13} />Jobs activos</div>
        <div className="kpi-v">{k.jobsActivos.value}</div>
        <div className="kpi-foot"><div className="kpi-d">{k.jobsActivos.sub}</div></div>
      </div>
      <div className="kpi">
        <div className="kpi-l"><Icon name="banknote" size={13} />Ingresos</div>
        <div className="kpi-v" style={{ fontSize: 22 }}>${k.ingresos.value}<span className="u">{k.ingresos.unit}</span></div>
        <div className="kpi-foot"><div className="kpi-d"><span className="up">▲ {k.ingresos.delta}</span> {k.ingresos.sub}</div><Spark data={TRENDS.ingresos} color="var(--accent)" /></div>
      </div>
    </div>
  );
}

function Trends() {
  return (
    <div className="trends">
      <div className="tcard">
        <div className="tcard-h"><span className="tcard-t">Crecimiento de organizaciones</span><span className="tcard-v">{TRENDS.orgs.at(-1)}</span></div>
        <AreaChart data={TRENDS.orgs} labels={MONTHS} color="var(--success-600)" fill="rgba(44,122,87,.10)" />
      </div>
      <div className="tcard">
        <div className="tcard-h"><span className="tcard-t">Ingresos por mes</span><span className="tcard-v">${TRENDS.ingresos.at(-1)}K<span className="u">USD</span></span></div>
        <BarChart data={TRENDS.ingresos} labels={MONTHS} color="var(--accent)" />
      </div>
      <div className="tcard">
        <div className="tcard-h"><span className="tcard-t">Consultas de plataforma</span><span className="tcard-v">{TRENDS.consultas.at(-1)}K</span></div>
        <AreaChart data={TRENDS.consultas} labels={MONTHS} color="var(--info-600)" fill="rgba(62,110,120,.10)" />
      </div>
    </div>
  );
}

function ResumenView({ go }) {
  return (
    <div className="pwrap">
      <CriticalBand go={go} />

      <div className="psec"><span className="eb">Estado de plataforma</span><span className="scount mono">{PLATFORM_KPIS.periodo}</span></div>
      <KpiCards />

      <div className="psec" style={{ marginTop: 22 }}><h2>Tendencias</h2><span className="more" onClick={() => go("orgs")}>Ver organizaciones →</span></div>
      <Trends />

      <div className="privacy" style={{ marginTop: 18 }}>
        <Icon name="shield" size={14} />
        Metadata sí, contenido nunca. La consola muestra números, pesos, tiempos, estados y frecuencias — jamás el texto de un documento ni de una consulta de cliente.
      </div>
    </div>
  );
}

Object.assign(window, { ResumenView });
