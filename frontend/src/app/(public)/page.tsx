"use client";

/**
 * DOCYAN sitio público v2 — HOME (port fiel de `home.jsx` + `demo.jsx`).
 *
 * Arco completo en miniatura: gancho (hero variante A split + demo vivo)
 * → el momento → anaquel→FLOW → 3 pasos → confianza → foso → puente CoDos
 * → sectores → dos puertas. Decisión D1: SOLO variante A (texto+CTAs izquierda,
 * demo vivo derecha).
 *
 * El demo vivo del hero usa el backend real (`demoQuery(texto,"hero")`): las
 * consultas preparadas (match exacto/keywords) responden al instante con su dato
 * citado; el input libre sin match consulta al backend y muestra la respuesta
 * servida o el fallback honesto — NUNCA fabrica una respuesta.
 *
 * CSS: clases tal cual del prototipo (kit-sitio-v2.css, escopado bajo `.s2`; el
 * layout ya envuelve en `.s2`).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Doors } from "@/components/commercial/site-chrome";
import { useT, useSite, type Bilingual } from "@/lib/site-i18n";
import { demoQuery, DEMO_FALLBACK } from "@/lib/demo-query";

/* ============================================================ */
/* Demo vivo del hero (port de demo.jsx, backend real codo="hero") */
/* ============================================================ */

interface DemoQA {
  q: Bilingual;
  value?: string;
  unit?: string;
  note?: Bilingual;
  text?: Bilingual;
  cite: string | null;
  page: string | number | null;
  span: string | null;
  mark: string | null;
  spanLang: string | null;
}

interface DemoDoc {
  key: string;
  name: Bilingual;
  langTag: string;
  icon: string;
  qa: DemoQA[];
}

const DEMO_DOCS: DemoDoc[] = [
  {
    key: "msds",
    name: { es: "MSDS — Acetona", en: "MSDS — Acetone" },
    langTag: "EN",
    icon: "file-text",
    qa: [
      {
        q: { es: "¿Cuál es el límite de exposición OSHA?", en: "What is the OSHA exposure limit?" },
        value: "1,000",
        unit: "ppm",
        note: { es: "PEL (TWA 8 h) según OSHA. El TLV de ACGIH es más estricto: 250 ppm.", en: "OSHA PEL (8-hr TWA). The ACGIH TLV is stricter: 250 ppm." },
        cite: "MSDS Acetone · Sec. 8",
        page: 5,
        span: "Exposure controls — OSHA PEL (TWA 8 hr): 1000 ppm. ACGIH TLV (TWA): 250 ppm.",
        mark: "OSHA PEL (TWA 8 hr): 1000 ppm",
        spanLang: "EN",
      },
      {
        q: { es: "¿Qué protección personal requiere su manejo?", en: "What personal protection does handling require?" },
        text: { es: "Gafas de seguridad con protección lateral y guantes de nitrilo. Manejar en área ventilada, lejos de fuentes de ignición.", en: "Safety glasses with side shields and nitrile gloves. Handle in a ventilated area, away from ignition sources." },
        cite: "MSDS Acetone · Sec. 8",
        page: 5,
        span: "Personal protective equipment: safety glasses with side shields; nitrile gloves. Use only with adequate ventilation. Keep away from ignition sources.",
        mark: "safety glasses with side shields; nitrile gloves",
        spanLang: "EN",
      },
    ],
  },
  {
    key: "ficha",
    name: { es: "Ficha técnica — Compresor GA-22", en: "Datasheet — GA-22 compressor" },
    langTag: "ES",
    icon: "file-text",
    qa: [
      {
        q: { es: "¿Rango de presión de operación?", en: "What is the operating pressure range?" },
        value: "4.0 – 8.5",
        unit: "bar",
        note: { es: "Presión nominal de trabajo: 7.5 bar. Verificar el manómetro antes de cada arranque.", en: "Nominal working pressure: 7.5 bar. Check the gauge before every start-up." },
        cite: "Ficha técnica GA-22 · §4.1",
        page: 12,
        span: "Rango de presión de operación: 4.0 – 8.5 bar. Presión nominal de trabajo: 7.5 bar. Verificar manómetro antes de cada arranque.",
        mark: "4.0 – 8.5 bar",
        spanLang: "ES",
      },
      {
        q: { es: "¿Intervalo de cambio de aceite?", en: "What is the oil change interval?" },
        value: "4,000",
        unit: "h",
        note: { es: "Con aceite Roto-Inject; reducir a 2,000 h en ambientes con polvo.", en: "With Roto-Inject oil; reduce to 2,000 h in dusty environments." },
        cite: "Ficha técnica GA-22 · §7.2",
        page: 23,
        span: "Intervalo de cambio de aceite: cada 4,000 horas con aceite Roto-Inject. En ambientes con alta carga de polvo, reducir el intervalo a 2,000 horas.",
        mark: "cada 4,000 horas",
        spanLang: "ES",
      },
    ],
  },
];

