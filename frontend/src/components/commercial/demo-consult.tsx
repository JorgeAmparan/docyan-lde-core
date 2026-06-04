"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { VERTICALS, demoDocHref, type DemoVertical, type DemoQA } from "@/lib/demo-data";

/* DOCYAN Landing v2 — full consult flow for the public demo-CoDo explorer:
   multi-turn thread, conditional renderers by intent type, in-app source overlay
   (threads to the exact span) + "Abrir PDF". Ported 1:1 from `demo-flow.jsx`. */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AnswerMsg = DemoQA & { codo: string };

function openDoc(a: AnswerMsg) {
  window.open(demoDocHref(a, a.codo), "_blank", "noopener");
}

function FaCite({ a, codo, onCite }: { a: AnswerMsg; codo: string; onCite: (a: AnswerMsg) => void }) {
  return (
    <div className="da-cite-row">
      <span className="tipwrap" data-tip={`Ver fuente · pág. ${a.page ?? "—"}  ↗`}>
        <button className="cite chip-fn" onClick={() => onCite({ ...a, codo })}>
          <span className="brk" />{a.cite} <span className="ext">↗</span>
        </button>
      </span>
      <button className="openpdf" onClick={() => openDoc(a)}><Icon name="external-link" size={13} />Abrir PDF</button>
    </div>
  );
}

