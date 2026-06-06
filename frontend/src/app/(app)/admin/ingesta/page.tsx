"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { IngestBatch } from "@/components/ingesta/ingest-batch";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useIngestStore } from "@/lib/ingest-store";
import type { DocProgress } from "@/lib/ingesta";
import {
  CONTACT_EMAIL,
  INGEST_BATCH_MAX,
  SESSION_HARD_CAP_USD,
  STRIPE_ENABLED,
} from "@/lib/config";

/**
 * Ingesta — cotización de lote (gate sin bypass) + ingesta observable (F1).
 *
 * Flujo real (decisión rectora #3, orquestación en cliente):
 *   subir ≤10 docs → POST /ingesta/documents por doc (cotiza + crea job) →
 *   cotización de lote agregada en cliente → confirmar los que caben bajo
 *   saldo/hard cap → POST .../{job_id}/confirm por doc → vista de progreso viva
 *   (polling por job, agregado en cliente). CERO datos de demostración fijos: si el
 *   backend no responde, error real, nunca fallback simulado (decisión rectora #11).
 */

interface QuotedDoc {
  jobId: string;
  name: string;
  tokens: number;
  costUsd: number;
  timeSec: number;
  aprobado: boolean;
  decision: string;
  saldo: number;
  advertencia?: string | null;
}

interface UploadResponse {
  job_id: string;
  status: string;
  cotizacion: {
    tokens_documento: number;
    costo_estimado_usd: number;
    tiempo_estimado_seg: number;
    decision: string;
    aprobado: boolean;
    saldo_disponible_usd: number;
  };
  advertencia?: string | null;
}