const demoDelay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type AnswerState = DemoQA;

/* coincidencia laxa: una pregunta libre que comparte palabras clave con una
   consulta preparada usa su respuesta citada real */
function matchQA(doc: DemoDoc, v: string, t: (o: Bilingual) => string): DemoQA | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = norm(v).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let best: DemoQA | null = null;
  let bestScore = 0;
  for (const qa of doc.qa) {
    const hay = norm(t(qa.q) + " " + (qa.mark || "") + " " + t(qa.note || qa.text || { es: "", en: "" }));
    const score = words.filter((w) => hay.includes(w)).length;
    if (score > bestScore) {
      best = qa;
      bestScore = score;
    }
  }
  return bestScore >= 1 ? best : null;
}

type Phase = "idle" | "typing" | "loading" | "answered";

function LiveDemo() {
  const t = useT();
  const { lang } = useSite();
  const [docKey, setDocKey] = useState("msds");
  const [phase, setPhase] = useState<Phase>("idle");
  const [q, setQ] = useState("");
  const [a, setA] = useState<AnswerState | null>(null);
  const [showSrc, setShowSrc] = useState(false);
  const [text, setText] = useState("");
  const typingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  /* al llegar una respuesta, asegurar que el cuerpo de la demo quede visible
     (en móvil el input queda abajo y la respuesta aparece arriba, fuera de vista) */
  useEffect(() => {
    if (phase !== "answered" && phase !== "loading") return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0) window.scrollBy({ top: r.top - 14, behavior: "smooth" });
  }, [phase]);

  const doc = DEMO_DOCS.find((d) => d.key === docKey) ?? DEMO_DOCS[0];

  const runAnswer = async (question: string, hit: DemoQA | null) => {
    setQ(question);
    setPhase("loading");
    setA(null);
    setShowSrc(false);
    if (hit) {
      await demoDelay(520);
      setA(hit);
    } else {
      // input libre sin match: backend real (codo="hero"). Respuesta servida o
      // fallback honesto — NUNCA se fabrica una respuesta.
      let res: AnswerState;
      try {
        const o = await demoQuery(question, "hero");
        if (o.servido && o.resultado) {
          const r = o.resultado as Record<string, unknown>;
          const answer =
            (typeof r.respuesta === "string" && r.respuesta) ||
            (typeof r.answer === "string" && r.answer) ||
            (typeof r.texto === "string" && r.texto) ||
            "";
          const cite =
            (typeof r.cita === "string" && r.cita) ||
            (typeof r.cite === "string" && r.cite) ||
            t(doc.name) + " · §";
          const span =
            (typeof r.span === "string" && r.span) ||
            (typeof r.fragmento === "string" && r.fragmento) ||
            answer ||
            null;
          res = {
            q: { es: question, en: question },
            text: { es: answer, en: answer },
            cite: cite || null,
            page: "—",
            span,
            mark: null,
            spanLang: lang.toUpperCase(),
          };
        } else {
          const msg = o.fallback || DEMO_FALLBACK;
          res = {
            q: { es: question, en: question },
            text: { es: msg, en: msg },
            cite: null,
            page: null,
            span: null,
            mark: null,
            spanLang: null,
          };
        }
      } catch {
        res = {
          q: { es: question, en: question },
          text: { es: DEMO_FALLBACK, en: DEMO_FALLBACK },
          cite: null,
          page: null,
          span: null,
          mark: null,
          spanLang: null,
        };
      }
      setA(res);
    }
    setPhase("answered");
    setTimeout(() => setShowSrc(true), 480);
  };

  const ask = async (qa: DemoQA) => {
    if (typingRef.current) return;
    typingRef.current = true;
    const question = t(qa.q);
    setPhase("typing");
    setA(null);
    setShowSrc(false);
    setText("");
    for (let i = 1; i <= question.length; i++) {
      setText(question.slice(0, i));
      await demoDelay(question.length > 38 ? 16 : 26);
    }
    await demoDelay(240);
    setText("");
    typingRef.current = false;
    runAnswer(question, qa);
  };

  const submitFree = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && "preventDefault" in e) e.preventDefault();
    if (typingRef.current || phase === "loading") return;
    const v = text.trim();
    if (!v) return;
    setText("");
    const exact = doc.qa.find((x) => t(x.q).toLowerCase() === v.toLowerCase());
    runAnswer(v, exact || matchQA(doc, v, t) || null);
  };

  const pickDoc = (k: string) => {
    typingRef.current = false;
    setDocKey(k);
    setPhase("idle");
    setA(null);
    setQ("");
    setShowSrc(false);
    setText("");
  };

  return (
    <div className="demo-card2" data-comment-anchor="demo-vivo" ref={cardRef}>
      <div className="dc2-top">
        <span className="t-ico"><Icon name="files" size={16} /></span>
        <div>
          <div className="ml">{t({ es: "Demo en vivo · tus documentos", en: "Live demo · your documents" })}</div>
          <div className="mn">{t({ es: "Pregunta y recibe la respuesta con su fuente", en: "Ask and get the answer with its source" })}</div>
        </div>
        <span className="dc2-live"><span className="dot" />{t({ es: "EN VIVO", en: "LIVE" })}</span>
      </div>

      <div className="dc2-docs" role="tablist" aria-label={t({ es: "Documentos de la demo", en: "Demo documents" })}>
        {DEMO_DOCS.map((d) => (
          <button key={d.key} className={"dc2-doc" + (d.key === docKey ? " on" : "")} role="tab" aria-selected={d.key === docKey} onClick={() => pickDoc(d.key)}>
            <Icon name={d.icon} size={13} />{t(d.name)}<span className="lang-tag">{d.langTag}</span>
          </button>
        ))}
      </div>

      <div className="dc2-body" aria-live="polite">
        {phase === "idle" && (
          <div className="dc2-empty">
            <Icon name="message-circle-question" size={22} />
            <p>{doc.key === "msds"
              ? t({ es: "Este documento vino en inglés. Pregúntale en tu idioma.", en: "Ask this document anything — the answer always carries its source." })
              : t({ es: "Pregunta lo que necesitas saber frente al equipo.", en: "Ask what you need to know, right at the machine." })}</p>
          </div>
        )}
        {(phase === "loading" || phase === "answered") && <div className="dc2-q">{q}</div>}
        {phase === "loading" && (
          <div className="dc2-shimmer"><span className="dot" />{t({ es: "DOCYAN está leyendo el documento…", en: "DOCYAN is reading the document…" })}</div>
        )}
        {phase === "answered" && a && (
          <div className="dc2-a">
            {a.value ? (
              <>
                <div className="big">{a.value} <span className="u">{a.unit}</span></div>
                <p className="note">{a.note ? t(a.note) : null}</p>
              </>
            ) : (
              <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>{a.text ? t(a.text) : null}</p>
            )}
            {a.cite && (
              <div className="dc2-citerow">
                <button className="cite2" onClick={() => setShowSrc(!showSrc)}>
                  <span className="brk" /><span className="ctxt">{a.cite} · {t({ es: "pág.", en: "p." })} {a.page}</span> ↗
                </button>
              </div>
            )}
            {showSrc && a.span && (
              <div className="dc2-src">
                <span className="thread" />
                <div className="src2">
                  <div className="s-head">
                    <Icon name="file-text" size={12} />
                    <span>{t({ es: "Fragmento original", en: "Original fragment" })}</span>
                    <span className="pg">{t({ es: "pág.", en: "p." })} {a.page}</span>
                  </div>
                  <div className="s-span">
                    {a.mark && a.span.includes(a.mark) ? (
                      <>
                        {a.span.split(a.mark)[0]}<mark>{a.mark}</mark>{a.span.split(a.mark)[1]}
                      </>
                    ) : a.span}
                  </div>
                  {a.spanLang && a.spanLang !== lang.toUpperCase() && (
                    <span className="s-orig"><Icon name="globe" size={11} />{t({ es: "Documento original en " + (a.spanLang === "EN" ? "inglés" : "español") + " · tú preguntaste en español", en: "Original document in " + (a.spanLang === "EN" ? "English" : "Spanish") + " · you asked in English" })}</span>
                  )}
                  <div className="s-actions">
                    <span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Pedigree al fragmento exacto · SHA-256", en: "Span pedigree · SHA-256" })}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dc2-sugs">
        {doc.qa.map((qa, i) => (
          <button key={i} className="dc2-sug" disabled={phase === "typing" || phase === "loading"} onClick={() => ask(qa)}>{t(qa.q)}</button>
        ))}
      </div>

      <form className="dc2-box" onSubmit={submitFree}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitFree(e); }}
          placeholder={t({ es: "Escribe tu pregunta…", en: "Type your question…" })}
          aria-label={t({ es: "Pregunta al documento", en: "Ask the document" })}
          readOnly={phase === "typing"}
        />
        <button className="send" type="button" onClick={submitFree} disabled={!text.trim() || phase === "typing" || phase === "loading"} aria-label={t({ es: "Enviar pregunta", en: "Send question" })}>
          <Icon name="arrow-up" size={16} />
        </button>
      </form>

      <div className="dc2-foot">
        <Icon name="shield-check" size={12} />
        <span>{t({ es: "Respuestas reales del producto en producción · cada cita es trazable al documento original", en: "Real answers from the product in production · every citation traces to the original document" })}</span>
      </div>
    </div>
  );
}

/* ============================================================ */
/* HERO — variante A (split). Decisión D1.                      */
/* ============================================================ */

function HeroA() {
  const t = useT();
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
              <Link className="btn primary lg" href="/signup">{t({ es: "Pruébalo gratis — 3 documentos", en: "Try it free — 3 documents" })}<Icon name="arrow-right" size={16} /></Link>
              <Link className="btn sec lg" href="/codigo">{t({ es: "Agendar demo", en: "Book a demo" })}</Link>
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

/* ============================================================ */
/* Capa 1: el momento                                           */
/* ============================================================ */

const SCENES_HOME: { sector: Bilingual; quote: Bilingual; cost: Bilingual; tag: Bilingual }[] = [
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

/* ============================================================ */
/* Capa 2: anaquel → FLOW                                       */
/* ============================================================ */

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

/* ============================================================ */
/* 3 pasos                                                      */
/* ============================================================ */

function StepsSection() {
  const t = useT();
  const steps: { n: string; ic: string; h: Bilingual; p: Bilingual }[] = [
    { n: "01", ic: "upload", h: { es: "Sube tus documentos", en: "Upload your documents" }, p: { es: "Manuales, fichas, MSDS, procedimientos. DOCYAN los analiza y los vuelve documentos vivos.", en: "Manuals, datasheets, MSDS, procedures. DOCYAN analyzes them and makes them live documents." } },
    { n: "02", ic: "message-circle-question", h: { es: "Tu gente pregunta", en: "Your people ask" }, p: { es: "En su idioma, desde el punto de uso. La respuesta llega renderizada para leerse de un vistazo.", en: "In their language, at the point of use. The answer arrives rendered to be read at a glance." } },
    { n: "03", ic: "quote", h: { es: "Cada respuesta trae su fuente", en: "Every answer carries its source" }, p: { es: "Cita clickeable al fragmento exacto del documento original. Si DOCYAN no lo sabe, lo dice.", en: "A clickable citation to the exact span of the original document. If DOCYAN doesn't know, it says so." } },
  ];
  return (
    <section className="band" data-screen-label="Home — Cómo funciona (resumen)">
      <div className="wrap">
        <span className="eyebrow">{t({ es: "Cómo funciona", en: "How it works" })}</span>
        <h2 className="sec-title">{t({ es: "Tres pasos, sin caja negra", en: "Three steps, no black box" })}</h2>
        <div className="steps3">
          {steps.map((s) => (
            <div className="step3" key={s.n}>
              <span className="n">{s.n}</span>
              <span className="si"><Icon name={s.ic} size={22} /></span>
              <h3>{t(s.h)}</h3>
              <p>{t(s.p)}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26 }}>
          <Link className="vlink" href="/como-funciona"><Icon name="git-branch" size={14} />{t({ es: "Ver la arquitectura completa — sin caja negra", en: "See the full architecture — no black box" })}</Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Capa 3: confianza                                            */
/* ============================================================ */

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
                <p>{t({ es: "Pedigree al fragmento exacto y umbrales por criticidad: si la confianza no alcanza, DOCYAN no inventa — te muestra dónde buscar.", en: "Span-level pedigree and criticality thresholds: if confidence falls short, DOCYAN doesn't invent — it shows you where to look." })}</p>
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
            <Icon name="triangle-alert" size={20} />
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

/* ============================================================ */
/* Capa 4: el foso                                              */
/* ============================================================ */

function MoatSection() {
  const t = useT();
  const levels: { n: string; lv: Bilingual; h: Bilingual; p: Bilingual; ex: Bilingual }[] = [
    { n: "1", lv: { es: "Consulta", en: "Consultation" }, h: { es: "El dato, al instante", en: "The data, instantly" }, p: { es: "Respuestas citadas en el punto de uso. El gancho que se siente el primer día.", en: "Cited answers at the point of use. The hook you feel on day one." }, ex: { es: "«¿Límite OSHA de la acetona?» → 1,000 ppm, citado.", en: "“OSHA limit for acetone?” → 1,000 ppm, cited." } },
    { n: "2", lv: { es: "Patrón", en: "Pattern" }, h: { es: "Lo que tu gente pregunta", en: "What your people ask" }, p: { es: "Las consultas dibujan dónde está la fricción: qué documento se consulta más, qué turno pregunta qué.", en: "Queries map the friction: which document gets consulted most, which shift asks what." }, ex: { es: "El 40% de las consultas del turno B son sobre una sola máquina.", en: "40% of shift B's queries concern a single machine." } },
    { n: "3", lv: { es: "Cobertura", en: "Coverage" }, h: { es: "Lo que falta documentar", en: "What's missing" }, p: { es: "DOCYAN señala preguntas sin buena respuesta en tus documentos — el mapa de tu conocimiento tácito en fuga.", en: "DOCYAN flags questions your documents can't answer well — the map of your tacit knowledge leak." }, ex: { es: "12 preguntas recurrentes sin fuente: candidatas a documentarse.", en: "12 recurring questions with no source: candidates for documentation." } },
  ];
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
          {levels.map((l) => (
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

/* ============================================================ */
/* Puente CoDos (demos sin registro)                            */
/* ============================================================ */

const CODOS_BRIDGE: { key: string; label: string; icon: string; entity: string }[] = [
  { key: "lab", label: "Laboratorios", icon: "flask-conical", entity: "Centrífuga Hettich Rotina 380" },
  { key: "maq", label: "Maquiladoras", icon: "factory", entity: "Línea CNC Haas VF-4" },
  { key: "pharma", label: "Farma", icon: "pill", entity: "Bioreactor B-3" },
  { key: "min", label: "Minería", icon: "mountain", entity: "Excavadora Komatsu PC-2000" },
  { key: "agri", label: "Agroindustria", icon: "sprout", entity: "Tanque enfriamiento leche T-7" },
];

function CodoBridge() {
  const t = useT();
  return (
    <section className="band ink codo-bridge" data-screen-label="Home — Puente CoDos">
      <div className="wrap">
        <div className="cb-grid">
          <div>
            <span className="eyebrow">{t({ es: "Demos sin registro", en: "No-signup demos" })}</span>
            <h2 className="sec-title">{t({ es: "¿Quieres verlo con documentos de tu sector?", en: "Want to see it with documents from your industry?" })}</h2>
            <p className="sec-lead">{t({
              es: "Cinco Conjuntos de Documentos ya analizados — pregunta lo que preguntarías en tu operación, sin registrarte.",
              en: "Five Document Sets already analyzed — ask what you'd ask in your operation, without signing up.",
            })}</p>
          </div>
          <div className="cb-list">
            {CODOS_BRIDGE.map((c) => (
              <Link key={c.key} className="cb-item" href="/demo">
                <Icon name={c.icon} size={17} />
                <span>{c.label}</span>
                <span className="cb-entity">{c.entity}</span>
                <Icon name="arrow-right" size={15} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Sectores                                                     */
/* ============================================================ */

const VERTS: { key: string; ic: string; built: boolean; norm: string; name: Bilingual; desc: Bilingual }[] = [
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

const VERT_HREF: Record<string, string> = {
  lab: "/verticales/laboratorios",
  maq: "/verticales/maquila",
  flot: "/verticales/flotillas",
};

function VertGrid({ limit }: { limit?: number }) {
  const t = useT();
  const list = limit ? VERTS.slice(0, limit) : VERTS;
  return (
    <div className="verts2">
      {list.map((v) => (
        <Link className="vert2" key={v.key} href={v.built ? (VERT_HREF[v.key] ?? "/verticales") : "/verticales"}>
          <span className="vi"><Icon name={v.ic} size={20} /></span>
          <h3>{t(v.name)}</h3>
          <p>{t(v.desc)}</p>
          <span className="vfoot">
            <span className="norm">{v.norm}</span>
            {v.built && <span className="varrow"><Icon name="arrow-right" size={15} /></span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

function SectorsSection() {
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
        <VertGrid limit={6} />
        <div style={{ marginTop: 24 }}>
          <Link className="vlink" href="/verticales"><Icon name="layout-grid" size={14} />{t({ es: "Ver todos los sectores", en: "See all industries" })}</Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* CTA final                                                    */
/* ============================================================ */

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

/* ============================================================ */
/* Página                                                       */
/* ============================================================ */

export default function HomePage() {
  return (
    <main data-screen-label="Home">
      <HeroA />
      <MomentSection />
      <ParadigmSection />
      <StepsSection />
      <TrustSection />
      <MoatSection />
      <CodoBridge />
      <SectorsSection />
      <HomeCTA />
    </main>
  );
}
