/* DOCYAN sitio público v2 — HOME.
   Arco completo en miniatura: gancho (3 variantes de hero + demo vivo)
   → el momento → anaquel→FLOW → 3 pasos → foso → confianza → sectores → dos puertas. */

function HeroA() {
  const t = useT();
  const linkOut = useLinkOut();
  return (
    <header className="hero2">
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">DOCYAN LDE · Live Document Environment</span>
            <h1>{t({ es: "El dato está en tus documentos. Ahora también está a una pregunta.", en: "The answer is in your documents. Now it's also one question away." })}</h1>
            <p className="sub">{t({
              es: "Tus manuales, fichas y procedimientos, consultables al instante frente al equipo — con la respuesta lista para leerse de un vistazo y la cita al documento original.",
              en: "Your manuals, datasheets and procedures, instantly consultable at the machine — with the answer readable at a glance and a citation to the original document.",
            })}</p>
            <div className="cta">
              <button className="btn primary lg" onClick={() => linkOut("/signup")}>{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}<Icon name="arrow-right" size={16} /></button>
              <button className="btn sec lg" onClick={() => linkOut("/codigo")}>{t({ es: "Agendar demo", en: "Book a demo" })}</button>
            </div>
            <p className="cta-note">{t({ es: "Sin tarjeta · 30 días · todas las capacidades", en: "No card · 30 days · all capabilities" })}</p>
            <div className="hero-trust">
              <span><Icon name="quote" size={14} />{t({ es: "Cita trazable a la fuente", en: "Citation traceable to source" })}</span>
              <span><Icon name="shield-check" size={14} />{t({ es: "Sin alucinaciones", en: "No hallucinations" })}</span>
              <span><Icon name="hash" size={14} />SHA-256</span>
            </div>
          </div>
          <LiveDemo />
        </div>
      </div>
    </header>
  );
}

function HeroB() {
  const t = useT();
  const linkOut = useLinkOut();
  return (
    <header className="hero2 heroB">
      <div className="wrap">
        <p className="bq">{t({ es: "«¿Cuál es el torque de apriete?» — y el manual tiene 80 páginas.", en: "“What's the torque spec?” — and the manual is 80 pages long." })}</p>
        <h1>{t({ es: "Deja de buscar dónde está. Pregunta qué necesitas.", en: "Stop searching for where it is. Ask for what you need." })}</h1>
        <p className="sub">{t({
          es: "DOCYAN convierte tus documentos en respuestas al instante, con la cita al original. Frente al equipo, en tu idioma.",
          en: "DOCYAN turns your documents into instant answers, citing the original. At the machine, in your language.",
        })}</p>
        <div className="cta">
          <button className="btn primary lg" onClick={() => linkOut("/signup")}>{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}<Icon name="arrow-right" size={16} /></button>
          <button className="btn sec lg" onClick={() => linkOut("/codigo")}>{t({ es: "Agendar demo", en: "Book a demo" })}</button>
        </div>
        <p className="cta-note">{t({ es: "Sin tarjeta · 30 días · todas las capacidades", en: "No card · 30 days · all capabilities" })}</p>
        <div className="heroB-demo"><LiveDemo /></div>
      </div>
    </header>
  );
}

function HeroC() {
  const t = useT();
  const linkOut = useLinkOut();
  return (
    <header className="heroC">
      <div className="wrap">
        <div className="heroC-grid">
          <div>
            <span className="eyebrow">DOCYAN LDE · Live Document Environment</span>
            <h1 style={{ fontSize: "clamp(34px,6vw,52px)", fontWeight: 700, letterSpacing: "-.025em", lineHeight: 1.06, margin: "14px 0 0", textWrap: "pretty" }}>
              {t({ es: "Estás frente al equipo. El reloj corre. El dato existe.", en: "You're at the machine. The clock is running. The answer exists." })}
            </h1>
            <p className="sub">{t({
              es: "Hoy lo buscas en carpetas y manuales de 80 páginas, pellizcando la pantalla. Con DOCYAN lo preguntas — y llega con su cita al documento original.",
              en: "Today you dig through folders and 80-page manuals, pinching the screen. With DOCYAN you ask — and it arrives with a citation to the original document.",
            })}</p>
            <div className="cta">
              <button className="btn primary lg" onClick={() => linkOut("/signup")}>{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}<Icon name="arrow-right" size={16} /></button>
              <button className="btn onink lg" onClick={() => linkOut("/codigo")}>{t({ es: "Agendar demo", en: "Book a demo" })}</button>
            </div>
            <p className="cta-note" style={{ color: "var(--stone-400)" }}>{t({ es: "Sin tarjeta · 30 días · todas las capacidades", en: "No card · 30 days · all capabilities" })}</p>
          </div>
          <div style={{ paddingBottom: 48 }}><LiveDemo /></div>
        </div>
      </div>
    </header>
  );
}

