"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { IngestBatch } from "@/components/ingesta/ingest-batch";
import { QuoteCard } from "@/components/ingesta/quote-card";
import { FuentesPanel } from "@/components/ingesta/fuentes-panel";
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
 * Portada al prototipo `IngestaView` del design system (cotizador.css): banner de
 * cupo, modos subir/conectar, análisis del lote (CotizaCard) y panel de resumen +
 * fórmula. Modelo Comercial Canónico: cupo del plan ($0) + setup por excedente.
 * NADA de saldo prepagado.
 *
 * Flujo real (decisión rectora #3, orquestación en cliente):
 *   subir ≤10 docs → POST /ingesta/documents por doc (cotiza + crea job) →
 *   cotización de lote agregada en cliente → confirmar los que caben bajo el cap
 *   de sesión → POST .../{job_id}/confirm por doc → vista de progreso viva
 *   (polling por job). CERO datos de demostración: si el backend no responde,
 *   error real, nunca fallback simulado (decisión rectora #11).
 *
 * Corrección de tipo (regla transversal #1): el usuario corrige el tipo en la
 * tarjeta; la página RE-COTIZA ese doc con `tipo_forzado` (el backend lo acepta
 * en POST /ingesta/documents) — honesto: el confirm no lleva body.
 */

// Fórmula canónica del setup por excedente (cotizador.md): MAX($15, costo×25).
const SETUP_PISO_USD = 15;
const SETUP_MULTIPLICADOR = 25;
const SETUP_FACTOR_COMPLEJIDAD = 1.0;

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
  tipo?: string | null;
  /** Quién resolvió el tipo (heurística / usuario / worker generará). */
  resolvedBy?: "heuristica" | "usuario" | "worker_generara" | null;
  /** Tipo forzado por el usuario (se reenvía al re-cotizar). */
  tipoForzado?: string | null;
  dentroCupo: boolean;
  cupoRestante?: number | null;
  /** Sin schema de catálogo: el worker lo generará → aviso honesto. */
  tipoNoCubierto: boolean;
  advertencia?: string | null;
  /** Banda A: precio de setup en MXN (FX Banxico congelado al cotizar). */
  setupLocal?: number | null;
  /** Páginas estimadas (ct-meta del prototipo). */
  pages?: number | null;
  /** El binario original (para re-cotizar con tipo_forzado sin re-pedirlo). */
  file?: File;
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
  paginas_estimadas?: number | null;
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

interface CupoEstado {
  aplica: boolean;
  cupo_restante: number;
  cupo_inicial: number;
  cupo_recurrente_mensual: number;
  dentro_de_cupo: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  freemium: "Freemium",
  esencial: "Esencial",
  profesional: "Profesional",
  enterprise: "Enterprise",
};

export default function IngestaPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const fileRef = useRef<HTMLInputElement>(null);

  const [quotes, setQuotes] = useState<QuotedDoc[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [modo, setModo] = useState<"subir" | "conectar">("subir");
  const [showFormula, setShowFormula] = useState(false);

  const jobIds = useIngestStore((s) => s.jobIds);
  const batch = useIngestStore((s) => s.batch);
  const minimized = useIngestStore((s) => s.minimized);
  const startBatch = useIngestStore((s) => s.startBatch);
  const setMinimized = useIngestStore((s) => s.setMinimized);
  const skip = useIngestStore((s) => s.skip);
  const clear = useIngestStore((s) => s.clear);

  const hasActiveBatch = jobIds.length > 0;

  // Plan + cupo del tenant → banner y presentación. El plan freemium tacha el valor
  // real (Total $0). El cupo viene del endpoint REAL `/ingesta/cupo`; el banner se
  // wirea a datos reales — sin plan ficticio. La moneda la decide la banda (MXN
  // Banda A vía FX Banxico, USD B/C) por doc (`cotizacion_local`).
  const [plan, setPlan] = useState<string | null>(null);
  const [cupo, setCupo] = useState<CupoEstado | null>(null);
  const isFreemium = plan === "freemium";

  useEffect(() => {
    if (!token) return;
    let alive = true;
    getOrg(token)
      .then((o) => alive && setPlan(o?.plan ?? null))
      .catch(() => {});
    api
      .get<CupoEstado>("/ingesta/cupo", { token })
      .then((c) => alive && setCupo(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  // ── Cotización de lote agregada (cap de sesión, gate de gasto) ──────────────
  const budget = SESSION_HARD_CAP_USD;

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

  // Documentos que caben y EXCEDEN el cupo (cobran setup) vs incluidos ($0).
  const incluidos = quotes.filter((q) => isFreemium || q.dentroCupo);
  const adicionales = fitIds.filter((id) => {
    const q = quotes.find((x) => x.jobId === id);
    return q && !isFreemium && !q.dentroCupo;
  });

  const fmtSetup = (usd: number, local: number) =>
    localCurrency === "MXN"
      ? `$${Math.round(local).toLocaleString("es-MX")} MXN`
      : `$${usd.toFixed(2)} USD`;

  // Total a cobrar (excedentes que caben). Freemium / todo en cupo → $0.
  const totalCobroUsd = adicionales.reduce((a, id) => {
    const q = quotes.find((x) => x.jobId === id);
    return a + (q?.setupUsd ?? 0);
  }, 0);
  const totalCobroLocal = adicionales.reduce((a, id) => {
    const q = quotes.find((x) => x.jobId === id);
    return a + (q?.setupLocal ?? 0);
  }, 0);
  const totalCobro = localCurrency === "MXN" ? totalCobroLocal : totalCobroUsd;
  const totalCobroLabel = isFreemium ? fmtSetup(0, 0) : fmtSetup(totalCobroUsd, totalCobroLocal);

  // Banner de cupo: wireado a datos REALES. Prioridad: endpoint /ingesta/cupo;
  // si el plan no lleva cupo (freemium / aplica=false), se deriva del lote
  // (cuántos caen dentro del cupo) sin inventar un plan ficticio.
  const cupoRestanteQuote = quotes.find((q) => q.cupoRestante != null)?.cupoRestante;
  const cupoBanner =
    cupo && cupo.aplica
      ? {
          restante: Math.max(0, cupo.cupo_restante - incluidos.length),
          recurrente: cupo.cupo_inicial || cupo.cupo_recurrente_mensual,
          usadoBase: cupo.cupo_inicial - cupo.cupo_restante,
        }
      : cupoRestanteQuote != null
        ? { restante: cupoRestanteQuote, recurrente: cupoRestanteQuote, usadoBase: 0 }
        : null;

  function mapQuote(r: UploadResponse, f: File, prevTipoForzado?: string | null): QuotedDoc {
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
      tipo: r.tipo_documento ?? null,
      resolvedBy: (r.tipo_resuelto_por as QuotedDoc["resolvedBy"]) ?? null,
      tipoForzado: prevTipoForzado ?? null,
      dentroCupo: c.dentro_de_cupo ?? false,
      cupoRestante: c.cupo_restante ?? null,
      tipoNoCubierto: r.tipo_resuelto_por === "worker_generara" || !r.tipo_documento,
      advertencia: r.advertencia,
      setupLocal: r.cotizacion_local?.moneda === "MXN" ? r.cotizacion_local.precio_setup : null,
      pages: r.paginas_estimadas ?? null,
      file: f,
    };
  }

  async function quoteFile(f: File, tipoForzado?: string | null): Promise<QuotedDoc> {
    const form = new FormData();
    form.append("file", f, f.name);
    if (tipoForzado) form.append("tipo_forzado", tipoForzado);
    const r = await api.postForm<UploadResponse>("/ingesta/documents", form, { token });
    return mapQuote(r, f, tipoForzado);
  }

  async function onFiles(fileList: FileList) {
    const files = Array.from(fileList).slice(0, INGEST_BATCH_MAX);
    setQuoting(true);
    setQuoteError(null);
    setQuotes([]);
    try {
      const results = await Promise.all(files.map((f) => quoteFile(f)));
      setQuotes(results);
    } catch (e) {
      // Backend no responde / error real → se muestra, NUNCA un fallback simulado.
      setQuoteError(e instanceof ApiError ? e.message : t("ingesta.page.quoteError"));
    } finally {
      setQuoting(false);
    }
  }

  /** Corrección de tipo (regla #1): re-cotiza ESE doc con `tipo_forzado`. El backend
   *  reclasifica/recalcula y devuelve un job nuevo; reemplazamos la tarjeta en sitio. */
  async function correctType(jobId: string, tipoForzado: string) {
    const q = quotes.find((x) => x.jobId === jobId);
    if (!q?.file) return;
    // Optimista: marca la selección de inmediato.
    setQuotes((cur) => cur.map((x) => (x.jobId === jobId ? { ...x, tipoForzado } : x)));
    try {
      const fresh = await quoteFile(q.file, tipoForzado);
      setQuotes((cur) => cur.map((x) => (x.jobId === jobId ? fresh : x)));
    } catch (e) {
      setQuoteError(e instanceof ApiError ? e.message : t("ingesta.page.quoteError"));
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
        fitIds.map((id) => api.post(`/ingesta/documents/${id}/confirm`, undefined, { token })),
      );
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

  function replaceDoc() {
    clear();
    fileRef.current?.click();
  }

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
    <div className="wrap">
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

      {/* Cupo del plan — wireado a /ingesta/cupo (real). */}
      {cupoBanner && (
        <div className="cupo-banner">
          <span className="cupo-ic">
            <Icon name="package-check" size={20} />
          </span>
          <div className="cupo-main">
            <div className="cupo-t">
              Tu plan incluye ingestas sin costo · te quedan{" "}
              <b>
                {cupoBanner.restante} de {cupoBanner.recurrente}
              </b>{" "}
              este mes
            </div>
            <div className="cupo-m">
              Las primeras del lote entran en tu cupo; los <b>adicionales desde ${SETUP_PISO_USD}</b>{" "}
              se cotizan antes de cobrar. Tú decides cuántos documentos cargas y cuándo.
            </div>
            <div className="cupo-pips">
              {Array.from({ length: cupoBanner.recurrente }).map((_, i) => (
                <span
                  key={i}
                  className={
                    "cupo-pip " +
                    (i < cupoBanner.usadoBase
                      ? "used"
                      : i < cupoBanner.recurrente - cupoBanner.restante
                        ? "used"
                        : "free")
                  }
                />
              ))}
            </div>
          </div>
          {plan && <span className="cupo-tier">{PLAN_LABEL[plan] ?? plan}</span>}
        </div>
      )}

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

      <div className="ing-grid">
        {/* Análisis del lote (izquierda) */}
        <div>
          <div className="ing-modes">
            <button
              className={"ing-mode" + (modo === "subir" ? " on" : "")}
              onClick={() => setModo("subir")}
            >
              <Icon name="upload-cloud" size={15} />
              Subir documentos
            </button>
            <button
              className={"ing-mode" + (modo === "conectar" ? " on" : "")}
              onClick={() => setModo("conectar")}
            >
              <Icon name="plug" size={15} />
              Conectar una fuente
            </button>
          </div>

          {modo === "subir" ? (
            <div
              className="dropzone"
              role="button"
              tabIndex={0}
              style={{ marginBottom: 16 }}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
              }}
            >
              <Icon name="upload-cloud" size={26} />
              <div className="dz-t">{t("ingesta.page.dropzone", { max: INGEST_BATCH_MAX })}</div>
              <div className="dz-m">{t("ingesta.page.formats")}</div>
            </div>
          ) : (
            <FuentesPanel />
          )}

          {quoting && (
            <div className="manual-note quoting" style={{ marginBottom: 14 }} data-testid="quoting-spinner">
              <span className="qc-spin">
                <Icon name="loader" size={15} />
              </span>
              {t("ingesta.page.quoting")}
            </div>
          )}

          {quoteError && (
            <div className="manual-note warn" style={{ marginBottom: 14 }} role="alert">
              <Icon name="alert-triangle" size={15} />
              {quoteError}
            </div>
          )}

          {quotes.length > 0 && (
            <>
              <div className="sec-h2">
                <h2>{t("ingesta.page.quoteTitle")}</h2>
                <span className="cnt">
                  {quotes.length} {quotes.length === 1 ? "documento" : "documentos"}
                </span>
              </div>
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
                    dentroCupo={q.dentroCupo}
                    tipoNoCubierto={q.tipoNoCubierto}
                    rejected={!q.aprobado}
                    overCap={q.aprobado && !fits}
                    advertencia={q.advertencia}
                    pages={q.pages}
                    tokens={q.tokens}
                    resolvedBy={q.resolvedBy}
                    tipoForzado={q.tipoForzado}
                    onTipoChange={(v) => correctType(q.jobId, v)}
                    onRemove={() => removeDoc(q.jobId)}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Resumen + cobro (derecha) */}
        <div>
          <div className="panel">
            <div className="sec-h2">
              <h2>{t("ingesta.page.aboutTitle")}</h2>
            </div>

            {quotes.length === 0 ? (
              <div className="manual-note">
                <Icon name="shield" size={15} />
                {t("ingesta.page.gateNote")}
              </div>
            ) : (
              <>
                <div className="sum-rows">
                  <div className="sum-row">
                    <span>Documentos en el lote</span>
                    <b>{quotes.length}</b>
                  </div>
                  <div className="sum-row">
                    <span>Incluidos en tu cupo</span>
                    <b style={{ color: "var(--success-600)" }}>{incluidos.length} · $0</b>
                  </div>
                  <div className="sum-row">
                    <span>Adicionales (× ${SETUP_PISO_USD} piso)</span>
                    <b>{adicionales.length}</b>
                  </div>
                  <div className="sum-row">
                    <span>Tiempo estimado</span>
                    <b>~{Math.max(1, Math.round(totalTime / 60))} min</b>
                  </div>
                  <div className="sum-row total">
                    <span>Total a cobrar</span>
                    <b>{totalCobroLabel}</b>
                  </div>
                </div>

                <div className="pay-dest">
                  <span className="pdi">
                    <Icon name="credit-card" size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="pdn">Transferencia / tarjeta (piloto)</div>
                    <div className="pdm">método de pago · destino del cobro</div>
                  </div>
                  <button className="pd-edit" type="button" disabled>
                    Cambiar
                  </button>
                </div>

                {/* Manejo explícito del cap de sesión → CONVERSIÓN, no recarga. */}
                {overCap && (
                  <div className="manual-note" style={{ marginBottom: 12 }}>
                    <Icon name="info" size={15} />
                    {t("ingesta.page.capExceeded", {
                      fit: fitIds.length,
                      total: quotes.length,
                      cap: SESSION_HARD_CAP_USD,
                    }) + " "}
                    Sube de plan para ingerir más{" "}
                    {STRIPE_ENABLED ? (
                      <a href="/plan">Ver planes</a>
                    ) : (
                      <a href={`mailto:${CONTACT_EMAIL}?subject=Subir de plan en DOCYAN LDE`}>
                        contáctanos para subir de plan
                      </a>
                    )}
                    .
                  </div>
                )}

                <div className="manual-note">
                  <Icon name="info" size={15} />
                  Cobro <b>manual durante el piloto</b>; Stripe se activa tras los primeros clientes.
                  El monto se reserva al confirmar y se liquida al costo real al completar.
                </div>

                <button
                  className="primary-btn"
                  onClick={confirmBatch}
                  disabled={confirming || fitIds.length === 0}
                  style={{ width: "100%", marginTop: 12 }}
                >
                  <Icon name="play" size={15} />
                  {confirming
                    ? t("ingesta.page.confirming")
                    : `Confirmar e ingerir lote${totalCobro > 0 ? " — " + totalCobroLabel : " — sin costo"}`}
                </button>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "var(--fg-subtle)",
                    lineHeight: 1.5,
                    margin: "12px 0 0",
                    textAlign: "center",
                  }}
                >
                  Nada se ingiere sin tu confirmación. El precio se ve antes de cobrar.
                </p>

                {/* Cómo se calcula el precio (fórmula canónica). */}
                <div className="formula-box">
                  <button className="formula-h" onClick={() => setShowFormula((v) => !v)}>
                    <Icon name="function-square" size={14} />
                    Cómo se calcula el precio
                    <Icon name="chevron-right" size={15} className={"chev" + (showFormula ? " open" : "")} />
                  </button>
                  {showFormula && (
                    <div className="formula-body">
                      <p style={{ margin: "0 0 9px" }}>
                        El precio se ancla al <b>valor</b>, no al cómputo (centavos por documento). El
                        cupo del plan cubre las primeras; al excedente se le aplica:
                      </p>
                      <p style={{ margin: "0 0 11px", textAlign: "center" }}>
                        <code>
                          MAX(${SETUP_PISO_USD}, costo × {SETUP_MULTIPLICADOR}) ×{" "}
                          {SETUP_FACTOR_COMPLEJIDAD.toFixed(1)}
                        </code>
                      </p>
                      <div className="fb-line">
                        <span>Piso mínimo</span>
                        <b>${SETUP_PISO_USD}.00</b>
                      </div>
                      <div className="fb-line">
                        <span>Multiplicador sobre costo</span>
                        <b>×{SETUP_MULTIPLICADOR}</b>
                      </div>
                      <div className="fb-line">
                        <span>Factor de complejidad</span>
                        <b>{SETUP_FACTOR_COMPLEJIDAD.toFixed(1)}</b>
                      </div>
                      <p style={{ margin: "9px 0 0", color: "var(--fg-subtle)" }}>
                        Para casi todo gana el piso; solo documentos enormes (300+ págs, OCR pesado)
                        activan el ×{SETUP_MULTIPLICADOR}. El tipo documental no cambia el precio — el
                        costo se mide por tokens.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