export default function IngestaPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const fileRef = useRef<HTMLInputElement>(null);

  const [quotes, setQuotes] = useState<QuotedDoc[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const jobIds = useIngestStore((s) => s.jobIds);
  const batch = useIngestStore((s) => s.batch);
  const minimized = useIngestStore((s) => s.minimized);
  const startBatch = useIngestStore((s) => s.startBatch);
  const setMinimized = useIngestStore((s) => s.setMinimized);
  const skip = useIngestStore((s) => s.skip);
  const clear = useIngestStore((s) => s.clear);

  const hasActiveBatch = jobIds.length > 0;

  // ── Cotización de lote agregada (saldo + hard cap de sesión) ────────────────
  const saldo = quotes.length > 0 ? quotes[0].saldo : null;
  const budget = Math.min(saldo ?? Infinity, SESSION_HARD_CAP_USD);

  const { fitIds, totalCost, totalTime, overflowIds } = useMemo(() => {
    let cum = 0;
    const fit: string[] = [];
    const overflow: string[] = [];
    let cost = 0;
    let time = 0;
    for (const q of quotes) {
      const next = cum + q.costUsd;
      if (q.aprobado && next <= budget) {
        cum = next;
        cost += q.costUsd;
        time += q.timeSec;
        fit.push(q.jobId);
      } else {
        overflow.push(q.jobId);
      }
    }
    return { fitIds: fit, totalCost: cost, totalTime: time, overflowIds: overflow };
  }, [quotes, budget]);

  async function onFiles(fileList: FileList) {
    const files = Array.from(fileList).slice(0, INGEST_BATCH_MAX);
    setQuoting(true);
    setQuoteError(null);
    setQuotes([]);
    try {
      const results = await Promise.all(
        files.map(async (f) => {
          const form = new FormData();
          form.append("file", f, f.name);
          const r = await api.postForm<UploadResponse>("/ingesta/documents", form, { token });
          const c = r.cotizacion;
          return {
            jobId: r.job_id,
            name: f.name,
            tokens: c.tokens_documento,
            costUsd: c.costo_estimado_usd,
            timeSec: c.tiempo_estimado_seg,
            aprobado: c.aprobado,
            decision: c.decision,
            saldo: c.saldo_disponible_usd,
            advertencia: r.advertencia,
          } as QuotedDoc;
        }),
      );
      setQuotes(results);
    } catch (e) {
      // Backend no responde / error real → se muestra, NUNCA un fallback simulado.
      setQuoteError(e instanceof ApiError ? e.message : t("ingesta.page.quoteError"));
    } finally {
      setQuoting(false);
    }
  }

  function removeDoc(jobId: string) {
    setQuotes((cur) => cur.filter((q) => q.jobId !== jobId));
  }

  async function confirmBatch() {
    if (fitIds.length === 0) return;
    setConfirming(true);
    try {
      await Promise.all(
        fitIds.map((id) =>
          api.post(`/ingesta/documents/${id}/confirm`, undefined, { token }),
        ),
      );
      // Monta la vista de progreso de inmediato (feedback instantáneo, handoff §7):
      // los docs arrancan en 'encolado' y el watcher global toma el relevo.
      const seed: Record<string, DocProgress> = {};
      const weights: Record<string, number> = {};
      fitIds.forEach((id, i) => {
        const q = quotes.find((x) => x.jobId === id)!;
        seed[id] = {
          docId: id,
          name: q.name,
          kind: q.name.split(".").pop() ?? "doc",
          status: "encolado",
          phase: null,
          phaseFraction: 0,
          pct: 0,
          etaSeconds: null,
          queuePosition: i + 1,
        };
        weights[id] = q.timeSec || 1;
      });
      startBatch(fitIds, seed, weights);
      setQuotes([]);
    } catch (e) {
      setQuoteError(e instanceof ApiError ? e.message : t("ingesta.page.confirmError"));
    } finally {
      setConfirming(false);
    }
  }

  async function retry(docId: string) {
    try {
      await api.post(`/ingesta/documents/${docId}/retry`, undefined, { token });
    } catch {
      // el watcher reflejará el estado real en el siguiente poll
    }
  }

  function consult(doc: DocProgress) {
    if (doc.consultUrl) router.push(doc.consultUrl);
  }

  const insufficient = saldo != null && quotes.some((q) => !q.aprobado);
  const overCap = overflowIds.length > 0 && quotes.every((q) => q.aprobado);

  // ── Vista de progreso activa (no minimizada) ────────────────────────────────
  if (hasActiveBatch && !minimized && batch) {
    return (
      <IngestBatch
        batch={batch}
        onRetry={retry}
        onSkip={skip}
        onConsult={consult}
        onMinimize={() => setMinimized(true)}
        onNewIngest={() => {
          clear();
          fileRef.current?.click();
        }}
      />
    );
  }

  return (
    <>
      {/* Banner minimizado: el lote sigue en segundo plano (active waiting). */}
      {hasActiveBatch && minimized && batch && (
        <div className="batch-head" style={{ marginBottom: 16 }}>
          <div className="bh-row">
            <div className="bh-title">
              <span className="bh-spin">
                <Icon name="loader" size={16} />
              </span>
              <div className="bh-tt">
                <div className="bh-h">
                  {t("ingesta.batch.processing", { count: batch.docs.length })}
                </div>
                <div className="bh-sub mono">
                  {t("ingesta.batch.pctOfBatch", { pct: Math.round(batch.pct) })}
                </div>
              </div>
            </div>
            <button className="mini-btn" onClick={() => setMinimized(false)}>
              <Icon name="maximize-2" size={14} />
              {t("ingesta.actions.viewProgress")}
            </button>
          </div>
          <div className="batch-bar">
            <i style={{ width: batch.pct + "%" }} />
          </div>
        </div>
      )}

      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h">
            <h2>{t("ingesta.page.quoteTitle")}</h2>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            data-testid="ingesta-file-input"
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
            }}
          />
          <div
            className="dropzone"
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
            }}
          >
            <Icon name="upload-cloud" size={26} />
            <div className="dz-t">
              {t("ingesta.page.dropzone", { max: INGEST_BATCH_MAX })}
            </div>
            <div className="dz-m">{t("ingesta.page.formats")}</div>
          </div>

          {quoting && (
            <div className="manual-note" style={{ marginTop: 14 }}>
              <Icon name="loader" size={15} />
              {t("ingesta.page.quoting")}
            </div>
          )}

          {quoteError && (
            <div className="manual-note warn" style={{ marginTop: 14 }} role="alert">
              <Icon name="alert-triangle" size={15} />
              {quoteError}
            </div>
          )}

          {quotes.length > 0 && (
            <>
              <div className="quote">
                <div className="qr2">
                  <span>{t("ingesta.page.costTotal")}</span>
                  <b className="mono">${totalCost.toFixed(2)} USD</b>
                </div>
                <div className="qr2">
                  <span>{t("ingesta.page.timeTotal")}</span>
                  <b className="mono">~{Math.round(totalTime / 60)} min</b>
                </div>
                <div className="qr2">
                  <span>{t("ingesta.page.balance")}</span>
                  <b className={"mono " + (insufficient ? "warn" : "ok")}>
                    {saldo != null ? `$${saldo.toFixed(2)} USD` : "—"}
                  </b>
                </div>
              </div>

              {/* Desglose por documento (real, por tiktoken) */}
              <div className="ing-breakdown" style={{ marginTop: 12 }}>
                {quotes.map((q) => {
                  const fits = fitIds.includes(q.jobId);
                  return (
                    <div className="pre-doc" key={q.jobId}>
                      <span className="pd-ic">
                        <Icon name="file-text" size={16} />
                      </span>
                      <div className="pd-main">
                        <div className="pd-name">{q.name}</div>
                        <div className="pd-sub mono">
                          {q.tokens.toLocaleString()} tok · ${q.costUsd.toFixed(2)} · ~
                          {Math.max(1, Math.round(q.timeSec / 60))} min
                          {!q.aprobado && ` · ${t("ingesta.page.rejected")}`}
                          {q.aprobado && !fits && ` · ${t("ingesta.page.overCapDoc")}`}
                        </div>
                      </div>
                      <button
                        className="link-btn"
                        onClick={() => removeDoc(q.jobId)}
                        aria-label={t("ingesta.page.removeDoc")}
                      >
                        {t("ingesta.actions.remove")}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Manejo explícito del hard cap / saldo (no rechazo en silencio) */}
              {(overCap || insufficient) && (
                <div className="manual-note" style={{ marginTop: 12 }}>
                  <Icon name="info" size={15} />
                  {insufficient
                    ? t("ingesta.page.insufficient")
                    : t("ingesta.page.capExceeded", {
                        fit: fitIds.length,
                        total: quotes.length,
                        cap: SESSION_HARD_CAP_USD,
                      })}
                  {!STRIPE_ENABLED ? (
                    <>
                      {" "}
                      <a
                        href={`mailto:${CONTACT_EMAIL}?subject=Recarga de saldo de ingesta DOCYAN`}
                      >
                        {t("ingesta.page.contactRecharge")}
                      </a>
                    </>
                  ) : (
                    <>
                      {" "}
                      <Link href="/cuenta/recharge">{t("ingesta.page.recharge")}</Link>
                    </>
                  )}
                </div>
              )}

              <button
                className="primary-btn"
                onClick={confirmBatch}
                disabled={confirming || fitIds.length === 0}
                style={{ marginTop: 12 }}
              >
                <Icon name="play" size={15} />
                {confirming
                  ? t("ingesta.page.confirming")
                  : t("ingesta.page.confirmBatch", { n: fitIds.length })}
              </button>
            </>
          )}
        </div>

        <div className="panel">
          <div className="sec-h">
            <h2>{t("ingesta.page.aboutTitle")}</h2>
          </div>
          <div className="manual-note">
            <Icon name="shield" size={15} />
            {t("ingesta.page.gateNote")}
          </div>
        </div>
      </div>
    </>
  );
}
