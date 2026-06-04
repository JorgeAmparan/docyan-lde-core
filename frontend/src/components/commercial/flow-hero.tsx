"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { VERTICALS, demoDocHref, type DemoVertical, type DemoQA } from "@/lib/demo-data";

/* DOCYAN Landing v2 — FLOW hero: playable consult demo with a 5-vertical selector
   and a functional citation chip that opens the source doc at the exact span.
   Ported 1:1 from `landing-flow.jsx` (HeroFlow + useConsult + AnswerCard). */

const HERO_TRUST: [string, string][] = [
  ["scan-line", "QR persistente"],
  ["link", "Cita cliqueable"],
  ["globe", "ES · EN nativo"],
  ["zap", "Time-to-value en días"],
  ["shield-check", "Sin alucinaciones por diseño"],
  ["scale", "Gobernanza activa por criticidad"],
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface HeroAnswer extends Partial<DemoQA> {
  answer?: string;
}

function openDoc(a: HeroAnswer, codo: string) {
  window.open(demoDocHref({ ...a }, codo), "_blank", "noopener");
}

/** Shared consult engine for the hero. Curated questions resolve to the grounded
 *  qa entry; free text returns a representative grounded fallback (demo). */
function useConsult(vert: DemoVertical) {
  const [phase, setPhase] = useState<"idle" | "loading" | "answered">("idle");
  const [q, setQ] = useState("");
  const [a, setA] = useState<HeroAnswer | null>(null);
  const [showSrc, setShowSrc] = useState(false);
  const [opening, setOpening] = useState(false);

  const run = async (question: string) => {
    setQ(question);
    setPhase("loading");
    setA(null);
    setShowSrc(false);
    const hit = vert.qa.find((x) => x.q === question);
    let res: HeroAnswer;
    await delay(460);
    if (hit) {
      res = { ...hit, answer: hit.note ?? hit.span };
    } else {
      const base = vert.qa[0];
      res = {
        answer: "Respuesta con cita a la fuente exacta del documento de este equipo.",
        cite: base.cite,
        doc: base.doc,
        page: base.page,
        span: question,
      };
    }
    setA(res);
    setPhase("answered");
    setTimeout(() => setShowSrc(true), 420);
  };
  const openSource = () => {
    if (!a) return;
    setOpening(true);
    setTimeout(() => {
      setOpening(false);
      openDoc(a, vert.codo);
    }, 220);
  };
  const reset = () => {
    setPhase("idle");
    setA(null);
    setQ("");
    setShowSrc(false);
    setOpening(false);
  };
  return { phase, q, a, showSrc, opening, run, openSource, reset };
}

type Consult = ReturnType<typeof useConsult>;

function AnswerCard({ c }: { c: Consult }) {
  const { phase, q, a, showSrc, opening, openSource } = c;
  return (
    <>
      <div className="demo-q">{q}</div>
      {phase === "loading" && (
        <div className="demo-shimmer"><span className="sh-dot" />DOCYAN está buscando en el documento…</div>
      )}
      {phase === "answered" && a && (
        <div className="demo-a">
          <p className="da-text">{a.answer}</p>
          <div className="da-cite-row">
            <span className="tipwrap" data-tip={`Abrir documento · pág. ${a.page ?? "—"}  ↗`}>
              <button className={"cite chip-fn" + (showSrc ? " threaded" : "")} onClick={openSource}>
                <span className="brk" />{a.cite} <span className="ext">↗</span>
              </button>
            </span>
            <button className="openpdf" onClick={openSource}><Icon name="external-link" size={13} />Abrir PDF</button>
          </div>
          {opening && <div className="demo-shimmer op"><span className="sh-dot" />Abriendo documento fuente…</div>}
          {showSrc && !opening && (
            <div className="da-src">
              <span className="thread" />
              <div className="src-doc">
                <Icon name="file-text" size={13} />
                <span>Fuente · <mark>{a.cite}</mark></span>
                <span className="src-tag">span resaltado</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function FlowHero() {
  const [vkey, setVkey] = useState("lab");
  const vert = VERTICALS.find((v) => v.key === vkey) ?? VERTICALS[0];
  const c = useConsult(vert);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus({ preventScroll: true });
  }, []);

  const pickVert = (k: string) => { setVkey(k); c.reset(); setText(""); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) { c.run(text.trim()); setText(""); }
  };

  return (
    <div className="wrap">
      <div className="hero hero-flow">
        <div className="hero-copy">
          <div className="hero-brand">
            <DocyanMark size={30} />
            <span className="hb-wm">DOCYAN<span className="hb-lde">LDE</span></span>
            <span className="hb-by">by XCID</span>
          </div>
          <span className="eyebrow">Live Document Environment</span>
          <h1>Pregúntale a tus documentos. Te responden con la fuente.</h1>
          <p className="sub">
            Escanea el QR del equipo, pregunta en lenguaje natural y obtén respuesta con cita al fragmento exacto. Pruébalo aquí — con tu vertical.
          </p>
          <div className="cta">
            <Link href="/signup" className="btn primary lg"><Icon name="calendar" size={17} />Agendar demo de 30 min</Link>
            <Link href="/precios" className="btn sec lg">Ver planes</Link>
          </div>
          <div className="hero-trust">
            {HERO_TRUST.map(([ic, t]) => (
              <span key={t}><Icon name={ic} size={14} />{t}</span>
            ))}
          </div>
        </div>

        <div className="hero-demo">
          <div className="vsel" role="tablist">
            {VERTICALS.map((v) => (
              <button key={v.key} className={"vtab" + (v.key === vkey ? " on" : "")} onClick={() => pickVert(v.key)}>
                <Icon name={v.icon} size={14} />{v.label}
              </button>
            ))}
          </div>

          <div className="demo-wrap">
            <div className="demo-card" key={vkey}>
              <div className="demo-top">
                <div className="mctx">
                  <DocyanMark size={20} />
                  <div>
                    <div className="ml">Estás consultando</div>
                    <div className="mn">{vert.codo} · {vert.entity}</div>
                  </div>
                </div>
                <span className="demo-live"><span className="lv-dot" />DEMO EN VIVO</span>
              </div>

              <div className="demo-body">
                {c.phase === "idle" ? (
                  <div className="demo-empty">
                    <Icon name={vert.icon} size={22} />
                    <p>Toca una pregunta — o escribe la tuya — y mira cómo DOCYAN responde con su cita.</p>
                  </div>
                ) : (
                  <AnswerCard c={c} />
                )}
              </div>

              <div className="demo-sugs">
                {vert.qa.map((x) => (
                  <button key={x.q} className="demo-sug" onClick={() => c.run(x.q)} disabled={c.phase === "loading"}>
                    {x.q}
                  </button>
                ))}
              </div>
              <form className="demo-box" onSubmit={submit}>
                {!text && !focused && <span className="dcaret" aria-hidden="true" />}
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Escribe tu propia pregunta…"
                  aria-label="Escribe tu propia pregunta"
                />
                <button type="submit" className="db-send" aria-label="Preguntar" disabled={c.phase === "loading"}>
                  <Icon name="arrow-up" size={17} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
