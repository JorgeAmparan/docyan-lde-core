"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useIngestStore } from "@/lib/ingest-store";
import { useIngestBatch } from "@/hooks/use-ingest-batch";

/**
 * Watcher global de ingesta (active waiting, handoff §0.4 / F1 §3.6).
 *
 * Montado una sola vez en Providers. Cuando hay un lote activo en el store,
 * sondea los jobs (vía useIngestBatch) sin importar en qué pantalla esté el
 * admin, sincroniza el resultado al store y dispara los avisos (toasts) a nivel
 * app — el aviso de completado NO depende de la pantalla de ingesta.
 */
export function GlobalIngestWatcher() {
  const { t } = useTranslation("common");
  const token = useAuth((s) => s.token);
  const jobIds = useIngestStore((s) => s.jobIds);
  const seed = useIngestStore((s) => s.seed);
  const weights = useIngestStore((s) => s.weights);
  const syncBatch = useIngestStore((s) => s.syncBatch);

  const { batch, byId } = useIngestBatch(jobIds, seed, {
    token,
    weights,
    onDocCompleted: (d) => toast.success(t("ingesta.toast.docCompleted"), { description: d.name }),
    onDocError: (d) =>
      toast.error(t("ingesta.toast.docError"), { description: d.name }),
    onBatchCompleted: (b) =>
      toast.success(t("ingesta.toast.batchCompleted"), {
        description: t("ingesta.batch.doneSub", { n: b.counts.completado }),
      }),
  });

  useEffect(() => {
    if (jobIds.length > 0) syncBatch(batch, byId);
  }, [batch, byId, jobIds.length, syncBatch]);

  return null;
}
