/* DOCYAN sitio público v2 — VERTICALES.
   Hub con paraguas transversal (la firma del trabajo que une sectores)
   + grid de 7 + páginas de detalle: Laboratorios (modelo), Maquila, Flotillas. */

const VERTS = [
  { key: "lab", ic: "flask-conical", built: true, norm: "ISO 17025",
    name: { es: "Laboratorios de pruebas", en: "Testing laboratories" },
    desc: { es: "Métodos, calibraciones y certificados consultables al instante — antes de que venzan.", en: "Methods, calibrations and certificates consultable instantly — before they expire." } },
  { key: "maq", ic: "factory", built: true, norm: "IATF · ISO 9001",
    name: { es: "Maquila y manufactura", en: "Maquila & manufacturing" },
    desc: { es: "Parámetros de máquina y procedimientos en el piso, sin detener la línea para buscar.", en: "Machine parameters and procedures on the floor, without stopping the line to search." } },
  { key: "flot", ic: "truck", built: true, norm: "ASME B31.8 · NOM",
    name: { es: "Flotillas de técnicos", en: "Field technician fleets" },
    desc: { es: "El procedimiento completo en el celular del técnico, a 200 km de la oficina.", en: "The full procedure on the tech's phone, 200 km from the office." } },
  { key: "marina", ic: "anchor", built: false, norm: "API · OSHA",
    name: { es: "Plataforma marina y petrolera", en: "Offshore & oil platforms" },
    desc: { es: "Donde no hay segunda oportunidad: el dato crítico citado, sin depender de la conexión.", en: "Where there is no second chance: the critical datum cited, without depending on connectivity." } },
  { key: "mina", ic: "mountain", built: false, norm: "NOM-023",
    name: { es: "Minería", en: "Mining" },
    desc: { es: "La cuadrilla deja de esperar a «quien sabe»: pregunta y sigue trabajando.", en: "The crew stops waiting for “the one who knows”: ask and keep working." } },
  { key: "vial", ic: "traffic-cone", built: false, norm: "SCT · AASHTO",
    name: { es: "Construcción vial", en: "Road construction" },
    desc: { es: "Especificaciones y bitácoras del frente de obra, consultables desde el frente de obra.", en: "Specs and logs from the work front, consultable at the work front." } },
  { key: "agro", ic: "wheat", built: false, norm: "SENASICA · FDA",
    name: { es: "Agroindustria", en: "Agroindustry" },
    desc: { es: "Fichas y protocolos del piso de producción a media cosecha, sin volver a la oficina.", en: "Datasheets and protocols on the production floor mid-harvest, without going back to the office." } },
];

