"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/icon";
import {
  type BatchProgress,
  type DocProgress,
  PHASE_ORDER,
  PHASE_WEIGHTS,
} from "@/lib/ingesta";

/**
 * IngestBatch — progreso de procesamiento en vivo (Capa A · Admin › Ingesta).
 *
 * Portado 1:1 del mock de Claude Design (docs/handoff-ingesta/ingesta-progress.jsx),
 * SIN el motor de simulación: el estado viene de `batch` (agregado en cliente a
 * partir del polling real por job). Conserva los 4 mecanismos que hacen que
 * ~600 s no se sientan colgados: 5 tramos nombrados, contadores reales, ticker que
 * "respira" y ETA con cadencia tranquila (handoff §1). Visual gana el handoff;
 * datos/lógica, el contrato F1.
 */

function iconForKind(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes("ocr") || k.includes("scan")) return "file-scan";
  if (k.includes("xls")) return "file-spreadsheet";
  if (k.includes("png") || k.includes("jpg") || k.includes("image")) return "file-scan";
  return "file-text";
}

export interface IngestBatchProps {
  batch: BatchProgress;
  onRetry?: (docId: string) => void;
  onSkip?: (docId: string) => void;
  onConsult?: (doc: DocProgress) => void;
  onMinimize?: () => void;
  onNewIngest?: () => void;
}

