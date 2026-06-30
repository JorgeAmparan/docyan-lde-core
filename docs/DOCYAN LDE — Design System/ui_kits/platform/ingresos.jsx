/* DOCYAN — Consola del fundador. Ingresos:
   registrar pago manual (org, monto, moneda, concepto), historial,
   estado de cuenta por org (pagos, suscripción, próxima fecha de corte). */

function fmtMoney(n, cur) {
  const v = n.toLocaleString("en-US");
  return cur === "MXN" ? "MXN " + v : "$" + v;
}

function RegisterPayment({ onAdd }) {
  const [org, setOrg] = useState("");
  const [monto, setMonto] = useState("");
  const [cur, setCur] = useState("USD");
  const [concepto, setConcepto] = useState("");
  const ok = org && monto && concepto;
  return (
    <div className="panel">
      <div className="psec" style={{ marginTop: 0 }}><h2>Registrar pago manual</h2></div>
      <p className="panel-lead">Cobro manual durante el piloto. Queda en el historial y actualiza el estado de cuenta de la organización.</p>
      <div className="field"><label>Organización</label>
        <select className="sel" value={org} onChange={(e) => setOrg(e.target.value)}>
          <option value="">Selecciona organización…</option>
          {ORGS.filter((o) => o.estado !== "cancelada").map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
      </div>
      <div className="frow">
        <div className="field"><label>Monto</label><input className="inp mono" inputMode="decimal" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
        <div className="field"><label>Moneda</label>
          <select className="sel" value={cur} onChange={(e) => setCur(e.target.value)}>
            <option>USD</option><option>MXN</option><option>EUR</option><option>GBP</option><option>AUD</option>
          </select>
        </div>
      </div>
      <div className="field"><label>Concepto</label><input className="inp" placeholder="Ej. Suscripción Profesional · junio" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
      <button className="btn primary" style={{ width: "100%" }} disabled={!ok} onClick={() => { onAdd({ fecha: "06 jun 2026", org, monto: parseFloat(monto) || 0, cur, concepto, metodo: "Transferencia" }); setOrg(""); setMonto(""); setConcepto(""); }}>
        <Icon name="plus" size={15} />Registrar pago
      </button>
    </div>
  );
}

function IngresosView() {
  const [payments, setPayments] = useState(PAYMENTS);
  const [acctOrg, setAcctOrg] = useState("Farmacéutica Quálitas");

  const totalUSD = payments.filter((p) => p.cur === "USD").reduce((s, p) => s + p.monto, 0);
  const acct = ACCOUNT_STATE[acctOrg];
  const acctPayments = payments.filter((p) => p.org === acctOrg);

  return (
    <div className="pwrap">
      <div className="psec"><h2>Ingresos</h2><span className="scount mono">{PLATFORM_KPIS.periodo}</span></div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi"><div className="kpi-l"><Icon name="banknote" size={13} />Registrado (USD)</div><div className="kpi-v">${totalUSD.toLocaleString("en-US")}</div><div className="kpi-foot"><div className="kpi-d">{payments.filter((p) => p.cur === "USD").length} pagos este periodo</div></div></div>
        <div className="kpi"><div className="kpi-l"><Icon name="clock-alert" size={13} />Saldo vencido</div><div className="kpi-v" style={{ color: "var(--danger-600)" }}>$1,297</div><div className="kpi-foot"><div className="kpi-d">2 orgs en gracia · 1 suspendida</div></div></div>
        <div className="kpi"><div className="kpi-l"><Icon name="repeat" size={13} />MRR estimado</div><div className="kpi-v">$11,400</div><div className="kpi-foot"><div className="kpi-d">suscripciones activas recurrentes</div></div></div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div>
          <div className="psec" style={{ marginTop: 0 }}><h2>Historial de pagos</h2><span className="scount mono">{payments.length}</span></div>
          <div className="ptbl-wrap">
            <table className="ptbl">
              <thead><tr><th>Fecha</th><th>Organización</th><th>Concepto</th><th>Método</th><th className="num">Monto</th></tr></thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td className="t-num t-sub">{p.fecha}</td>
                    <td className="t-name" style={{ fontWeight: 600 }}>{p.org}</td>
                    <td className="t-sub">{p.concepto}</td>
                    <td><span className="t-sub">{p.metodo}</span></td>
                    <td className="num t-num" style={{ fontWeight: 600 }}>{fmtMoney(p.monto, p.cur)} <span className="t-sub" style={{ fontWeight: 400 }}>{p.cur}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <RegisterPayment onAdd={(p) => setPayments([p, ...payments])} />
      </div>

      <div className="psec" style={{ marginTop: 24 }}><h2>Estado de cuenta por organización</h2></div>
      <div className="acct-card">
        <div className="field" style={{ maxWidth: 380, marginBottom: 16 }}>
          <label>Organización</label>
          <select className="sel" value={acctOrg} onChange={(e) => setAcctOrg(e.target.value)}>
            {Object.keys(ACCOUNT_STATE).map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        {acct && (
          <div className="split-bal">
            <div>
              <div className="acct-row"><span className="al">Suscripción</span><span className="av">{acct.suscripcion}</span></div>
              <div className="acct-row"><span className="al">Próxima fecha de corte</span><span className="av mono" style={acct.proximoCorte.startsWith("vencido") ? { color: "var(--danger-600)" } : null}>{acct.proximoCorte}</span></div>
              <div className="acct-row"><span className="al">Saldo vencido</span><span className="av mono" style={acct.saldoVencido > 0 ? { color: "var(--danger-600)" } : { color: "var(--success-600)" }}>${acct.saldoVencido.toLocaleString("en-US")} USD</span></div>
            </div>
            <div>
              <div className="t-id" style={{ marginBottom: 8, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase" }}>Pagos de esta org</div>
              {acctPayments.length ? acctPayments.map((p, i) => (
                <div className="acct-row" key={i}><span className="al">{p.fecha} · {p.concepto}</span><span className="av mono">{fmtMoney(p.monto, p.cur)}</span></div>
              )) : <div className="t-sub">Sin pagos registrados este periodo.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { IngresosView });
