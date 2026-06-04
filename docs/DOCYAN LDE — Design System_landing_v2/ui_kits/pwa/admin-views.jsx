/* DOCYAN PWA kit — admin sub-views: CoDos, Alertas, Ingesta, Gobernanza/FAT, QRs, Usuarios. */

/* ── shared: faux QR plate (brand object) ──────────────────── */
function qrCells(seed) {
  const n = 21, on = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (fx, fy) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
    const isFinder = finder(0, 0) || finder(n - 7, 0) || finder(0, n - 7);
    if (isFinder) {
      const lx = x % (x < 7 ? 1 : 1); // placeholder
      const rx = x >= n - 7 ? x - (n - 7) : x, ry = y >= n - 7 ? y - (n - 7) : y;
      const cx = x < 7 ? x : rx, cy = y < 7 ? y : ry;
      const ring = cx === 0 || cx === 6 || cy === 0 || cy === 6;
      const core = cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4;
      on.push(ring || core);
    } else {
      on.push(((x * 73 + y * 151 + seed * 31 + x * y) % 7) < 3);
    }
  }
  return on;
}
function QRPlate({ size = 168, seed = 4, label = "CODO-LAB-04" }) {
  const cells = qrCells(seed);
  return (
    <div className="qr-plate" style={{ width: size + 40 }}>
      <div className="qr-frame" style={{ width: size, height: size }}>
        <span className="qb tl" /><span className="qb tr" /><span className="qb bl" /><span className="qb br" />
        <div className="qr-grid" style={{ width: size - 26, height: size - 26 }}>
          {cells.map((c, i) => <span key={i} className={c ? "m on" : "m"} />)}
        </div>
        <div className="qr-logo"><Mark size={Math.round(size * 0.16)} /></div>
      </div>
      <div className="qr-cap">{label}</div>
    </div>
  );
}

/* ── 5.5 · CoDos: expediente esquemático focal (objeto cognitivo) + nav granular + anotaciones + config ──
   Diseñado para flow del usuario experto: meta clara siempre visible, feedback
   instantáneo al seleccionar, densidad controlada por el usuario, cero push. */
const CODO_TREE = [
  ["folder", "Manuales de equipo", 0, [
    ["file-text", "Manual CNC Haas VF-2", 1, "vivo"],
    ["file-text", "Hettich Rotina 380 — manual", 1, "vivo"],
  ]],
  ["folder", "Seguridad & MSDS", 0, [
    ["file-text", "MSDS refrigerante sintético", 1, "vivo"],
    ["file-text", "NOM-018-STPS — pictogramas", 1, "vivo"],
  ]],
  ["folder", "Calibración", 0, [
    ["file-clock", "Histórico de calibración 2025", 1, "vivo"],
    ["file-x", "Certificado CAL-21 (vencido)", 1, "exp"],
  ]],
];

const ENTITY = {
  id: "CODO-LAB-04", name: "Centrífuga Hettich Rotina 380",
  facts: [["clock-alert", "Calibración vence en 4 días", "warn"], ["files", "12 documentos vivos", "ok"], ["bell", "2 alertas", "warn"]],
};
const CLUSTERS = {
  top: { key: "docs", label: "Documentos", icon: "file-text", items: [["Manual VF-2", "§4.2.1"], ["Hettich — manual", "cap. 3"], ["MSDS refrigerante", "v3"], ["NOM-018-STPS", "pictogramas"]] },
  left: { key: "proc", label: "Procedimientos", icon: "list-checks", items: [["Cambio de filtro", "§7.3"], ["Arranque de turno", "rutina"], ["Limpieza CIP", "§2.1"]] },
  right: { key: "cal", label: "Calibración", icon: "ruler", items: [["Cert. CAL-22-117", "vence 4d", "warn"], ["Histórico 2025", "12 registros"]] },
  bottom: { key: "alert", label: "Alertas", icon: "bell", items: [["Calibración por vencer", "≤ 7 días", "warn"], ["Cert. CAL-21 vencido", "vencido", "warn"]] },
};

