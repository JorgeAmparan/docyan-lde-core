"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { useT, type Bilingual } from "@/lib/site-i18n";
import { VERTICALS, type DemoVertical, type DemoDoc } from "@/lib/demo-data";
import { demoQuery, getDemoCodoContexto } from "@/lib/demo-query";
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
    documento_tipo?: string;
    documento_url?: string | null;
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
  docTipo: string;              // tipo documental REAL de la cita (atribución §2.3)
  docUrl: string | null;        // URL del PDF de origen (Abrir PDF)
  doc: string;
  fallback: string | null;
}

/* Normaliza la respuesta del CoDo al contrato de la tarjeta UNIFICADA
   (`DemoAnswerCard`, el mismo render del hero). InfoCard: primera spec prominente
   + extras; ProcedureCard: pasos numerados; vacío: fallback honesto.
   B13.3 §2.5: el copy del fallback NO invita a "preguntas sugeridas abajo" cuando
   el CoDo no tiene sugeridas (p. ej. lab) — invita a reformular sobre su dominio. */
/* Atribución correcta (B13.3 §2.3): la etiqueta de la cita nombra el documento
   REAL de origen (por su tipo), nunca el primer doc del CoDo. Evita "Operating
   Manual · ..._calibration_cert.pdf" (nombre de un doc + archivo de otro). */
function fuenteLabel(docs: DemoDoc[], tipo?: string, fallback?: string): string {
  const d = tipo ? docs.find((x) => x.tipo === tipo) : undefined;
  return d?.name || fallback || "documento";
}

