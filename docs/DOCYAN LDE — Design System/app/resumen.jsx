/* DOCYAN — Resumen (home admin) */

const STATS = [
  ["folder", "CoDos activos", "3", "22 documentos vivos"],
  ["zap", "Hit-rate caché", "86%", "▲ 4% vs. mes pasado", "up"],
  ["coins", "Costo / consulta", "$0.011", "promedio 30 días"],
  ["timer", "Latencia P95", "1.4s", "P50 · 0.3s"],
];
const PATTERNS = [
  ["repeat", "3 colaboradores repiten la misma secuencia de arranque en la MAXI-10ND", "Sugerencia de Playbook · últimos 14 días"],
  ["message-square", "Las consultas de calibración suben antes de cada auditoría", "Patrón estacional · CODO-LAB-04"],
  ["file-warning", "2 personas anotaron holgura en el mismo acople", "Observación recurrente · 30 días"],
];

function ResumenView({ go, openCodo }) {
  const [verified, setVerified] = useState(false);
  return <div className="wrap">
    <div className="stats">
      {STATS.map((s, i) => <div className="stat" key={i}>
        <div className="sl"><Icon name={s[0]} size={12} />{s[1]}</div>
        <div className="sv">{s[2]}</div>
        <div className="sd">{s[4] === "up" ? <span className="up">{s[3].split(" ")[0]} </span> : null}{s[4] === "up" ? s[3].split(" ").slice(1).join(" ") : s[3]}</div>
      </div>)}
    </div>

    <div className="sec-h"><h2>CoDos</h2><span className="more" onClick={() => go("codos")}>Ver todos →</span></div>
    <div className="codo-grid" style={{ marginBottom: 22 }}>
      {CODOS.slice(0, 2).map(c => <div key={c.key} className="codo-card" onClick={() => openCodo(c)}>
        <div className="ch"><span className="ci"><Icon name={c.icon} size={21} /></span>
          <div style={{ minWidth: 0 }}><div className="cid">{c.id}</div><div className="cn">{c.name}</div></div>
          {c.alert ? <span className="badge warn"><Icon name="alarm-clock" size={12} />2 alertas</span> : <span className="badge ok"><Icon name="check" size={12} />Al día</span>}</div>
        <div className="crow">
          <div className="cstat"><div className="cv">{c.docs}</div><div className="cl">docs vivos</div></div>
          <div className="cstat"><div className="cv">{c.consultas}</div><div className="cl">consultas / 30d</div></div>
          <div className="cstat"><div className="cv">{c.colab}</div><div className="cl">colaboradores</div></div>
        </div>
      </div>)}
    </div>

    <div className="two">
      <div className="panel">
        <div className="sec-h"><h2>Patrones detectados</h2></div>
        {PATTERNS.map((p, i) => <div className="pattern" key={i}>
          <div className="pic"><Icon name={p[0]} size={16} /></div>
          <div><div className="pt">{p[1]}</div><div className="pm">{p[2]}</div></div>
        </div>)}
      </div>
      <div className="panel">
        <div className="sec-h"><h2>Cupo de ingestas</h2><span className="more" onClick={() => go("ingesta")}>Ir a ingesta →</span></div>
        <div className="bal-row"><span className="bv">{CUPO_DEMO.restante}</span><span style={{ fontSize: 13, color: "var(--fg-muted)" }}>de {CUPO_DEMO.recurrente} incluidas este mes</span></div>
        <div className="bar"><i style={{ width: (100 * (CUPO_DEMO.recurrente - CUPO_DEMO.restante) / CUPO_DEMO.recurrente) + "%" }} /></div>
        <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 7 }}>Plan Profesional · adicionales desde ${SETUP.pisoUsd}, cotizados antes de cobrar</div>
        <div className="chain">
          <div className="ci2"><Icon name="shield-check" size={18} /></div>
          <div><div className="ct">Cadena criptográfica</div><div className="cm">{verified ? "SHA-256 · íntegra · 8,412 eventos" : "FAT · SHA-256"}</div></div>
          <button onClick={() => setVerified(true)}>{verified ? "✓ Verificada" : "Verificar"}</button>
        </div>
      </div>
    </div>
  </div>;
}

Object.assign(window, { ResumenView });