/* ---- Capa 1: el momento ---- */
const SCENES_HOME = [
  {
    sector: { es: "Maquila · termoformado", en: "Maquila · thermoforming" },
    quote: { es: "«La línea parada y el parámetro de temperatura está… ¿en cuál de los tres manuales?»", en: "“Line down, and the temperature parameter is… in which of the three manuals?”" },
    cost: { es: "Cada minuto de paro se factura solo.", en: "Every minute of downtime bills itself." },
    tag: { es: "foto: piso de termoformado", en: "photo: thermoforming floor" },
  },
  {
    sector: { es: "Flotillas · gasoductos / telecom", en: "Fleets · pipelines / telecom" },
    quote: { es: "«El técnico está a 200 km, con una barra de señal, y el procedimiento vive en el servidor de la oficina.»", en: "“The tech is 200 km out, one bar of signal, and the procedure lives on the office server.”" },
    cost: { es: "La visita se repite. El cliente espera.", en: "The visit gets repeated. The client waits." },
    tag: { es: "foto: técnico en campo", en: "photo: field technician" },
  },
  {
    sector: { es: "Laboratorio · ISO 17025", en: "Laboratory · ISO 17025" },
    quote: { es: "«La calibración venció y nadie lo vio a tiempo.»", en: "“The calibration expired and nobody caught it in time.”" },
    cost: { es: "Un hallazgo en auditoría que era evitable.", en: "An audit finding that was avoidable." },
    tag: { es: "foto: mesa de laboratorio", en: "photo: laboratory bench" },
  },
];

function MomentSection() {
  const t = useT();
  return (
    <section className="band" data-screen-label="Home — El momento">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "El momento", en: "The moment" })}</span>
        <h2 className="sec-title">{t({ es: "Todos hemos vivido esta escena", en: "We've all lived this scene" })}</h2>
        <p className="sec-lead">{t({
          es: "El dato existe — está en un manual, una ficha, un procedimiento. Pero entre tú y el dato hay carpetas, versiones y 80 páginas en una pantalla de 6 pulgadas.",
          en: "The answer exists — in a manual, a datasheet, a procedure. But between you and it there are folders, versions, and 80 pages on a 6-inch screen.",
        })}</p>
        <div className="scenes">
          {SCENES_HOME.map((s, i) => (
            <article className="scene-card" key={i}>
              <div className="ph"><span className="ph-tag">{t(s.tag)}</span></div>
              <div className="sc-body">
                <span className="sc-sector">{t(s.sector)}</span>
                <p className="sc-quote">{t(s.quote)}</p>
                <span className="sc-cost">{t(s.cost)}</span>
              </div>
            </article>
          ))}
        </div>
        <p className="momento-close">{t({
          es: "El costo nunca es el documento. Es el tiempo muerto, la decisión a ciegas, o esperar a «quien sabe».",
          en: "The cost is never the document. It's the downtime, the blind decision, or waiting for “the one who knows.”",
        })}</p>
      </div>
    </section>
  );
}

