/* DOCYAN sitio público v2 — demo vivo rediseñado.
   Misma mecánica (documento → pregunta → respuesta con cita a span),
   mejor puesta en escena: charola de documentos reales, pregunta tecleada,
   respuesta de un vistazo y span original revelado (consulta multilingüe
   demostrada con un documento que vino en inglés — sin nombrarlo "traducción"). */

/* abrir el documento fuente (mock de PDF) aterrizando en el span citado */
function openDoc2(a, codo, docName) {
  const u = new URLSearchParams({
    doc: a.doc || docName || a.cite || "Documento fuente",
    cite: a.cite || "Documento · §",
    page: String(a.page || "—"),
    span: a.span || "Fragmento citado del documento fuente.",
    codo: codo || "DEMO",
    lang: a.spanLang || "ES",
  });
  window.open("demo-doc.html?" + u.toString(), "_blank", "noopener");
}

/* overlay modal del documento fuente — divulgación progresiva nivel 2.
   El documento se muestra en su idioma ORIGINAL (a.spanLang); desde el pie
   se puede abrir el documento completo en pestaña nueva (nivel 3). */
function DocOverlay({ a, codo, onClose }) {
  const t = useT();
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!a) return null;
  const EN = (a.spanLang || "ES") === "EN";
  const docTitle = a.doc || "Documento fuente";
  return (
    <div className="doc-ov" onClick={onClose}>
      <div className="doc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={docTitle}>
        <div className="dsh-head">
          <div style={{ minWidth: 0 }}>
            <div className="dsh-eyebrow">{a.cite} · {EN ? "p. " : "pág. "}{a.page}</div>
            <div className="dsh-title">{docTitle}</div>
            <div className="dsh-meta">DOCYAN · {codo || "DEMO"} · {EN
              ? t({ es: "documento vivo · idioma original: inglés", en: "live document · original language: English" })
              : t({ es: "documento vivo · idioma original: español", en: "live document · original language: Spanish" })}</div>
          </div>
          <button className="dsh-x" onClick={onClose} aria-label={t({ es: "Cerrar", en: "Close" })}><Icon name="x" size={18} /></button>
        </div>
        <div className="dsh-body">
          <h2>{EN ? "Preconditions" : "Condiciones previas"}</h2>
          <p>{EN
            ? "Before any intervention, verify that the equipment is in a safe state and confirm the validity of the associated records."
            : "Antes de cualquier intervención, verifica que el equipo se encuentre en estado seguro y confirma la vigencia de los registros asociados."}</p>
          <h2>{(a.cite || "§").split("·").pop().trim()} — {EN ? "cited section" : "sección citada"}</h2>
          <p>
            {EN ? "Under the conditions defined for this operating entity, the following applies. " : "En las condiciones definidas para esta entidad operativa, aplica lo siguiente. "}
            <mark className="dsh-span">{a.span}</mark>
            <span className="dsh-tag">{EN ? "span cited by DOCYAN" : "span citado por DOCYAN"}</span>{" "}
            {EN ? "Repeat the verification a second time to ensure record consistency." : "Repite la verificación una segunda vez para asegurar la consistencia del registro."}
          </p>
          <h2>{EN ? "Records" : "Registro"}</h2>
          <p>{EN
            ? "After completing the procedure, record the value and date in the equipment log. Traceability is cryptographically chained in DOCYAN's FAT."
            : "Tras completar el procedimiento, registra el valor y la fecha en la bitácora del equipo. La trazabilidad queda encadenada criptográficamente en el FAT de DOCYAN."}</p>
        </div>
        <div className="dsh-foot">
          <span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Pedigree a span exacto · cadena SHA-256", en: "Exact-span pedigree · SHA-256 chain" })}</span>
          <a className="dsh-open" onClick={() => openDoc2(a, codo)}>{t({ es: "Abrir en pestaña nueva", en: "Open in new tab" })} ↗</a>
        </div>
      </div>
    </div>
  );
}

const demoDelay = (ms) => new Promise((r) => setTimeout(r, ms));