function Cluster({ pos, dense, sel, onPick }) {
  const c = CLUSTERS[pos];
  return (
    <div className={"cluster " + pos}>
      <div className="cl-head"><span className="cl-ic"><Icon name={c.icon} size={14} /></span>{c.label}<span className="cl-n">{c.items.length}</span></div>
      {dense && (
        <div className="cl-items">
          {c.items.map((it, i) => {
            const id = c.key + i, on = sel === id;
            return <button key={i} className={"snode" + (on ? " on" : "") + (it[2] === "warn" ? " warn" : "")} onClick={() => onPick({ id, label: it[0], meta: it[1], cluster: c.label, sev: it[2] })}>{it[0]}<span className="sn-m">{it[1]}</span></button>;
          })}
        </div>
      )}
    </div>
  );
}

function Schematic({ dense, setDense, sel, setSel }) {
  return (
    <>
      <div className="sch-controls">
        <span className="sch-hint mono">Esquema de la entidad · toca un nodo para ver su detalle</span>
        <div className="seg sm">
          <button className={dense ? "" : "on"} onClick={() => setDense(false)}>Compacto</button>
          <button className={dense ? "on" : ""} onClick={() => setDense(true)}>Detallado</button>
        </div>
      </div>
      <div className="schematic">
        <Cluster pos="top" dense={dense} sel={sel && sel.id} onPick={setSel} />
        <Cluster pos="left" dense={dense} sel={sel && sel.id} onPick={setSel} />
        <button className={"hub" + (!sel ? " on" : "")} onClick={() => setSel(null)}>
          <span className="hub-ic"><Icon name="disc-3" size={22} /></span>
          <span className="hub-id mono">{ENTITY.id}</span>
          <span className="hub-name">Centrífuga Hettich</span>
        </button>
        <Cluster pos="right" dense={dense} sel={sel && sel.id} onPick={setSel} />
        <Cluster pos="bottom" dense={dense} sel={sel && sel.id} onPick={setSel} />
      </div>
      <div className="focal">
        {!sel ? (
          <>
            <div className="fc-lab mono">Estás revisando</div>
            <div className="fc-name">{ENTITY.name}</div>
            <div className="fc-facts">{ENTITY.facts.map(([ic, t, sev], i) => <span key={i} className={"fc-fact " + sev}><Icon name={ic} size={13} />{t}</span>)}</div>
          </>
        ) : (
          <>
            <div className="fc-lab mono">{sel.cluster} {sel.sev === "warn" && "· requiere atención"}</div>
            <div className="fc-name">{sel.label}</div>
            <div className="fc-row"><span className="cite" style={{ marginTop: 0 }}><span className="brk" />{sel.meta} ↗</span><button className="mini-btn"><Icon name="external-link" size={13} />Abrir</button></div>
          </>
        )}
      </div>
    </>
  );
}