/* ---- Capa 2: anaquel → FLOW ---- */
function ParadigmSection() {
  const t = useT();
  return (
    <section className="band paper" data-screen-label="Home — Anaquel a FLOW">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "El cambio de categoría", en: "The category shift" })}</span>
        <h2 className="sec-title">{t({ es: "Del anaquel al flujo", en: "From the shelf to the flow" })}</h2>
        <div className="paradigm">
          <div className="par-card shelf">
            <span className="pc-lab">{t({ es: "Modelo anaquel — hoy", en: "Shelf model — today" })}</span>
            <h3>{t({ es: "Tú vas al dato", en: "You go to the data" })}</h3>
            <p>{t({ es: "Tienes que saber qué archivo, qué carpeta, qué página. El conocimiento está inmóvil; el esfuerzo es tuyo.", en: "You have to know which file, which folder, which page. The knowledge sits still; the effort is yours." })}</p>
            <ul className="par-list">
              <li><Icon name="folder-search" size={15} />{t({ es: "Navegar carpetas y versiones", en: "Navigate folders and versions" })}</li>
              <li><Icon name="zoom-in" size={15} />{t({ es: "Pellizcar el PDF de 80 páginas", en: "Pinch through the 80-page PDF" })}</li>
              <li><Icon name="clock" size={15} />{t({ es: "Perder el momento", en: "Lose the moment" })}</li>
            </ul>
          </div>
          <div className="par-arrow"><Icon name="arrow-right" size={28} /></div>
          <div className="par-card flow">
            <span className="pc-lab">{t({ es: "Modelo FLOW — DOCYAN", en: "FLOW model — DOCYAN" })}</span>
            <h3>{t({ es: "El dato viene a ti", en: "The data comes to you" })}</h3>
            <p>{t({ es: "Preguntas qué necesitas. La respuesta llega presentada para leerse de un vistazo, con su fuente.", en: "You ask for what you need. The answer arrives ready to read at a glance, with its source." })}</p>
            <ul className="par-list">
              <li><Icon name="message-circle" size={15} />{t({ es: "Preguntas en tu idioma", en: "Ask in your language" })}</li>
              <li><Icon name="quote" size={15} />{t({ es: "Respuesta con cita al original", en: "Answer cited to the original" })}</li>
              <li><Icon name="zap" size={15} />{t({ es: "Sin perder el momento", en: "Without losing the moment" })}</li>
            </ul>
          </div>
        </div>
        <p className="momento-close" style={{ marginTop: 32 }}>{t({
          es: "No es un buscador mejor. Es un entorno de documentos analizados en vivo — otra categoría.",
          en: "Not a better search box. A live document environment — a different category.",
        })}</p>
      </div>
    </section>
  );
}

/* ---- 3 pasos ---- */
function StepsSection({ go }) {
  const t = useT();
  return (
    <section className="band" data-screen-label="Home — Cómo funciona (resumen)">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "Cómo funciona", en: "How it works" })}</span>
        <h2 className="sec-title">{t({ es: "Tres pasos, sin caja negra", en: "Three steps, no black box" })}</h2>
        <div className="steps3">
          {[
            { n: "01", ic: "upload", h: { es: "Sube tus documentos", en: "Upload your documents" }, p: { es: "Manuales, fichas, MSDS, procedimientos. DOCYAN los analiza y los vuelve documentos vivos.", en: "Manuals, datasheets, MSDS, procedures. DOCYAN analyzes them and makes them live documents." } },
            { n: "02", ic: "message-circle-question", h: { es: "Tu gente pregunta", en: "Your people ask" }, p: { es: "En su idioma, desde el punto de uso. La respuesta llega renderizada para leerse de un vistazo.", en: "In their language, at the point of use. The answer arrives rendered to be read at a glance." } },
            { n: "03", ic: "quote", h: { es: "Cada respuesta trae su fuente", en: "Every answer carries its source" }, p: { es: "Cita clickeable al span exacto del documento original. Si DOCYAN no lo sabe, lo dice.", en: "A clickable citation to the exact span of the original document. If DOCYAN doesn't know, it says so." } },
          ].map((s) => (
            <div className="step3" key={s.n}>
              <span className="n">{s.n}</span>
              <span className="si"><Icon name={s.ic} size={22} /></span>
              <h3>{t(s.h)}</h3>
              <p>{t(s.p)}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26 }}>
          <a className="vlink" onClick={() => go("como")}><Icon name="git-branch" size={14} />{t({ es: "Ver la arquitectura completa — sin caja negra", en: "See the full architecture — no black box" })}</a>
        </div>
      </div>
    </section>
  );
}