function toCardData(a: Answer, t: T, hasSugeridas: boolean, dominio: string, docs: DemoDoc[]): DemoCardData {
  const esProc = a.kind === "procedure_card";
  const sinRespuesta = !a.servido || (esProc ? a.pasos.length === 0 : a.especificaciones.length === 0);
  if (sinRespuesta) {
    const invita = hasSugeridas
      ? t({ es: "Prueba una de las preguntas sugeridas abajo.", en: "Try one of the suggested questions below." })
      : t({ es: `Reformúlala sobre ${dominio} (p. ej. rango, vigencia o trazabilidad).`, en: `Rephrase it about ${dominio} (e.g. range, validity or traceability).` });
    return {
      kind: "empty",
      fallback: a.fallback ? `${a.fallback} ${invita}` : `${t({ es: "Esa pregunta no está en este documento demo.", en: "That question isn't in this demo document." })} ${invita}`,
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
      citeLabel: fuenteLabel(docs, a.docTipo, a.docNombre),
      citeUrl: a.docUrl,
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
    citeLabel: fuenteLabel(docs, primary?.cita?.documento_tipo, primary?.cita?.documento_nombre),
    citeUrl: primary?.cita?.documento_url ?? null,
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
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const convoRef = useRef<HTMLDivElement>(null);

  // Doc-tabs reales (fix §2.4): documentos REALES del grafo (con su id), no el
  // listado curado local (que no trae id). Sin esto la consulta corre contra
  // todo el CoDo y puede citar otro documento del mismo tenant (cross-citation).
  const { data: contexto, isLoading: contextoLoading } = useQuery({
    queryKey: ["demo-codo-contexto", vert.key, vert.codo],
    queryFn: () => getDemoCodoContexto(vert.key, vert.codo),
  });
  const documentosReales = contexto?.documentos ?? [];
  const activeDoc = documentosReales[activeDocIdx];

  // CoDo nuevo (cambio de vertical) ⇒ vuelve al primer documento.
  useEffect(() => {
    setActiveDocIdx(0);
  }, [vert.key]);

  const ask = async (question: string) => {
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    // Capa 3 única (D3): toda consulta —sugerida o libre— al backend real,
    // acotada al documento activo de las doc-tabs (fix §2.4).
    const res = await demoQuery(question, vert.key, activeDoc?.id);
    const payload = ((res.resultado || {}) as Record<string, unknown>).payload as Record<string, unknown> | undefined;
    const kind = (payload?.kind as string) || "info_card";
    let especificaciones = (payload?.especificaciones as Espec[]) || [];
    const pasos = (payload?.pasos as Paso[]) || [];
    const citas = (payload?.citas as Array<{ documento_nombre?: string; documento_tipo?: string; documento_url?: string | null }>) || [];
    // alerts_dashboard (B13.3 §2.4 — "¿cuándo vence?"): mapea las alertas
    // administrativas (vencimientos con cita) al render de info para mostrarlas.
    if (kind === "alerts_dashboard") {
      const alertas = (payload?.alertas as Array<{ descripcion?: string; fecha_vencimiento?: string; cita?: Espec["cita"] }>) || [];
      especificaciones = alertas.map((al) => ({ nombre: al.descripcion || "Vencimiento", valor: al.fecha_vencimiento, cita: al.cita }));
    }
    const tieneContenido = kind === "procedure_card" ? pasos.length > 0 : especificaciones.length > 0;
    const a: Answer = {
      q: question,
      servido: !!res.servido && tieneContenido,
      kind,
      especificaciones,
      pasos,
      titulo: (payload?.titulo as string) || "",
      docNombre: citas[0]?.documento_nombre || "",
      docTipo: citas[0]?.documento_tipo || (payload?.especificaciones as Espec[] | undefined)?.[0]?.cita?.documento_tipo || "",
      docUrl: citas[0]?.documento_url || (payload?.especificaciones as Espec[] | undefined)?.[0]?.cita?.documento_url || null,
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
    // Espera al contexto real (doc-tabs) antes de consultar: sin él, la pregunta
    // correría sin acotar a un documento (riesgo de cross-citation — fix §2.4).
    if (text.trim() && !contextoLoading) { ask(text.trim()); setText(""); }
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
    // `.s2` escopa el kit-sitio-v2 (mismas clases que el hero del index). El CoDo
    // vive FUERA del grupo (public)/SiteShell, así que debe declarar `.s2` aquí o
    // las tarjetas (.dc2-a, .cite2, …) no reciben estilo y caen a texto plano.
    <div className="demo-page s2">
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
          <span className="dc-tag">{documentosReales.length || vert.docs.length} {t({ es: "documentos vivos", en: "live documents" })}</span>
        </div>

        {/* Doc-tabs reales (fix §2.4): acotan el retrieval a UN documento — sin esto
            la consulta corría contra todo el CoDo y podía citar otro documento del
            mismo tenant demo (cross-citation). Verbatim de consult.jsx .doctabs. */}
        {documentosReales.length > 1 && (
          <div className="doctabs">
            {documentosReales.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={"doctab" + (i === activeDocIdx ? " on" : "")}
                onClick={() => setActiveDocIdx(i)}
              >
                <Icon name="file-text" size={14} />
                {d.nombre || "Documento"}
              </button>
            ))}
          </div>
        )}

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
              <DemoAnswerCard key={i} data={toCardData(m.a, t, vert.questions.length > 0, t(vert.entity) as string, vert.docs)} />
            ),
          )}
          {loading && <div className="demo-shimmer dc-load"><span className="sh-dot" />{t({ es: "DOCYAN está buscando en el documento…", en: "DOCYAN is searching the document…" })}</div>}
        </div>

        <div className="dc-foot">
          {vert.questions.length > 0 ? (
            <div className="dc-sugs">{vert.questions.map((q, i) => <button key={i} className="demo-sug" onClick={() => ask(t(q))} disabled={loading || contextoLoading}>{t(q)}</button>)}</div>
          ) : (
            <div className="dc-sugs dc-sugs-empty">{t({ es: `Escribe tu pregunta sobre ${t(vert.entity)}.`, en: `Type your question about ${t(vert.entity)}.` })}</div>
          )}
          <form className="demo-box dc-box" onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${t({ es: "Pregunta sobre", en: "Ask about" })} ${t(vert.entity)}…`} aria-label={t({ es: "Pregunta", en: "Question" })} />
            <button type="submit" className="db-send" aria-label={t({ es: "Preguntar", en: "Ask" })} disabled={loading || contextoLoading}><Icon name="arrow-up" size={17} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
