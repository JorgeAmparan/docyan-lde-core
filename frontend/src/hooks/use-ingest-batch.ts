"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import {
  type BatchProgress,
  type DocProgress,
  aggregateBatch,
  isActive,
} from "@/lib/ingesta";

/**
 * useIngestBatch — orquestación de lote DEL LADO CLIENTE (F1 §3.4, handoff §6.3).
 *
 * Recibe los `job_id` confirmados, sondea `GET /ingesta/documents/{id}/status`
 * cada `pollMs` (2–3 s, NO SSE — decisión rectora #4) por cada job activo, y
 * agrega los N `DocProgress` en un `BatchProgress`. Deja de sondear un job al
 * llegar a estado terminal. Dispara callbacks por diff de status (active waiting:
 * los avisos no dependen de que la pantalla siga abierta — el componente los
 * traduce a toasts/banner).
 */
export interface UseIngestBatchOptions {
  pollMs?: number;
  token?: string | null;
  /** Trabajo estimado por doc (segundos de la cotización) para ponderar el pct. */
  weights?: Record<string, number>;
  onDocCompleted?: (doc: DocProgress) => void;
  onDocError?: (doc: DocProgress) => void;
  onBatchCompleted?: (batch: BatchProgress) => void;
}

export interface UseIngestBatch {
  batch: BatchProgress;
  byId: Record<string, DocProgress>;
  /** Fuerza un re-poll inmediato (p.ej. tras un retry manual). */
  refresh: () => void;
  polling: boolean;
}

const DEFAULT_POLL_MS = 2500;

export function useIngestBatch(
  jobIds: string[],
  seed: Record<string, DocProgress> = {},
  opts: UseIngestBatchOptions = {},
): UseIngestBatch {
  const { pollMs = DEFAULT_POLL_MS, token, weights } = opts;
  const [byId, setById] = useState<Record<string, DocProgress>>(seed);
  const [polling, setPolling] = useState(false);

  // Refs para los callbacks y el diff de status (no re-suscribir el intervalo).
  const prevStatus = useRef<Record<string, string>>({});
  const batchDoneFired = useRef(false);
  const cbRef = useRef(opts);
  cbRef.current = opts;
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const idsKey = jobIds.join(",");

  // Nuevo lote (cambia el set de jobIds): reinicia el estado a su seed y rearma
  // los disparadores de toast/banner (rehidratación, handoff §6.7).
  useEffect(() => {
    setById({ ...seedRef.current });
    prevStatus.current = {};
    batchDoneFired.current = false;
  }, [idsKey]);

  const pollOnce = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) return;
    const snapshots = await Promise.all(
      ids.map(async (id) => {
        try {
          return await api.get<DocProgress>(`/ingesta/documents/${id}/status`, { token });
        } catch {
          // Backend no responde para ESTE job: conserva el último snapshot (no
          // inventa datos). Si nunca respondió, se omite del lote este ciclo.
          return null;
        }
      }),
    );

    setById((cur) => {
      const next = { ...cur };
      for (const s of snapshots) {
        if (s) next[s.docId] = s;
      }
      // Diff de status → callbacks (toasts/banner). active waiting.
      for (const s of snapshots) {
        if (!s) continue;
        const prev = prevStatus.current[s.docId];
        if (prev !== s.status) {
          if (s.status === "completado") cbRef.current.onDocCompleted?.(s);
          else if (s.status === "error") cbRef.current.onDocError?.(s);
          prevStatus.current[s.docId] = s.status;
        }
      }
      return next;
    });
  }, [idsKey, token]);

  // Loop de polling: se detiene cuando no quedan jobs activos.
  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setPolling(false);
      return;
    }
    let cancelled = false;
    setPolling(true);

    const tick = async () => {
      if (cancelled) return;
      await pollOnce();
    };
    void tick(); // primer poll inmediato (feedback instantáneo)
    const handle = setInterval(() => {
      // ¿quedan activos? si no, deja de sondear.
      setById((cur) => {
        const activos = ids.some((id) => {
          const d = cur[id];
          return !d || isActive(d.status);
        });
        if (!activos) {
          clearInterval(handle);
          setPolling(false);
        }
        return cur;
      });
      void tick();
    }, pollMs);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [idsKey, pollMs, pollOnce]);

  const batch = aggregateBatch(
    (idsKey ? idsKey.split(",") : []).map((id) => byId[id]).filter(Boolean) as DocProgress[],
    weights,
  );

  // Banner de fin de lote (una sola vez).
  useEffect(() => {
    if (
      !batchDoneFired.current &&
      batch.docs.length > 0 &&
      batch.counts.completado + batch.counts.error === batch.docs.length
    ) {
      batchDoneFired.current = true;
      cbRef.current.onBatchCompleted?.(batch);
    }
  }, [batch]);

  return { batch, byId, refresh: () => void pollOnce(), polling };
}
