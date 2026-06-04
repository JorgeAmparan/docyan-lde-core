/* DOCYAN commercial kit — pricing with regional detection + comparison. */

const REGIONS = {
  "USA / CA": { cur: "$", suf: " USD", plans: [299, 699, 2500], setup: ["$199", "$499", "Custom"] },
  "UE": { cur: "€", suf: " EUR", plans: [289, 679, 2450], setup: ["€199", "€499", "Custom"] },
  "UK": { cur: "£", suf: " GBP", plans: [249, 589, 2099], setup: ["£179", "£429", "Custom"] },
  "AU": { cur: "AUD ", suf: "", plans: [459, 1079, 3849], setup: ["AUD 309", "AUD 769", "Custom"] },
  "MX": { cur: "MXN ", suf: "", plans: [4990, 11990, 42500], setup: ["MXN 3,490", "MXN 8,490", "Custom"] },
  "LatAm": { cur: "$", suf: " USD", plans: [229, 529, 2500], setup: ["$159", "$379", "Custom"] },
};
const PLAN_NAMES = ["Esencial", "Profesional", "Enterprise"];
const PLAN_BLURB = ["Para un equipo o un CoDo.", "Para operación multi-CoDo.", "Para organizaciones reguladas a escala."];
const PLAN_FEAT = [
  ["50 documentos vivos", "1 par lingüístico", "1 admin · colaboradores ilimitados", "Memoria reactiva + Playbooks A·B·C", "Soporte email 48h"],
  ["300 documentos vivos", "3 pares lingüísticos", "3 admins · colaboradores ilimitados", "Dashboard métricas PCL + reportes EDB", "Playbooks precargados por vertical", "Soporte email + chat 24h"],
  ["Documentos ilimitados", "Pares lingüísticos ilimitados", "Reportes regulatorios custom", "SLA 99.5% · soporte 24/7", "Onboarding in-situ", "On-premise opcional"],
];

function fmt(n, cur, suf) { return cur + n.toLocaleString("en-US") + suf; }

function Pricing({ go, region, setRegion }) {
  const [annual, setAnnual] = useState(true);
  const r = REGIONS[region];
  const price = (i) => annual ? Math.round(r.plans[i] * 0.85) : r.plans[i];

  return (
    <div>
      <div className="pricing-head">
        <div className="wrap">
          <span className="eyebrow">Precios</span>
          <h1>Planes claros. Cifras públicas.</h1>
          <div className="region-bar">
            {Object.keys(REGIONS).map((k) => (
              <button key={k} className={"rb" + (k === region ? " on" : "")} onClick={() => setRegion(k)}>{k}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="billing-toggle">
              <span style={{ color: annual ? "var(--fg-subtle)" : "var(--fg)" }}>Mensual</span>
              <div className={"sw" + (annual ? "" : " month")} onClick={() => setAnnual(!annual)}><i /></div>
              <span style={{ color: annual ? "var(--fg)" : "var(--fg-subtle)" }}>Anual</span>
              <span className="save-pill">−15%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="plans">
          {PLAN_NAMES.map((name, i) => (
            <div className={"plan" + (i === 1 ? " rec" : "")} key={name}>
              {i === 1 && <span className="rec-tag">Recomendado</span>}
              <div className="pn">{name}</div>
              <div className="pp"><span className="amt">{fmt(price(i), r.cur, "")}</span><span className="per">{r.suf || ""}/mes</span></div>
              <div className="setup">Setup inicial: {r.setup[i]}</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "12px 0 0" }}>{PLAN_BLURB[i]}</p>
              <ul className="pfeat">
                {PLAN_FEAT[i].map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}
              </ul>
              <button className={"btn " + (i === 1 ? "primary" : "sec")} style={{ width: "100%", justifyContent: "center" }} onClick={() => go("signup")}>
                {i === 2 ? "Hablar con ventas" : "Empezar"}
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, margin: "8px 0 40px", fontSize: 13, color: "var(--fg-muted)" }}>
          <span><Icon name="shield-check" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />30 días de garantía</span>
          <span><Icon name="calendar" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Demo en vivo (sin trial gratuito)</span>
          <span><Icon name="receipt" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Impuestos según jurisdicción</span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Comparativa</h2>
        <table className="cmp">
          <thead><tr><th></th><th className="c">Esencial</th><th className="c">Profesional</th><th className="c">Enterprise</th></tr></thead>
          <tbody>
            {[
              ["Documentos vivos", "50", "300", "Ilimitados"],
              ["Pares lingüísticos", "1", "3", "Ilimitados"],
              ["Admins incluidos", "1", "3", "3"],
              ["Colaboradores con QR", "Ilimitados", "Ilimitados", "Ilimitados"],
              ["Pedigree cliqueable", true, true, true],
              ["Playbooks A·B·C", true, true, true],
              ["Métricas PCL + reportes EDB", false, true, true],
              ["Reportes regulatorios custom", false, false, true],
              ["Almacenamiento", "5 GB", "20 GB", "Ilimitado"],
              ["SLA", "—", "—", "99.5%"],
              ["On-premise", false, false, true],
            ].map((row) => (
              <tr key={row[0]}>
                <td>{row[0]}</td>
                {[1, 2, 3].map((c) => (
                  <td className={"c" + (c === 2 ? " reccol" : "")} key={c}>
                    {row[c] === true ? <Icon name="check" size={16} style={{ color: "var(--success-600)" }} />
                      : row[c] === false ? <Icon name="minus" size={16} style={{ color: "var(--stone-400)" }} />
                      : row[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ height: 56 }} />
      </div>
      <Footer go={go} />
    </div>
  );
}

Object.assign(window, { Pricing });
