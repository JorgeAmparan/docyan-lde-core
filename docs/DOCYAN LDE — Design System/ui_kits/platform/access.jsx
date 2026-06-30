/* DOCYAN — Consola del fundador. Códigos de acceso (pilotos):
   generar (cuota + vencimiento), ver existentes con estado, revocar. */

const CODE_STATE = {
  activo:   { tone: "ok",      icon: "circle-check", label: "Activo" },
  usado:    { tone: "info",    icon: "user-check",   label: "Usado" },
  expirado: { tone: "muted",   icon: "clock",        label: "Expirado" },
  revocado: { tone: "danger",  icon: "ban",          label: "Revocado" },
};

function randCode() {
  const a = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return "PILOTO-" + a() + "-" + a();
}

function GeneratorCard({ onGenerate, generated }) {
  const [cuota, setCuota] = useState("50");
  const [dias, setDias] = useState("30");
  const [nota, setNota] = useState("");
  return (
    <div className="panel">
      <div className="psec" style={{ marginTop: 0 }}><h2>Generar código de piloto</h2></div>
      <p className="panel-lead">Un código habilita un piloto con cuota de documentos y vencimiento. Se canjea una sola vez al crear la organización.</p>
      <div className="frow">
        <div className="field"><label>Cuota de documentos</label>
          <select className="sel" value={cuota} onChange={(e) => setCuota(e.target.value)}>
            <option value="25">25 documentos</option><option value="50">50 documentos</option><option value="100">100 documentos</option>
          </select>
        </div>
        <div className="field"><label>Vence en</label>
          <select className="sel" value={dias} onChange={(e) => setDias(e.target.value)}>
            <option value="14">14 días</option><option value="30">30 días</option><option value="45">45 días</option><option value="60">60 días</option>
          </select>
        </div>
      </div>
      <div className="field"><label>Nota interna <span className="hint">opcional</span></label><input className="inp" placeholder="Ej. piloto Lab Saltillo — referido por Delta Norte" value={nota} onChange={(e) => setNota(e.target.value)} /></div>
      <button className="btn primary" style={{ width: "100%" }} onClick={() => onGenerate(cuota, dias)}><Icon name="ticket-plus" size={15} />Generar código</button>

      {generated && (
        <div className="code-result">
          <div className="cr-lab">Código generado</div>
          <div className="cr-code">{generated.code}</div>
          <div className="cr-meta">Cuota {generated.cuotaDocs} docs · vence {generated.vence} · cópialo y compártelo con el piloto</div>
        </div>
      )}
    </div>
  );
}

function CodesView() {
  const [codes, setCodes] = useState(ACCESS_CODES);
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied] = useState(null);

  function generate(cuota, dias) {
    const d = new Date(2026, 5, 6 + parseInt(dias, 10));
    const vence = d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
    const nc = { code: randCode(), estado: "activo", cuotaDocs: parseInt(cuota, 10), vence, generado: "06 jun 2026", org: null, canjeado: null };
    setGenerated(nc);
    setCodes([nc, ...codes]);
  }
  function revoke(code) {
    setCodes(codes.map((c) => c.code === code ? { ...c, estado: "revocado" } : c));
  }
  function copy(code) { try { navigator.clipboard.writeText(code); } catch (e) {} setCopied(code); setTimeout(() => setCopied(null), 1400); }

  const activos = codes.filter((c) => c.estado === "activo").length;

  return (
    <div className="pwrap">
      <div className="psec"><h2>Códigos de acceso</h2><span className="scount mono">{activos} activos · {codes.length} totales</span></div>

      <div className="split">
        <div className="ptbl-wrap">
          <table className="ptbl">
            <thead><tr><th>Código</th><th>Estado</th><th className="num">Cuota</th><th>Vence</th><th>Organización</th><th></th></tr></thead>
            <tbody>
              {codes.map((c) => {
                const s = CODE_STATE[c.estado];
                return (
                  <tr key={c.code} className={c.estado === "expirado" || c.estado === "revocado" ? "dim" : ""}>
                    <td>
                      <div className="code-cell">
                        <span className="code-mono">{c.code}</span>
                        <button className="copybtn" title="Copiar" onClick={() => copy(c.code)}><Icon name={copied === c.code ? "check" : "copy"} size={13} /></button>
                      </div>
                      <div className="t-id">generado {c.generado}</div>
                    </td>
                    <td><Badge tone={s.tone} icon={s.icon}>{s.label}</Badge></td>
                    <td className="num t-num">{c.cuotaDocs} <span className="t-sub">docs</span></td>
                    <td className="t-num t-sub">{c.vence}</td>
                    <td>{c.org ? <span className="t-sub">{c.org}{c.canjeado ? <span className="t-id"> · canjeado {c.canjeado}</span> : null}</span> : <span className="t-sub" style={{ color: "var(--fg-subtle)" }}>— sin asignar</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      {c.estado === "activo"
                        ? <button className="btn danger sm" onClick={() => revoke(c.code)}><Icon name="ban" size={13} />Revocar</button>
                        : <span className="t-id">{c.estado}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <GeneratorCard onGenerate={generate} generated={generated} />
      </div>

      <div className="privacy">
        <Icon name="shield" size={14} />
        Los códigos otorgan acceso de piloto a la plataforma. La consola gestiona cuota y vencimiento — nunca el contenido que la organización ingiere bajo ese piloto.
      </div>
    </div>
  );
}

Object.assign(window, { CodesView });
