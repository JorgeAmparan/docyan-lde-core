"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { IngestBatch } from "@/components/ingesta/ingest-batch";
import { QuoteCard } from "@/components/ingesta/quote-card";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { getOrg, deleteDocumento } from "@/lib/onboarding";
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
  /** Precio de setup comercial (valor real de la ingesta, ancla de la tarjeta). */
  setupUsd: number;
  timeSec: number;
  aprobado: boolean;
  decision: string;
  saldo: number;
  tipo?: string | null;
  dentroCupo: boolean;
  cupoRestante?: number | null;
  /** Sin schema de catálogo: el worker lo generará → aviso honesto. */
  tipoNoCubierto: boolean;
  advertencia?: string | null;
  /** Banda A: precio de setup en MXN (FX Banxico congelado al cotizar). */
  setupLocal?: number | null;
}

interface CotizacionLocal {
  moneda: string;
  precio_setup: number;
  fx_fix: number;
  fx_fecha: string;
  fx_fuente: string;
  margen: number;
}

interface UploadResponse {
  job_id: string;
  status: string;
  tipo_documento?: string | null;
  tipo_resuelto_por?: string;
  cotizacion: {
    tokens_documento: number;
    costo_estimado_usd: number;
    costo_total_usd?: number;
    tiempo_estimado_seg: number;
    decision: string;
    aprobado: boolean;
    saldo_disponible_usd: number;
    precio_setup_usd?: number;
    dentro_de_cupo?: boolean;
    cupo_restante?: number | null;
  };
  cotizacion_local?: CotizacionLocal | null;
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

  // Plan del tenant → presentación de la cotización (freemium tacha el valor real
  // y muestra Total $0.00). La moneda la decide la banda del tenant: el backend
  // devuelve `cotizacion_local` (MXN para Banda A, FX Banxico congelado) por doc.
  const [isFreemium, setIsFreemium] = useState(false);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    getOrg(token)
      .then((o) => alive && setIsFreemium(o?.plan === "freemium"))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  // ── Cotización de lote agregada (saldo + hard cap de sesión) ────────────────
  const saldo = quotes.length > 0 ? quotes[0].saldo : null;
  const budget = Math.min(saldo ?? Infinity, SESSION_HARD_CAP_USD);

  // Banda A: el backend convierte el setup a MXN (FX congelado). Si algún quote trae
  // `setupLocal`, la tarjeta y el resumen se muestran en MXN; si no, en USD (B/C).
  const localCurrency: "USD" | "MXN" = quotes.some((q) => q.setupLocal != null) ? "MXN" : "USD";

  const { fitIds, totalCost, totalSetup, totalSetupLocal, totalTime, overflowIds } = useMemo(() => {
    let cum = 0;
    const fit: string[] = [];
    const overflow: string[] = [];
    let cost = 0;
    let setup = 0;
    let setupLocal = 0;
    let time = 0;
    for (const q of quotes) {
      const next = cum + q.costUsd;
      if (q.aprobado && next <= budget) {
        cum = next;
        cost += q.costUsd;
        setup += q.setupUsd;
        setupLocal += q.setupLocal ?? 0;
        time += q.timeSec;
        fit.push(q.jobId);
      } else {
        overflow.push(q.jobId);
      }
    }
    return { fitIds: fit, totalCost: cost, totalSetup: setup, totalSetupLocal: setupLocal, totalTime: time, overflowIds: overflow };
  }, [quotes, budget]);

