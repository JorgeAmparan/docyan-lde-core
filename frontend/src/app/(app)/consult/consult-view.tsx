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
  CANNED_CTX,
  SUGGESTIONS,
  errorAnswer,
  mapResueltaToAnswer,
  type Answer,
  type AnswerMode,
  type AlertsDashboardPayload,
  type ComparativeViewPayload,
  type ConsultaResuelta,
  type DiagnosticTreePayload,
  type DiagramViewerPayload,
  type InfoCardPayload,
  type ProcedureCardPayload,
  type TimelinePayload,
  type VideoPlayerPayload,
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

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="acard">
      <div className="warn">
        <Icon name="triangle-alert" size={16} />
        <div className="wt">
          <span className="wlab">No se pudo resolver la consulta</span>
          {msg}
        </div>
      </div>
    </div>
  );
}

function AnswerBody({
  a,
  saved,
  onSave,
  onCite,
  onNavigate,
}: {
  a: Answer;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
  onNavigate: (nodoId: string) => void;
}) {
  switch (a.kind) {
    case "info":
      return <InformativaCard payload={a.payload as InfoCardPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "steps":
      return <GuiaPasoAPaso payload={a.payload as ProcedureCardPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "troubleshoot":
      return (
        <TroubleshootingTree
          payload={a.payload as DiagnosticTreePayload}
          saved={saved}
          onSave={onSave}
          onCite={onCite}
          onNavigate={onNavigate}
        />
      );
    case "diagram":
      return <GraficosViewer payload={a.payload as DiagramViewerPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "video":
      return <VideoPlayer payload={a.payload as VideoPlayerPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "history":
      return <HistorialTimeline payload={a.payload as TimelinePayload} saved={saved} onSave={onSave} />;
    case "alerts":
      return <AlertasDashboard payload={a.payload as AlertsDashboardPayload} saved={saved} onSave={onSave} onCite={() => {}} />;
    case "compare":
      return <ComparativaView payload={a.payload as ComparativeViewPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "error":
      return <ErrorCard msg={a.errorMsg ?? "Error desconocido."} />;
    default:
      return null;
  }
}

function answerTitle(a: Answer): string {
  const p = a.payload as { titulo?: string } | undefined;
  return p?.titulo || a.question || "Consulta";
}

/**
 * The collaborator consult view — full-screen, mobile-first, bottom-anchored
 * query box. Shared by /consult (admin) and /q/[token] (public QR). Wired to the
 * real `/mo/query` (8 typed payloads). On backend failure shows an honest error
 * (NO canned data — B9.5 §2.5).
 */
export function ConsultView({
  context,
  embedded = false,
  onFirstAnswer,
}: {
  context?: ConsultContext;
  /** Embebido (p.ej. en el wizard de onboarding): en flujo, sin ocupar toda la
   *  pantalla ni navegar fuera. Mismo motor real (/mo/query), inline. */
  embedded?: boolean;
  /** Se dispara UNA vez al aparecer la primera respuesta (éxito o error honesto).
   *  El wizard de onboarding lo usa para confirmar el "ájá" y habilitar Continuar. */
  onFirstAnswer?: () => void;
}) {
  const ctx = context ?? CANNED_CTX;
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const firstAnswerRef = useRef(false);
  const onFirstAnswerRef = useRef(onFirstAnswer);
  useEffect(() => {
    onFirstAnswerRef.current = onFirstAnswer;
  }, [onFirstAnswer]);

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
    if (!firstAnswerRef.current) {
      firstAnswerRef.current = true;
      onFirstAnswerRef.current?.();
    }
  }, []);

  const query = useCallback(
    async (label: string, params?: Record<string, unknown>): Promise<Answer> => {
      const res = await api.post<{ resultado: ConsultaResuelta }>(
        "/mo/query",
        {
          texto: label,
          canal: "pwa",
          entidad_id: ("entityId" in ctx && ctx.entityId) || undefined,
          token_qr: ("tokenQr" in ctx && ctx.tokenQr) || undefined,
          params,
        },
        { token },
      );
      const resuelta = res.resultado ?? (res as unknown as ConsultaResuelta);
      return mapResueltaToAnswer(resuelta, label);
    },
    [ctx, token],
  );

  /** Both free-text and suggestions hit the real MO; failure → honest error. */
  const askFree = useCallback(
    async (label: string) => {
      setBusy(true);
      try {
        appendAnswer(label, await query(label));
      } catch {
        appendAnswer(label, errorAnswer(label, "El motor no respondió. Reintenta en unos segundos."));
      } finally {
        setBusy(false);
      }
    },
    [appendAnswer, query],
  );

  /** Tipo 5 navigation — re-query the next decision node and append it. */
  const navigateNode = useCallback(
    async (nodoId: string) => {
      setBusy(true);
      try {
        appendAnswer("Continuar diagnóstico", await query("Continuar diagnóstico", { nodo_id: nodoId }));
      } catch {
        appendAnswer("Continuar diagnóstico", errorAnswer("Continuar diagnóstico", "No se pudo avanzar en el diagnóstico."));
      } finally {
        setBusy(false);
      }
    },
    [appendAnswer, query],
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

  const showNudge = savedIds.length >= 2;

  return (
    <div
      className={embedded ? "consult-embed" : undefined}
      style={
        embedded
          ? undefined
          : {
              position: "fixed",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              background: "var(--bg)",
              maxWidth: 560,
              margin: "0 auto",
            }
      }
    >
      <div className="ctx">
        <DocyanMark size={26} />
        <div className="ctx-t">
          <div className="ctx-lab">Estás consultando</div>
          <div className="ctx-name">
            <span className="ctx-codo">{ctx.codo}</span> · {ctx.entityName}
          </div>
        </div>
        {!embedded && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => router.push("/saved")}
            aria-label="Mis consultas"
          >
            <Icon name="bookmark" size={19} />
          </button>
        )}
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
            {SUGGESTIONS.map(([ic, q]) => (
              <button type="button" className="sug" key={q} onClick={() => askFree(q)} disabled={busy}>
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
                onCite={(s) => s && setSource(s)}
                onNavigate={navigateNode}
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
