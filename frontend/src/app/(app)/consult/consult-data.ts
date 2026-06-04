/**
 * Canned consult data + answer types, recreated verbatim from the design bundle
 * (`ui_kits/pwa/consult.jsx` ANSWERS / SUGGESTIONS). These are the FALLBACKS that
 * let every intent type render without a backend. When the real MO answers
 * (`POST /mo/query` → ConsultaResuelta), `mapResueltaToAnswer` adapts the live
 * payload into the same `Answer` shape the renderers consume.
 */
import type { components } from "@/types/api";

export type ConsultaResuelta = components["schemas"]["ConsultaResuelta"];

export type AnswerKind =
  | "info"
  | "steps"
  | "troubleshoot"
  | "diagram"
  | "video"
  | "history"
  | "alerts"
  | "compare";

/** "cache" = instant cache hit (jade pulse). "synth" = synthesized (amber blink). */
export type AnswerMode = "cache" | "synth";

export interface BaseAnswer {
  kind: AnswerKind;
  mode: AnswerMode;
  title?: string;
}

export interface InfoAnswerData extends BaseAnswer {
  kind: "info";
  q: string;
  value: string;
  unit: string;
  note: string;
  cite: string;
}

export interface StepsAnswerData extends BaseAnswer {
  kind: "steps";
  title: string;
  ppe: Array<[string, string]>;
  steps: string[];
  warn: { lab: string; text: string };
  cite: string;
}

export interface SimpleAnswerData extends BaseAnswer {
  kind: "troubleshoot" | "diagram" | "video" | "history" | "alerts" | "compare";
  title: string;
}

export type Answer = InfoAnswerData | StepsAnswerData | SimpleAnswerData;

/** Suggested questions: [icon, label, answerKey]. */
export const SUGGESTIONS: Array<[string, string, string]> = [
  ["gauge", "¿Torque del perno B?", "torque"],
  ["wrench", "¿Cómo cambio el filtro de refrigerante?", "filtro"],
  ["activity", "La centrífuga vibra al arrancar", "vibra"],
  ["image", "Muéstrame el diagrama del rotor", "diagrama"],
  ["play-circle", "Video: montaje del rotor", "video"],
  ["history", "Historial de esta centrífuga", "historial"],
  ["bell", "¿Qué alertas tengo pendientes?", "alertas"],
  ["git-compare", "Compara la rev. C y D del manual", "compara"],
];

export const ANSWERS: Record<string, Answer> = {
  torque: {
    kind: "info",
    q: "Torque del perno B — cabezal",
    value: "85",
    unit: "N·m",
    mode: "cache",
    note: "Aplicado en cruz, en tres etapas progresivas (40 → 65 → 85 N·m).",
    cite: "Manual VF-2 · §4.2.1",
  },
  filtro: {
    kind: "steps",
    title: "Cambio del filtro de refrigerante",
    mode: "synth",
    ppe: [
      ["hand", "Guantes nitrilo"],
      ["glasses", "Gafas de seguridad"],
    ],
    steps: [
      "Detén la máquina y aplica bloqueo/etiquetado (LOTO) en el interruptor principal.",
      "Cierra la válvula de suministro y deja drenar 2 min al depósito.",
      "Retira la tapa del alojamiento del filtro girando en sentido antihorario.",
      "Extrae el cartucho usado y deséchalo según el MSDS del refrigerante.",
      "Coloca el cartucho nuevo, vuelve a sellar y reabre la válvula.",
    ],
    warn: {
      lab: "Advertencia",
      text: "No retires la tapa sin haber drenado: el alojamiento permanece presurizado.",
    },
    cite: "Manual VF-2 · §7.3",
  },
  vibra: { kind: "troubleshoot", mode: "synth", title: "Vibración al arrancar" },
  diagrama: { kind: "diagram", mode: "cache", title: "Diagrama del rotor" },
  video: { kind: "video", mode: "cache", title: "Video · montaje del rotor" },
  historial: { kind: "history", mode: "synth", title: "Historial de la centrífuga" },
  alertas: { kind: "alerts", mode: "synth", title: "Alertas pendientes" },
  compara: { kind: "compare", mode: "synth", title: "Comparativa rev. C vs D" },
};

/** Default CoDo/entity context (used by /q/[token] when QR fetch fails + demo). */
export const CANNED_CTX = {
  codo: "CODO-LAB-04",
  entityName: "Centrífuga Hettich",
  entityTitle: "Centrífuga Hettich Rotina 380",
  entityMeta: "QR escaneado · 4 documentos vivos",
};

/** The cited source span surfaced by the citation chip overlay (from playbook.jsx). */
export const CANNED_SOURCE = {
  title: "Manual CNC Haas VF-2",
  ref: "§4.2.1 · Apriete de cabezal",
  paragraphs: [
    {
      text: "4.2 — Montaje del cabezal. Antes de aplicar par, verifica que las superficies de contacto estén limpias y libres de rebabas.",
    },
    {
      text: "4.2.1 — El par de apriete del perno B es 85 N·m, aplicado en cruz en tres etapas progresivas (40 → 65 → 85 N·m). Repite la secuencia una segunda vez para asegurar el asentamiento.",
      highlight: true,
    },
    {
      text: "4.2.2 — Tras el apriete final, registra el valor en la bitácora de mantenimiento del equipo.",
    },
  ],
  footnote: "Referenciado por 3 consultas en este CoDo",
};

const KIND_BY_INTENT: Record<string, AnswerKind> = {
  informativa: "info",
  guia: "steps",
  guía: "steps",
  procedure: "steps",
  troubleshooting: "troubleshoot",
  diagnostico: "troubleshoot",
  graficos: "diagram",
  gráficos: "diagram",
  diagram: "diagram",
  video: "video",
  historial: "history",
  history: "history",
  alertas: "alerts",
  alerts: "alerts",
  comparativa: "compare",
  compare: "compare",
};

/**
 * Adapt a live MO `ConsultaResuelta` envelope into the renderer `Answer` shape.
 * DESIGN: the live payloads (InfoCardPayload, ProcedureCardPayload, …) carry more
 * fields than the kit; we map the ones the renderers need and fall back to the
 * canned example for that kind when the payload is sparse, so the UI never breaks.
 */
export function mapResueltaToAnswer(r: ConsultaResuelta, question: string): Answer {
  const key = (r.tipo_intencion || "").toLowerCase();
  const kind: AnswerKind = KIND_BY_INTENT[key] ?? "info";
  const mode: AnswerMode = r.contexto_ccp?.cache_hit ? "cache" : "synth";
  const payload = (r.payload ?? {}) as Record<string, unknown>;

  if (kind === "info") {
    return {
      kind: "info",
      mode,
      q: (payload.titulo as string) || (payload.pregunta as string) || question,
      value: (payload.valor as string) ?? "—",
      unit: (payload.unidad as string) ?? "",
      note: (payload.nota as string) || (payload.detalle as string) || (r.nota ?? ""),
      cite: (payload.cita as string) || (payload.fuente as string) || "Documento fuente · §",
    };
  }
  if (kind === "steps") {
    const fallback = ANSWERS.filtro as StepsAnswerData;
    return {
      kind: "steps",
      mode,
      title: (payload.titulo as string) || question,
      ppe: (payload.epp as Array<[string, string]>) ?? fallback.ppe,
      steps: (payload.pasos as string[]) ?? fallback.steps,
      warn: (payload.advertencia as { lab: string; text: string }) ?? fallback.warn,
      cite: (payload.cita as string) || "Documento fuente · §",
    };
  }
  return { kind, mode, title: (payload.titulo as string) || question };
}
