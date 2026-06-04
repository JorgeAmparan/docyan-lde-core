/* DOCYAN commercial kit — public landing page. */

function Nav({ go }) {
  return (
    <nav className="nav">
      <div className="brand"><Mark size={26} />DOCYAN<span className="lde">LDE</span></div>
      <div className="links">
        <a onClick={() => go("landing")}>Producto</a>
        <a onClick={() => go("how")}>Cómo funciona</a>
        <a onClick={() => go("pricing")}>Precios</a>
        <a onClick={() => go("vertical")}>Casos de uso</a>
        <a onClick={() => go("security")}>Seguridad</a>
      </div>
      <div className="right">
        <span className="region"><Icon name="globe" size={13} />MX · ES</span>
        <button className="btn ghost" onClick={() => go("account")}>Ingresar</button>
        <button className="btn primary" onClick={() => go("signup")}>Agendar demo</button>
      </div>
    </nav>
  );
}

function Hero({ go }) {
  return (
    <div className="wrap">
      <div className="hero">
        <div>
          <span className="eyebrow">Live Document Environment</span>
          <h1>Tus documentos, vivos donde se necesitan.</h1>
          <p className="sub">Escanea el QR del equipo, pregunta y obtén respuesta con cita a la fuente exacta. Sin buscar, sin reescribir tus manuales.</p>
          <div className="cta">
            <button className="btn primary lg" onClick={() => go("signup")}><Icon name="calendar" size={17} />Agendar demo de 30 min</button>
            <button className="btn sec lg" onClick={() => go("pricing")}>Ver planes</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mock">
            <div className="mctx"><Mark size={22} /><div><div className="ml">Estás consultando</div><div className="mn">CODO-LAB-04 · Centrífuga Hettich</div></div></div>
            <div style={{ textAlign: "right" }}><span className="mq">¿Torque del perno B?</span></div>
            <div className="macard">
              <div className="mqlab">Torque del perno B</div>
              <div className="mbig">85<span className="u"> N·m</span></div>
              <span className="cite"><span className="brk" />Manual VF-2 · §4.2.1 ↗</span>
            </div>
          </div>
          <div className="hero-tag" style={{ top: -14, left: -16 }}><Icon name="scan-line" size={15} />QR persistente</div>
          <div className="hero-tag" style={{ bottom: 22, right: -18 }}><Icon name="link" size={15} />Cita cliqueable</div>
        </div>
      </div>
    </div>
  );
}

const PROBLEMS = [
  ["files", "Documentos muertos y dispersos", "Manuales, MSDS y procedimientos repartidos en carpetas que nadie abre en el piso."],
  ["user-minus", "Conocimiento que se va con la gente", "Cuando el experto se jubila, su forma de resolver se va con él."],
  ["clock", "Tiempo perdido buscando", "Cada consulta empieza de cero: buscar, hojear, interpretar."],
  ["shield-alert", "Cumplimiento frágil", "La trazabilidad regulatoria depende de procesos manuales que fallan."],
];

function Problem() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">El problema</span>
        <h2 className="sec-title">El conocimiento existe. No está donde se necesita.</h2>
        <div className="diffs" style={{ marginTop: 32 }}>
          {PROBLEMS.map(([ic, h, p]) => (
            <div className="diff" key={h}><span className="di"><Icon name={ic} size={20} /></span><div><h3>{h}</h3><p>{p}</p></div></div>
          ))}
        </div>
        <div className="prob-trust">
          <Icon name="shield-alert" size={20} />
          <div>
            <h3>El problema no es solo dónde está el conocimiento. Es si puedes confiar en lo que te responde un sistema.</h3>
            <p>Los chatbots genéricos alucinan: inventan cifras, fabrican normas que no existen y no pueden mostrarte la fuente exacta. En una industria regulada, eso no es una limitación tolerable.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  ["upload", "Ingieres tus documentos como están", "Sin reescribir nada. DOCYAN los lee tal cual: PDFs, manuales, fichas, MSDS."],
  ["qr-code", "Pegas QRs en equipos, lugares y procesos", "Cada QR es la puerta a un CoDo — un contexto documental coherente."],
  ["scan-line", "Cualquiera escanea y consulta", "Pregunta en lenguaje natural; recibe respuesta con cita a la fuente exacta."],
];

