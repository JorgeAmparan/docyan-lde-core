/**
 * Consult answer model (B9.5 §2.1) — derives ENTIRELY from the backend OpenAPI
 * contract. `mapResueltaToAnswer` wraps the live `ConsultaResuelta` payload (the
 * discriminated `payload.kind` union) into a thin `Answer` the renderers consume.
 *
 * The 8 renderers read the REAL typed payload — no parallel/hardcoded shapes, no
 * canned fallback. On backend failure the view shows an honest error (kind:"error"),
 * never invented data (§2.5).
 */
import type { components } from "@/types/api";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";

export type ConsultaResuelta = components["schemas"]["ConsultaResuelta"];
export type Cita = components["schemas"]["Cita"];
export type PipelinePayload = ConsultaResuelta["payload"];

export type InfoCardPayload = components["schemas"]["InfoCardPayload"];
export type ProcedureCardPayload = components["schemas"]["ProcedureCardPayload"];
export type DiagramViewerPayload = components["schemas"]["DiagramViewerPayload"];
export type VideoPlayerPayload = components["schemas"]["VideoPlayerPayload"];
export type DiagnosticTreePayload = components["schemas"]["DiagnosticTreePayload"];
export type TimelinePayload = components["schemas"]["TimelinePayload"];
export type AlertsDashboardPayload = components["schemas"]["AlertsDashboardPayload"];
export type ComparativeViewPayload = components["schemas"]["ComparativeViewPayload"];

export type AnswerKind =
  | "info"
  | "steps"
  | "troubleshoot"
  | "diagram"
  | "video"
  | "history"
  | "alerts"
  | "compare"
  | "error";

/** "cache" = instant cache hit (jade pulse). "synth" = synthesized (amber blink). */
export type AnswerMode = "cache" | "synth";

export interface Answer {
  kind: AnswerKind;
  mode: AnswerMode;
  question: string;
  /** The live typed payload (undefined only for kind:"error"). */
  payload?: PipelinePayload;
  degradado?: boolean;
  nota?: string | null;
  errorMsg?: string;
}

const KIND_BY_PAYLOAD: Record<string, AnswerKind> = {
  info_card: "info",
  procedure_card: "steps",
  diagram_viewer: "diagram",
  video_player: "video",
  diagnostic_tree: "troubleshoot",
  timeline: "history",
  alerts_dashboard: "alerts",
  comparative_view: "compare",
};

/** Wrap a live MO `ConsultaResuelta` into the renderer `Answer` (kind from the
 *  payload discriminator — the contract's own `kind`, not a guess on tipo_intencion). */
export function mapResueltaToAnswer(r: ConsultaResuelta, question: string): Answer {
  const payload = r.payload;
  const pk = (payload as { kind?: string } | undefined)?.kind ?? "";
  const kind: AnswerKind = KIND_BY_PAYLOAD[pk] ?? "info";
  const mode: AnswerMode = r.contexto_ccp?.cache_hit ? "cache" : "synth";
  return { kind, mode, question, payload, degradado: r.degradado ?? false, nota: r.nota };
}

/** Honest error answer (no invented data). */
export function errorAnswer(question: string, msg: string): Answer {
  return { kind: "error", mode: "synth", question, errorMsg: msg };
}

// ── Citation helpers (single source of truth: label chip + overlay) ───────────

/** Human label for the citation chip from a backend `Cita`. */
export function citaLabel(c?: Cita | null): string | null {
  if (!c) return null;
  const doc = c.documento_nombre || c.documento_id;
  const sec = c.seccion ? ` · ${c.seccion}` : "";
  const pag = c.pagina != null ? ` · p.${c.pagina}` : "";
  if (doc) return `${doc}${sec}${pag}`;
  return c.seccion || null;
}

/** Build the source overlay from a backend `Cita`. INTEGRIDAD DE CITA (regla
 *  absoluta): el fragmento resaltado es SOLO el verbatim del documento
 *  (`cita.fragmento` = chunk[start:end]). Si no hay span, NO se resalta nada y se
 *  declara honesto "fragmento no disponible" — jamás se muestra texto generado
 *  como si fuera la fuente. */
export function citaToSource(c?: Cita | null): SourceSpan | null {
  if (!c) return null;
  const ref =
    [c.seccion, c.pagina != null ? `p.${c.pagina}` : null].filter(Boolean).join(" · ") || "—";
  const verbatim = c.fragmento?.trim();
  return {
    title: c.documento_nombre || c.documento_id || "Documento fuente",
    ref,
    paragraphs: verbatim
      ? [{ text: verbatim, highlight: true }]
      : [
          {
            text:
              "Fragmento no disponible: esta cita aún no tiene el span de caracteres del documento. Se muestra la ubicación (documento · sección), no el texto generado.",
            highlight: false,
          },
        ],
    footnote: c.documento_id ? `Documento ${c.documento_id.slice(0, 12)}` : undefined,
  };
}
