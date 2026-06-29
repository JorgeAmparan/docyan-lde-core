/* DOCYAN — Demo pública sin registro · superficie del prototipo (fuente de verdad).
   Reusa la consulta REAL del prototipo (ColabMobile / ConsultView) DENTRO de marcos
   de dispositivo (teléfono ↔ tablet, toggle), con el CoDo MAXI-10ND (3 docs de la
   mezcladora) — el mismo preview de consulta. Opus porta esto a la sección /demo
   del sitio público; en producción la consulta libre va contra el backend real. */
const { useState: useStateD } = React;

function DemoShowcase({ saved, toggleSave }) {
  const [dev, setDev] = useStateD("phone"); // phone | tablet
  return <div className="demo-show">
    <div className="ds-head">
      <span className="ds-eyebrow">Demo sin registro</span>
      <h1 className="ds-title">Pruébalo con documentos reales</h1>
      <p className="ds-lead">Mezcladora de concreto <b>MAXI-10ND</b> · 3 documentos vivos. Pregunta lo que preguntarías frente al equipo — la respuesta llega citada a la fuente, en tu idioma.</p>
      <div className="ds-devtoggle" role="tablist" aria-label="Dispositivo">
        <button className={"ds-dev" + (dev === "phone" ? " on" : "")} role="tab" aria-selected={dev === "phone"} onClick={() => setDev("phone")}><Icon name="smartphone" size={15} />Teléfono</button>
        <button className={"ds-dev" + (dev === "tablet" ? " on" : "")} role="tab" aria-selected={dev === "tablet"} onClick={() => setDev("tablet")}><Icon name="tablet" size={15} />Tablet</button>
      </div>
    </div>

    <div className="ds-stage">
      {dev === "phone"
        ? <div className="ds-bezel phone"><div className="ds-screen">{<ColabMobile saved={saved} toggleSave={toggleSave} />}</div></div>
        : <div className="ds-bezel tablet"><div className="ds-screen">{<ConsultView codo={CODOS[0]} saved={saved} toggleSave={toggleSave} />}</div></div>}
    </div>

    <div className="ds-banner">
      <span className="dsb-dot"><span /></span>
      <div className="dsb-txt"><b>Estás en un CoDo demo.</b> Las respuestas vienen de los 3 documentos reales de la MAXI-10ND. Cuando quieras, hazlo con los tuyos.</div>
      <div className="dsb-cta">
        <button className="dsb-btn primary" onClick={() => dcModal({ icon: "rocket", title: "Empieza gratis", body: "Crea tu cuenta y carga tus primeros 3 documentos — sin tarjeta, 30 días, todas las capacidades.", confirm: "Crear cuenta gratis", doneTitle: "¡Listo!", doneBody: "En producción esto te lleva al registro (/signup)." })}>Ahora con tus documentos</button>
        <button className="dsb-btn ghost" onClick={() => dcModal({ icon: "calendar", title: "Agendar demo", body: "Te mostramos DOCYAN con documentos de tu sector y resolvemos dudas de implementación.", confirm: "Agendar", doneTitle: "Gracias", doneBody: "En producción esto te lleva a /codigo (piloto, Esencial −30%)." })}>Agendar demo</button>
      </div>
    </div>
  </div>;
}
Object.assign(window, { DemoShowcase });