export function IngestBatch({
  batch,
  onRetry,
  onSkip,
  onConsult,
  onMinimize,
  onNewIngest,
}: IngestBatchProps) {
  const { t } = useTranslation("common");
  const [blip, setBlip] = useState(0);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Ticker que "respira" (cadencia tranquila ~1.4 s). Sin simulación de datos:
  // solo rota la línea de actividad sobre los contadores reales (handoff §1).
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setBlip((b) => b + 1), 1400);
    return () => clearInterval(id);
  }, [reduce]);

  const total = batch.docs.length;
  const { completado, procesando, encolado, error } = batch.counts;
  const finished = total > 0 && completado + error === total;
  const procDoc = batch.docs.find((d) => d.status === "procesando" || d.status === "cargando");

  return (
    <div className={"ingest-batch" + (reduce ? " reduce" : "")}>
      {!finished ? (
        <div className="batch-head">
          <div className="bh-row">
            <div className="bh-title">
              <span className="bh-spin">
                <Icon name="loader" size={16} />
              </span>
              <div className="bh-tt">
                <div className="bh-h">{t("ingesta.batch.processing", { count: total })}</div>
                <div className="bh-sub">
                  {procDoc ? (
                    <>
                      {t("ingesta.batch.processingDoc")} <b>{procDoc.name}</b>
                    </>
                  ) : (
                    t("ingesta.batch.preparing")
                  )}
                </div>
              </div>
            </div>
            <div className="bh-eta">
              <div className="bh-eta-big">{fmtEta(batch.etaSeconds, t)}</div>
              <div className="bh-eta-sm mono">{t("ingesta.batch.remaining")}</div>
            </div>
          </div>
          <div className="batch-bar">
            <i style={{ width: batch.pct + "%" }} />
          </div>
          <div className="bh-meta">
            <span className="bh-pct mono">{t("ingesta.batch.pctOfBatch", { pct: Math.round(batch.pct) })}</span>
            <span className="bh-counts">
              <span className="bc ok"><span className="bc-dot" />{t("ingesta.counts.completado", { n: completado })}</span>
              <span className="bc proc"><span className="bc-dot" />{t("ingesta.counts.procesando", { n: procesando })}</span>
              <span className="bc enc"><span className="bc-dot" />{t("ingesta.counts.encolado", { n: encolado })}</span>
              {error > 0 && (
                <span className="bc bad"><span className="bc-dot" />{t("ingesta.counts.error", { n: error })}</span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="batch-done">
          <div className="bd-ic">
            <Icon name="check-check" size={22} />
          </div>
          <div className="bd-main">
            <div className="bd-h">{t("ingesta.batch.doneTitle")}</div>
            <div className="bd-sub">
              {t("ingesta.batch.doneSub", { n: completado })}
              {error > 0 && (
                <>
                  {" · "}
                  <b className="bd-err">{t("ingesta.batch.doneErr", { k: error })}</b>
                </>
              )}
            </div>
          </div>
          <div className="bd-acts">
            <button className="mini-btn" onClick={onMinimize}>
              <Icon name="history" size={14} />
              {t("ingesta.actions.history")}
            </button>
            <button className="primary-btn" onClick={onNewIngest}>
              <Icon name="plus" size={15} />
              {t("ingesta.actions.newIngest")}
            </button>
          </div>
        </div>
      )}

      {/* Active waiting: minimizar deja al admin navegar (handoff §0.4). */}
      {!finished && (
        <div className="batch-actions">
          <span className="spacer" />
          <button className="link-btn" onClick={onMinimize}>
            {t("ingesta.actions.minimize")}
          </button>
        </div>
      )}

      <div className="idoc-list">
        {batch.docs.map((d) => (
          <DocRow
            key={d.docId}
            doc={d}
            blip={blip}
            onRetry={onRetry}
            onSkip={onSkip}
            onConsult={onConsult}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseBar({ doc }: { doc: DocProgress }) {
  const { t } = useTranslation("common");
  const activeIdx = doc.phase ? PHASE_ORDER.indexOf(doc.phase) : -1;
  return (
    <div className="iphases">
      {PHASE_ORDER.map((p, idx) => {
        const fill = idx < activeIdx ? 1 : idx === activeIdx ? doc.phaseFraction : 0;
        const state = idx < activeIdx ? "done" : idx === activeIdx ? "active" : "pending";
        return (
          <div className="iph" key={p} style={{ flexGrow: PHASE_WEIGHTS[p] }} data-st={state}>
            <div className="iph-track">
              <i style={{ width: fill * 100 + "%" }} />
            </div>
            <div className="iph-lab">
              {state === "done" && <Icon name="check" size={10} />}
              {t(`ingesta.phase.${p}`)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocRow({
  doc,
  blip,
  onRetry,
  onSkip,
  onConsult,
}: {
  doc: DocProgress;
  blip: number;
  onRetry?: (id: string) => void;
  onSkip?: (id: string) => void;
  onConsult?: (doc: DocProgress) => void;
}) {
  const { t } = useTranslation("common");

  if (doc.status === "encolado")
    return (
      <div className="idoc q">
        <span className="idoc-ic">
          <Icon name={iconForKind(doc.kind)} size={17} />
        </span>
        <div className="idoc-main">
          <div className="idoc-name">{doc.name}</div>
          <div className="idoc-sub mono">{doc.kind}</div>
        </div>
        <span className="idoc-status enc">
          <Icon name="clock" size={12} />
          {t("ingesta.queuePosition", { n: doc.queuePosition ?? "—" })}
        </span>
      </div>
    );

  if (doc.status === "completado")
    return (
      <div className="idoc done">
        <span className="idoc-ic ok">
          <Icon name="check" size={16} />
        </span>
        <div className="idoc-main">
          <div className="idoc-name">{doc.name}</div>
          <div className="idoc-sub ok">
            <Icon name="circle-check-big" size={12} />
            {doc.disponibleParaConsulta
              ? t("ingesta.doc.completedAvailable")
              : t("ingesta.doc.completed")}
          </div>
        </div>
        <button className="link-btn" onClick={() => onConsult?.(doc)}>
          {t("ingesta.actions.consult")}
        </button>
      </div>
    );

  if (doc.status === "error")
    return (
      <div className="idoc err">
        <span className="idoc-ic bad">
          <Icon name="alert-triangle" size={15} />
        </span>
        <div className="idoc-main">
          <div className="idoc-name">{doc.name}</div>
          <div className="idoc-sub bad">
            <Icon name="x-circle" size={12} />
            {t("ingesta.doc.error", { reason: doc.error?.message ?? "" })}
          </div>
        </div>
        <div className="idoc-acts">
          <button className="mini-btn" onClick={() => onRetry?.(doc.docId)}>
            <Icon name="rotate-ccw" size={13} />
            {t("ingesta.actions.retry")}
          </button>
          <button className="link-btn" onClick={() => onSkip?.(doc.docId)}>
            {t("ingesta.actions.skip")}
          </button>
        </div>
      </div>
    );

  // procesando / cargando — tarjeta expandida
  return (
    <div className="idoc live">
      <div className="idoc-top">
        <span className="idoc-ic live">
          <Icon name={iconForKind(doc.kind)} size={17} />
        </span>
        <div className="idoc-main">
          <div className="idoc-name">{doc.name}</div>
          <div className="idoc-sub mono">{doc.kind}</div>
        </div>
        <span className={"idoc-status " + (doc.status === "cargando" ? "load" : "proc")}>
          <span className="pdot" />
          {doc.status === "cargando" ? t("ingesta.status.cargando") : t("ingesta.status.procesando")}
        </span>
        <span className="idoc-pct mono">{Math.round(doc.pct)}%</span>
      </div>

      <PhaseBar doc={doc} />

      <div className="idoc-foot">
        <span className="idoc-detail mono">{detailLine(doc, t)}</span>
        <span className="idoc-eta mono">
          {doc.etaSeconds != null ? t("ingesta.doc.eta", { clock: fmtClock(doc.etaSeconds) }) : ""}
        </span>
      </div>
      <div className="idoc-tick">
        <span className="tk-dot" />
        <span key={blip} className="tk-txt">
          {tickerLine(doc, blip, t)}
        </span>
      </div>
    </div>
  );
}

// ── Formato / textos derivados de contadores reales ─────────────────────────

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function fmtEta(s: number, t: TFunc): string {
  if (s <= 0.5) return "—";
  if (s < 12) return t("ingesta.eta.seconds");
  if (s < 75) return t("ingesta.eta.lessThanMinute");
  return t("ingesta.eta.minutes", { n: Math.round(s / 60) });
}

function fmtClock(s: number): string {
  const v = Math.max(0, Math.round(s));
  return Math.floor(v / 60) + ":" + String(v % 60).padStart(2, "0");
}

function detailLine(doc: DocProgress, t: TFunc): string {
  const c = doc.counters ?? {};
  switch (doc.phase) {
    case "descarga":
      return c.bytesTotal ? `${fmtMb(c.bytes)} / ${fmtMb(c.bytesTotal)} MB` : "";
    case "conversion":
      return c.pages ? t("ingesta.detail.conversion", { page: c.page ?? c.pages, pages: c.pages }) : "";
    case "extraccion":
      return t("ingesta.detail.extraccion", {
        page: c.page ?? 0,
        spans: c.spans ?? 0,
        entities: c.entities ?? 0,
      });
    case "grafo":
      return t("ingesta.detail.grafo", {
        entities: c.entities ?? 0,
        relations: c.relations ?? 0,
        relationsTotal: c.relationsTotal ?? c.relations ?? 0,
      });
    case "dedup":
      return t("ingesta.detail.dedup", { merged: c.merged ?? 0, entities: c.entities ?? 0 });
    default:
      return "";
  }
}

function tickerLine(doc: DocProgress, blip: number, t: TFunc): string {
  const c = doc.counters ?? {};
  const variants: Record<string, string[]> = {
    descarga: ["ingesta.ticker.descarga.0", "ingesta.ticker.descarga.1", "ingesta.ticker.descarga.2"],
    conversion: ["ingesta.ticker.conversion.0", "ingesta.ticker.conversion.1"],
    extraccion: ["ingesta.ticker.extraccion.0", "ingesta.ticker.extraccion.1"],
    grafo: ["ingesta.ticker.grafo.0", "ingesta.ticker.grafo.1"],
    dedup: ["ingesta.ticker.dedup.0", "ingesta.ticker.dedup.1"],
  };
  const keys = doc.phase ? variants[doc.phase] ?? [] : [];
  if (keys.length === 0) return "";
  const key = keys[blip % keys.length];
  return t(key, {
    page: c.page ?? c.pages ?? 0,
    pages: c.pages ?? 0,
    spans: c.spans ?? 0,
    entities: c.entities ?? 0,
    relations: c.relations ?? 0,
    merged: c.merged ?? 0,
  });
}

function fmtMb(bytes?: number): string {
  if (!bytes) return "0.0";
  return (bytes / (1024 * 1024)).toFixed(1);
}
