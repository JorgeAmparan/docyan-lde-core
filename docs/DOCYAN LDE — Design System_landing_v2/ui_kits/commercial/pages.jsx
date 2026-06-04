/* DOCYAN commercial kit — secondary pages: vertical, how-it-works, security, about, status, support. */

/* ── 6.3.1 · Vertical use-case (template, shown: Laboratorios) ── */
function VerticalPage({ go }) {
  const FLOW = [
    ["scan-line", "El colaborador escanea el QR de la centrífuga", "Llega al CoDo del equipo sin login. Cero fricción en el piso."],
    ["search", "Pregunta en lenguaje natural", "\"¿Cada cuándo se calibra y cuál es el último certificado?\""],
    ["link", "Recibe respuesta con cita", "Valor + vigencia + pedigree cliqueable al certificado fuente."],
  ];
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Caso de uso · Laboratorios</span>
          <h1 className="page-h1">Laboratorios ISO/IEC 17025</h1>
          <p className="sec-lead">Calibraciones vigentes, procedimientos por equipo y trazabilidad de auditoría — consultables en el punto de uso, no enterrados en una carpeta de red.</p>
          <div className="cta" style={{ marginTop: 26 }}>
            <button className="btn primary lg" onClick={() => go("signup")}><Icon name="calendar" size={17} />Agendar demo</button>
            <button className="btn sec lg" onClick={() => go("pricing")}>Ver planes</button>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap two-col">
          <div>
            <span className="eyebrow">El problema</span>
            <h2 className="sec-title">La calibración venció y nadie lo vio a tiempo.</h2>
            <p className="sec-lead">El conocimiento del equipo vive en PDFs dispersos, hojas de cálculo y la cabeza del metrólogo. El auditor llega y empieza la búsqueda.</p>
          </div>
          <div className="prob-list">
            {[["Documentación fragmentada por instrumento", "files"], ["Vigencias de calibración sin alertas", "alarm-clock"], ["Trazabilidad manual ante auditoría 17025", "clipboard-list"]].map(([t, ic]) => (
              <div className="pl-item" key={t}><Icon name={ic} size={18} /><span>{t}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Ejemplo de flujo</span>
          <h2 className="sec-title">Un día en el laboratorio.</h2>
          <div className="flow3">
            {FLOW.map(([ic, h, p], i) => (
              <div className="flow-node" key={i}><div className="fn-n">0{i + 1}</div><div className="fn-ic"><Icon name={ic} size={20} /></div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
          <div className="shot" style={{ marginTop: 32 }}><span className="shot-tag">CAPTURA DE PRODUCTO · CONSULTA EN PISO</span></div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <span className="eyebrow">Marcos aplicables</span>
          <h2 className="sec-title">Cumplimiento que el vertical exige.</h2>
          <div className="norms-big">{["ISO/IEC 17025", "ISO 9001", "NMX-EC-17025", "ema (acreditación)", "ILAC-MRA"].map((n) => <span key={n}>{n}</span>)}</div>
          <div className="disc"><Icon name="info" size={18} /><p>DOCYAN es capa de conocimiento, no sistema de registro primario. Las alertas son administrativas — nunca decisiones de calibración u operativas.</p></div>
        </div>
      </section>
      <Footer go={go} />
    </>
  );
}

/* ── 6.3.2 · Cómo funciona (técnica) ───────────────────────── */
function HowPage({ go }) {
  const ARCH = [
    ["upload-cloud", "Ingesta", "Documentos como están — PDF, DOCX, imágenes con OCR."],
    ["git-fork", "Grafo de conocimiento", "Entidades, spans y relaciones — no solo chunks de texto."],
    ["scan-search", "Consulta clasificada", "8 tipos de intención → render específico por tipo."],
    ["link", "Respuesta con pedigree", "Cada salida cita el span exacto de la fuente."],
  ];
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Cómo funciona</span>
          <h1 className="page-h1">De documento muerto a respuesta citada.</h1>
          <p className="sec-lead">Para CIOs, jefes de TI y arquitectos. El recorrido de un documento desde que entra hasta que responde — sin caja negra.</p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="arch">
            {ARCH.map(([ic, h, p], i) => (
              <React.Fragment key={i}>
                <div className="arch-node"><div className="an-ic"><Icon name={ic} size={22} /></div><h3>{h}</h3><p>{p}</p></div>
                {i < ARCH.length - 1 && <div className="arch-arrow"><Icon name="arrow-right" size={20} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="band paper">
        <div className="wrap two-col">
          <div>
            <span className="eyebrow">Posicionamiento técnico</span>
            <h2 className="sec-title">Por qué un grafo, no solo RAG.</h2>
            <p className="sec-lead">Un grafo de conocimiento preserva la estructura del documento — secciones, entidades y sus relaciones — así la cita apunta al span exacto, no a un fragmento aproximado.</p>
          </div>
          <div className="tech-list">
            {[["Caché semántico con umbral de confianza configurable", "zap"], ["Clasificación de intención antes de responder", "scan-search"], ["Cadena criptográfica SHA-256 para auditoría", "shield-check"], ["Multi-idioma nativo a nivel de consulta", "languages"]].map(([t, ic]) => (
              <div className="pl-item" key={t}><Icon name={ic} size={18} /><span>{t}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="band ink">
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 className="sec-title" style={{ maxWidth: "20ch", margin: "0 auto" }}>¿Lo evaluamos con tus documentos?</h2>
          <div className="cta" style={{ justifyContent: "center", marginTop: 24 }}><button className="btn primary lg" onClick={() => go("signup")}><Icon name="calendar" size={17} />Agendar demo técnica</button></div>
        </div>
      </section>
      <Footer go={go} />
    </>
  );
}

/* ── 6.3.3 · Seguridad y cumplimiento ──────────────────────── */
function SecurityPage({ go }) {
  const SEC = [
    ["layers", "Multi-tenancy absoluto", "Aislamiento total entre organizaciones. Ningún dato cruza tenants."],
    ["database", "RLS por tenant", "Row-Level Security en base de datos — el aislamiento se aplica en la capa de datos, no solo en la app."],
    ["shield-check", "Cadena criptográfica SHA-256", "Cada evento del FAT se encadena con hash. La bitácora de auditoría es verificable e inviolable."],
    ["globe-lock", "GDPR · Privacy Act AU · Aviso MX", "Cumplimiento de privacidad por jurisdicción, con residencia de datos según mercado."],
    ["server", "Opción on-premise (Enterprise)", "Despliegue dedicado en infraestructura del cliente para los requisitos más estrictos."],
    ["bug", "Responsible disclosure", "Canal de divulgación responsable para investigadores de seguridad."],
  ];
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Seguridad y cumplimiento</span>
          <h1 className="page-h1">Hecho para industria regulada, desde el dato.</h1>
          <p className="sec-lead">La trazabilidad no es un extra: es el producto. Así protegemos y auditamos cada consulta.</p>
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <div className="sec-grid">
            {SEC.map(([ic, h, p]) => (
              <div className="sec-item" key={h}><div className="si-ic"><Icon name={ic} size={20} /></div><div><h3>{h}</h3><p>{p}</p></div></div>
            ))}
          </div>
          <div className="chain-card">
            <div className="cc-ic"><Icon name="shield-check" size={22} /></div>
            <div><div className="cc-t">FAT · cadena íntegra</div><div className="cc-m mono">SHA-256 · 8,412 eventos encadenados · última verificación hoy</div></div>
            <span className="cc-ok">✓ Verificada</span>
          </div>
        </div>
      </section>
      <Footer go={go} />
    </>
  );
}

/* ── 6.3.4 · Acerca de XCID ─────────────────────────────────── */
function AboutPage({ go }) {
  return (
    <>
      <section className="band paper">
        <div className="wrap narrow">
          <span className="eyebrow">Acerca de XCID</span>
          <h1 className="page-h1">El motor invisible detrás de DOCYAN.</h1>
          <p className="about-body">XCID SA de CV es una empresa mexicana de ingeniería de producto. Construimos DOCYAN para que el conocimiento documental de la industria regulada deje de estar muerto y disperso — y empiece a responder donde se necesita.</p>
          <p className="about-body">El nombre nace del náhuatl: <i>Yan</i>, "lugar" — <b>el lugar de los documentos</b>. La identidad se apoya en <i>"in tlilli, in tlapalli"</i>, la tinta negra y la tinta roja: la metáfora azteca de la escritura y el códice. Por eso cada cita aparece en rojo cinabrio, como en los códices originales.</p>
          <div className="about-contact">
            <div><span className="ac-l">Contacto comercial</span><a className="ac-v">ventas@xcid.mx</a></div>
            <div><span className="ac-l">Ubicación</span><span className="ac-v">México</span></div>
          </div>
          <div className="cta" style={{ marginTop: 30 }}><button className="btn primary lg" onClick={() => go("signup")}>Hablar con el equipo</button></div>
        </div>
      </section>
      <Footer go={go} />
    </>
  );
}

/* ── 6.3.7 · Status page ───────────────────────────────────── */
function StatusPage({ go }) {
  const COMP = [
    ["API de consulta", "operational"], ["Ingesta de documentos", "operational"], ["Generación de QRs", "operational"],
    ["Dashboard de cuenta", "operational"], ["Pagos (Stripe)", "degraded"], ["Notificaciones por email", "operational"],
  ];
  const INC = [["Hoy", "Latencia elevada en pagos", "Investigando · 14:20", "degraded"], ["28 may", "Mantenimiento programado de ingesta", "Resuelto · 02:00–02:40", "resolved"]];
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Estado del sistema</span>
          <div className="status-hero"><span className="sh-dot" /><h1 className="page-h1" style={{ margin: 0 }}>Operación normal</h1></div>
          <p className="sec-lead">Uptime 90 días · <b className="mono">99.98%</b></p>
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <div className="status-list">
            {COMP.map(([name, st]) => (
              <div className="status-row" key={name}><span className={"st-dot " + st} /><span className="st-name">{name}</span><span className={"st-lab " + st}>{st === "operational" ? "Operativo" : "Degradado"}</span></div>
            ))}
          </div>
          <div className="sec-h-c"><h2 className="sec-title" style={{ fontSize: 22 }}>Incidentes recientes</h2></div>
          {INC.map(([d, t, m, st], i) => (
            <div className="incident" key={i}><span className={"st-dot " + st} /><div><div className="inc-t">{t}</div><div className="inc-m mono">{d} · {m}</div></div></div>
          ))}
        </div>
      </section>
      <Footer go={go} />
    </>
  );
}

/* ── 6.6 · Centro de soporte ───────────────────────────────── */
function SupportPage({ go }) {
  const CATS = [
    ["rocket", "Primeros pasos", "Configura tu cuenta y tu primer CoDo."],
    ["folder-tree", "Crear un CoDo", "Organiza documentos en contexto."],
    ["qr-code", "Generar y pegar QRs", "Imprime y coloca los QRs persistentes."],
    ["users", "Invitar a tu equipo", "Admins y colaboradores."],
  ];
  const ARTS = ["¿Qué es un CoDo y cómo lo estructuro?", "Cómo subir mi primer documento y ver la cotización", "Cómo imprimir un QR persistente para un equipo", "Diferencia entre consulta guardada y Playbook", "Cómo cambiar mi par lingüístico por defecto"];
  return (
    <>
      <section className="band paper">
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">Centro de ayuda</span>
          <h1 className="page-h1" style={{ marginBottom: 22 }}>¿En qué te ayudamos?</h1>
          <div className="help-search"><Icon name="search" size={18} /><input placeholder="Busca en la documentación…" /></div>
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <div className="help-cats">
            {CATS.map(([ic, h, p]) => (
              <div className="help-card" key={h}><div className="hc-ic"><Icon name={ic} size={20} /></div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
          <div className="two-col" style={{ marginTop: 40, alignItems: "start" }}>
            <div>
              <h2 className="sec-title" style={{ fontSize: 22 }}>Artículos populares</h2>
              <div className="art-list">{ARTS.map((a) => <a className="art" key={a}><Icon name="file-text" size={15} />{a}<Icon name="chevron-right" size={15} /></a>)}</div>
            </div>
            <div className="contact-card">
              <h3>¿No encuentras lo que buscas?</h3>
              <p>Escríbenos y te respondemos. Los planes con soporte prioritario incluyen chat y tickets.</p>
              <div className="field"><label>Correo</label><input placeholder="tu@empresa.com" /></div>
              <div className="field"><label>¿Cómo te ayudamos?</label><input placeholder="Describe tu consulta…" /></div>
              <button className="btn primary" style={{ width: "100%" }}>Enviar consulta</button>
            </div>
          </div>
        </div>
      </section>
      <Footer go={go} />
    </>
  );
}

Object.assign(window, { VerticalPage, HowPage, SecurityPage, AboutPage, StatusPage, SupportPage });