  const fmtSetup = (usd: number, local: number) =>
    localCurrency === "MXN"
      ? `$${Math.round(local).toLocaleString("es-MX")} MXN`
      : `$${usd.toFixed(2)} USD`;

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
            setupUsd: c.precio_setup_usd ?? c.costo_estimado_usd,
            timeSec: c.tiempo_estimado_seg,
            aprobado: c.aprobado,
            decision: c.decision,
            saldo: c.saldo_disponible_usd,
            tipo: r.tipo_documento ?? null,
            dentroCupo: c.dentro_de_cupo ?? false,
            cupoRestante: c.cupo_restante ?? null,
            // worker_generara → no hubo match de catálogo: schema aún no optimizado.
            tipoNoCubierto: r.tipo_resuelto_por === "worker_generara" || !r.tipo_documento,
            advertencia: r.advertencia,
            // Banda A: el backend ya convirtió el setup a MXN (FX congelado).
            setupLocal: r.cotizacion_local?.moneda === "MXN" ? r.cotizacion_local.precio_setup : null,
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

  /** Reemplazar (§1.1.4): subir una versión nueva (in-place, decisión #11). Cierra
   *  el lote actual y reabre el selector de archivos para re-ingerir. */
  function replaceDoc() {
    clear();
    fileRef.current?.click();
  }

  /** Eliminar (§1.1.4) el documento vivo. El `doc_id` (SHA) viaja en consultUrl
   *  (`/consulta?doc={sha}`). Tras borrar, sale de la lista (estado terminal). */
  async function deleteLive(doc: DocProgress) {
    const sha = doc.consultUrl?.split("doc=")[1];
    if (sha) {
      try {
        await deleteDocumento(decodeURIComponent(sha), token as string);
      } catch {
        // el siguiente recorrido del admin reflejará el estado real del grafo
      }
    }
    skip(doc.docId);
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
        onReplace={replaceDoc}
        onDelete={deleteLive}
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
            <div className="manual-note quoting" style={{ marginTop: 14 }} data-testid="quoting-spinner">
              <span className="qc-spin">
                <Icon name="loader" size={15} />
              </span>
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
                  {isFreemium ? (
                    <span className="qr2-free">
                      <b className="mono qc-was">{fmtSetup(totalSetup, totalSetupLocal)}</b>
                      <b className="mono">{localCurrency === "MXN" ? "$0 MXN" : "$0.00 USD"}</b>
                    </span>
                  ) : (
                    <b className="mono">
                      {localCurrency === "MXN" ? fmtSetup(totalSetup, totalSetupLocal) : `$${totalCost.toFixed(2)} USD`}
                    </b>
                  )}
                </div>
                <div className="qr2">
                  <span>{t("ingesta.page.timeTotal")}</span>
                  <b className="mono">~{Math.round(totalTime / 60)} min</b>
                </div>
                {!isFreemium && (
                  <div className="qr2">
                    <span>{t("ingesta.page.balance")}</span>
                    <b className={"mono " + (insufficient ? "warn" : "ok")}>
                      {saldo != null ? `$${saldo.toFixed(2)} USD` : "—"}
                    </b>
                  </div>
                )}
              </div>

              {/* §1.1.2 — tarjeta de cotización por documento: el usuario VE el valor
                  real de cada ingesta y aprueba (ancla de valor, gate de gasto). */}
              <div className="quote-cards" style={{ marginTop: 12 }}>
                {quotes.map((q) => {
                  const fits = fitIds.includes(q.jobId);
                  return (
                    <QuoteCard
                      key={q.jobId}
                      name={q.name}
                      tipo={q.tipo}
                      isFreemium={isFreemium}
                      valueUsd={localCurrency === "MXN" ? (q.setupLocal ?? q.setupUsd) : q.setupUsd}
                      totalUsd={localCurrency === "MXN" ? (q.setupLocal ?? q.costUsd) : q.costUsd}
                      currency={localCurrency}
                      saldoUsd={localCurrency === "USD" ? q.saldo : null}
                      dentroCupo={q.dentroCupo}
                      cupoRestante={q.cupoRestante}
                      tipoNoCubierto={q.tipoNoCubierto}
                      rejected={!q.aprobado}
                      overCap={q.aprobado && !fits}
                      advertencia={q.advertencia}
                      onRemove={() => removeDoc(q.jobId)}
                    />
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