function VertGrid({ go, limit }) {
  const t = useT();
  const list = limit ? VERTS.slice(0, limit) : VERTS;
  return (
    <div className="verts2">
      {list.map((v) => (
        <button className="vert2" key={v.key} onClick={() => go(v.built ? "vert:" + v.key : "verticales")}>
          <span className="vi"><Icon name={v.ic} size={20} /></span>
          <h3>{t(v.name)}</h3>
          <p>{t(v.desc)}</p>
          <span className="vfoot">
            <span className="norm">{v.norm}</span>
            {v.built && <span className="varrow"><Icon name="arrow-right" size={15} /></span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---- paraguas transversal ---- */
function Umbrella() {
  const t = useT();
  return (
    <div className="umb">
      {[
        { ic: "file-check", h: { es: "Trabajo regido por documentos", en: "Work governed by documents" }, p: { es: "Manuales, normas, métodos: el documento manda.", en: "Manuals, standards, methods: the document rules." } },
        { ic: "alert-triangle", h: { es: "El error cuesta", en: "Errors cost" }, p: { es: "Paro de línea, hallazgo, incidente. Equivocarse no es gratis.", en: "Downtime, findings, incidents. Mistakes aren't free." } },
        { ic: "map-pin", h: { es: "Punto de uso lejos de la oficina", en: "Point of use far from the office" }, p: { es: "El dato se necesita frente al equipo, no en el escritorio.", en: "The data is needed at the machine, not at the desk." } },
        { ic: "wifi-off", h: { es: "Conectividad no garantizada", en: "Connectivity not guaranteed" }, p: { es: "Campo, plataforma, mina: una barra de señal es normal.", en: "Field, platform, mine: one bar of signal is normal." } },
        { ic: "user-minus", h: { es: "Fuga de conocimiento tácito", en: "Tacit knowledge leak" }, p: { es: "Cuando el experto se va, su saber se va con él.", en: "When the expert leaves, the knowledge goes too." } },
      ].map((u, i) => (
        <div className="umb-item" key={i}>
          <Icon name={u.ic} size={20} />
          <h3>{t(u.h)}</h3>
          <p>{t(u.p)}</p>
        </div>
      ))}
    </div>
  );
}

function VerticalesHub({ go }) {
  const t = useT();
  return (
    <main data-screen-label="Verticales — Hub">
      <header className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "Sectores", en: "Industries" })}</span>
          <h1>{t({ es: "Siete escenas, una misma firma de trabajo", en: "Seven scenes, one signature of work" })}</h1>
          <p className="sec-lead">{t({
            es: "DOCYAN no es «para un sector»: es para un tipo de trabajo. Si tu operación comparte esta firma, te vas a reconocer en alguna de las escenas.",
            en: "DOCYAN isn't “for an industry”: it's for a kind of work. If your operation shares this signature, you'll recognize yourself in one of the scenes.",
          })}</p>
        </div>
      </header>
      <section className="band" data-screen-label="Verticales — Paraguas">
        <div className="wrap">
          <Umbrella />
        </div>
      </section>
      <section className="band paper" data-screen-label="Verticales — Grid">
        <div className="wrap">
          <h2 className="sec-title" style={{ marginTop: 0 }}>{t({ es: "Elige tu escena", en: "Pick your scene" })}</h2>
          <VertGrid go={go} />
        </div>
      </section>
      <section className="band" data-screen-label="Verticales — CTA">
        <div className="wrap"><Doors compact /></div>
      </section>
    </main>
  );
}

/* ---- detalle por vertical ---- */
const VDETAIL = {
  lab: {
    eyebrow: { es: "Laboratorios de pruebas · ISO 17025", en: "Testing laboratories · ISO 17025" },
    h1: { es: "«La calibración venció y nadie lo vio a tiempo.»", en: "“The calibration expired and nobody caught it in time.”" },
    pain: { es: "El hallazgo era evitable: la fecha estaba en el certificado, el certificado estaba en una carpeta, y la carpeta estaba a tres clics que nadie dio. En un laboratorio acreditado, ese descuido se llama no conformidad.", en: "The finding was avoidable: the date was on the certificate, the certificate was in a folder, and the folder was three clicks nobody made. In an accredited lab, that oversight is called a nonconformity." },
    meta: ["ISO/IEC 17025", "EMA · ILAC", { es: "Auditorías de acreditación", en: "Accreditation audits" }],
    tag: { es: "foto: mesa de laboratorio / equipo de medición", en: "photo: lab bench / measuring equipment" },
    flow: [
      { ic: "file-up", h: { es: "Métodos y certificados, vivos", en: "Methods and certificates, alive" }, p: { es: "Métodos de prueba, certificados de calibración, manuales de equipo: entran una vez y quedan consultables, con su hash.", en: "Test methods, calibration certificates, equipment manuals: ingested once, consultable forever, with their hash." } },
      { ic: "bell", h: { es: "La vigencia te encuentra a ti", en: "Validity finds you" }, p: { es: "Alertas administrativas de vencimiento de calibraciones y revisiones de método — antes de la auditoría, no durante.", en: "Administrative alerts for calibration expiry and method reviews — before the audit, not during." } },
      { ic: "quote", h: { es: "El auditor pregunta; tú citas", en: "The auditor asks; you cite" }, p: { es: "«¿Con qué método se corrió esta muestra?» — respuesta con cita al span del método vigente, en segundos.", en: "“Which method ran this sample?” — answer with a citation to the current method's span, in seconds." } },
    ],
    note: { es: "DOCYAN es capa de conocimiento, no tu sistema de registro primario: tus resultados viven en tu LIMS; aquí vive el saber que los rodea.", en: "DOCYAN is a knowledge layer, not your primary system of record: your results live in your LIMS; the knowledge around them lives here." },
  },
  maq: {
    eyebrow: { es: "Maquila y manufactura", en: "Maquila & manufacturing" },
    h1: { es: "«La línea parada, y el parámetro en cuál de los tres manuales.»", en: "“Line down, and the parameter in which of the three manuals.”" },
    pain: { es: "Termoformado, ensamble, inyección: el dato del proceso existe — en el manual del fabricante, en la hoja de proceso, en el instructivo que alguien actualizó. Mientras lo encuentras, la línea factura tiempo muerto.", en: "Thermoforming, assembly, injection: the process datum exists — in the OEM manual, the process sheet, the work instruction someone updated. While you find it, the line bills downtime." },
    meta: ["IATF 16949", "ISO 9001", { es: "Auditorías de cliente", en: "Customer audits" }],
    tag: { es: "foto: piso de termoformado / línea de ensamble", en: "photo: thermoforming floor / assembly line" },
    flow: [
      { ic: "file-up", h: { es: "Manuales OEM y hojas de proceso", en: "OEM manuals and process sheets" }, p: { es: "El manual de 120 páginas que vino con la máquina — en el idioma en que vino — se vuelve consultable desde el piso.", en: "The 120-page manual that came with the machine — in whatever language it came — becomes consultable from the floor." } },
      { ic: "message-circle-question", h: { es: "El operador pregunta en su idioma", en: "The operator asks in their language" }, p: { es: "«¿Temperatura de molde para PP de 2 mm?» — respuesta de un vistazo, con la cita al manual original a un toque.", en: "“Mold temperature for 2 mm PP?” — at-a-glance answer, citation to the original manual one tap away." } },
      { ic: "activity", h: { es: "El patrón queda para la planta", en: "The pattern stays with the plant" }, p: { es: "Qué máquina genera más consultas, qué turno pregunta qué: frecuencia visible, sin juicios. DOCYAN cuenta, no concluye.", en: "Which machine drives the most queries, which shift asks what: frequency made visible, no judgments. DOCYAN counts, it doesn't conclude." } },
    ],
    note: { es: "Las respuestas son capa de conocimiento para decidir mejor; los registros de producción siguen en tus sistemas de registro.", en: "Answers are a knowledge layer for better decisions; production records stay in your systems of record." },
  },
  flot: {
    eyebrow: { es: "Flotillas de técnicos · gasoductos / telecom", en: "Field technician fleets · pipelines / telecom" },
    h1: { es: "«El técnico a 200 km, y el procedimiento en el servidor de la oficina.»", en: "“The tech 200 km out, and the procedure on the office server.”" },
    pain: { es: "Una barra de señal, un cliente esperando y un procedimiento que vive en la intranet. La visita que se repite por falta de un dato es la más cara de todas.", en: "One bar of signal, a waiting client and a procedure that lives on the intranet. The site visit repeated for lack of one datum is the most expensive of all." },
    meta: ["ASME B31.8", "NOM-007-ASEA", { es: "Bitácoras de campo", en: "Field logs" }],
    tag: { es: "foto: técnico en derecho de vía / torre", en: "photo: technician at right-of-way / tower" },
    flow: [
      { ic: "smartphone", h: { es: "El procedimiento, en el celular", en: "The procedure, on the phone" }, p: { es: "Cada técnico lleva los documentos vivos de su flotilla en el bolsillo, presentados para leerse con guantes y sol.", en: "Every tech carries the fleet's live documents in their pocket, presented to be read with gloves on and sun overhead." } },
      { ic: "wifi-off", h: { es: "Pensado para una barra de señal", en: "Built for one bar of signal" }, p: { es: "Las respuestas viajan ligeras: texto renderizado, no PDFs de 40 MB. El dato llega aunque la red apenas llegue.", en: "Answers travel light: rendered text, not 40 MB PDFs. The datum arrives even when the network barely does." } },
      { ic: "quote", h: { es: "Cita para la bitácora", en: "A citation for the log" }, p: { es: "Cada decisión de campo queda respaldada: respuesta, fuente y hash. Si después alguien pregunta «¿por qué?», está la cita.", en: "Every field decision is backed: answer, source and hash. If someone later asks “why?”, the citation is there." } },
    ],
    note: { es: "Alertas y respuestas son capa administrativa; la operación del ducto o la red sigue en tus sistemas de control.", en: "Alerts and answers are an administrative layer; pipeline and network operations stay in your control systems." },
  },
};

function VerticalPage({ vkey, go }) {
  const t = useT();
  const d = VDETAIL[vkey];
  if (!d) return <VerticalesHub go={go} />;
  const others = VERTS.filter((v) => v.built && v.key !== vkey);
  const codoKey = { lab: "lab", maq: "maq" }[vkey] || null;
  return (
    <main data-screen-label={"Vertical — " + vkey}>
      <header className="vpage-hero">
        <div className="wrap">
          <span className="eyebrow">{t(d.eyebrow)}</span>
          <h1>{t(d.h1)}</h1>
          <p className="vpain">{t(d.pain)}</p>
          <div className="vmeta">
            {d.meta.map((m, i) => <span key={i}>{typeof m === "string" ? m : t(m)}</span>)}
          </div>
        </div>
      </header>
      <section className="band" style={{ paddingTop: 24 }} data-screen-label={"Vertical " + vkey + " — Escena"}>
        <div className="wrap">
          <div className="ph" style={{ aspectRatio: "21/8" }}><span className="ph-tag">{t(d.tag)}</span></div>
          <div className="flow32">
            {d.flow.map((f, i) => (
              <div className="fnode2" key={i}>
                <span className="fn">{"0" + (i + 1)}</span>
                <span className="fi"><Icon name={f.ic} size={20} /></span>
                <h3>{t(f.h)}</h3>
                <p>{t(f.p)}</p>
              </div>
            ))}
          </div>
          <div className="unsafe" style={{ marginTop: 28 }}>
            <Icon name="scale" size={20} />
            <div>
              <h3>{t({ es: "La línea que no se cruza", en: "The line that isn't crossed" })}</h3>
              <p>{t(d.note)}</p>
            </div>
          </div>
          <div className="vlinks" style={{ marginTop: 26 }}>
            <a className="vlink on" onClick={() => go(codoKey ? "demos:" + codoKey : "demos")}><Icon name="play" size={14} />{t({ es: "Pruébalo sin registro — CoDo de este sector", en: "Try it without signup — this industry's CoDo" })}</a>
          </div>
          <div className="vlinks">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", alignSelf: "center" }}>{t({ es: "Otras escenas:", en: "Other scenes:" })}</span>
            {others.map((v) => (
              <a className="vlink" key={v.key} onClick={() => go("vert:" + v.key)}><Icon name={v.ic} size={14} />{t(v.name)}</a>
            ))}
            <a className="vlink" onClick={() => go("verticales")}><Icon name="layout-grid" size={14} />{t({ es: "Todas", en: "All" })}</a>
          </div>
        </div>
      </section>
      <section className="band paper" data-screen-label={"Vertical " + vkey + " — CTA"}>
        <div className="wrap">
          <div className="cta-band">
            <h2 className="sec-title">{t({ es: "Pruébalo con tus propios documentos", en: "Try it with your own documents" })}</h2>
          </div>
          <Doors compact />
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { VerticalesHub, VerticalPage, VertGrid, VERTS });
