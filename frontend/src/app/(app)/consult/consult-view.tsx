"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import {
  ConsultaSpanOverlay,
  type SourceSpan,
} from "@/components/brand/consulta-span-overlay";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

import {
  ANSWERS,
  CANNED_CTX,
  CANNED_SOURCE,
  SUGGESTIONS,
  mapResueltaToAnswer,
  type Answer,
  type AnswerMode,
  type ConsultaResuelta,
  type InfoAnswerData,
  type StepsAnswerData,
} from "./consult-data";
import { InformativaCard } from "./renderers/informativa-card";
import { GuiaPasoAPaso } from "./renderers/guia-paso-a-paso";
import { GraficosViewer } from "./renderers/graficos-viewer";
import { VideoPlayer } from "./renderers/video-player";
import { TroubleshootingTree } from "./renderers/troubleshooting-tree";
import { HistorialTimeline } from "./renderers/historial-timeline";
import { AlertasDashboard } from "./renderers/alertas-dashboard";
import { ComparativaView } from "./renderers/comparativa-view";

export interface ConsultContext {
  codo: string;
  entityName: string;
  entityTitle: string;
  entityMeta: string;
  /** Set on the public QR route — forwarded to /mo/query as token_qr. */
  tokenQr?: string;
  /** Entity id for /mo/query (when known). */
  entityId?: string;
}

interface Message {
  id: number;
  role: "user" | "answer";
  text?: string;
  answer?: Answer;
}

/** The mode line: jade pulse "instantáneo · caché" or amber blinking "buscando…". */
function ModeLine({ mode }: { mode: AnswerMode }) {
  const synth = mode === "synth";
  return (
    <div className={"mode" + (synth ? " synth" : "")}>
      <span className="pulse" />
      {synth ? "Respuesta sintetizada" : "Respuesta instantánea · caché"}
    </div>
  );
}

function AnswerBody({
  a,
  saved,
  onSave,
  onCite,
}: {
  a: Answer;
  saved: boolean;
  onSave: () => void;
  onCite: () => void;
}) {
  switch (a.kind) {
    case "info":
      return <InformativaCard a={a as InfoAnswerData} saved={saved} onSave={onSave} onCite={onCite} />;
    case "steps":
      return <GuiaPasoAPaso a={a as StepsAnswerData} saved={saved} onSave={onSave} onCite={onCite} />;
    case "troubleshoot":
      return <TroubleshootingTree saved={saved} onSave={onSave} onCite={onCite} />;
    case "diagram":
      return <GraficosViewer saved={saved} onSave={onSave} onCite={onCite} />;
    case "video":
      return <VideoPlayer saved={saved} onSave={onSave} onCite={onCite} />;
    case "history":
      return <HistorialTimeline saved={saved} onSave={onSave} />;
    case "alerts":
      return <AlertasDashboard saved={saved} onSave={onSave} onCite={onCite} />;
    case "compare":
      return <ComparativaView saved={saved} onSave={onSave} onCite={onCite} />;
    default:
      return null;
  }
}

function answerTitle(a: Answer): string {
  if (a.kind === "info") return a.q;
  return a.title ?? "Consulta";
}

/**
 * The collaborator consult view — full-screen, mobile-first, bottom-anchored
 * query box. Shared by /consult (admin) and /q/[token] (public QR). Recreated
 * from consult.jsx ConsultScreen with real /mo/query + /mo/queries/save wiring
 * and canned fallbacks so every intent renders without a backend.
 */
