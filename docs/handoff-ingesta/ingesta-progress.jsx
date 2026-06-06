/* DOCYAN PWA kit — Ingesta: progreso de procesamiento en vivo (Capa A · §5.8).
   El reto de diseño: una barra que avanza ~600 s por documento SIN sentirse colgada.
   Estrategia:
   · El procesamiento interno se parte en 5 fases nombradas (tramos visibles de la barra),
     así el avance se lee como hitos, no como un crawl infinito.
   · Cada fase tiene contadores reales que suben (página, spans, entidades, relaciones),
     para que el avance "se sienta trabajado".
   · Un ticker de actividad rota cada ~1.4 s — el componente "respira" durante la espera.
   · El ETA refresca con calma (cada ~2.5 s), no como un cronómetro nervioso.
   · Aviso visible (toast) al completar cada documento y al completar el lote.
   Simulación determinista: todo el estado es función de `t` (segundos simulados). */

/* ── Fases internas → tramos de la barra (peso = ancho del tramo) ───────────── */
const ING_PHASES = [
  { key: "descarga",   label: "Descarga",          w: 6  },
  { key: "conversion", label: "Conversión",        w: 16 },
  { key: "extraccion", label: "Extracción",        w: 38 },
  { key: "grafo",      label: "Escritura a grafo", w: 28 },
  { key: "dedup",      label: "Deduplicación",     w: 12 },
];
const PH_BASE = { descarga: 9, conversion: 52, extraccion: 150, grafo: 92, dedup: 38 }; // s @ factor 1
const PH_TOTAL = Object.values(PH_BASE).reduce((a, b) => a + b, 0);
const cumW = (i) => ING_PHASES.slice(0, i).reduce((a, p) => a + p.w, 0);

/* ── El lote (hasta 10 docs; aquí 6 — incluye el doc largo OCR y uno con error) ── */
const ING_DOCS = [
  { name: "Bitácora calibración Q1.xlsx",            kind: "xlsx", icon: "file-spreadsheet", mb: 2.1,  pages: 18,  factor: 0.30, pool: ["balanza AB204", "incertidumbre", "patrón de masa", "deriva", "trazabilidad"] },
  { name: "Manual prensa hidráulica (escaneo).pdf",  kind: "pdf · OCR", icon: "file-scan",   mb: 28.4, pages: 142, factor: 1.78, ocr: true, pool: ["cilindro", "presión de cierre", "válvula de alivio", "perno B", "par de apriete", "final de carrera"] },
  { name: "Procedimiento de limpieza CIP.pdf",       kind: "pdf",  icon: "file-text",        mb: 8.1,  pages: 60,  factor: 1.05, pool: ["filtro CIP", "ciclo de enjuague", "soda cáustica", "conductividad", "temperatura"] },
  { name: "MSDS refrigerante sintético v3.pdf",      kind: "pdf",  icon: "file-text",        mb: 3.4,  pages: 22,  factor: 0.52, pool: ["refrigerante", "pictograma GHS", "punto de inflamación", "EPP", "ventilación"] },
  { name: "Anexo IATF — registros de control.docx",  kind: "docx", icon: "file-text",        mb: 1.9,  pages: 34,  factor: 0.46, pool: ["plan de control", "característica especial", "Cpk", "AMEF", "registro"] },
  { name: "Plano P&ID rev.B (escaneo).png",          kind: "png · OCR", icon: "file-scan",   mb: 11.2, pages: 1,   factor: 0.42, ocr: true, fail: 0.58, failMsg: "OCR ilegible — resolución del escaneo demasiado baja", pool: ["lazo de control", "transmisor", "válvula", "P&ID"] },
];
ING_DOCS.forEach((d) => {
  d.spansF = Math.round(d.pages * 2.6 + 4);
  d.entsF  = Math.round(d.pages * 1.8 + 3);
  d.relsF  = Math.round(d.entsF * 2.6);
  d.dupsF  = Math.max(2, Math.round(d.entsF * 0.10));
  d.phaseDur = (k) => PH_BASE[k] * d.factor;
  d.active = d.fail
    ? d.phaseDur("descarga") + d.phaseDur("conversion") * d.fail   // se detiene a mitad de conversión
    : PH_TOTAL * d.factor;
});
const ING_STARTS = [];
ING_DOCS.reduce((acc, d, i) => { ING_STARTS[i] = acc; return acc + d.active; }, 0);
const ING_TOTAL = ING_STARTS[ING_DOCS.length - 1] + ING_DOCS[ING_DOCS.length - 1].active;