const DEMO_DOCS = [
  {
    key: "msds",
    name: { es: "MSDS — Acetona", en: "MSDS — Acetone" },
    langTag: "EN",
    icon: "file-text",
    qa: [
      {
        q: { es: "¿Cuál es el límite de exposición OSHA?", en: "What is the OSHA exposure limit?" },
        value: "1,000", unit: "ppm",
        note: { es: "PEL (TWA 8 h) según OSHA. El TLV de ACGIH es más estricto: 250 ppm.", en: "OSHA PEL (8-hr TWA). The ACGIH TLV is stricter: 250 ppm." },
        cite: "MSDS Acetone · Sec. 8", page: 5,
        span: "Exposure controls — OSHA PEL (TWA 8 hr): 1000 ppm. ACGIH TLV (TWA): 250 ppm.",
        mark: "OSHA PEL (TWA 8 hr): 1000 ppm",
        spanLang: "EN",
      },
      {
        q: { es: "¿Qué protección personal requiere su manejo?", en: "What personal protection does handling require?" },
        text: { es: "Gafas de seguridad con protección lateral y guantes de nitrilo. Manejar en área ventilada, lejos de fuentes de ignición.", en: "Safety glasses with side shields and nitrile gloves. Handle in a ventilated area, away from ignition sources." },
        cite: "MSDS Acetone · Sec. 8", page: 5,
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
        value: "4.0 – 8.5", unit: "bar",
        note: { es: "Presión nominal de trabajo: 7.5 bar. Verificar el manómetro antes de cada arranque.", en: "Nominal working pressure: 7.5 bar. Check the gauge before every start-up." },
        cite: "Ficha técnica GA-22 · §4.1", page: 12,
        span: "Rango de presión de operación: 4.0 – 8.5 bar. Presión nominal de trabajo: 7.5 bar. Verificar manómetro antes de cada arranque.",
        mark: "4.0 – 8.5 bar",
        spanLang: "ES",
      },
      {
        q: { es: "¿Intervalo de cambio de aceite?", en: "What is the oil change interval?" },
        value: "4,000", unit: "h",
        note: { es: "Con aceite Roto-Inject; reducir a 2,000 h en ambientes con polvo.", en: "With Roto-Inject oil; reduce to 2,000 h in dusty environments." },
        cite: "Ficha técnica GA-22 · §7.2", page: 23,
        span: "Intervalo de cambio de aceite: cada 4,000 horas con aceite Roto-Inject. En ambientes con alta carga de polvo, reducir el intervalo a 2,000 horas.",
        mark: "cada 4,000 horas",
        spanLang: "ES",
      },
    ],
  },
];

async function askDocyanLive(q, lang, docName) {
  if (!window.claude || typeof window.claude.complete !== "function") throw new Error("offline");
  const prompt =
    "Eres DOCYAN, un entorno de documentos analizados en vivo. DEMO pública del sitio. " +
    "El usuario consulta el documento: " + docName + ". " +
    (lang === "en" ? "Answer in English. " : "Responde en español. ") +
    "Tono competente y directo, sin marketing, máximo 2 frases, con un dato concreto plausible para ese documento. " +
    'Devuelve SOLO JSON sin nada más: {"answer":"...","cite":"Documento · §x.y"}' +
    "\n\nPregunta: " + q;
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 9000));
  const raw = await Promise.race([window.claude.complete(prompt), timeout]);
  const txt = typeof raw === "string" ? raw : (raw && raw.completion) || "";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("parse");
  const o = JSON.parse(m[0]);
  if (!o.answer) throw new Error("empty");
  return o;
}

/* coincidencia laxa: una pregunta libre que comparte palabras clave
   con una consulta preparada usa su respuesta citada real */
function matchQA(doc, v, t) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = norm(v).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let best = null, bestScore = 0;
  for (const qa of doc.qa) {
    const hay = norm(t(qa.q) + " " + (qa.mark || "") + " " + t(qa.note || qa.text || {}));
    const score = words.filter((w) => hay.includes(w)).length;
    if (score > bestScore) { best = qa; bestScore = score; }
  }
  return bestScore >= 1 ? best : null;
}

