/* DOCYAN — Consola del fundador. Organizaciones: tabla + detalle de org.
   Detalle = peso de almacenamiento, nº docs, tiempo de ingesta, cupo de ingestas/excedente,
   frecuencia de consultas (número, nunca causa). Metadata, nunca contenido. */

const ORG_FILTERS = [
  ["todas", "Todas"],
  ["activa", "Activas"],
  ["gracia", "Gracia"],
  ["suspendida", "Suspendidas"],
  ["piloto", "Pilotos"],
  ["freemium", "Freemium"],
  ["cancelada", "Canceladas"],
];

function OrgsTable({ open }) {
  const [filter, setFilter] = useState("todas");
  const [q, setQ] = useState("");
  const rows = ORGS.filter((o) =>
    (filter === "todas" || o.estado === filter) &&
    (q === "" || o.name.toLowerCase().includes(q.toLowerCase()) || o.id.toLowerCase().includes(q.toLowerCase()))
  );
  const counts = (f) => f === "todas" ? ORGS.length : ORGS.filter((o) => o.estado === f).length;

  return (
    <div className="pwrap">
      <div className="psec"><h2>Organizaciones</h2><span className="scount mono">{ORGS.length} totales</span></div>

      <div className="filters">
        {ORG_FILTERS.map(([k, l]) => (
          <button key={k} className={"fpill" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {l}<span className="fc">{counts(k)}</span>
          </button>
        ))}
        <div className="fsearch"><Icon name="search" size={14} /><input placeholder="Buscar org o ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      <div className="ptbl-wrap">
        <table className="ptbl">
          <thead>
            <tr>
              <th>Organización</th><th>Alta</th><th>Plan</th><th>Banda</th><th>Estado</th>
              <th className="num">Usuarios</th><th className="num">Docs</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className={"clik" + (o.estado === "cancelada" ? " dim" : "")} onClick={() => open(o.id)}>
                <td><div className="t-name">{o.name}</div><div className="t-id">{o.id} · {o.vertical}</div></td>
                <td className="t-sub">{o.alta}</td>
                <td><PlanTag plan={o.plan} /></td>
                <td className="t-num t-sub">{o.banda}</td>
                <td><StatusBadge estado={o.estado} dias={o.dias} /></td>
                <td className="num t-num">{o.usuarios}</td>
                <td className="num t-num">{o.docs.toLocaleString("en-US")}</td>
                <td className="chev-cell"><Icon name="chevron-right" size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrgDetail({ org, back, go }) {
  const o = org;
  const cupoPct = o.cupoMes ? Math.min(100, Math.round((o.cupoUsado / o.cupoMes) * 100)) : 0;
  const barTone = cupoPct >= 95 ? "danger" : cupoPct >= 75 ? "warn" : "";
  const initials = o.name.split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <div className="pwrap">
      <div className="back-row"><button className="linkbtn" onClick={back}><Icon name="arrow-left" size={15} />Organizaciones</button></div>

      <div className="od-head">
        <div className="od-mark">{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div className="od-name">{o.name}</div>
          <div className="od-meta">
            <span className="mid">{o.id}</span><span className="sep">·</span>
            <PlanTag plan={o.plan} />
            <StatusBadge estado={o.estado} dias={o.dias} />
            <span className="sep">·</span>
            <span className="mline">{o.vertical} · banda {o.banda} · alta {o.alta}</span>
          </div>
        </div>
        <div className="od-actions">
          <button className="btn ghost sm" onClick={() => go("ingresos")}><Icon name="receipt" size={14} />Estado de cuenta</button>
          <button className="btn ghost sm" onClick={() => go("soporte")}><Icon name="life-buoy" size={14} />Soporte</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric"><div className="ml"><Icon name="hard-drive" size={13} />Peso de almacenamiento</div><div className="mv">{o.storageGB}<span className="u">GB</span></div><div className="ms">{o.docs.toLocaleString("en-US")} documentos · metadata de peso</div></div>
        <div className="metric"><div className="ml"><Icon name="files" size={13} />Documentos vivos</div><div className="mv">{o.docs.toLocaleString("en-US")}</div><div className="ms">{o.usuarios} usuarios con acceso</div></div>
        <div className="metric"><div className="ml"><Icon name="timer" size={13} />Tiempo prom. de ingesta</div><div className="mv">{o.avgIngestMin}<span className="u">min</span></div><div className="ms">por documento · últimos 30 d</div></div>
        <div className="metric"><div className="ml"><Icon name="activity" size={13} />Frecuencia de consultas</div><div className="mv">{o.consultas30d.toLocaleString("en-US")}</div><div className="ms">consultas / 30 d · frecuencia, no causa</div></div>
      </div>

      <div className="split-bal" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="psec" style={{ marginTop: 0 }}><h2>Cupo de ingestas</h2></div>
          {o.cupoMes > 0
            ? <>
                <div className="bal-row"><span className="bal-v mono">{o.cupoMes - o.cupoUsado}</span><span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>de {o.cupoMes} restantes este mes</span></div>
                <div className="bar"><i className={barTone} style={{ width: cupoPct + "%" }} /></div>
                <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 8 }}>
                  Usadas <b className="mono">{o.cupoUsado}</b> de <b className="mono">{o.cupoMes}</b> · adicionales este ciclo <b className="mono">${o.excedenteUSD.toLocaleString("en-US")}</b>
                </div>
              </>
            : <div style={{ fontSize: 12.5, color: "var(--fg-muted)", padding: "4px 0" }}>Freemium · sin cupo de ingestas (límite de 3 documentos vivos).</div>}
        </div>
        <div className="panel">
          <div className="psec" style={{ marginTop: 0 }}><h2>Suscripción</h2></div>
          <div className="acct-row"><span className="al">Plan</span><span className="av">{o.plan} · banda {o.banda}</span></div>
          <div className="acct-row"><span className="al">Estado de ciclo de vida</span><span className="av"><StatusBadge estado={o.estado} dias={o.dias} /></span></div>
          <div className="acct-row"><span className="al">Próxima fecha de corte</span><span className={"av mono" + (o.proximoCorte === "vencido" ? "" : "")} style={o.proximoCorte === "vencido" ? { color: "var(--danger-600)" } : null}>{o.proximoCorte}</span></div>
        </div>
      </div>

      <div className="privacy">
        <Icon name="shield" size={14} />
        Vista de metadata operativa. DOCYAN nunca expone el texto de los documentos de {o.name} ni el contenido de sus consultas — solo pesos, tiempos, estados y frecuencias.
      </div>
    </div>
  );
}

function OrgsView({ go }) {
  const [openId, setOpenId] = useState(null);
  const org = openId ? ORGS.find((o) => o.id === openId) : null;
  if (org) return <OrgDetail org={org} back={() => setOpenId(null)} go={go} />;
  return <OrgsTable open={setOpenId} />;
}

Object.assign(window, { OrgsView });
