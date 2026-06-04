/* DOCYAN commercial kit — authenticated account dashboard (Capa B §6.5). */

const ACCT_NAV = [
  ["layout-dashboard", "Resumen", true],
  ["credit-card", "Plan y suscripción"],
  ["receipt", "Facturación"],
  ["wallet", "Saldo de ingesta"],
  ["users", "Usuarios"],
  ["lock", "Seguridad"],
];

function Account({ go }) {
  return (
    <div>
      <div className="nav">
        <div className="brand" onClick={() => go("landing")} style={{ cursor: "pointer" }}><Mark size={26} />DOCYAN<span className="lde">LDE</span></div>
        <div className="right">
          <span className="region"><Icon name="building-2" size={13} />Laboratorio Estándar</span>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--cinnabar-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>JM</div>
        </div>
      </div>

      <div className="acct">
        <aside className="acct-side">
          <h4>Cuenta</h4>
          {ACCT_NAV.map(([ic, t, on]) => <a key={t} className={on ? "on" : ""}><Icon name={ic} size={17} />{t}</a>)}
        </aside>
        <main className="acct-main">
          <h1>Resumen de cuenta</h1>

          <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, padding: 18 }}>
            <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", background: "var(--cinnabar-50)", color: "var(--cinnabar-600)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="badge-check" size={22} /></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Plan Profesional · anual</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Próxima factura: 12 jul 2026 · MXN 10,191/mes</div>
            </div>
            <button className="btn sec" style={{ marginLeft: "auto" }}>Cambiar plan</button>
          </div>

          <div className="usage">
            <div className="ucard"><div className="ul">Documentos vivos</div><div className="uv">218 / 300</div><div className="bar"><i style={{ width: "73%" }} /></div><div className="ud">73% del plan usado</div></div>
            <div className="ucard"><div className="ul">Almacenamiento</div><div className="uv">12.4 / 20 GB</div><div className="bar"><i style={{ width: "62%" }} /></div><div className="ud">62% usado</div></div>
            <div className="ucard"><div className="ul">Saldo de ingesta</div><div className="uv">$184 USD</div><div className="bar"><i style={{ width: "37%" }} /></div><div className="ud">Consumido $316 de $500</div></div>
          </div>

          <div className="card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Facturación reciente</h2>
              <a style={{ marginLeft: "auto", fontSize: 13, color: "var(--accent-fg)", fontWeight: 500, cursor: "pointer" }}>Ver todo</a>
            </div>
            {[["12 jun 2026", "Suscripción Profesional", "MXN 10,191"], ["12 may 2026", "Suscripción Profesional", "MXN 10,191"], ["28 abr 2026", "Recarga de saldo", "MXN 5,000"]].map((b, i) => (
              <div className="billrow" key={i}>
                <span className="bd">{b[0]}</span><span>{b[1]}</span><span className="amt">{b[2]}</span>
                <a><Icon name="download" size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />PDF</a>
              </div>
            ))}
          </div>

          <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon name="wallet" size={20} color="var(--cinnabar-600)" />
            <div><div style={{ fontWeight: 600, fontSize: 14 }}>Recargar saldo de ingesta</div><div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Presets: $50 · $100 · $250 · $500</div></div>
            <button className="btn primary" style={{ marginLeft: "auto" }}>Recargar</button>
          </div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { Account });
