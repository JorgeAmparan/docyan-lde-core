/* DOCYAN commercial kit — signup / Stripe checkout flow. */

const STEPS_S = ["Plan", "Cuenta", "Fiscal", "Pago"];

function Signup({ go, region }) {
  const [step, setStep] = useState(1);
  const r = REGIONS[region];
  const [plan, setPlan] = useState(1);
  const [pay, setPay] = useState("card");
  const monthly = Math.round(r.plans[plan] * 0.85);

  if (step === 5) {
    return (
      <div className="auth" style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--success-100)", color: "var(--success-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "20px 0 0" }}>
          <Icon name="check" size={28} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "18px 0 8px" }}>Pago confirmado</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 15 }}>Enviamos tu factura a tu correo. Vamos a configurar tu primera organización.</p>
        <button className="btn primary lg" style={{ margin: "24px auto 0" }} onClick={() => go("account")}>Ir al onboarding<Icon name="arrow-right" size={17} /></button>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="steps-nav">
        {STEPS_S.map((s, i) => (
          <React.Fragment key={s}>
            <div className={"sn" + (i + 1 === step ? " on" : i + 1 < step ? " done" : "")}>
              <span className="sc">{i + 1 < step ? <Icon name="check" size={13} /> : i + 1}</span>{s}
            </div>
            {i < STEPS_S.length - 1 && <div className="bar" />}
          </React.Fragment>
        ))}
      </div>

      <div className="card">
        {step === 1 && (
          <>
            <h2>Elige tu plan</h2>
            <p className="lead">Puedes cambiar de plan en cualquier momento.</p>
            {PLAN_NAMES.map((name, i) => (
              <div key={name} className={"pay-row" + (i === plan ? " on" : "")} onClick={() => setPlan(i)} style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                  <div className="pr-ic" style={{ width: 22, height: 22, borderRadius: "50%", border: i === plan ? "6px solid var(--cinnabar-500)" : "2px solid var(--border-strong)", background: "transparent" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 7 }}>{name}{i === 1 && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-fg)", background: "var(--cinnabar-50)", border: "1px solid var(--cinnabar-100)", borderRadius: "var(--radius-full)", padding: "1px 7px" }}>Recomendado</span>}</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 2 }}>{PLAN_BLURB[i]}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flex: "none" }}>{i === 2 ? "Custom" : fmt(Math.round(r.plans[i] * 0.85), r.cur, "") + "/mes"}</div>
              </div>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <h2>Crea tu cuenta</h2>
            <p className="lead">Datos de acceso y de tu organización.</p>
            <div className="field"><label>Correo de trabajo</label><input placeholder="nombre@laboratorio.mx" /></div>
            <div className="row2c">
              <div className="field"><label>Contraseña</label><input type="password" placeholder="••••••••" /></div>
              <div className="field"><label>Organización</label><input placeholder="Laboratorio Estándar" /></div>
            </div>
            <div className="row2c">
              <div className="field"><label>Vertical</label><select><option>Laboratorio</option><option>Maquiladora</option><option>Farmacéutica</option><option>Minería</option><option>Agroexportación</option></select></div>
              <div className="field"><label>País</label><select><option>México</option><option>Estados Unidos</option><option>Australia</option></select></div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Datos fiscales</h2>
            <p className="lead">México · facturación CFDI.</p>
            <div className="row2c">
              <div className="field"><label>RFC</label><input placeholder="XAXX010101000" /></div>
              <div className="field"><label>Razón social</label><input placeholder="Laboratorio Estándar SA de CV" /></div>
            </div>
            <div className="field"><label>Uso de CFDI</label><select><option>G03 — Gastos en general</option><option>P01 — Por definir</option></select></div>
            <div className="field"><label>Dirección fiscal</label><input placeholder="Calle, número, colonia, CP" /></div>
          </>
        )}

        {step === 4 && (
          <>
            <h2>Pago</h2>
            <p className="lead">Procesado de forma segura con Stripe.</p>
            <div className={"pay-row" + (pay === "card" ? " on" : "")} onClick={() => setPay("card")}><span className="pr-ic">VISA</span>Tarjeta de crédito o débito</div>
            <div className={"pay-row" + (pay === "oxxo" ? " on" : "")} onClick={() => setPay("oxxo")}><span className="pr-ic">OXXO</span>OXXO / SPEI (pago referenciado)</div>
            {pay === "card" && (
              <div style={{ marginTop: 6 }}>
                <div className="field"><label>Número de tarjeta</label><input placeholder="4242 4242 4242 4242" /></div>
                <div className="row2c"><div className="field"><label>Vencimiento</label><input placeholder="MM / AA" /></div><div className="field"><label>CVC</label><input placeholder="123" /></div></div>
              </div>
            )}
            <div className="summary">
              <div className="sr"><span>{PLAN_NAMES[plan]} · anual (−15%)</span><span>{fmt(monthly, r.cur, r.suf)}/mes</span></div>
              <div className="sr"><span>Setup inicial</span><span>{r.setup[plan]}</span></div>
              <div className="sr"><span>IVA 16%</span><span>incluido</span></div>
              <div className="sr total"><span>Hoy</span><span>{fmt(Math.round(monthly * 12 * 1), r.cur, r.suf)}</span></div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 1 && <button className="btn sec" onClick={() => setStep(step - 1)}><Icon name="arrow-left" size={16} />Atrás</button>}
          <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => setStep(step + 1)}>
            {step === 4 ? "Pagar y crear cuenta" : "Continuar"}<Icon name="arrow-right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Signup });
