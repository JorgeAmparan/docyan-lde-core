"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";

/* DOCYAN sitio público v2 — PRODUCTO.
   La narrativa de significado: híbrido editorial (capas 1-2 en prosa)
   → módulos de producto (capas 3-4) → dos puertas. NO duplica la home.
   Port fiel de producto.jsx. */

interface Bi {
  es: string;
  en: string;
}

const GARANTIA: { ic: string; h: Bi; p: Bi }[] = [
  {
    ic: "languages",
    h: { es: "El manual vino en otro idioma. No importa.", en: "The manual came in another language. It doesn't matter." },
    p: {
      es: "Tu operador pregunta en español y recibe la respuesta en español — y a un toque, el fragmento original del documento, tal como vino. La fuente sigue siendo la fuente.",
      en: "Your operator asks in their language and gets the answer in their language — and one tap away, the original fragment of the document, exactly as it came. The source stays the source.",
    },
  },
  {
    ic: "shield-check",
    h: { es: "Freno de alucinación", en: "Hallucination brake" },
    p: {
      es: "Pedigree al fragmento exacto y umbrales por criticidad. Si la confianza no alcanza el umbral del dato, DOCYAN no responde con humo: te dice qué encontró y dónde seguir.",
      en: "Span-level pedigree and criticality thresholds. If confidence doesn't clear the data's threshold, DOCYAN doesn't answer with smoke: it tells you what it found and where to keep looking.",
    },
  },
  {
    ic: "quote",
    h: { es: "La cita es el producto", en: "The citation is the product" },
    p: {
      es: "Cada respuesta lleva su marca de cita al fragmento exacto del original. No es una nota al pie decorativa: es el contrato de confianza de cada interacción.",
      en: "Every answer carries its citation mark to the exact span of the original. Not a decorative footnote: the trust contract of every interaction.",
    },
  },
  {
    ic: "hash",
    h: { es: "Cadena SHA-256", en: "SHA-256 chain" },
    p: {
      es: "Documento, análisis y respuesta quedan ligados criptográficamente. Cuando el auditor pregunte «¿de dónde salió esto?», hay una sola respuesta verificable.",
      en: "Document, analysis and answer are cryptographically linked. When the auditor asks “where did this come from?”, there is one verifiable answer.",
    },
  },
];

