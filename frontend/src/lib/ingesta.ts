/**
 * Ingesta — tipos de progreso y agregación de lote DEL LADO CLIENTE (F1).
 *
 * Decisión rectora #3: no hay `batchId` en el backend. El backend maneja jobs
 * individuales (`job_id`); el cliente dispara N, sondea cada uno
 * (`GET /ingesta/documents/{job_id}/status` → `DocProgress`) y agrega los N en un
 * `BatchProgress` aquí. Estos tipos siguen el contrato del handoff (§3.1) para
 * que `BatchProgress.docs[i]` calce 1:1 con las props del componente de diseño.
 *
 * Los pesos de fase son la misma fuente de verdad que el backend
 * (`app/jobs/progress.py`). El `pct`/`etaSeconds` por doc los calcula el backend;
 * aquí solo se agregan a nivel lote.
 */

export type Phase = "descarga" | "conversion" | "extraccion" | "grafo" | "dedup";
export type DocStatus = "encolado" | "cargando" | "procesando" | "completado" | "error";

export const PHASE_ORDER: Phase[] = ["descarga", "conversion", "extraccion", "grafo", "dedup"];
export const PHASE_WEIGHTS: Record<Phase, number> = {
  descarga: 6,
  conversion: 16,
  extraccion: 38,
  grafo: 28,
  dedup: 12,
};

export interface DocCounters {
  bytes?: number;
  bytesTotal?: number;
  page?: number;
  pages?: number;
  spans?: number;
  entities?: number;
  relations?: number;
  relationsTotal?: number;
  merged?: number;
}

/** Respuesta de GET /ingesta/documents/{job_id}/status. */
export interface DocProgress {
  docId: string;
  name: string;
  kind: string;
  status: DocStatus;
  phase: Phase | null;
  phaseFraction: number;
  pct: number;
  etaSeconds: number | null;
  queuePosition?: number | null;
  counters?: DocCounters;
  retryAttempt?: number;
  error?: { code: string; message: string } | null;
  consultUrl?: string | null;
  disponibleParaConsulta?: boolean;
  // B13.3: job completado PERO sin :DocumentoSource (no quedó vivo) — estado visible.
  completedSinDocumento?: boolean;
  // Pieza 6 — estados honestos: completó pero 0 ontología extraída; y si NO se cobró
  // (la reserva se liberó por no rendir contenido consultable). La UI muestra el
  // estado honesto + Retry: "sin contenido consultable, no se te cobró, reintenta".
  completedSinOntologia?: boolean;
  noCobrado?: boolean;
}

/** Construido EN EL CLIENTE agregando N DocProgress. NO es un endpoint. */
export interface BatchProgress {
  docs: DocProgress[];
  pct: number;
  etaSeconds: number;
  counts: { completado: number; procesando: number; encolado: number; error: number };
}

const TERMINAL: DocStatus[] = ["completado", "error"];
export const isTerminal = (s: DocStatus): boolean => TERMINAL.includes(s);
export const isActive = (s: DocStatus): boolean => !isTerminal(s);

/**
 * Agrega N DocProgress en un BatchProgress (orquestación en cliente).
 * `weights`: trabajo estimado por doc (p.ej. segundos de la cotización) para
 * ponderar el pct "por trabajo, no por nº de docs" (handoff §4). Si falta, peso 1.
 */
export function aggregateBatch(
  docs: DocProgress[],
  weights?: Record<string, number>,
): BatchProgress {
  const counts = { completado: 0, procesando: 0, encolado: 0, error: 0 };
  for (const d of docs) {
    if (d.status === "completado") counts.completado += 1;
    else if (d.status === "error") counts.error += 1;
    else if (d.status === "encolado") counts.encolado += 1;
    else counts.procesando += 1; // cargando | procesando
  }

  let wsum = 0;
  let pctAcc = 0;
  let eta = 0;
  for (const d of docs) {
    const w = weights?.[d.docId] ?? 1;
    wsum += w;
    const docPct = d.status === "completado" ? 100 : d.pct;
    pctAcc += w * docPct;
    if (isActive(d.status)) {
      // ETA del lote = suma de ETAs restantes; si el doc no la trae (encolado),
      // se estima con su peso × fracción restante.
      eta += d.etaSeconds ?? w * (1 - docPct / 100);
    }
  }

  return {
    docs,
    pct: wsum > 0 ? Math.round((pctAcc / wsum) * 100) / 100 : 0,
    etaSeconds: Math.round(eta),
    counts,
  };
}

export const batchDone = (b: BatchProgress): boolean =>
  b.docs.length > 0 && b.counts.completado + b.counts.error === b.docs.length;
