"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useT, type Bilingual } from "@/lib/site-i18n";
import { VERTICALS, DOC_TIPO_LABEL, type DemoVertical } from "@/lib/demo-data";
import { demoQuery } from "@/lib/demo-query";
import { DemoAnswerCard, type DemoCardData } from "@/components/commercial/demo-answer-card";

type T = (o: Bilingual) => string;

/* DOCYAN sitio público v2 — explorador de CoDo demo (F3, reconciliado). TODA consulta
   (sugerida o libre) va al backend real (POST /demo/query) y se renderiza con cita al
   documento real. Cero enlatado (D3). El documento demo permanece en su idioma
   original; el chrome sigue el idioma del sitio. */

interface Espec {
  nombre?: string;
  valor?: string;
  unidad?: string;
  // `fragmento` = verbatim del documento (chunk[start:end]); null ⇒ sin span.
  cita?: {
    documento_id?: string;
    documento_nombre?: string;
    fragmento?: string | null;
    span_inicio?: number | null;
    span_fin?: number | null;
  };
}
interface Paso {
  orden?: number;
  descripcion?: string;
  epp?: string[];
  herramientas?: string[];
  advertencias?: string[];
}
interface Answer {
  q: string;
  servido: boolean;
  kind: string;                 // "info_card" | "procedure_card" | …
  especificaciones: Espec[];
  pasos: Paso[];                // procedimiento del manual (manual_tecnico)
  titulo: string;
  docNombre: string;            // tipo/nombre del documento de la cita (p.ej. manual_tecnico)
  doc: string;
  fallback: string | null;
}

/* Normaliza la respuesta del CoDo al contrato de la tarjeta UNIFICADA
   (`DemoAnswerCard`, el mismo render del hero). InfoCard: primera spec prominente
   + extras; ProcedureCard: pasos numerados; vacío: fallback honesto que invita a
   las sugeridas. */
function toCardData(a: Answer, t: T): DemoCardData {
  const esProc = a.kind === "procedure_card";
  const sinRespuesta = !a.servido || (esProc ? a.pasos.length === 0 : a.especificaciones.length === 0);
  if (sinRespuesta) {
    return {
      kind: "empty",
      fallback: a.fallback
        ? `${a.fallback} ${t({ es: "Prueba una de las preguntas sugeridas abajo.", en: "Try one of the suggested questions below." })}`
        : t({ es: "Esa pregunta no está en este documento demo — prueba una de las preguntas sugeridas abajo.", en: "That question isn't in this demo document — try one of the suggested questions below." }),
    };
  }
  if (esProc) {
    return {
      kind: "procedure",
      titulo: a.titulo,
      pasos: a.pasos.slice(0, 8).map((p) => ({
        descripcion: p.descripcion,
        meta: (p.herramientas ?? []).concat(p.epp ?? []).join(" · ") || undefined,
      })),
      citeLabel: `${a.doc} · ${a.docNombre || "manual_tecnico"}`,
      verbatim: null, // los procedimientos muestran los pasos reales; sin span por paso
    };
  }
  const primary = a.especificaciones[0];
  return {
    kind: "info",
    value: primary?.nombre,
    unit: primary?.unidad,
    note: primary?.valor,
    extras: a.especificaciones.slice(1, 4).map((e) => ({ nombre: e.nombre, valor: e.valor })),
    citeLabel: `${a.doc} · ${primary?.cita?.documento_nombre || "msds"}`,
    verbatim: primary?.cita?.fragmento?.trim() || null,
  };
}