/* estado puro de un doc en el instante t (segundos simulados) */
function ingState(i, t) {
  const d = ING_DOCS[i];
  const start = ING_STARTS[i], end = start + d.active;
  if (t < start) return { status: "encolado" };
  if (t >= end)  return d.fail ? { status: "error", pct: cumW(1) + ING_PHASES[1].w * d.fail } : { status: "completado", pct: 100 };
  // procesando
  let local = t - start, pi = 0, pf = 0, acc = 0;
  for (let k = 0; k < ING_PHASES.length; k++) {
    const dur = d.phaseDur(ING_PHASES[k].key);
    if (local < acc + dur) { pi = k; pf = dur ? (local - acc) / dur : 0; break; }
    acc += dur;
  }
  const key = ING_PHASES[pi].key;
  const pct = cumW(pi) + ING_PHASES[pi].w * pf;
  const reached = (ph) => pi > ph ? 1 : pi === ph ? pf : 0;
  const counters = {
    mb: (d.mb * (key === "descarga" ? pf : 1)).toFixed(1),
    page: Math.max(1, Math.round(d.pages * (key === "conversion" || key === "extraccion" ? pf : pi > 2 ? 1 : 0)) || (pi > 2 ? d.pages : 1)),
    span: Math.round(d.spansF * reached(2)),
    ents: Math.round(d.entsF * Math.max(reached(2), pi >= 3 ? 1 : 0)),
    rel: Math.round(d.relsF * reached(3)),
    merged: Math.round(d.dupsF * reached(4)),
  };
  return { status: key === "descarga" ? "cargando" : "procesando", pi, pf, pct, key, counters, remain: end - t };
}

