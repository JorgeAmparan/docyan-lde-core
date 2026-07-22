"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import {
  ConsultaSpanOverlay,
  type SourceSpan,
} from "@/components/brand/consulta-span-overlay";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { SCHEMAS, SCHEMA_ESTADO_META } from "@/lib/schemas-catalog";

import {
  errorAnswer,
  mapResueltaToAnswer,
  type Answer,
  type AnswerMode,
  type AlertsDashboardPayload,
  type BilingualAlignmentPayload,
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
import { BilingualAlignment } from "./renderers/bilingual-alignment";
import { SolicitudModal, type SolicitarPrefill } from "./renderers/solicitud-modal";

/** Lookup tipo documental (id de schema) → schema, para el chip `.doc-tipo` del
 *  prototipo (consult.jsx). Espejo de `SCHEMA_BY_ID` del design system. */
const SCHEMA_BY_ID = new Map(SCHEMAS.map((s) => [s.id, s] as const));

/** Etiqueta de display para los `tipo_documento` REALES del backend cuyo vocabulario
 *  (extracción) aún NO está reconciliado 1:1 con el catálogo canónico de 14 schemas.
 *  Reconciliar el modelado (p.ej. `manual_tecnico` → ¿operación o mantenimiento?) es
 *  PENDIENTE DE JORGE; esto es SOLO display, no afirma identidad de schema. */
const BACKEND_TIPO_LABEL: Record<string, string> = {
  manual_tecnico: "Manual técnico",
  msds: "Hoja de seguridad",
  calibracion: "Certificado de calibración",
  troubleshooting: "Guía de fallas",
};

/** Resuelve el chip `.doc-tipo` para CUALQUIER tipo real: catálogo canónico cuando
 *  existe (con su severidad), mapa de display del backend, o humaniza el id crudo.
 *  Garantiza que el elemento del prototipo aparezca siempre con dato real. */
function resolveDocTipo(tipo?: string | null): { label: string; sev: string } | null {
  if (!tipo) return null;
  const s = SCHEMA_BY_ID.get(tipo);
  if (s) return { label: s.label, sev: SCHEMA_ESTADO_META[s.estado].sev };
  const humano =
    BACKEND_TIPO_LABEL[tipo] ??
    tipo.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  // Documento real ya ingerido ⇒ tipo "activo" ⇒ severidad ok (verde), no gris.
  return { label: humano, sev: "ok" };
}

export interface ConsultContext {
  codo: string;
  entityName: string;
  entityTitle: string;
  entityMeta: string;
  /** Set on the public QR route — forwarded to /mo/query as token_qr. */
  tokenQr?: string;
  /** Entity id for /mo/query (when known). */
  entityId?: string;
  /** Active document id for a loose-document CoDo. Forwarded to /mo/query as
   *  documento_id so retrieval scopes to THIS document (and the PCL cache keys
   *  on it) — without it, a query can cite another document of the same tenant
   *  (cross-citation) and two loose docs collide in the cache. */
  documentoId?: string;
  /** Documentos reales del CoDo (de `GET /mo/codos/{id}`). Alimentan las doc-tabs
   *  del shell de escritorio (Shell-A): cada pestaña acota el retrieval a SU
   *  documento_id. Vacío/1 doc ⇒ sin pestañas. NO se inventan documentos. */
  documentos?: Array<{
    id: string;
    nombre?: string | null;
    tipo?: string | null;
    /** Preguntas sugeridas por DOCYAN para ESTE documento (de su ontología/EDB).
     *  Reales, del backend; en el `/demo` showcase vienen del CoDo MAXI-10. */
    sugerencias?: string[] | null;
  }>;
}

interface Message {
  id: number;
  role: "user" | "answer";
  text?: string;
  answer?: Answer;
}

/** Un id "tipo hash" (SHA-256 de un documento suelto, u otra cadena hex larga sin
 *  separadores legibles) NO se muestra al usuario: la cabecera de consulta usa el
 *  nombre del CoDo en su lugar (DEF-4). Heurística: ≥16 chars hex contiguos. */
function isHashLike(id: string): boolean {
  return /[0-9a-f]{16,}/i.test(id.replace(/[^0-9a-z]/gi, ""));
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
  onSolicitar,
}: {
  a: Answer;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
  onNavigate: (nodoId: string) => void;
  onSolicitar?: (p: SolicitarPrefill) => void;
}) {
  switch (a.kind) {
    case "info":
      return <InformativaCard payload={a.payload as InfoCardPayload} saved={saved} onSave={onSave} onCite={onCite} onSolicitar={onSolicitar} />;
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
      return <AlertasDashboard payload={a.payload as AlertsDashboardPayload} saved={saved} onSave={onSave} onCite={() => {}} onSolicitar={onSolicitar} />;
    case "compare":
      return <ComparativaView payload={a.payload as ComparativeViewPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "bilingual":
      return <BilingualAlignment payload={a.payload as BilingualAlignmentPayload} saved={saved} onSave={onSave} onCite={onCite} />;
    case "error":
      return <ErrorCard msg={a.errorMsg ?? "Error desconocido."} />;
    default:
      return null;
  }
}

/* Traza cada RENDER (eje B) a su TIPO DOCUMENTAL representativo (eje A) — hace
   visible la relación render↔schema, igual que answers.jsx (KIND_SCHEMA). No es
   dato inventado: es el mapeo determinista tipo-de-render → tipo documental. */
const KIND_SCHEMA: Record<string, string> = {
  info: "ficha_tecnica",
  steps: "manual_mantenimiento",
  troubleshoot: "manual_mantenimiento",
  diagram: "manual_operacion",
  video: "manual_operacion",
  history: "registro_historico",
  alerts: "certificado_calibracion",
  compare: "manual_operacion",
  bilingual: "memoria_traduccion",
};
const SCHEMA_LABEL: Record<string, string> = {
  ficha_tecnica: "Ficha técnica",
  manual_mantenimiento: "Manual de mantenimiento",
  manual_operacion: "Manual de operación",
  registro_historico: "Registro histórico",
  certificado_calibracion: "Certificado de calibración",
  memoria_traduccion: "Memoria de traducción",
};

/** Tipo documental REAL de la fuente citada (`Cita.documento_tipo`, B13.3 §2.3).
 *  El chip de procedencia (`.dc-prov`) usa ESTO — el tipo del documento del que
 *  de verdad proviene la respuesta — no la heurística por tipo de render. La
 *  heurística `KIND_SCHEMA` queda solo como respaldo cuando la respuesta no trae
 *  cita con tipo (p.ej. degradación honesta sin procedencia). */
function provenanceTipo(a: Answer): string | null {
  const citas = (a.payload as { citas?: Array<{ documento_tipo?: string | null }> } | undefined)
    ?.citas;
  return citas?.find((c) => c?.documento_tipo)?.documento_tipo ?? null;
}

/** Envoltura de respuesta del prototipo (answers.jsx → AnswerBody): `.dc-answer`
 *  con `.dc-prov` (línea de modo + chip del tipo documental de origen) sobre la
 *  tarjeta de tipo. El error no lleva provenance. */
function AnswerCard({
  a,
  saved,
  onSave,
  onCite,
  onNavigate,
  onSolicitar,
}: {
  a: Answer;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
  onNavigate: (nodoId: string) => void;
  onSolicitar?: (p: SolicitarPrefill) => void;
}) {
  if (a.kind === "error") {
    return <AnswerBody a={a} saved={saved} onSave={onSave} onCite={onCite} onNavigate={onNavigate} />;
  }
  // El chip de procedencia refleja el TIPO REAL del documento citado
  // (`Cita.documento_tipo`), NO el tipo de render. Antes, toda respuesta
  // Informativa (`kind:"info"`) pintaba "Ficha técnica" aunque la fuente fuera
  // un `manual_tecnico` — la heurística `KIND_SCHEMA["info"]="ficha_tecnica"`
  // ignoraba el tipo real. El respaldo heurístico solo aplica sin cita tipada.
  const provTipo = provenanceTipo(a);
  const label = provTipo
    ? resolveDocTipo(provTipo)?.label ?? null
    : SCHEMA_LABEL[KIND_SCHEMA[a.kind] ?? "ficha_tecnica"];
  return (
    <div className="dc-answer">
      <div className="dc-prov">
        <ModeLine mode={a.mode} />
        {label && (
          <span className="prov-tipo" title="Tipo documental del que proviene esta respuesta">
            <Icon name="library" size={11} />
            {label}
          </span>
        )}
      </div>
      <AnswerBody a={a} saved={saved} onSave={onSave} onCite={onCite} onNavigate={onNavigate} onSolicitar={onSolicitar} />
    </div>
  );
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
/** Función de consulta inyectable. Por defecto la vista pega a `/mo/query` con la
 *  sesión autenticada (ruta /consult y /q/[token]). El demo público la sustituye
 *  para enrutar TODA consulta por `demoQuery` (backend demo real, sin token) sin
 *  tocar el camino autenticado. Devuelve un `Answer` (real o error honesto). */
export type QueryFn = (
  label: string,
  params?: Record<string, unknown>,
) => Promise<Answer>;

export function ConsultView({
  context,
  embedded = false,
  onFirstAnswer,
  queryFn,
}: {
  /** Contexto REAL del CoDo/entidad. Requerido: el llamador lo resuelve del backend
   *  (`/mo/codos/{id}` o `/qr/{token}`). No hay contexto enlatado de respaldo. */
  context: ConsultContext;
  /** Embebido (p.ej. en el wizard de onboarding): en flujo, sin ocupar toda la
   *  pantalla ni navegar fuera. Mismo motor real (/mo/query), inline. */
  embedded?: boolean;
  /** Se dispara UNA vez al aparecer la primera respuesta (éxito o error honesto).
   *  El wizard de onboarding lo usa para confirmar el "ájá" y habilitar Continuar. */
  onFirstAnswer?: () => void;
  /** Consulta inyectada (demo público): si se pasa, la vista enruta por aquí en vez
   *  de pegar a `/mo/query`. Sin ella, comportamiento idéntico al autenticado. */
  queryFn?: QueryFn;
}) {
  const ctx = context;
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
  // PROVISIONAL-ED2 (§2.8): estado del formulario de solicitud. Solo en sesión
  // autenticada (con token); el demo público no crea solicitudes reales.
  const [solicitarPrefill, setSolicitarPrefill] = useState<SolicitarPrefill | null>(null);
  // Chat persistente (Pieza 6): una SESIÓN por CoDo. El backend acumula el historial
  // por session_id (multi-turno nativo del SDK); sin enviarlo, cada consulta sería
  // stateless y el seguimiento perdería el contexto. Se crea al montar / al cambiar
  // de CoDo (conversación nueva) y se reenvía en cada /mo/query.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const codoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    // Reset de conversación al CAMBIAR de CoDo. Se hace dentro de los callbacks
    // async (no síncrono en el effect, que dispararía renders en cascada) marcando
    // si es un CoDo nuevo respecto al anterior visto.
    const esNuevoCodo = codoRef.current !== ctx.codo;
    codoRef.current = ctx.codo;
    firstAnswerRef.current = false;
    api
      .post<{ session_id: string }>(
        "/mo/sessions",
        { session_type: "consulta", canal: "pwa" },
        { token },
      )
      .then((r) => {
        if (cancelado) return;
        setSessionId(r.session_id);
        if (esNuevoCodo) setMsgs([]); // CoDo nuevo ⇒ conversación nueva
      })
      .catch(() => {
        // Sin sesión, la consulta sigue funcionando (stateless): no se bloquea el CoDo.
        if (!cancelado) setSessionId(null);
      });
    return () => {
      cancelado = true;
    };
  }, [token, ctx.codo]);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [source, setSource] = useState<SourceSpan | null>(null);
  const convoRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const nextId = () => (idRef.current += 1);

  // Doc-tabs reales (Shell-A): el documento activo acota el retrieval a SU id.
  // No se inventan documentos — vienen de `GET /mo/codos/{id}`.
  const documentos = useMemo(() => ctx.documentos ?? [], [ctx.documentos]);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const activeDoc = documentos[activeDocIdx];
  const activeDocumentoId =
    activeDoc?.id ?? ("documentoId" in ctx ? ctx.documentoId : undefined);
  // Chip de tipo del documento activo (tipo REAL → catálogo / display) para `.doc-tipo`.
  const activeTipo = resolveDocTipo(activeDoc?.tipo);

  // "Tus consultas" — etiquetas de las respuestas guardadas en esta sesión (real).
  const [savedQ, setSavedQ] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState("");

  // Observaciones del operador — persistidas localmente (como el prototipo).
  // PENDIENTE DE JORGE: no hay endpoint para persistir/auditar observaciones
  // server-side; aquí quedan en localStorage por CoDo, sin fingir guardado remoto.
  const obsKey = `docyan_obs_${ctx.codo}`;
  const [obs, setObs] = useState<Array<{ t: string; at: string }>>([]);
  const [obsAdding, setObsAdding] = useState(false);
  const [obsVal, setObsVal] = useState("");
  // Hidrata las observaciones del cliente tras el montaje (evita mismatch SSR; el
  // server no conoce localStorage). setState-en-effect es el patrón correcto aquí
  // y consistente con el resto del repo (site-i18n).
  useEffect(() => {
    let parsed: Array<{ t: string; at: string }> = [];
    try {
      parsed = JSON.parse(localStorage.getItem(obsKey) || "[]");
    } catch {
      parsed = [];
    }
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setObs(parsed);
  }, [obsKey]);
  const persistObs = (next: Array<{ t: string; at: string }>) => {
    setObs(next);
    try {
      localStorage.setItem(obsKey, JSON.stringify(next));
    } catch {
      /* almacenamiento no disponible — la UI sigue funcionando en memoria */
    }
  };

  // Fix lag del input (Sprint UI-2 §1.2.8): la burbuja del usuario se pinta AL
  // INSTANTE al enviar (y se limpia el campo) — la respuesta del motor llega después.
  // Antes ambas se agregaban juntas tras `await query`, así que el texto tardaba
  // ~lo que tardara el backend en aparecer. El demo público ya lo hace instantáneo.
  const appendUser = useCallback((label: string) => {
    setMsgs((m) => [...m, { id: nextId(), role: "user", text: label }]);
    setText("");
  }, []);

  const appendAnswer = useCallback((a: Answer) => {
    setMsgs((m) => [...m, { id: nextId(), role: "answer", answer: a }]);
    if (!firstAnswerRef.current) {
      firstAnswerRef.current = true;
      onFirstAnswerRef.current?.();
    }
  }, []);

  const query = useCallback(
    async (label: string, params?: Record<string, unknown>): Promise<Answer> => {
      // Demo público: la consulta va por la función inyectada (demoQuery), no a
      // /mo/query. El camino autenticado (sin queryFn) queda intacto.
      if (queryFn) return queryFn(label, params);
      const res = await api.post<{ resultado: ConsultaResuelta }>(
        "/mo/query",
        {
          texto: label,
          canal: "pwa",
          entidad_id: ("entityId" in ctx && ctx.entityId) || undefined,
          documento_id: activeDocumentoId || undefined,
          token_qr: ("tokenQr" in ctx && ctx.tokenQr) || undefined,
          session_id: sessionId ?? undefined,
          params,
        },
        { token },
      );
      const resuelta = res.resultado ?? (res as unknown as ConsultaResuelta);
      return mapResueltaToAnswer(resuelta, label);
    },
    [ctx, token, sessionId, activeDocumentoId, queryFn],
  );

  /** Both free-text and suggestions hit the real MO; failure → honest error. */
  const askFree = useCallback(
    async (label: string) => {
      appendUser(label); // pinta la pregunta al instante; la respuesta llega después
      setBusy(true);
      try {
        appendAnswer(await query(label));
      } catch {
        appendAnswer(errorAnswer(label, "El motor no respondió. Reintenta en unos segundos."));
      } finally {
        setBusy(false);
      }
    },
    [appendUser, appendAnswer, query],
  );

  /** Tipo 5 navigation — re-query the next decision node and append it. */
  const navigateNode = useCallback(
    async (nodoId: string) => {
      appendUser("Continuar diagnóstico");
      setBusy(true);
      try {
        appendAnswer(await query("Continuar diagnóstico", { nodo_id: nodoId }));
      } catch {
        appendAnswer(errorAnswer("Continuar diagnóstico", "No se pudo avanzar en el diagnóstico."));
      } finally {
        setBusy(false);
      }
    },
    [appendUser, appendAnswer, query],
  );

  useEffect(() => {
    const c = convoRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [msgs]);

  const onSave = useCallback(
    async (id: number, a: Answer) => {
      if (savedIds.includes(id)) return;
      setSavedIds((s) => [...s, id]);
      const titulo = answerTitle(a);
      setSavedQ((q) => (q.includes(titulo) ? q : [...q, titulo]));
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

  // ── handlers del shell (Shell-A) ───────────────────────────────────────────
  const selectDoc = (i: number) => {
    setActiveDocIdx(i);
    setMsgs([]); // conversación por documento (paridad con el prototipo)
  };
  const addUser = () => {
    const v = addVal.trim();
    if (!v || busy) return;
    setSavedQ((q) => (q.includes(v) ? q : [...q, v]));
    setAddVal("");
    setAdding(false);
    askFree(v);
  };
  const delSavedQ = (i: number) => setSavedQ((q) => q.filter((_, k) => k !== i));
  const addObs = () => {
    const v = obsVal.trim();
    if (!v) return;
    persistObs([...obs, { t: v, at: "ahora" }]);
    setObsVal("");
    setObsAdding(false);
  };
  const delObs = (i: number) => persistObs(obs.filter((_, k) => k !== i));

  // Solo autenticado: el botón "Solicitar" abre el formulario prellenado con la cita
  // y el contexto de CoDo. Sin token (demo público) queda undefined → sin botón.
  const onSolicitar = token
    ? (p: SolicitarPrefill) =>
        setSolicitarPrefill({
          ...p,
          entidadId: p.entidadId ?? ctx.entityId,
          codoId: ctx.codo,
          consultaId: sessionId ?? undefined,
        })
    : undefined;

  // Se MONTA solo cuando hay un dato seleccionado (tras pulsar "Solicitar"). Así el
  // uso de react-query del modal no exige un QueryClientProvider en superficies que
  // nunca abren el formulario (p. ej. los tests unitarios de la vista, el demo sin token).
  const solicitudModalEl =
    solicitarPrefill !== null ? (
      <SolicitudModal
        open
        onOpenChange={(o) => !o && setSolicitarPrefill(null)}
        prefill={solicitarPrefill}
        token={token}
      />
    ) : null;

  const renderAnswer = (m: Message) =>
    m.role === "user" ? (
      <div className="bubble" key={m.id}>
        {m.text}
      </div>
    ) : (
      <AnswerCard
        key={m.id}
        a={m.answer!}
        saved={savedIds.includes(m.id)}
        onSave={() => onSave(m.id, m.answer!)}
        onCite={(s) => s && setSource(s)}
        onNavigate={navigateNode}
        onSolicitar={onSolicitar}
      />
    );

  const qbarForm = (
    <form
      className="qbar"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text.trim();
        if (q && !busy) askFree(q);
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Pregunta sobre ${activeDoc?.nombre || ctx.entityName}…`}
        disabled={busy}
      />
      <button type="button" className="mic" aria-label="Voz a texto">
        <Icon name="mic" size={19} />
      </button>
      <button type="submit" className="send" aria-label="Enviar" disabled={busy}>
        <Icon name="arrow-up" size={19} />
      </button>
    </form>
  );

  // ── Embebido (wizard de onboarding): single-column inline, mismo motor real ──
  if (embedded) {
    return (
      <div className="consult-embed">
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
            <p className="meta" style={{ marginTop: 10 }}>
              Escribe abajo una pregunta sobre {ctx.entityName} para ver la respuesta con cita a la
              fuente.
            </p>
          </div>
          {msgs.map(renderAnswer)}
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
        <ConsultaSpanOverlay
          open={source !== null}
          onOpenChange={(o) => !o && setSource(null)}
          source={source}
        />
        {solicitudModalEl}
      </div>
    );
  }

  // ── Shell-A escritorio (dos columnas) — colapsa a una en pantallas angostas ──
  return (
    <div className="consult-desktop">
      <div className="consult-wrap">
        <div className="ctxbar">
          <div className="eyebrow">
            <span className="dot" />
            Consultando
            {/* DEF-4: nunca el SHA crudo — solo código legible del CoDo. */}
            {ctx.codo && !isHashLike(ctx.codo) ? ` · ${ctx.codo}` : ""}
          </div>
          <h1>{ctx.entityName}</h1>
        </div>

        {documentos.length >= 1 && (
          <div className="doctabs">
            {documentos.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={"doctab" + (i === activeDocIdx ? " on" : "")}
                onClick={() => selectDoc(i)}
              >
                <Icon name="file-text" size={14} />
                {d.nombre || "Documento"}
                {/* Badge de idioma del prototipo (.lt). El backend aún no provee el
                    idioma del documento: se conserva el elemento y se omite el valor
                    (regla #4 — sin fabricarlo, sin quitar el elemento). */}
                <span className="lt">{(d as { lang?: string }).lang ?? ""}</span>
              </button>
            ))}
          </div>
        )}

        <div className="cwrap">
          <div className="col-left">
            <div className="doc-card2">
              <div className="dh">
                <span className="di">
                  <Icon name="file-text" size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="dn">{activeDoc?.nombre || ctx.entityTitle}</div>
                  <div className="dm">{ctx.entityMeta}</div>
                  {/* Chip de tipo documental del prototipo (.doc-tipo + .sev-dot),
                      alimentado del tipo REAL del documento activo. Solo aparece si
                      el tipo existe en el catálogo de schemas (sin fabricar dato). */}
                  {activeTipo && (
                    <span className="doc-tipo">
                      <span className={"sev-dot " + activeTipo.sev} />
                      {activeTipo.label}
                    </span>
                  )}
                </div>
              </div>
              <span className="badge-vivo">
                <span className="bd" />
                documento vivo
              </span>
            </div>

            {/* Sugeridas por DOCYAN — preguntas que el documento sabe responder
                (de su ontología/EDB). Sección del diseño; alimentada por datos
                reales del documento activo. En consulta LIVE no se enlatan (D2);
                el /demo showcase las trae del CoDo MAXI-10. */}
            {(activeDoc?.sugerencias ?? []).length > 0 && (
              <div className="cb-group">
                <div className="cb-lab">
                  <Icon name="sparkles" size={13} />
                  Sugeridas por DOCYAN
                </div>
                {(activeDoc?.sugerencias ?? []).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="sug"
                    onClick={() => !busy && askFree(s)}
                  >
                    <Icon name="sparkles" size={15} />
                    <span className="tx">{s}</span>
                    <span className="ar">→</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tus consultas — guardadas en esta sesión (real). */}
            <div className="cb-group">
              <div className="cb-lab">
                <Icon name="bookmark" size={13} />
                Tus consultas
              </div>
              {savedQ.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  className="sug saved"
                  onClick={() => !busy && askFree(q)}
                >
                  <Icon name="bookmark" size={15} />
                  <span className="tx">{q}</span>
                  <span
                    className="del"
                    onClick={(e) => {
                      e.stopPropagation();
                      delSavedQ(i);
                    }}
                  >
                    <Icon name="x" size={13} />
                  </span>
                </button>
              ))}
              {adding ? (
                <div className="add-row">
                  <input
                    autoFocus
                    value={addVal}
                    placeholder="Escribe una consulta…"
                    onChange={(e) => setAddVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addUser();
                      if (e.key === "Escape") setAdding(false);
                    }}
                  />
                  <button type="button" className="ok" onClick={addUser}>
                    <Icon name="check" size={16} />
                  </button>
                </div>
              ) : (
                <button type="button" className="add-q" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={15} />
                  Agregar consulta
                </button>
              )}
            </div>

            {/* Observaciones del operador — nota sobre la entidad, no instrucción.
                Persisten localmente (como el prototipo); persistencia/auditoría
                server-side: PENDIENTE DE JORGE (sin endpoint). */}
            <div className="cb-group">
              <div className="cb-lab">
                <Icon name="pencil-line" size={13} />
                Observaciones
              </div>
              <p className="obs-hint">
                Anota algo que viste en el equipo. Queda como tu nota; no es una instrucción.
              </p>
              {obs.map((o, i) => (
                <div className="obs-item" key={i}>
                  <span className="obs-ic">
                    <Icon name="message-square-text" size={14} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="obs-t">{o.t}</div>
                    <div className="obs-m">tú · {o.at}</div>
                  </div>
                  <button type="button" className="obs-del" onClick={() => delObs(i)}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              {obsAdding ? (
                <div className="add-row">
                  <input
                    autoFocus
                    value={obsVal}
                    placeholder="Ej. holgura en el acople motor-eje…"
                    onChange={(e) => setObsVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addObs();
                      if (e.key === "Escape") setObsAdding(false);
                    }}
                  />
                  <button type="button" className="ok" onClick={addObs}>
                    <Icon name="check" size={16} />
                  </button>
                </div>
              ) : (
                <button type="button" className="add-q" onClick={() => setObsAdding(true)}>
                  <Icon name="plus" size={15} />
                  Anotar observación
                </button>
              )}
            </div>
          </div>

          <div className="col-right">
            <div className="threadbar">
              <span className="tb-l">
                <Icon name="messages-square" size={14} />
                Conversación{activeDoc?.nombre ? ` · ${activeDoc.nombre}` : ""}
              </span>
              {msgs.length > 0 && (
                <button type="button" className="clearbtn" onClick={() => setMsgs([])}>
                  <Icon name="eraser" size={14} />
                  Limpiar conversación
                </button>
              )}
            </div>

            <div className="thread" ref={convoRef}>
              {msgs.length === 0 && (
                <div className="empty">
                  <Icon name="message-circle-question" size={26} />
                  <p>
                    Escribe tu pregunta sobre <b>{ctx.entityName}</b>. La respuesta llega con su cita
                    a la fuente.
                  </p>
                </div>
              )}
              {msgs.map(renderAnswer)}

              {showNudge && (
                <div className="nudge">
                  <div className="nh">
                    <Icon name="git-branch" size={17} />
                    Secuencia detectada
                  </div>
                  <p>
                    Guardaste varias consultas sobre {ctx.entityName}. Un{" "}
                    <strong>Playbook</strong> es una secuencia que repites como rutina — DOCYAN puede
                    unirlas en una.
                  </p>
                  <div className="acts">
                    <button
                      type="button"
                      className="sug"
                      style={{
                        background: "var(--cinnabar-500)",
                        color: "#fff",
                        border: "none",
                        justifyContent: "center",
                        fontWeight: 600,
                      }}
                      onClick={() => router.push("/saved")}
                    >
                      Crear Playbook
                    </button>
                  </div>
                </div>
              )}
            </div>

            {qbarForm}
          </div>
        </div>
      </div>

      <ConsultaSpanOverlay
        open={source !== null}
        onOpenChange={(o) => !o && setSource(null)}
        source={source}
      />
      {solicitudModalEl}
    </div>
  );
}