export function DemoConsult({ vkey }: { vkey: string }) {
  const router = useRouter();
  const t = useT();
  const vert: DemoVertical = VERTICALS.find((v) => v.key === vkey) ?? VERTICALS[0];
  const [msgs, setMsgs] = useState<({ role: "user"; text: string } | { role: "answer"; a: Answer })[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const convoRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    // Capa 3 única (D3): toda consulta —sugerida o libre— al backend real.
    const res = await demoQuery(question, vert.key);
    const payload = ((res.resultado || {}) as Record<string, unknown>).payload as Record<string, unknown> | undefined;
    const kind = (payload?.kind as string) || "info_card";
    const especificaciones = (payload?.especificaciones as Espec[]) || [];
    const pasos = (payload?.pasos as Paso[]) || [];
    const citas = (payload?.citas as Array<{ documento_nombre?: string }>) || [];
    const tieneContenido = kind === "procedure_card" ? pasos.length > 0 : especificaciones.length > 0;
    const a: Answer = {
      q: question,
      servido: !!res.servido && tieneContenido,
      kind,
      especificaciones,
      pasos,
      titulo: (payload?.titulo as string) || "",
      docNombre: citas[0]?.documento_nombre || "",
      doc: vert.docs[0]?.name || (t(vert.entity) as string),
      fallback: res.fallback,
    };
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

  // B7: volver al hub /demo (o a la página de origen si se llegó desde verticales/demo).
  const goBack = () => {
    if (typeof document !== "undefined") {
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.origin === window.location.origin && /\/(verticales|demo)/.test(ref.pathname)) {
          router.back();
          return;
        }
      } catch { /* ignore */ }
    }
    router.push("/demo");
  };

  return (
    <div className="demo-page">
      <div className="demo-banner">
        <Icon name="info" size={15} />
        <span>{t({ es: "Estás en un CoDo demo de DOCYAN. Para crear el tuyo, agenda una demo o regístrate.", en: "You're in a DOCYAN demo CoDo. To create your own, book a demo or sign up." })}</span>
        <div className="db-ctas">
          <button className="btn sec" onClick={() => router.push("/codigo")}>{t({ es: "Agendar demo", en: "Book a demo" })}</button>
          <button className="btn primary" onClick={() => router.push("/signup")}>{t({ es: "Pruébalo gratis", en: "Try it free" })}</button>
        </div>
      </div>
      <div className="dc-wrap">
        <div className="dc-head">
          <button className="dc-back" onClick={goBack}><Icon name="arrow-left" size={16} />{t({ es: "Volver", en: "Back" })}</button>
          <div className="dc-ctx">
            <span className="dc-ic"><Icon name={vert.icon} size={18} /></span>
            <div>
              <div className="ml">{t({ es: "Estás consultando", en: "You're consulting" })}</div>
              <div className="mn">{vert.codo} · {t(vert.entity)}</div>
            </div>
          </div>
          {/* Chip expandible: lista los documentos del CoDo (nombre + tipo). Sin
              selector por documento — la unidad consultable es el CoDo; la cita
              ya atribuye de qué documento viene cada dato. */}
          <div className="dc-docchip">
            <button
              type="button"
              className="dc-tag dc-tag-btn"
              aria-expanded={docsOpen}
              onClick={() => setDocsOpen((o) => !o)}
            >
              {vert.docs.length} {t({ es: "documentos vivos", en: "live documents" })}
              <Icon name={docsOpen ? "chevron-up" : "chevron-down"} size={14} />
            </button>
            {docsOpen && (
              <ul className="dc-doclist" role="list">
                {vert.docs.map((d) => (
                  <li key={d.name}>
                    <Icon name="file-text" size={13} />
                    <span className="dc-doclist-n">{d.name}</span>
                    <span className="dc-doclist-t">{t(DOC_TIPO_LABEL[d.tipo])}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dc-body" ref={convoRef}>
          {msgs.length === 0 && (
            <div className="dc-intro">
              <p>{t(vert.blurb)}</p>
              <p>{t({ es: "Pregúntale a este CoDo demo: cada respuesta se compone del documento real y llega con su cita. Tócala para ver el fragmento original.", en: "Ask this demo CoDo: every answer is composed from the real document and comes with its citation. Tap it to see the original fragment." })}</p>
              <div className="dc-docs">{vert.docs.map((d) => <span className="dc-doc" key={d.name}><Icon name="file-text" size={13} />{d.name}</span>)}</div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div className="fa-user" key={i}>{m.text}</div>
            ) : (
              <DemoAnswerCard key={i} data={toCardData(m.a, t)} />
            ),
          )}
          {loading && <div className="demo-shimmer dc-load"><span className="sh-dot" />{t({ es: "DOCYAN está buscando en el documento…", en: "DOCYAN is searching the document…" })}</div>}
        </div>

        <div className="dc-foot">
          <div className="dc-sugs">{vert.questions.map((q, i) => <button key={i} className="demo-sug" onClick={() => ask(t(q))} disabled={loading}>{t(q)}</button>)}</div>
          <form className="demo-box dc-box" onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${t({ es: "Pregunta sobre", en: "Ask about" })} ${t(vert.entity)}…`} aria-label={t({ es: "Pregunta", en: "Question" })} />
            <button type="submit" className="db-send" aria-label={t({ es: "Preguntar", en: "Ask" })} disabled={loading}><Icon name="arrow-up" size={17} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