function FaInfo({ a }: { a: DemoQA }) {
  return (
    <div className="fa-info">
      {a.value != null && <div className="fa-big">{a.value}<span className="fa-u">{a.unit}</span></div>}
      <p className="fa-note">{a.note}</p>
    </div>
  );
}
function FaSteps({ a }: { a: DemoQA }) {
  return (
    <>
      <div className="fa-q">{a.title}</div>
      <div className="fa-ppe">{a.ppe?.map(([ic, t], i) => <span className="fa-chip" key={i}><Icon name={ic} size={13} />{t}</span>)}</div>
      <ol className="fa-steps">{a.steps?.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {a.warn && <div className="fa-warn"><Icon name="triangle-alert" size={15} /><div><span className="fa-wlab">{a.warn[0]}</span>{a.warn[1]}</div></div>}
    </>
  );
}
function FaDiagram({ a }: { a: DemoQA }) {
  const [act, setAct] = useState<number | null>(null);
  return (
    <>
      <div className="fa-q">{a.title}</div>
      <div className="fa-diag">
        <span className="ph-tag">DIAGRAMA · DROP IMAGE</span>
        {a.pins?.map(([n, x, y]) => (
          <button key={n} className={"fa-pin" + (act === n ? " on" : "")} style={{ left: x + "%", top: y + "%" }} onClick={() => setAct(act === n ? null : n)} aria-label={`Pin ${n}`}>{n}</button>
        ))}
      </div>
      <ol className="fa-legend">
        {a.pins?.map(([n, , , label]) => (
          <li key={n} className={act === n ? "on" : ""} onClick={() => setAct(act === n ? null : n)}><span className="fa-ln">{n}</span>{label}</li>
        ))}
      </ol>
    </>
  );
}
function FaVideo({ a }: { a: DemoQA }) {
  return (
    <>
      <div className="fa-q">{a.title}</div>
      <div className="fa-vid"><span className="ph-tag">VIDEO · {a.dur} · DROP CLIP</span><button className="fa-play" aria-label="Reproducir"><Icon name="play" size={18} /></button></div>
      <ul className="fa-chapters">{a.chapters?.map(([t, l], i) => <li key={i}><span className="fa-tc">{t}</span>{l}</li>)}</ul>
    </>
  );
}
function FaTrouble({ a }: { a: DemoQA }) {
  const [node, setNode] = useState(-1);
  return (
    <>
      <div className="fa-q">{a.title}</div>
      {node === -1 ? (
        <>
          <p className="fa-ask">{a.ask}</p>
          <div className="fa-opts">{a.options?.map(([label], i) => <button key={i} className="fa-opt" onClick={() => setNode(i)}>{label}<span className="ar">→</span></button>)}</div>
        </>
      ) : (
        <>
          <p className="fa-outcome"><strong>Diagnóstico:</strong> {a.options?.[node][1]}</p>
          <button className="fa-retry" onClick={() => setNode(-1)}><Icon name="rotate-ccw" size={13} />Otra rama</button>
        </>
      )}
    </>
  );
}
function FaHistory({ a }: { a: DemoQA }) {
  return (
    <>
      <div className="fa-q">{a.title}</div>
      <ul className="fa-timeline">{a.events?.map(([d, t], i) => <li key={i}><span className="fa-dot" /><div><span className="fa-td">{d}</span><span className="fa-tt">{t}</span></div></li>)}</ul>
      <div className="fa-pattern"><Icon name="sparkles" size={14} /><span><b>Patrón detectado:</b> {a.pattern}</span></div>
    </>
  );
}
function FaAlerts({ a }: { a: DemoQA }) {
  return (
    <>
      <div className="fa-q">{a.title}</div>
      <div className="fa-admin"><Icon name="info" size={14} />Recordatorio administrativo — no es una instrucción operativa.</div>
      {a.items?.map(([sev, t, m], i) => (
        <div className={"fa-alert s-" + sev} key={i}><div><span className="fa-at">{t}</span><span className="fa-am">{m}</span></div></div>
      ))}
    </>
  );
}
function FaCompare({ a }: { a: DemoQA }) {
  return (
    <>
      <div className="fa-q">{a.title}</div>
      <div className="fa-vers"><span className="fa-ver old">{a.from}</span><Icon name="arrow-right" size={14} /><span className="fa-ver new">{a.to}</span></div>
      <ul className="fa-diff">{a.diff?.map(([k, t], i) => <li className={"d-" + k} key={i}><span className="dm">{k === "add" ? "+" : k === "del" ? "−" : "~"}</span>{t}</li>)}</ul>
      <div className="fa-sum"><span className="fa-sl">Resumen</span>{a.summary}</div>
    </>
  );
}

const FA: Record<string, (props: { a: DemoQA }) => React.JSX.Element> = {
  info: FaInfo, steps: FaSteps, diagram: FaDiagram, video: FaVideo,
  troubleshoot: FaTrouble, history: FaHistory, alerts: FaAlerts, compare: FaCompare,
};

function DemoAnswer({ a, codo, onCite }: { a: AnswerMsg; codo: string; onCite: (a: AnswerMsg) => void }) {
  const R = FA[a.kind] ?? FaInfo;
  return (
    <div className="fa-card">
      <div className="fa-mode"><span className="fa-pulse" />Respuesta con cita · tipo: {a.kind}</div>
      <R a={a} />
      <FaCite a={a} codo={codo} onCite={onCite} />
    </div>
  );
}

function SourceOverlay({ a, onClose }: { a: AnswerMsg; onClose: () => void }) {
  return (
    <div className="src-overlay" onClick={onClose}>
      <div className="src-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="src-head">
          <div style={{ minWidth: 0 }}>
            <div className="src-doc-t">{a.doc || "Documento fuente"}</div>
            <div className="src-cite">{a.cite}</div>
          </div>
          <button className="src-x" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={18} /></button>
        </div>
        <div className="src-body">
          <p>Antes de aplicar cualquier valor, verifica que las superficies de contacto estén limpias y que el equipo se encuentre en estado seguro. Confirma la vigencia de los registros asociados del CoDo.</p>
          <p>En las condiciones definidas para esta entidad operativa, aplica lo siguiente. <mark>{a.span}</mark> Repite la verificación una segunda vez para asegurar el asentamiento y la consistencia del registro.</p>
          <p>Tras completar el procedimiento, registra el valor y la fecha en la bitácora del equipo. La trazabilidad de cada acción queda encadenada criptográficamente en el FAT de DOCYAN.</p>
        </div>
        <div className="src-foot">
          <Icon name="shield-check" size={14} />
          <span>Pedigree a span exacto · cadena SHA-256</span>
          <a onClick={() => openDoc(a)}>Abrir PDF ↗</a>
        </div>
      </div>
    </div>
  );
}

export function DemoConsult({ vkey }: { vkey: string }) {
  const router = useRouter();
  const vert: DemoVertical = VERTICALS.find((v) => v.key === vkey) ?? VERTICALS[0];
  const [msgs, setMsgs] = useState<({ role: "user"; text: string } | { role: "answer"; a: AnswerMsg })[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState<AnswerMsg | null>(null);
  const convoRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    const hit = vert.qa.find((x) => x.q === question);
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    let a: AnswerMsg;
    await delay(540);
    if (hit) {
      a = { ...hit, codo: vert.codo };
    } else {
      const b = vert.qa[0];
      a = { kind: "info", q: question, codo: vert.codo, note: "Respuesta con cita a la fuente exacta del documento de este equipo.", cite: b.cite, doc: b.doc, page: b.page, span: question };
    }
    setMsgs((m) => [...m, { role: "answer", a }]);
    setLoading(false);
  };
  useEffect(() => {
    const c = convoRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [msgs, loading]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) { ask(text.trim()); setText(""); }
  };

  return (
    <div className="demo-page">
      <div className="demo-banner">
        <Icon name="info" size={15} />
        <span>Estás en un <b>CoDo demo</b> de DOCYAN. Para crear el tuyo, agenda una demo o regístrate.</span>
        <div className="db-ctas">
          <button className="btn sec" onClick={() => router.push("/signup")}>Agendar demo</button>
          <button className="btn primary" onClick={() => router.push("/signup")}>Regístrate</button>
        </div>
      </div>
      <div className="dc-wrap">
        <div className="dc-head">
          <button className="dc-back" onClick={() => router.push("/")}><Icon name="arrow-left" size={16} />Volver</button>
          <div className="dc-ctx">
            <span className="dc-ic"><Icon name={vert.icon} size={18} /></span>
            <div>
              <div className="ml">Estás consultando</div>
              <div className="mn">{vert.codo} · {vert.entity}</div>
            </div>
          </div>
          <span className="dc-tag">{vert.docs.length} documentos vivos</span>
        </div>

        <div className="dc-body" ref={convoRef}>
          {msgs.length === 0 && (
            <div className="dc-intro">
              <p>Pregúntale a este CoDo demo. Cada respuesta se renderiza según su tipo — valor, procedimiento, diagrama, diagnóstico… — y llega con su cita. Tócala para ver el span en la fuente.</p>
              <div className="dc-docs">{vert.docs.map((d) => <span className="dc-doc" key={d}><Icon name="file-text" size={13} />{d}</span>)}</div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div className="fa-user" key={i}>{m.text}</div>
            ) : (
              <DemoAnswer key={i} a={m.a} codo={vert.codo} onCite={setSrc} />
            ),
          )}
          {loading && <div className="demo-shimmer dc-load"><span className="sh-dot" />DOCYAN está buscando en el documento…</div>}
        </div>

        <div className="dc-foot">
          <div className="dc-sugs">{vert.qa.map((x) => <button key={x.q} className="demo-sug" onClick={() => ask(x.q)} disabled={loading}>{x.q}</button>)}</div>
          <form className="demo-box dc-box" onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Pregunta sobre ${vert.entity}…`} aria-label="Pregunta" />
            <button type="submit" className="db-send" aria-label="Preguntar" disabled={loading}><Icon name="arrow-up" size={17} /></button>
          </form>
        </div>
      </div>
      {src && <SourceOverlay a={src} onClose={() => setSrc(null)} />}
    </div>
  );
}