/* ---- Capa 3: confianza ---- */
function TrustSection() {
  const t = useT();
  return (
    <section className="band paper" data-screen-label="Home — Confianza">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "La garantía", en: "The guarantee" })}</span>
        <h2 className="sec-title">{t({ es: "Pregunta en tu idioma. La fuente sigue siendo la fuente.", en: "Ask in your language. The source stays the source." })}</h2>
        <div className="trust2">
          <div className="trust-pts">
            <div className="trust-pt">
              <span className="ti"><Icon name="languages" size={19} /></span>
              <div>
                <h3>{t({ es: "Consulta multilingüe con cita al original", en: "Multilingual consultation, cited to the original" })}</h3>
                <p>{t({ es: "El manual vino en inglés o alemán; tu operador pregunta en español y recibe la respuesta en español — con el fragmento original real a un toque.", en: "The manual came in German or Spanish; your operator asks in English and gets the answer in English — with the real original fragment one tap away." })}</p>
              </div>
            </div>
            <div className="trust-pt">
              <span className="ti"><Icon name="shield-check" size={19} /></span>
              <div>
                <h3>{t({ es: "Freno de alucinación", en: "Hallucination brake" })}</h3>
                <p>{t({ es: "Pedigree a span y umbrales por criticidad: si la confianza no alcanza, DOCYAN no inventa — te muestra dónde buscar.", en: "Span-level pedigree and criticality thresholds: if confidence falls short, DOCYAN doesn't invent — it shows you where to look." })}</p>
              </div>
            </div>
            <div className="trust-pt">
              <span className="ti"><Icon name="hash" size={19} /></span>
              <div>
                <h3>{t({ es: "Cadena de integridad SHA-256", en: "SHA-256 integrity chain" })}</h3>
                <p>{t({ es: "Cada documento y cada respuesta quedan ligados criptográficamente a su fuente. Auditable de punta a punta.", en: "Every document and every answer is cryptographically tied to its source. Auditable end to end." })}</p>
              </div>
            </div>
          </div>
          <div className="unsafe" style={{ marginTop: 0 }}>
            <Icon name="alert-triangle" size={20} />
            <div>
              <h3>{t({ es: "Tu gente ya le pregunta a una IA. Sin fuente.", en: "Your people already ask an AI. Without a source." })}</h3>
              <p>{t({
                es: "Hoy suben fichas y manuales a herramientas de IA genéricas para «entenderlos»: sin cita, sin trazabilidad, copiando datos regulados fuera de tu control — y la IA inventa. DOCYAN es ese mismo gesto natural, vuelto seguro: citado, trazable y dentro de tu entorno.",
                en: "Today they upload datasheets and manuals to generic AI tools to “make sense of them”: no citation, no traceability, regulated data copied outside your control — and the AI invents. DOCYAN is that same natural gesture, made safe: cited, traceable, inside your environment.",
              })}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Capa 4: el foso ---- */
