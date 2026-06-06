"use client";

import { create } from "zustand";

import { type BatchProgress, type DocProgress, aggregateBatch } from "@/lib/ingesta";

/**
 * Estado GLOBAL del lote de ingesta en curso (F1 active waiting, handoff §0.4).
 *
 * Vive fuera de la página para que el admin pueda navegar el resto de la app
 * mientras la ingesta procesa: un watcher global (montado en Providers) sondea
 * los jobs y escribe aquí; el aviso de completado (toast/banner) NO depende de
 * que la pantalla de ingesta siga abierta.
 */
interface IngestState {
  /** job_id confirmados que el watcher debe sondear. Vacío = sin lote activo. */
  jobIds: string[];
  /** Snapshot inicial por doc (montaje inmediato sin pantalla en blanco). */
  seed: Record<string, DocProgress>;
  /** Trabajo estimado por doc (segundos) para ponderar el pct del lote. */
  weights: Record<string, number>;
  /** Última agregación calculada por el watcher. */
  batch: BatchProgress | null;
  byId: Record<string, DocProgress>;
  /** Vista minimizada (drawer) — el lote sigue procesando en segundo plano. */
  minimized: boolean;

  startBatch: (
    jobIds: string[],
    seed: Record<string, DocProgress>,
    weights: Record<string, number>,
  ) => void;
  syncBatch: (batch: BatchProgress, byId: Record<string, DocProgress>) => void;
  skip: (docId: string) => void;
  setMinimized: (v: boolean) => void;
  clear: () => void;
}

export const useIngestStore = create<IngestState>((set) => ({
  jobIds: [],
  seed: {},
  weights: {},
  batch: null,
  byId: {},
  minimized: false,

  startBatch: (jobIds, seed, weights) =>
    set({
      jobIds,
      seed,
      weights,
      // Batch inicial desde el seed → la vista de progreso monta de inmediato,
      // sin pantalla en blanco (feedback instantáneo, handoff §7).
      batch: aggregateBatch(
        jobIds.map((id) => seed[id]).filter((d): d is DocProgress => Boolean(d)),
        weights,
      ),
      byId: seed,
      minimized: false,
    }),
  syncBatch: (batch, byId) => set({ batch, byId }),
  // "Omitir" es acción de cliente (F1 §3.7 / handoff §7): deja de contarlo.
  skip: (docId) =>
    set((s) => ({ jobIds: s.jobIds.filter((id) => id !== docId) })),
  setMinimized: (v) => set({ minimized: v }),
  clear: () => set({ jobIds: [], seed: {}, weights: {}, batch: null, byId: {}, minimized: false }),
}));