function LiveDemo({ compact = false }) {
  const t = useT();
  const { lang } = useLang();
  const [docKey, setDocKey] = useState("msds");
  const [phase, setPhase] = useState("idle"); // idle | typing | loading | answered
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [showSrc, setShowSrc] = useState(false);
  const [text, setText] = useState("");
  const [docView, setDocView] = useState(null);
  const typingRef = useRef(false);
  const cardRef = useRef(null);

  /* al llegar una respuesta, asegurar que el cuerpo de la demo quede visible
     (en móvil el input queda abajo y la respuesta aparece arriba, fuera de vista) */
  useEffect(() => {
    if (phase !== "answered" && phase !== "loading") return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0) window.scrollBy({ top: r.top - 14, behavior: "smooth" });
  }, [phase]);

  const doc = DEMO_DOCS.find((d) => d.key === docKey);

  const runAnswer = async (question, hit) => {
    setQ(question); setPhase("loading"); setA(null); setShowSrc(false);
    if (hit) {
      await demoDelay(520);
      setA(hit);
    } else {
      let res;
      try {
        const o = await askDocyanLive(question, lang, t(doc.name));
        res = { text: { es: o.answer, en: o.answer }, cite: o.cite || t(doc.name) + " · §", page: "—", span: o.answer, mark: null, spanLang: lang.toUpperCase() };
      } catch (e) {
        res = {
          text: {
            es: "En esta demo pública solo este par de documentos está analizado en vivo. En tu entorno, esta pregunta se respondería igual: con el dato y su cita al original. Prueba una de las consultas sugeridas.",
            en: "In this public demo only these two documents are analyzed live. In your environment, this question would be answered the same way: the datum plus its citation to the original. Try one of the suggested queries.",
          },
          cite: null, page: null, span: null, mark: null, spanLang: null,
        };
      }
      setA(res);
    }
    setPhase("answered");
    setTimeout(() => setShowSrc(true), 480);
  };

  const ask = async (qa) => {
    if (typingRef.current) return;
    typingRef.current = true;
    const question = t(qa.q);
    setPhase("typing"); setA(null); setShowSrc(false);
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

  const submitFree = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (typingRef.current || phase === "loading") return;
    const v = text.trim();
    if (!v) return;
    setText("");
    const exact = doc.qa.find((x) => t(x.q).toLowerCase() === v.toLowerCase());
    runAnswer(v, exact || matchQA(doc, v, t) || null);
  };

  const pickDoc = (k) => { typingRef.current = false; setDocKey(k); setPhase("idle"); setA(null); setQ(""); setShowSrc(false); setText(""); };

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
                <p className="note">{t(a.note)}</p>
              </>
            ) : (
              <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>{t(a.text)}</p>
            )}
            {a.cite && (
              <div className="dc2-citerow">
                <button className="cite2" onClick={() => setShowSrc(!showSrc)}>
                  <span className="brk" /><span className="ctxt">{a.cite} · {t({ es: "pág.", en: "p." })} {a.page}</span> ↗
                </button>
                <button className="openpdf" onClick={() => setDocView(Object.assign({ doc: t(doc.name) }, a))}>
                  <Icon name="external-link" size={13} />{t({ es: "Abrir PDF", en: "Open PDF" })}
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
                    <span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Pedigree a span · SHA-256", en: "Span pedigree · SHA-256" })}</span>
                    <button className="openpdf" onClick={() => setDocView(Object.assign({ doc: t(doc.name) }, a))}>
                      <Icon name="external-link" size={13} />{t({ es: "Abrir PDF", en: "Open PDF" })}
                    </button>
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

      {!compact && (
        <div className="dc2-foot">
          <Icon name="shield-check" size={12} />
          <span>{t({ es: "Respuestas reales del producto en producción · cada cita es trazable al documento original", en: "Real answers from the product in production · every citation traces to the original document" })}</span>
        </div>
      )}
      {docView && <DocOverlay a={docView} codo="DEMO-HOME" onClose={() => setDocView(null)} />}
    </div>
  );
}

Object.assign(window, { LiveDemo, DEMO_DOCS, DocOverlay, openDoc2 });
