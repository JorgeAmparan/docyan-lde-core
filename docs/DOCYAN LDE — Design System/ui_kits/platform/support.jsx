/* DOCYAN — Consola del fundador. Soporte:
   bandeja unificada cross-org con contexto (org, usuario, pantalla de origen) + responder. */

const SUP_STATE = {
  abierto:    { tone: "warn",   label: "Abierto" },
  respondido: { tone: "info",   label: "Respondido" },
  cerrado:    { tone: "ok",     label: "Cerrado" },
};
const SUP_PRIO = { alta: "danger", media: "warn", baja: "muted" };

function SupportView() {
  const [threads, setThreads] = useState(SUPPORT);
  const [sel, setSel] = useState(SUPPORT[0].id);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("todos");

  const visible = threads.filter((t) => filter === "todos" || (filter === "abiertos" ? t.estado === "abierto" : t.estado !== "abierto"));
  const active = threads.find((t) => t.id === sel) || visible[0];

  function send() {
    if (!draft.trim()) return;
    setThreads(threads.map((t) => t.id === active.id
      ? { ...t, estado: "respondido", ultima: "ahora", hilo: [...t.hilo, { from: "soporte", t: draft.trim(), at: "Hoy · ahora" }] }
      : t));
    setDraft("");
  }

  const abiertos = threads.filter((t) => t.estado === "abierto").length;

  return (
    <div className="pwrap" style={{ maxWidth: "none" }}>
      <div className="psec"><h2>Soporte</h2><span className="scount mono">{abiertos} abiertos · {threads.length} hilos</span></div>

      <div className="filters" style={{ marginBottom: 14 }}>
        {[["todos", "Todos"], ["abiertos", "Abiertos"], ["resueltos", "Resueltos"]].map(([k, l]) => (
          <button key={k} className={"fpill" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="support-grid">
        <div className="sup-list">
          {visible.map((t) => {
            const s = SUP_STATE[t.estado];
            return (
              <div key={t.id} className={"sup-item" + (active && active.id === t.id ? " on" : "")} onClick={() => setSel(t.id)}>
                <div className="si-top">
                  <span className={"prio-dot t-" + SUP_PRIO[t.prioridad]} title={"Prioridad " + t.prioridad} />
                  <span className="si-org">{t.org}</span>
                  <span className="si-time">{t.ultima}</span>
                </div>
                <div className="si-subj">{t.asunto}</div>
                <div className="si-foot">
                  <span className="sup-ctx-pill">{t.pantalla}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="si-id">{t.id}</span>
                </div>
              </div>
            );
          })}
        </div>

        {active && (
          <div className="sup-thread">
            <div className="st-head">
              <div className="sth-org">{active.org}</div>
              <div className="sth-subj">{active.asunto}</div>
              <div className="st-ctx">
                <div className="ctx"><span className="cl">Usuario</span><span className="cv">{active.user}</span></div>
                <div className="ctx"><span className="cl">Pantalla de origen</span><span className="cv">{active.pantalla}</span></div>
                <div className="ctx"><span className="cl">Prioridad</span><span className="cv"><Badge tone={SUP_PRIO[active.prioridad]}>{active.prioridad}</Badge></span></div>
                <div className="ctx"><span className="cl">Estado</span><span className="cv"><Badge tone={SUP_STATE[active.estado].tone}>{SUP_STATE[active.estado].label}</Badge></span></div>
              </div>
            </div>
            <div className="st-body">
              {active.hilo.map((m, i) => (
                <div className={"msg " + m.from} key={i}>
                  <div className="mb">{m.t}</div>
                  <div className="mt">{m.from === "soporte" ? "DOCYAN soporte" : active.user.split(" · ")[0]} · {m.at}</div>
                </div>
              ))}
            </div>
            <div className="st-reply">
              <textarea placeholder="Responder al hilo…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
              <button className="btn primary" onClick={send} disabled={!draft.trim()}><Icon name="send-horizontal" size={15} />Enviar</button>
            </div>
          </div>
        )}
      </div>

      <div className="privacy" style={{ marginTop: 14 }}>
        <Icon name="shield" size={14} />
        El contexto del hilo es metadata (org, usuario, pantalla de origen). DOCYAN nunca adjunta el contenido del documento ni de la consulta que originó el reporte.
      </div>
    </div>
  );
}

Object.assign(window, { SupportView });