/* ── formato ───────────────────────────────────────────────────────────────── */
function fmtEta(s) {
  if (s <= 0.5) return "—";
  if (s < 12) return "unos segundos";
  if (s < 75) return "menos de 1 min";
  return "~" + Math.round(s / 60) + " min";
}
function fmtClock(s) {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/* ── ticker de actividad (el componente "respira") ─────────────────────────── */
function ingTicker(d, st, blip) {
  if (!st.counters) return "";
  const c = st.counters, p = d.pool;
  const e1 = p[blip % p.length], e2 = p[(blip + 1) % p.length];
  switch (st.key) {
    case "descarga":   return ["Recibiendo archivo…", "Verificando integridad SHA-256", "Cifrando en reposo"][blip % 3];
    case "conversion": return d.ocr ? `OCR sobre escaneo · página ${c.page} / ${d.pages}`
      : [`Normalizando layout · pág ${c.page} / ${d.pages}`, "Detectando tablas y encabezados", `Segmentando spans · pág ${c.page}`][blip % 3];
    case "extraccion": return [`Span §${c.span} extraído`, `Entidad «${e1}» identificada`, `Cita vinculada a fuente · pág ${c.page}`, `Clasificando intención · «${e2}»`][blip % 4];
    case "grafo":      return [`Nodo «${e1}» escrito al grafo`, `Relación ${e1} → ${e2}`, `${c.rel} relaciones en el grafo`, "Indexando embeddings BGE-M3"][blip % 4];
    case "dedup":      return [`Fusionando duplicado «${e1}»`, `${c.merged} / ${c.ents} entidades canónicas`, "Resolviendo alias y versiones", "Consolidando documentos vivos"][blip % 4];
    default: return "";
  }
}
function ingDetail(d, st) {
  const c = st.counters; if (!c) return "";
  switch (st.key) {
    case "descarga":   return `${c.mb} / ${d.mb.toFixed(1)} MB`;
    case "conversion": return `Página ${c.page} / ${d.pages}${d.ocr ? " · OCR" : ""}`;
    case "extraccion": return `Página ${c.page} / ${d.pages} · ${c.span} spans · ${c.ents} entidades`;
    case "grafo":      return `${c.ents} entidades · ${c.rel} / ${d.relsF} relaciones escritas`;
    case "dedup":      return `${c.merged} / ${d.dupsF} duplicados fusionados`;
    default: return "";
  }
}

/* ── barra de fases (tramos visibles) ──────────────────────────────────────── */
function PhaseBar({ st }) {
  return (
    <div className="iphases">
      {ING_PHASES.map((p, idx) => {
        const fill = idx < st.pi ? 1 : idx === st.pi ? st.pf : 0;
        const state = idx < st.pi ? "done" : idx === st.pi ? "active" : "pending";
        return (
          <div className="iph" key={p.key} style={{ flexGrow: p.w }} data-st={state}>
            <div className="iph-track"><i style={{ width: fill * 100 + "%" }} /></div>
            <div className="iph-lab">{state === "done" && <Icon name="check" size={10} />}{p.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── tarjeta de documento (expandida si está procesando) ───────────────────── */
function DocRow({ i, t, blip, pos }) {
  const d = ING_DOCS[i];
  const st = ingState(i, t);

  if (st.status === "encolado")
    return (
      <div className="idoc q">
        <span className="idoc-ic"><Icon name={d.icon} size={17} /></span>
        <div className="idoc-main"><div className="idoc-name">{d.name}</div><div className="idoc-sub mono">{d.kind} · {d.mb.toFixed(1)} MB · {d.pages} {d.pages === 1 ? "pág" : "págs"}</div></div>
        <span className="idoc-status enc"><Icon name="clock" size={12} />En cola · posición {pos}</span>
      </div>
    );

  if (st.status === "completado")
    return (
      <div className="idoc done">
        <span className="idoc-ic ok"><Icon name="check" size={16} /></span>
        <div className="idoc-main">
          <div className="idoc-name">{d.name}</div>
          <div className="idoc-sub ok"><Icon name="circle-check-big" size={12} />Completado · disponible para consulta</div>
        </div>
        <button className="link-btn">Consultar →</button>
      </div>
    );

  if (st.status === "error")
    return (
      <div className="idoc err">
        <span className="idoc-ic bad"><Icon name="alert-triangle" size={15} /></span>
        <div className="idoc-main">
          <div className="idoc-name">{d.name}</div>
          <div className="idoc-sub bad"><Icon name="x-circle" size={12} />Error · {d.failMsg}</div>
        </div>
        <div className="idoc-acts"><button className="mini-btn"><Icon name="rotate-ccw" size={13} />Reintentar</button><button className="link-btn">Omitir</button></div>
      </div>
    );

  /* procesando / cargando — tarjeta expandida */
  return (
    <div className="idoc live">
      <div className="idoc-top">
        <span className="idoc-ic live"><Icon name={d.icon} size={17} /></span>
        <div className="idoc-main">
          <div className="idoc-name">{d.name}</div>
          <div className="idoc-sub mono">{d.kind} · {d.mb.toFixed(1)} MB · {d.pages} {d.pages === 1 ? "pág" : "págs"}</div>
        </div>
        <span className={"idoc-status " + (st.status === "cargando" ? "load" : "proc")}>
          <span className="pdot" />{st.status === "cargando" ? "Cargando" : "Procesando"}
        </span>
        <span className="idoc-pct mono">{Math.round(st.pct)}%</span>
      </div>

      <PhaseBar st={st} />

      <div className="idoc-foot">
        <span className="idoc-detail mono">{ingDetail(d, st)}</span>
        <span className="idoc-eta mono">queda {fmtClock(st.remain)}</span>
      </div>
      <div className="idoc-tick"><span className="tk-dot" /><span key={blip + st.key} className="tk-txt">{ingTicker(d, st, blip)}</span></div>
    </div>
  );
}

/* ── componente principal ──────────────────────────────────────────────────── */
function IngestBatch({ onExit }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(10);
  const [blip, setBlip] = useState(0);
  const [etaTick, setEtaTick] = useState(0);
  const [toasts, setToasts] = useState([]);

  const tRef = useRef(0), lastRef = useRef(0);
  const prevRef = useRef(ING_DOCS.map(() => "encolado"));
  const batchRef = useRef(false);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* motor de simulación — setInterval con delta de tiempo real (robusto a throttling
     en segundo plano: si el intervalo se atrasa, el dt grande recupera el avance) */
  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastRef.current) / 1000; lastRef.current = now;
      tRef.current = Math.min(tRef.current + dt * speed, ING_TOTAL);
      setT(tRef.current);
      if (tRef.current >= ING_TOTAL) setPlaying(false);
    }, 80);
    return () => clearInterval(id);
  }, [playing, speed]);

  /* cadencias tranquilas: ticker 1.4 s, eta 2.5 s */
  useEffect(() => {
    const a = setInterval(() => setBlip((b) => b + 1), 1400);
    const b = setInterval(() => setEtaTick((x) => x + 1), 2500);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  /* avisos visibles: transición a completado / error, y fin de lote */
  const pushToast = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { ...toast, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
  }, []);
  useEffect(() => {
    ING_DOCS.forEach((d, i) => {
      const s = ingState(i, t).status, prev = prevRef.current[i];
      if (prev !== s && (s === "completado" || s === "error")) pushToast({ type: s, name: d.name });
      prevRef.current[i] = s;
    });
    if (t >= ING_TOTAL && !batchRef.current) { batchRef.current = true; pushToast({ type: "batch" }); }
  }, [t, pushToast]);

  /* derivados del lote */
  const done = ING_DOCS.filter((_, i) => ingState(i, t).status === "completado").length;
  const failed = ING_DOCS.filter((_, i) => ingState(i, t).status === "error").length;
  const procIdx = ING_DOCS.findIndex((_, i) => { const s = ingState(i, t).status; return s === "procesando" || s === "cargando"; });
  const queued = ING_DOCS.filter((_, i) => ingState(i, t).status === "encolado").length;
  const batchPct = Math.min(100, (t / ING_TOTAL) * 100);
  const remain = ING_TOTAL - tRef.current;
  const finished = t >= ING_TOTAL;
  void etaTick; // el ETA se relee de tRef en cada tick (cadencia 2.5 s)

  const restart = () => { tRef.current = 0; lastRef.current = performance.now(); batchRef.current = false; prevRef.current = ING_DOCS.map(() => "encolado"); setToasts([]); setT(0); setPlaying(true); };

  return (
    <div className={"ingest-batch" + (reduce ? " reduce" : "")}>
      {/* ── encabezado del lote / banner de fin ── */}
      {!finished ? (
        <div className="batch-head">
          <div className="bh-row">
            <div className="bh-title">
              <span className="bh-spin"><Icon name="loader" size={16} /></span>
              <div className="bh-tt">
                <div className="bh-h">Procesando lote — {ING_DOCS.length} documentos</div>
                <div className="bh-sub">{procIdx >= 0 ? <>Procesando <b>{ING_DOCS[procIdx].name}</b></> : "Preparando…"}</div>
              </div>
            </div>
            <div className="bh-eta">
              <div className="bh-eta-big">{fmtEta(remain)}</div>
              <div className="bh-eta-sm mono">restantes · {fmtClock(remain)}</div>
            </div>
          </div>
          <div className="batch-bar"><i style={{ width: batchPct + "%" }} /></div>
          <div className="bh-meta">
            <span className="bh-pct mono">{Math.round(batchPct)}% del lote</span>
            <span className="bh-counts">
              <span className="bc ok"><span className="bc-dot" />{done} completados</span>
              <span className="bc proc"><span className="bc-dot" />{procIdx >= 0 ? 1 : 0} procesando</span>
              <span className="bc enc"><span className="bc-dot" />{queued} en cola</span>
              {failed > 0 && <span className="bc bad"><span className="bc-dot" />{failed} con error</span>}
            </span>
          </div>
        </div>
      ) : (
        <div className="batch-done">
          <div className="bd-ic"><Icon name="check-check" size={22} /></div>
          <div className="bd-main">
            <div className="bd-h">Lote completado</div>
            <div className="bd-sub">{done} documentos vivos y disponibles para consulta{failed > 0 && <> · <b className="bd-err">{failed} con error</b></>}. La cadena SHA-256 quedó sellada.</div>
          </div>
          <div className="bd-acts">
            <button className="mini-btn" onClick={onExit}><Icon name="history" size={14} />Ver historial</button>
            <button className="primary-btn" onClick={onExit}><Icon name="plus" size={15} />Nueva ingesta</button>
          </div>
        </div>
      )}

      {/* ── controles de simulación (andamiaje de demo) ── */}
      <div className="sim-bar">
        <span className="sim-lab mono">Demo · simulación</span>
        <button className="sim-btn" onClick={() => setPlaying((p) => !p)} disabled={finished}>
          <Icon name={playing ? "pause" : "play"} size={13} />{playing ? "Pausar" : "Reanudar"}
        </button>
        <div className="sim-seg">
          {[[1, "1×"], [10, "10×"], [60, "60×"]].map(([v, l]) => (
            <button key={v} className={speed === v ? "on" : ""} onClick={() => setSpeed(v)} title={v === 1 ? "tiempo real" : v + " veces más rápido"}>{l}</button>
          ))}
        </div>
        <button className="sim-btn" onClick={restart}><Icon name="rotate-ccw" size={13} />Reiniciar</button>
        <button className="link-btn" style={{ marginLeft: "auto" }} onClick={onExit}>Cancelar lote</button>
      </div>

      {/* ── lista de documentos (procesando expandido, resto compacto) ── */}
      <div className="idoc-list">
        {ING_DOCS.map((_, i) => <DocRow key={i} i={i} t={t} blip={blip} pos={procIdx >= 0 ? i - procIdx : i + 1} />)}
      </div>

      {/* ── avisos (toasts) ── */}
      <div className="ing-toasts">
        {toasts.map((to) => (
          <div className={"ing-toast " + to.type} key={to.id}>
            <Icon name={to.type === "error" ? "alert-triangle" : to.type === "batch" ? "check-check" : "circle-check-big"} size={16} />
            <div>
              <div className="it-h">{to.type === "error" ? "Documento con error" : to.type === "batch" ? "Lote completado" : "Documento disponible"}</div>
              <div className="it-m">{to.type === "batch" ? "Todos los documentos del lote fueron procesados." : to.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { IngestBatch, ING_DOCS, ING_PHASES });