function MoatSection() {
  const t = useT();
  return (
    <section className="band ink" data-screen-label="Home — El foso">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "Y además", en: "And then" })}</span>
        <h2 className="sec-title">{t({ es: "Cada pregunta teje el saber de tu organización", en: "Every question weaves your organization's knowledge" })}</h2>
        <p className="sec-lead">{t({
          es: "Cuando el experto se va, su forma de resolver ya no se va con él. DOCYAN muestra qué se pregunta mucho y qué no está bien cubierto por tu documentación.",
          en: "When the expert leaves, their way of solving things no longer leaves with them. DOCYAN shows what gets asked a lot and what your documentation doesn't cover well.",
        })}</p>
        <div className="levels2">
          {[
            { n: "1", lv: { es: "Consulta", en: "Consultation" }, h: { es: "El dato, al instante", en: "The data, instantly" }, p: { es: "Respuestas citadas en el punto de uso. El gancho que se siente el primer día.", en: "Cited answers at the point of use. The hook you feel on day one." }, ex: { es: "«¿Límite OSHA de la acetona?» → 1,000 ppm, citado.", en: "“OSHA limit for acetone?” → 1,000 ppm, cited." } },
            { n: "2", lv: { es: "Patrón", en: "Pattern" }, h: { es: "Lo que tu gente pregunta", en: "What your people ask" }, p: { es: "Las consultas dibujan dónde está la fricción: qué documento se consulta más, qué turno pregunta qué.", en: "Queries map the friction: which document gets consulted most, which shift asks what." }, ex: { es: "El 40% de las consultas del turno B son sobre una sola máquina.", en: "40% of shift B's queries concern a single machine." } },
            { n: "3", lv: { es: "Cobertura", en: "Coverage" }, h: { es: "Lo que falta documentar", en: "What's missing" }, p: { es: "DOCYAN señala preguntas sin buena respuesta en tus documentos — el mapa de tu conocimiento tácito en fuga.", en: "DOCYAN flags questions your documents can't answer well — the map of your tacit knowledge leak." }, ex: { es: "12 preguntas recurrentes sin fuente: candidatas a documentarse.", en: "12 recurring questions with no source: candidates for documentation." } },
          ].map((l) => (
            <div className="level2" key={l.n}>
              <span className="lv"><span className="n">{l.n}</span>{t(l.lv)}</span>
              <h3>{t(l.h)}</h3>
              <p>{t(l.p)}</p>
              <span className="ex"><b>{t({ es: "Ejemplo — ", en: "Example — " })}</b>{t(l.ex)}</span>
            </div>
          ))}
        </div>
        <p className="momento-close" style={{ color: "var(--amate-300)" }}>{t({
          es: "DOCYAN cuenta, no concluye: reporta frecuencia y patrón. Diagnosticar causas sigue siendo tuyo.",
          en: "DOCYAN counts, it doesn't conclude: it reports frequency and pattern. Diagnosing causes remains yours.",
        })}</p>
      </div>
    </section>
  );
}

/* ---- sectores ---- */
function SectorsSection({ go }) {
  const t = useT();
  return (
    <section className="band" data-screen-label="Home — Sectores">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "Sectores", en: "Industries" })}</span>
        <h2 className="sec-title">{t({ es: "El mismo trabajo técnico, siete escenas", en: "The same technical work, seven scenes" })}</h2>
        <p className="sec-lead">{t({
          es: "Trabajo regido por documentos, errores que cuestan, punto de uso lejos de la oficina. Si te reconoces, DOCYAN es para tu operación.",
          en: "Work governed by documents, errors that cost, a point of use far from the office. If you recognize yourself, DOCYAN is for your operation.",
        })}</p>
        <VertGrid go={go} limit={6} />
        <div style={{ marginTop: 24 }}>
          <a className="vlink" onClick={() => go("verticales")}><Icon name="layout-grid" size={14} />{t({ es: "Ver todos los sectores", en: "See all industries" })}</a>
        </div>
      </div>
    </section>
  );
}

/* ---- CTA final ---- */
function HomeCTA() {
  const t = useT();
  return (
    <section className="band paper" data-screen-label="Home — CTA final">
      <div className="wrap">
        <div className="cta-band">
          <span className="eyebrow">{t({ es: "Empezar", en: "Get started" })}</span>
          <h2 className="sec-title">{t({ es: "Vive el producto antes de decidir", en: "Live the product before you decide" })}</h2>
        </div>
        <Doors />
      </div>
    </section>
  );
}

function HomePage({ go, heroVariant }) {
  return (
    <main data-screen-label="Home">
      {heroVariant === "B" ? <HeroB /> : heroVariant === "C" ? <HeroC /> : <HeroA />}
      <MomentSection />
      <ParadigmSection />
      <StepsSection go={go} />
      <TrustSection />
      <MoatSection />
      <CodoBridge go={go} />
      <SectorsSection go={go} />
      <HomeCTA />
    </main>
  );
}

Object.assign(window, { HomePage });