export default function ProductoPage() {
  const t = useT();
  return (
    <main data-screen-label="Producto">
      {/* lede editorial */}
      <header className="prod-hero">
        <div className="wrap narrow">
          <span className="eyebrow">{t({ es: "Producto · qué es DOCYAN", en: "Product · what DOCYAN is" })}</span>
          <h1>{t({ es: "Un entorno donde tus documentos están vivos", en: "An environment where your documents are alive" })}</h1>
          <p className="prod-lede">{t({
            es: "DOCYAN LDE convierte los documentos de tu organización en conocimiento consultable al instante — donde se necesita, por quien lo necesita, con cita al original. Esta página cuenta por qué eso cambia la categoría, no solo la herramienta.",
            en: "DOCYAN LDE turns your organization's documents into knowledge you can consult instantly — where it's needed, by whoever needs it, cited to the original. This page tells why that changes the category, not just the tool.",
          })}</p>
        </div>
      </header>

      {/* Capítulo 1 — el momento (prosa) */}
      <section className="band" data-screen-label="Producto — Cap. 1 El momento">
        <div className="wrap narrow">
          <div className="chapter"><span className="ch-n">01</span><span className="ch-t">{t({ es: "El momento", en: "The moment" })}</span></div>
          <div className="prose">
            <p>{t({
              es: "Son las 6:40 de la mañana y la termoformadora marca una alarma que el turno de noche no supo apagar. El parámetro correcto existe: está en el manual del fabricante, en algún lugar entre la página 40 y la 120. El ingeniero lo sabe. También sabe que la línea pierde dinero por minuto.",
              en: "It's 6:40 a.m. and the thermoformer shows an alarm the night shift couldn't clear. The right parameter exists: it's in the manufacturer's manual, somewhere between page 40 and page 120. The engineer knows this. He also knows the line loses money by the minute.",
            })}</p>
            <p>{t({
              es: "La misma escena, con otros nombres: el técnico de gasoducto a 200 km de la oficina con una barra de señal. La cuadrilla de minería esperando «al que sabe». El frente de obra detenido por una especificación. La plataforma marina donde no hay segunda oportunidad. El piso agroindustrial a media cosecha. El laboratorio donde la calibración venció y nadie lo vio a tiempo.",
              en: "The same scene, with other names: the pipeline technician 200 km from the office with one bar of signal. The mining crew waiting for “the one who knows.” The road crew halted by a specification. The offshore platform where there is no second chance. The agroindustrial floor mid-harvest. The laboratory where the calibration expired and nobody caught it in time.",
            })}</p>
            <p className="pull">{t({
              es: "El dato existe. Lo que no existe es el camino corto entre el dato y la persona que lo necesita, en el momento en que lo necesita.",
              en: "The data exists. What doesn't exist is the short path between the data and the person who needs it, at the moment they need it.",
            })}</p>
            <p>{t({
              es: "El costo nunca aparece en una factura con ese nombre. Aparece como tiempo muerto, como decisión tomada a ciegas, como visita repetida, como hallazgo de auditoría que era evitable.",
              en: "The cost never shows up on an invoice under that name. It shows up as downtime, as a decision made blind, as a repeated site visit, as an audit finding that was avoidable.",
            })}</p>
          </div>
        </div>
      </section>

      {/* Capítulo 2 — el paradigma (prosa + tarjetas) */}
      <section className="band paper" data-screen-label="Producto — Cap. 2 El paradigma">
        <div className="wrap narrow">
          <div className="chapter"><span className="ch-n">02</span><span className="ch-t">{t({ es: "El paradigma", en: "The paradigm" })}</span></div>
          <div className="prose">
            <p>{t({
              es: "Durante décadas la respuesta fue ordenar mejor el anaquel: más carpetas, mejores nombres de archivo, un buscador encima. Pero el modelo no cambió — tú sigues yendo al dato, y para llegar tienes que saber qué archivo, qué versión, qué página.",
              en: "For decades the answer was to organize the shelf better: more folders, better file names, a search box on top. But the model never changed — you still go to the data, and to get there you must know which file, which version, which page.",
            })}</p>
            <p>{t({
              es: "Hubo un negocio que ordenaba películas en anaqueles, y lo hacía muy bien. No perdió contra un anaquel mejor ordenado: perdió contra el flujo — la película que viene a ti. Lo mismo le está pasando al documento técnico.",
              en: "There was a business that organized movies on shelves, and did it very well. It didn't lose to a better-organized shelf: it lost to the flow — the movie that comes to you. The same is happening to the technical document.",
            })}</p>
            <p><b>{t({
              es: "DOCYAN no es un buscador mejor. Es el cambio de categoría: un entorno de documentos analizados en vivo,",
              en: "DOCYAN is not a better search box. It is the category change: a live document environment,",
            })}</b>{" "}{t({
              es: "donde preguntas qué necesitas y el dato viene a ti — renderizado para leerse de un vistazo, con su fuente.",
              en: "where you ask for what you need and the data comes to you — rendered to be read at a glance, with its source.",
            })}</p>
          </div>
        </div>
        <div className="wrap">
          <div className="paradigm">
            <div className="par-card shelf">
              <span className="pc-lab">{t({ es: "Anaquel", en: "Shelf" })}</span>
              <h3>{t({ es: "«¿Dónde está?»", en: "“Where is it?”" })}</h3>
              <p>{t({ es: "El conocimiento inmóvil. El esfuerzo, tuyo. El momento, perdido.", en: "Knowledge sits still. The effort is yours. The moment, lost." })}</p>
            </div>
            <div className="par-arrow"><Icon name="arrow-right" size={28} /></div>
            <div className="par-card flow">
              <span className="pc-lab">FLOW</span>
              <h3>{t({ es: "«¿Qué necesito?»", en: "“What do I need?”" })}</h3>
              <p>{t({ es: "Preguntas. El dato llega con su cita. El momento, intacto.", en: "You ask. The data arrives with its citation. The moment, intact." })}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Capítulo 3 — la garantía (módulos) */}
      <section className="band" data-screen-label="Producto — Cap. 3 La garantía">
        <div className="wrap">
          <div className="chapter"><span className="ch-n">03</span><span className="ch-t">{t({ es: "La garantía", en: "The guarantee" })}</span></div>
          <h2 className="sec-title">{t({ es: "En tu idioma, sin alucinaciones, con la fuente a un toque", en: "In your language, no hallucinations, the source one tap away" })}</h2>
          <p className="sec-lead">{t({
            es: "Lo lingüístico en DOCYAN no es un producto aparte: es la garantía de que la consulta funciona para tu gente real, con sus documentos reales.",
            en: "Language in DOCYAN is not a separate product: it's the guarantee that consultation works for your real people, with their real documents.",
          })}</p>
          <div className="sec-grid2">
            {GARANTIA.map((x, i) => (
              <div className="sec-item2" key={i}>
                <span className="ic"><Icon name={x.ic} size={20} /></span>
                <div><h3>{t(x.h)}</h3><p>{t(x.p)}</p></div>
              </div>
            ))}
          </div>
          <div className="unsafe">
            <Icon name="triangle-alert" size={20} />
            <div>
              <h3>{t({ es: "El acto inseguro que esto reemplaza", en: "The unsafe act this replaces" })}</h3>
              <p>{t({
                es: "Subir el MSDS a una IA genérica para «entenderlo» ya pasa en tu operación — sin fuente, sin trazabilidad, con datos regulados saliendo de tu control. DOCYAN conserva el gesto y le pone piso: citado, trazable, dentro de tu entorno.",
                en: "Uploading the MSDS to a generic AI to “make sense of it” already happens in your operation — no source, no traceability, regulated data leaving your control. DOCYAN keeps the gesture and gives it a floor: cited, traceable, inside your environment.",
              })}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Capítulo 4 — el foso (módulos sobre tinta) */}
      <section className="band ink" data-screen-label="Producto — Cap. 4 El foso">
        <div className="wrap">
          <div className="chapter"><span className="ch-n" style={{ borderColor: "rgba(207,65,36,.5)" }}>04</span><span className="ch-t" style={{ color: "var(--stone-400)" }}>{t({ es: "El foso", en: "The moat" })}</span></div>
          <h2 className="sec-title">{t({ es: "Lo que se queda cuando la gente se va", en: "What stays when people leave" })}</h2>
          <div className="trust2" style={{ marginTop: 28 }}>
            <div className="prose">
              <p>{t({
                es: "El gancho es la consulta. El foso se revela después: cada pregunta que hace tu gente teje, sin esfuerzo extra, el mapa del saber de tu organización — qué se consulta, qué se repite, qué no está cubierto.",
                en: "The hook is consultation. The moat reveals itself later: every question your people ask weaves, with no extra effort, the map of your organization's knowledge — what gets consulted, what repeats, what isn't covered.",
              })}</p>
              <p>{t({
                es: "La rotación deja de ser fuga: cuando el experto se va, su forma de resolver — las preguntas que hacía, los documentos que tocaba — ya quedó tejida en el entorno.",
                en: "Turnover stops being a leak: when the expert leaves, their way of solving — the questions they asked, the documents they touched — is already woven into the environment.",
              })}</p>
              <p className="pull" style={{ borderColor: "var(--cinnabar-400)" }}>{t({
                es: "DOCYAN cuenta, no concluye. Reporta frecuencia y patrón; el diagnóstico sigue siendo tuyo.",
                en: "DOCYAN counts, it doesn't conclude. It reports frequency and pattern; the diagnosis remains yours.",
              })}</p>
            </div>
            <div className="trust-pts">
              <div className="trust-pt">
                <span className="ti"><Icon name="activity" size={19} /></span>
                <div>
                  <h3>{t({ es: "Qué se pregunta mucho", en: "What gets asked a lot" })}</h3>
                  <p>{t({ es: "Frecuencia por documento, por equipo, por turno. La fricción de tu operación, visible.", en: "Frequency by document, by team, by shift. Your operation's friction, made visible." })}</p>
                </div>
              </div>
              <div className="trust-pt">
                <span className="ti"><Icon name="file-question" size={19} /></span>
                <div>
                  <h3>{t({ es: "Qué no cubre tu documentación", en: "What your documentation doesn't cover" })}</h3>
                  <p>{t({ es: "Preguntas recurrentes sin buena fuente: la lista de lo que conviene documentar antes de que se vaya quien lo sabe.", en: "Recurring questions with no good source: the list of what to document before the one who knows leaves." })}</p>
                </div>
              </div>
              <div className="trust-pt">
                <span className="ti"><Icon name="users" size={19} /></span>
                <div>
                  <h3>{t({ es: "El saber, de la organización", en: "Knowledge, the organization's" })}</h3>
                  <p>{t({ es: "No vive en la cabeza de una persona ni en una herramienta externa. Vive en tu entorno, citado y auditable.", en: "It doesn't live in one person's head or in an external tool. It lives in your environment, cited and auditable." })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* cierre → puertas */}
      <section className="band" data-screen-label="Producto — Cierre">
        <div className="wrap">
          <div className="cta-band">
            <span className="eyebrow">{t({ es: "El siguiente paso", en: "The next step" })}</span>
            <h2 className="sec-title">{t({ es: "La narrativa termina aquí. El producto empieza con 3 documentos.", en: "The narrative ends here. The product begins with 3 documents." })}</h2>
          </div>
          <Doors />
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <Link className="vlink" href="/como-funciona"><Icon name="git-branch" size={14} />{t({ es: "¿Eres de TI? Mira cómo funciona por dentro", en: "In IT? See how it works inside" })}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
