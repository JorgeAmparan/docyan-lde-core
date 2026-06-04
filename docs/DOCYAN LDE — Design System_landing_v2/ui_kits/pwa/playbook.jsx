/* DOCYAN PWA kit — saved consultas, Playbook run, and the cited-source overlay. */

function SavedSheet({ items, onClose }) {
  const [mode, setMode] = useState("list"); // list | run
  const isPlaybook = items.length >= 2;

  return (
    <div className="sheet">
      <div className="sheet-head">
        {mode === "run"
          ? <button className="x" onClick={() => setMode("list")}><Icon name="arrow-left" size={18} /></button>
          : <Icon name="bookmark" size={18} color="var(--cinnabar-600)" />}
        <h2>{mode === "run" ? "Playbook · Arranque de centrífuga" : (isPlaybook ? "Tus consultas" : "Mis consultas guardadas")}</h2>
        <button className="x" onClick={onClose}><Icon name="x" size={18} /></button>
      </div>

      {mode === "list" && (
        <div className="sheet-body">
          {items.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "40px 20px" }}>
              <Icon name="bookmark" size={28} color="var(--stone-400)" />
              <p style={{ fontSize: 14, marginTop: 10 }}>Aún no guardas consultas.<br />Guarda una respuesta útil para volver a ella.</p>
            </div>
          )}
          {items.map((it, i) => (
            <div className="saved-item" key={it.id}>
              {isPlaybook ? <span className="num">{i + 1}</span> : <span className="grip"><Icon name="grip-vertical" size={16} /></span>}
              <div style={{ minWidth: 0 }}>
                <div className="si-t">{it.title}</div>
                <div className="si-m">CODO-LAB-04 · guardada hoy</div>
              </div>
            </div>
          ))}
          {isPlaybook && (
            <div className="nudge" style={{ marginTop: 4 }}>
              <div className="nh"><Icon name="git-branch" size={17} />Secuencia detectada</div>
              <p>Estas consultas tocan el mismo equipo. Únelas en un <strong>Playbook</strong> reutilizable para tu rutina de arranque.</p>
              <button className="sug" style={{ background: "var(--cinnabar-500)", color: "#fff", border: "none", justifyContent: "center", fontWeight: 600 }} onClick={() => setMode("run")}>
                <Icon name="play" size={15} />Ejecutar como Playbook
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "run" && (
        <div className="sheet-body">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)", margin: "0 0 4px" }}>
            La página se compone en tiempo real, paso a paso.
          </p>
          {items.map((it, i) => (
            <div className="acard" key={it.id} style={{ animation: `slideup ${260 + i * 120}ms var(--ease-out)` }}>
              <div className="q"><span className="num" style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}>{i + 1}</span>{it.title}</div>
              <p style={{ marginTop: 8, color: "var(--fg)" }}>Respuesta consolidada con su cita a fuente.</p>
              <div className="acard-foot"><span className="cite"><span className="brk" />Manual VF-2 · §{i + 2}.1 ↗</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceOverlay({ onClose }) {
  return (
    <div className="sheet" style={{ background: "var(--surface)" }}>
      <div className="sheet-head">
        <button className="x" onClick={onClose}><Icon name="arrow-left" size={18} /></button>
        <div>
          <h2 style={{ fontSize: 15 }}>Manual CNC Haas VF-2</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-fg)" }}>§4.2.1 · Apriete de cabezal</div>
        </div>
      </div>
      <div className="sheet-body" style={{ gap: 14 }}>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)" }}>
          4.2 — Montaje del cabezal. Antes de aplicar par, verifica que las superficies de contacto estén limpias y libres de rebabas.
        </p>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>
          4.2.1 — <mark style={{ background: "var(--cinnabar-100)", borderBottom: "2px solid var(--cinnabar-500)", padding: "1px 2px", color: "var(--ink-900)" }}>El par de apriete del perno B es 85&nbsp;N·m, aplicado en cruz en tres etapas progresivas (40 → 65 → 85 N·m).</mark> Repite la secuencia una segunda vez para asegurar el asentamiento.
        </p>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)" }}>
          4.2.2 — Tras el apriete final, registra el valor en la bitácora de mantenimiento del equipo.
        </p>
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>
          <Icon name="git-branch" size={14} />Referenciado por 3 consultas en este CoDo
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SavedSheet, SourceOverlay });