export function ConsultView({ context }: { context?: ConsultContext }) {
  const ctx = context ?? CANNED_CTX;
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [source, setSource] = useState<SourceSpan | null>(null);
  const convoRef = useRef<HTMLDivElement>(null);

  const appendAnswer = useCallback((label: string, a: Answer) => {
    setMsgs((m) => [
      ...m,
      { id: Date.now(), role: "user", text: label },
      { id: Date.now() + 1, role: "answer", answer: a },
    ]);
    setText("");
  }, []);

  /** Suggested questions use the canned answer for that key (instant). */
  const askCanned = useCallback(
    (key: string, label: string) => {
      const a = ANSWERS[key] ?? {
        kind: "info" as const,
        mode: "synth" as const,
        q: label,
        value: "—",
        unit: "",
        note: "Consulta de ejemplo. En producto real, DOCYAN clasifica la intención y renderiza la respuesta.",
        cite: "Documento fuente · §",
      };
      appendAnswer(label, a);
    },
    [appendAnswer],
  );

  /** Free-text questions hit the real MO; on failure fall back to a canned info card. */
  const askFree = useCallback(
    async (label: string) => {
      setBusy(true);
      try {
        const res = await api.post<{ resultado: ConsultaResuelta }>(
          "/mo/query",
          {
            texto: label,
            canal: "pwa",
            entidad_id: ("entityId" in ctx && ctx.entityId) || undefined,
            token_qr: ("tokenQr" in ctx && ctx.tokenQr) || undefined,
          },
          { token },
        );
        const resuelta = res.resultado ?? (res as unknown as ConsultaResuelta);
        appendAnswer(label, mapResueltaToAnswer(resuelta, label));
      } catch {
        // No backend / error — degrade to a canned synthesized info card.
        appendAnswer(label, {
          kind: "info",
          mode: "synth",
          q: label,
          value: "—",
          unit: "",
          note: "Consulta de ejemplo. En producto real, DOCYAN clasifica la intención y renderiza la respuesta con cita a la fuente.",
          cite: "Documento fuente · §",
        });
      } finally {
        setBusy(false);
      }
    },
    [appendAnswer, ctx, token],
  );

  useEffect(() => {
    const c = convoRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [msgs]);

  const onSave = useCallback(
    async (id: number, a: Answer) => {
      if (savedIds.includes(id)) return;
      setSavedIds((s) => [...s, id]);
      try {
        await api.post(
          "/mo/queries/save",
          { texto: answerTitle(a), tipo_intencion: a.kind, nombre: answerTitle(a) },
          { token },
        );
      } catch {
        // Optimistic — the save is reflected locally even if the backend is down.
      }
    },
    [savedIds, token],
  );

  const openSource = useCallback(() => setSource(CANNED_SOURCE), []);

  const showNudge = savedIds.length >= 2;

  return (
    // Full-screen mobile-first column (NOT wrapped in the demo `.phone` frame).
    // The kit's `.ctx`/`.convo`/`.qbar` assume a flex column that fills height;
    // we reproduce the `.phone-screen` layout inline rather than add new CSS.
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      {/* Context strip — ALWAYS visible. */}
      <div className="ctx">
        <DocyanMark size={26} />
        <div className="ctx-t">
          <div className="ctx-lab">Estás consultando</div>
          <div className="ctx-name">
            <span className="ctx-codo">{ctx.codo}</span> · {ctx.entityName}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => router.push("/saved")}
          aria-label="Mis consultas"
        >
          <Icon name="bookmark" size={19} />
        </button>
      </div>

      <div className="convo" ref={convoRef}>
        <div className="entity-card">
          <div className="eh">
            <div className="ic">
              <Icon name="scan-line" size={21} />
            </div>
            <div>
              <h3>{ctx.entityTitle}</h3>
              <div className="meta">{ctx.entityMeta}</div>
            </div>
          </div>
          <div className="sugs">
            {SUGGESTIONS.map(([ic, q, key]) => (
              <button type="button" className="sug" key={key} onClick={() => askCanned(key, q)}>
                <Icon name={ic} size={15} />
                {q}
                <span className="ar">→</span>
              </button>
            ))}
          </div>
        </div>

        {msgs.map((m) =>
          m.role === "user" ? (
            <div className="bubble-user" key={m.id}>
              {m.text}
            </div>
          ) : (
            <div className="answer" key={m.id}>
              <ModeLine mode={m.answer!.mode} />
              <AnswerBody
                a={m.answer!}
                saved={savedIds.includes(m.id)}
                onSave={() => onSave(m.id, m.answer!)}
                onCite={openSource}
              />
            </div>
          ),
        )}

        {showNudge && (
          <div className="nudge">
            <div className="nh">
              <Icon name="git-branch" size={17} />
              Secuencia detectada
            </div>
            <p>
              Guardaste varias consultas sobre {ctx.entityName}. Un <strong>Playbook</strong> es una secuencia que repites como rutina — DOCYAN puede unirlas en una.
            </p>
            <div className="acts">
              <button
                type="button"
                className="sug"
                style={{ background: "var(--cinnabar-500)", color: "#fff", border: "none", justifyContent: "center", fontWeight: 600 }}
                onClick={() => router.push("/saved")}
              >
                Crear Playbook
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="qbar">
        <form
          className="qbox"
          onSubmit={(e) => {
            e.preventDefault();
            const q = text.trim();
            if (q && !busy) askFree(q);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pregunta sobre este equipo…"
            disabled={busy}
          />
          <button type="button" className="mic" aria-label="Voz a texto">
            <Icon name="mic" size={19} />
          </button>
          <button type="submit" className="send" aria-label="Enviar" disabled={busy}>
            <Icon name="arrow-up" size={19} />
          </button>
        </form>
      </div>

      <ConsultaSpanOverlay open={source !== null} onOpenChange={(o) => !o && setSource(null)} source={source} />
    </div>
  );
}