function CodosView() {
  const [mode, setMode] = useState("esquema"); // esquema | documentos
  const [dense, setDense] = useState(true);
  const [sel, setSel] = useState(null);
  const [selDoc, setSelDoc] = useState("Manual CNC Haas VF-2");

  return (
    <>
      {/* meta clara — siempre visible (flow: goal) */}
      <div className="goal-strip">
        <span className="gs-ic"><Icon name="disc-3" size={18} /></span>
        <div className="gs-t"><span className="gs-codo mono">{ENTITY.id}</span><span className="gs-name">{ENTITY.name}</span></div>
        <span className="gs-fact warn"><Icon name="clock-alert" size={13} />Calibración vence en 4 días</span>
        <span className="gs-fact"><Icon name="files" size={13} />12 docs vivos</span>
        <div className="seg sm" style={{ marginLeft: "auto" }}>
          <button className={mode === "esquema" ? "on" : ""} onClick={() => setMode("esquema")}><Icon name="git-fork" size={13} />Esquema</button>
          <button className={mode === "documentos" ? "on" : ""} onClick={() => setMode("documentos")}><Icon name="folder-tree" size={13} />Documentos</button>
        </div>
      </div>

      {mode === "esquema" ? (
        <div className="panel sch-panel">
          <Schematic dense={dense} setDense={setDense} sel={sel} setSel={setSel} />
        </div>
      ) : (
        <>
          <div className="search-big">
            <Icon name="search" size={17} />
            <input placeholder="Busca en todos los documentos de este CoDo…" defaultValue="par de apriete perno B" />
            <span className="hits">3 coincidencias</span>
          </div>
          <div className="codo-detail" style={{ marginTop: 16 }}>
            <div className="panel tree-panel">
              <div className="cd-head"><div><div className="cid">CODO-LAB-04</div><div className="cn">Centrífugas & rotores</div></div><Icon name="chevrons-up-down" size={15} color="var(--fg-subtle)" /></div>
              <div className="tree">
                {CODO_TREE.map(([fic, fname, , kids], i) => (
                  <div key={i}>
                    <div className="tnode folder"><Icon name="chevron-down" size={13} /><Icon name={fic} size={15} />{fname}</div>
                    {kids.map(([ic, name, , st], j) => (
                      <div key={j} className={"tnode doc" + (selDoc === name ? " on" : "")} onClick={() => setSelDoc(name)}>
                        <Icon name={ic} size={15} />{name}
                        <span className={"dstate " + (st === "exp" ? "exp" : "ok")}>{st === "exp" ? "vencido" : "vivo"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="panel doc-panel">
              <div className="cd-head"><div><div className="cid">DOC · §4.2.1</div><div className="cn">{selDoc}</div></div><button className="mini-btn"><Icon name="external-link" size={14} />Abrir</button></div>
              <p className="doc-span"><mark>El par de apriete del perno B es 85&nbsp;N·m</mark>, aplicado en cruz en tres etapas progresivas (40 → 65 → 85&nbsp;N·m).</p>
              <div className="anno-h"><Icon name="message-square" size={15} />Anotaciones <span className="cnt">3</span></div>
              <div className="anno"><div className="aav">AR</div><div><div className="atx">El asiento cónico llega con rebaba de fábrica — limpiar antes de aplicar par.</div><div className="amt">A. Ríos · hace 6 días · <span className="anode">sobre §4.2.1</span></div></div></div>
              <div className="anno"><div className="aav">JM</div><div><div className="atx">Confirmo, mismo lote. Reportado a compras.</div><div className="amt">J. Medina · hace 4 días</div></div></div>
              <div className="anno recurring"><div className="aic"><Icon name="sparkles" size={15} /></div><div><div className="atx"><b>Patrón detectado (Nivel 3):</b> 3 personas anotaron lo mismo sobre este span. DOCYAN lo eleva a observación del CoDo.</div></div></div>
              <button className="add-anno"><Icon name="plus" size={14} />Agregar anotación</button>
            </div>
          </div>

          <div className="sec-h" style={{ marginTop: 22 }}><h2>Configuración del CoDo</h2></div>
          <div className="cfg-grid">
            <div className="cfg"><label>Nombre</label><div className="cfg-v">Centrífugas & rotores</div></div>
            <div className="cfg"><label>Vertical</label><div className="cfg-v">Laboratorio ISO 17025</div></div>
            <div className="cfg"><label>Pares lingüísticos</label><div className="cfg-v">ES-MX · EN-US</div></div>
            <div className="cfg"><label>Umbral de confianza del caché</label><div className="cfg-v mono">0.92 <span className="cfg-note">default DOCYAN</span></div></div>
            <div className="cfg"><label>Criticidad por segmento</label><div className="cfg-v"><span className="badge warn">Seguridad ≥0.95</span> <span className="badge ok">Operacional ≥0.75</span></div></div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Alertas administrativas (admin, dense) ────────────────── */
const ADMIN_ALERTS = [
  ["warn", "Por vencer · ≤ 7 días", "Calibración — Centrífuga Hettich", "CODO-LAB-04", "Vence 07 jun · en 4 días", "CAL-22-117"],
  ["warn", "Por vencer · ≤ 7 días", "Certificado CAL-21 vencido", "CODO-LAB-04", "Venció 28 may", "CAL-21-088"],
  ["caution", "Próximas · ≤ 30 días", "MSDS refrigerante sintético", "CODO-LAB-04", "Expira 25 jun · en 22 días", "MSDS-REF-03"],
  ["caution", "Próximas · ≤ 30 días", "Certificación del colaborador A. Ríos", "Org", "Renueva en 28 días", "CERT-OP-AR"],
];
function AdminAlertsView() {
  const groups = [...new Set(ADMIN_ALERTS.map((a) => a[1]))];
  return (
    <>
      <div className="admin-banner" style={{ marginTop: 0 }}><Icon name="info" size={15} />Recordatorio administrativo — no es una instrucción operativa. DOCYAN no emite decisiones clínicas u operativas.</div>
      {groups.map((g) => (
        <div key={g} style={{ marginTop: 18 }}>
          <div className="ag-lab">{g}</div>
          <div className="panel" style={{ padding: 0 }}>
            {ADMIN_ALERTS.filter((a) => a[1] === g).map((a, i) => (
              <div className={"arow s-" + a[0]} key={i}>
                <span className="aico"><Icon name={a[0] === "warn" ? "alarm-clock" : "clock"} size={16} /></span>
                <div className="ainfo"><div className="at">{a[2]}</div><div className="am"><span className="codo-pill">{a[3]}</span>{a[4]}</div></div>
                <span className="cite" style={{ marginTop: 0 }}><span className="brk" />{a[5]} ↗</span>
                <div className="arow-acts"><button>Marcar leída</button><button>Posponer</button></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ── 5.8 · Ingesta ─────────────────────────────────────────── */
const QUEUE = [
  ["Procedimiento de limpieza CIP.pdf", "procesando", 62, "~3 min"],
  ["Anexo IATF — registros.docx", "encolado", 0, "en cola"],
  ["Bitácora calibración Q1.xlsx", "terminado", 100, "completado"],
  ["Manual prensa (escaneo).pdf", "fallido", 0, "OCR ilegible"],
];
const ING_HIST = [
  ["28 may", "Manual CNC Haas VF-2.pdf", "$42.80", "11 min", "ok"],
  ["24 may", "Lote MSDS (×6)", "$66.10", "23 min", "ok"],
  ["19 may", "Histórico calibración 2024", "$18.30", "6 min", "ok"],
];
function IngestaView() {
  return (
    <>
      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h"><h2>Cotización pre-ingesta</h2></div>
          <div className="dropzone"><Icon name="upload-cloud" size={26} /><div className="dz-t">Arrastra documentos o <b>selecciona</b></div><div className="dz-m">PDF · DOCX · XLSX · imágenes con OCR</div></div>
          <div className="quote">
            <div className="qr2"><span>Costo estimado</span><b className="mono">$58.40 USD</b></div>
            <div className="qr2"><span>Tiempo estimado</span><b className="mono">~14 min</b></div>
            <div className="qr2"><span>Saldo disponible</span><b className="mono ok">$184.00 USD</b></div>
          </div>
          <div className="manual-note"><Icon name="info" size={15} />Cobro manual durante el piloto. <a>Contactar a DOCYAN para recargar saldo →</a></div>
          <button className="primary-btn"><Icon name="play" size={15} />Confirmar e ingerir</button>
        </div>

        <div className="panel">
          <div className="sec-h"><h2>Cola de ingesta</h2></div>
          {QUEUE.map(([name, st, pct, eta], i) => (
            <div className="qitem" key={i}>
              <div className="qi-top"><span className={"q-dot " + st} /><span className="qi-name">{name}</span><span className={"qi-st " + st}>{st}</span></div>
              {st === "procesando" && <div className="bar" style={{ marginTop: 8 }}><i style={{ width: pct + "%" }} /></div>}
              <div className="qi-foot"><span className="mono">{eta}</span>{st === "fallido" && <button className="link-btn">Reintentar</button>}{st === "encolado" && <button className="link-btn">Cancelar</button>}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="two" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="sec-h"><h2>Saldo prepagado</h2><span className="more">Recargar →</span></div>
          <div className="bal-row"><span className="bv">$184</span><span style={{ fontSize: 13, color: "var(--fg-muted)" }}>USD disponibles</span></div>
          <div className="bar"><i style={{ width: "37%" }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 7 }}>Consumido $316 de $500 este ciclo</div>
        </div>
        <div className="panel">
          <div className="sec-h"><h2>Historial</h2></div>
          <table className="mini-tbl">
            <thead><tr><th>Fecha</th><th>Documento</th><th>Costo</th><th>Duración</th></tr></thead>
            <tbody>{ING_HIST.map((r, i) => <tr key={i}><td className="mono">{r[0]}</td><td>{r[1]}</td><td className="mono">{r[2]}</td><td className="mono">{r[3]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── 5.9 · Gobernanza & FAT ────────────────────────────────── */
const GRG = [
  ["Seguridad", 0.95, "warn"], ["Regulatorio", 0.90, "warn"], ["Calidad", 0.85, "caution"], ["Operacional", 0.75, "ok"], ["Informativa", 0.60, "ok"],
];
const FAT = [
  ["09:14:22", "consulta", "Torque perno B respondido", "A. Ríos", "CODO-LAB-04", "ok"],
  ["09:02:10", "gobernanza", "Output bloqueado · confianza 0.71 < 0.95", "sistema", "CODO-LAB-04", "block"],
  ["08:51:03", "alertas", "Alerta de calibración generada", "sistema", "CODO-LAB-04", "ok"],
  ["08:40:55", "onboarding", "Colaborador invitado", "J. Medina", "Org", "ok"],
];
function GobernanzaView() {
  return (
    <>
      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h"><h2>Configuración GRG</h2><span className="badge ok">Tier Profesional</span></div>
          <p className="panel-lead">Umbral de confianza mínimo para emitir respuesta, por criticidad. Editables por organización.</p>
          {GRG.map(([name, th, sev], i) => (
            <div className="grg-row" key={i}>
              <span className={"sev-dot s-" + sev} /><span className="grg-name">{name}</span>
              <div className="grg-bar"><i style={{ width: th * 100 + "%" }} /></div>
              <span className="grg-th mono">≥{th.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="sec-h"><h2>Eventos en cuarentena</h2><span className="badge warn">1</span></div>
          <div className="quar">
            <div className="quar-h"><Icon name="shield-alert" size={16} /><span>Output bloqueado por el GRG</span></div>
            <p className="quar-q">"¿Puedo operar la centrífuga sin la tapa de seguridad?"</p>
            <div className="quar-meta">
              <div><span>Regla</span><b>Seguridad ≥ 0.95</b></div>
              <div><span>Confianza</span><b className="mono">0.71</b></div>
              <div><span>Motivo</span><b>Bajo umbral + tema de seguridad</b></div>
            </div>
            <div className="quar-acts"><button className="link-btn">Ver razonamiento</button><button className="link-btn">Escalar a admin</button></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="sec-h">
          <h2>FAT — bitácora de auditoría</h2>
          <div className="exports">
            {["PDF", "XML", "JSON", "CSV"].map((f) => <button key={f} className="exp-btn">{f}</button>)}
          </div>
        </div>
        <div className="hist-filters" style={{ margin: "0 0 14px" }}>
          {["Todo", "Consulta", "Gobernanza", "Alertas", "Onboarding", "Sistema"].map((l, i) => <button key={i} className={i === 0 ? "on" : ""}>{l}</button>)}
        </div>
        <table className="mini-tbl fat">
          <thead><tr><th>Hora</th><th>Familia</th><th>Evento</th><th>Actor</th><th>Entidad</th><th></th></tr></thead>
          <tbody>
            {FAT.map((r, i) => (
              <tr key={i}>
                <td className="mono">{r[0]}</td><td><span className="fam">{r[1]}</span></td><td>{r[2]}</td><td>{r[3]}</td><td className="mono">{r[4]}</td>
                <td>{r[5] === "block" ? <span className="badge warn">bloqueado</span> : <Icon name="check" size={14} color="var(--success-600)" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="chain" style={{ marginTop: 16 }}>
          <div className="ci2"><Icon name="shield-check" size={18} /></div>
          <div><div className="ct">Cadena criptográfica</div><div className="cm">SHA-256 · íntegra · 8,412 eventos encadenados</div></div>
          <button>Verificar</button>
        </div>
      </div>
    </>
  );
}

/* ── 5.10 · Generar QRs ────────────────────────────────────── */
const QR_BATCH = [
  ["CODO-LAB-04", "Centrífuga Hettich · Rotina 380", 4],
  ["CODO-LAB-04", "CNC Haas VF-2", 7],
  ["CODO-LAB-02", "Balanza analítica AB204", 11],
];
function QRsView() {
  const [sel, setSel] = useState(0);
  return (
    <div className="ing-grid">
      <div className="panel">
        <div className="sec-h"><h2>Nuevo QR persistente</h2></div>
        <p className="panel-lead">El QR es la puerta del colaborador al CoDo. Pégalo físicamente en el equipo, lugar o proceso.</p>
        <div className="field2"><label>CoDo</label><div className="sel-box">CODO-LAB-04 · Centrífugas & rotores<Icon name="chevron-down" size={15} /></div></div>
        <div className="field2"><label>Entidad referenciada</label><div className="sel-box">Centrífuga Hettich Rotina 380<Icon name="chevron-down" size={15} /></div></div>
        <div className="field2"><label>Formato físico</label>
          <div className="seg">{["Etiqueta 5×5cm", "Placa 10×10cm", "Lámina A5"].map((o, i) => <button key={i} className={i === 1 ? "on" : ""}>{o}</button>)}</div>
        </div>
        <div className="qr-acts"><button className="primary-btn"><Icon name="printer" size={15} />Imprimir</button><button className="mini-btn"><Icon name="download" size={14} />PNG / SVG</button></div>
      </div>

      <div className="panel qr-preview-panel">
        <div className="sec-h"><h2>Previsualización</h2></div>
        <QRPlate seed={4} label="CODO-LAB-04 · Hettich Rotina 380" />
        <div className="sec-h" style={{ marginTop: 22 }}><h2>Generados recientemente</h2></div>
        {QR_BATCH.map(([codo, ent, n], i) => (
          <div className={"qr-item" + (sel === i ? " on" : "")} key={i} onClick={() => setSel(i)}>
            <QRPlate size={42} seed={i + 2} label="" />
            <div style={{ minWidth: 0 }}><div className="qi-ent">{ent}</div><div className="qi-codo mono">{codo} · {n} impresos</div></div>
            <Icon name="printer" size={15} color="var(--fg-subtle)" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 5.7.2/3 · Usuarios ────────────────────────────────────── */
const ADMINS = [["JM", "Jorge Medina", "Admin · propietario", "—"], ["RC", "Rosa Cantú", "Admin", "$12 / mes"]];
const OPERATORS = [["AR", "A. Ríos", "ES-MX", true], ["LP", "L. Peña", "ES-MX", true], ["DK", "D. Kim", "EN-US", false]];
function UsuariosView() {
  return (
    <>
      <div className="panel">
        <div className="sec-h"><h2>Admins</h2><button className="mini-btn"><Icon name="plus" size={14} />Invitar admin</button></div>
        <p className="panel-lead">Cada admin adicional suma un costo de seat según el plan. Los colaboradores son ilimitados y sin costo.</p>
        {ADMINS.map(([av, name, role, cost], i) => (
          <div className="urow" key={i}>
            <span className="uav ink">{av}</span>
            <div className="uinfo"><div className="un">{name}</div><div className="ur">{role}</div></div>
            <span className="useat mono">{cost}</span>
            <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="sec-h"><h2>Colaboradores <span className="cnt">21</span></h2><button className="mini-btn"><Icon name="plus" size={14} />Invitar colaborador</button></div>
        {OPERATORS.map(([av, name, lang, ai], i) => (
          <div className="urow" key={i}>
            <span className="uav cin">{av}</span>
            <div className="uinfo"><div className="un">{name}</div><div className="ur">Colaborador · entra por QR</div></div>
            <div className="uprefs">
              <span className="pref mono">{lang}</span>
              <span className={"pref toggle" + (ai ? " on" : "")}><Icon name="sparkles" size={12} />IA proactiva {ai ? "on" : "off"}</span>
            </div>
            <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />
          </div>
        ))}
        <div className="manual-note" style={{ marginTop: 14 }}><Icon name="settings" size={15} />Por usuario: par lingüístico default, variante regional, permiso de IA proactiva y "silenciar sugerencias".</div>
      </div>
    </>
  );
}

Object.assign(window, { CodosView, AdminAlertsView, IngestaView, GobernanzaView, QRsView, UsuariosView, QRPlate });
