"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useT, type Bilingual } from "@/lib/site-i18n";
import { VERTICALS, type DemoVertical } from "@/lib/demo-data";
import { demoQuery, DEMO_FALLBACK } from "@/lib/demo-query";

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
interface Answer {
  q: string;
  servido: boolean;
  especificaciones: Espec[];
  doc: string;
  fallback: string | null;
}

function CitedCard({ a, onOpen }: { a: Answer; onOpen: (e: Espec) => void }) {
  const t = useT();
  if (!a.servido || a.especificaciones.length === 0) {
    return (
      <div className="fa-card dc-fallback">
        <div className="fa-mode"><Icon name="info" size={14} />{t({ es: "Sin respuesta en este documento demo", en: "No answer in this demo document" })}</div>
        <p className="fa-note">{a.fallback || DEMO_FALLBACK}</p>
      </div>
    );
  }
  // Una respuesta puede sostenerse en varias especificaciones del documento real.
  const specs = a.especificaciones.slice(0, 4);
  return (
    <div className="fa-card">
      <div className="fa-mode"><span className="fa-pulse" />{t({ es: "Respuesta con cita al documento", en: "Answer cited to the document" })}</div>
      <div className="fa-specs">
        {specs.map((e, i) => (
          <div className="fa-spec" key={i}>
            <div className="fa-spec-v">{e.nombre}</div>
            {e.valor && <p className="fa-note">{e.valor}</p>}
            <div className="da-cite-row">
              <button className="cite2" onClick={() => onOpen(e)}>
                <span className="brk" />{a.doc} · {e.cita?.documento_nombre || "msds"} <span className="ext">↗</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceOverlay({ e, doc, onClose }: { e: Espec; doc: string; onClose: () => void }) {
  const t = useT();
  // INTEGRIDAD DE CITA (regla absoluta): el overlay solo muestra el VERBATIM del
  // documento (cita.fragmento = chunk[start:end]). Si no hay span, se declara
  // honesto "fragmento no disponible" — jamás el nombre/valor generado por el LLM.
  const verbatim = e.cita?.fragmento?.trim() || null;
  return (
    <div className="src-overlay" onClick={onClose}>
      <div className="src-sheet" onClick={(ev) => ev.stopPropagation()}>
        <div className="src-head">
          <div style={{ minWidth: 0 }}>
            <div className="src-doc-t">{doc}</div>
            <div className="src-cite">{e.cita?.documento_nombre || "msds"}</div>
          </div>
          <button className="src-x" onClick={onClose} aria-label={t({ es: "Cerrar", en: "Close" })}><Icon name="x" size={18} /></button>
        </div>
        <div className="src-body">
          {verbatim ? (
            <>
              <p>{t({ es: "Fragmento del documento original que sostiene la respuesta:", en: "Fragment of the original document that supports the answer:" })}</p>
              <p><mark>{verbatim}</mark></p>
              <p>{t({ es: "El documento se consulta en su idioma original; la respuesta llega en el idioma del sitio.", en: "The document is consulted in its original language; the answer arrives in the site's language." })}</p>
            </>
          ) : (
            <>
              <p className="src-unavailable">{t({ es: "Fragmento no disponible", en: "Fragment not available" })}</p>
              <p>{t({ es: "Esta respuesta aún no tiene el span de caracteres del documento. Se muestra la ubicación de la fuente, no el texto generado.", en: "This answer doesn't yet have the document's character span. The source location is shown, not generated text." })}</p>
            </>
          )}
        </div>
        <div className="src-foot">
          <Icon name="shield-check" size={14} />
          <span>{verbatim
            ? t({ es: "Pedigree al fragmento exacto · cadena SHA-256", en: "Exact-passage pedigree · SHA-256 chain" })
            : t({ es: "Procedencia al documento · sin span exacto", en: "Document provenance · no exact span" })}</span>
        </div>
      </div>
    </div>
  );
}

export function DemoConsult({ vkey }: { vkey: string }) {
  const router = useRouter();
  const t = useT();
  const vert: DemoVertical = VERTICALS.find((v) => v.key === vkey) ?? VERTICALS[0];
  const [msgs, setMsgs] = useState<({ role: "user"; text: string } | { role: "answer"; a: Answer })[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState<Espec | null>(null);
  const convoRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    // Capa 3 única (D3): toda consulta —sugerida o libre— al backend real.
    const res = await demoQuery(question, vert.key);
    const payload = ((res.resultado || {}) as Record<string, unknown>).payload as Record<string, unknown> | undefined;
    const especificaciones = (payload?.especificaciones as Espec[]) || [];
    const a: Answer = {
      q: question,
      servido: !!res.servido && especificaciones.length > 0,
      especificaciones,
      doc: vert.docs[0] || (t(vert.entity) as string),
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
          <span className="dc-tag">{vert.docs.length} {t({ es: "documentos vivos", en: "live documents" })}</span>
        </div>

        <div className="dc-body" ref={convoRef}>
          {msgs.length === 0 && (
            <div className="dc-intro">
              <p>{t(vert.blurb)}</p>
              <p>{t({ es: "Pregúntale a este CoDo demo: cada respuesta se compone del documento real y llega con su cita. Tócala para ver el fragmento original.", en: "Ask this demo CoDo: every answer is composed from the real document and comes with its citation. Tap it to see the original fragment." })}</p>
              <div className="dc-docs">{vert.docs.map((d) => <span className="dc-doc" key={d}><Icon name="file-text" size={13} />{d}</span>)}</div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div className="fa-user" key={i}>{m.text}</div>
            ) : (
              <CitedCard key={i} a={m.a} onOpen={setSrc} />
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
      {src && <SourceOverlay e={src} doc={vert.docs[0] || ""} onClose={() => setSrc(null)} />}
    </div>
  );
}