function HowItWorks() {
  return (
    <section className="band">
      <div className="wrap">
        <span className="eyebrow">Cómo funciona</span>
        <h2 className="sec-title">Tres pasos. Días, no meses.</h2>
        <div className="steps3">
          {STEPS.map(([ic, h, p], i) => (
            <div className="step3" key={h}><div className="n">0{i + 1}</div><div className="si"><Icon name={ic} size={22} /></div><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}

const LEVELS = [
  ["Nivel 1", "Consulta viva", "Documento consultable en tiempo real, en el punto de uso, con cita cliqueable a la fuente.", "Escanea → pregunta → respuesta con cita."],
  ["Nivel 2", "Conocimiento capturado", "El usuario captura cómo consulta — qué pregunta y en qué orden — como objeto reutilizable.", "Una rutina de arranque se vuelve un Playbook."],
  ["Nivel 3", "Inteligencia organizacional", "Las consultas y anotaciones retienen el conocimiento tácito cuando la gente se va.", "DOCYAN detecta patrones de uso del equipo."],
];

function ThreeLevels() {
  return (
    <section className="band ink">
      <div className="wrap">
        <span className="eyebrow">Tres niveles</span>
        <h2 className="sec-title">De la consulta de hoy al foso de mañana.</h2>
        <div className="levels">
          {LEVELS.map(([lv, h, p, ex]) => (
            <div className="level" key={lv}><div className="lv">{lv}</div><h3>{h}</h3><p>{p}</p><div className="ex"><b>Ej. </b>{ex}</div></div>
          ))}
        </div>
      </div>
    </section>
  );
}

const VERTS = [
  ["flask-conical", "Laboratorios ISO 17025", "Calibraciones, vigencias y procedimientos por equipo.", ["ISO 17025"]],
  ["factory", "Maquiladoras IMMEX", "Manuales por línea, MSDS y procedimientos de seguridad.", ["NOM-018-STPS", "IATF 16949"]],
  ["pill", "Farmacéutica", "Documentación auditada con cadena criptográfica.", ["FDA", "TGA", "COFEPRIS"]],
  ["sprout", "Agroexportación", "Documentación viva por mercado destino.", ["EU Organic"]],
  ["mountain", "Minería", "Safety & compliance en el piso de mina.", ["AS/NZS"]],
  ["plane", "Aeroespacial", "Procedimientos críticos trazables.", ["AS9100"]],
];

function Verticals() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Casos de uso</span>
        <h2 className="sec-title">Hecho para industrias reguladas.</h2>
        <div className="verts">
          {VERTS.map(([ic, h, p, norms]) => (
            <div className="vert" key={h}>
              <div className="vi"><Icon name={ic} size={20} /></div><h3>{h}</h3><p>{p}</p>
              <div className="norms">{norms.map((n) => <span className="norm" key={n}>{n}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const DIFFS = [
  ["timer", "Días, no meses", "Time-to-value medido en días — frente a los meses de una implementación tradicional."],
  ["file-check", "Ingiere como está", "No reescribimos tus documentos en otro sistema. Entran tal cual."],
  ["link", "Pedigree cliqueable", "Cada respuesta lleva cita al span exacto del documento fuente."],
  ["brain", "Conocimiento retenido", "El saber tácito se queda en tu organización."],
  ["languages", "Multi-idioma nativo", "Consulta en español o inglés; expandible por mercado."],
  ["badge-dollar-sign", "Precio transparente", "Planes públicos con cifras. Sin cotización opaca."],
];

function Differentiators() {
  return (
    <section className="band">
      <div className="wrap">
        <span className="eyebrow">Por qué DOCYAN</span>
        <h2 className="sec-title">Lo que la categoría no te da.</h2>
        <div className="diffs">
          {DIFFS.map(([ic, h, p]) => (
            <div className="diff" key={h}><span className="di"><Icon name={ic} size={20} /></span><div><h3>{h}</h3><p>{p}</p></div></div>
          ))}
        </div>
      </div>
    </section>
  );
}

const NORMS = ["NOM-018-STPS", "NOM-026-STPS", "IATF 16949", "AS9100", "ISO 17025", "FDA 21 CFR", "EU Organic", "TGA", "GMP", "AS/NZS"];

function Regulatory() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Cumplimiento</span>
        <h2 className="sec-title">Marcos que DOCYAN soporta.</h2>
        <p className="sec-lead reg-lead">Los marcos regulatorios no se satisfacen con buenas intenciones. DOCYAN entrega lo que el auditor pide: cita cliqueable a fuente, trazabilidad criptográfica de cada respuesta servida, y bloqueo activo de cualquier output que no pueda sustentar. No son aspiración; son lo que el sistema ya respeta por diseño.</p>
        <div className="norms-big">{NORMS.map((n) => <span key={n}>{n}</span>)}</div>
        <div className="disc">
          <Icon name="info" size={18} />
          <p>DOCYAN es una capa de conocimiento, no un sistema de registro primario. Las alertas son administrativas — nunca decisiones clínicas u operativas.</p>
        </div>
      </div>
    </section>
  );
}

function Footer({ go }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <div className="brand"><Mark size={24} tone="light" />DOCYAN</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, maxWidth: "34ch", marginTop: 14 }}>Live Document Environment. Un producto de XCID SA de CV, México.</p>
          </div>
          <div><h4>Producto</h4><a onClick={() => go("pricing")}>Precios</a><a onClick={() => go("how")}>Cómo funciona</a><a onClick={() => go("security")}>Seguridad</a><a onClick={() => go("vertical")}>Casos de uso</a></div>
          <div><h4>Empresa</h4><a onClick={() => go("about")}>Acerca de XCID</a><a onClick={() => go("support")}>Contacto</a><a>Privacidad</a><a>Términos</a></div>
          <div><h4>Soporte</h4><a onClick={() => go("support")}>Centro de ayuda</a><a onClick={() => go("support")}>Documentación</a><a onClick={() => go("status")}>Estado del sistema</a></div>
        </div>
        <div className="fbottom">
          <span>© 2026 XCID SA de CV</span>
          <div className="sp">
            <span className="region" style={{ color: "var(--amate-300)", borderColor: "rgba(244,238,227,.2)" }}><Icon name="globe" size={13} />México · Español</span>
            <span className="status"><span className="d" />Todos los sistemas operativos</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Landing({ go }) {
  return (
    <>
      <Hero go={go} />
      <Problem />
      <HowItWorks />
      <ThreeLevels />
      <Verticals />
      <Differentiators />
      <Regulatory />
      <Footer go={go} />
    </>
  );
}

Object.assign(window, { Nav, Landing, Footer, Problem, HowItWorks, Verticals, Differentiators, Regulatory });
