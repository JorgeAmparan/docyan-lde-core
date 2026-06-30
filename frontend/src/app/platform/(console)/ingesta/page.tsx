"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { Badge, PrivacyNote, StateBlock } from "@/components/platform/atoms";
import {
  usePlatformApi,
  JOB_STATE,
  PHASE_LABEL,
  fmtMoney,
  type JobSummary,
} from "@/lib/platform";

/**
 * Ingesta de documentos de PRUEBA — consola de plataforma (super-admin).
 *
 * Reutiliza el pipeline canónico de ingesta (cotizador → worker → Gemini →
 * GraphRAG-SDK) vía `/platform/test-ingesta/*`, cableado a un tenant de PRUEBA
 * destino (demo-/test-). Permite a Jorge cargar documentos y recorrer DOCYAN sin
 * dar de alta un cliente real.
 *
 * Nota de diseño: el kit de plataforma no trae pantalla de ingesta; se reutiliza
 * el vocabulario visual del kit de ingesta (dropzone, cot-card) dentro del shell
 * de plataforma. La cotización se presenta como COSTO DE CÓMPUTO estimado (tenant
 * de prueba, no se factura) — no se reusa la tarjeta de facturación de cliente
 * (cupo/freemium), que no aplica aquí; se mantiene la honestidad del dato.
 */

interface QuoteResp {
  job_id: string;
  status: string;
  tenant: string;
  tipo_documento?: string | null;
  cotizacion: {
    tokens_documento: number;
    costo_estimado_usd: number;
    tiempo_estimado_seg: number;
    decision: string;
    aprobado: boolean;
    motivo?: string;
  };
}

interface Quoted {
  jobId: string;
  name: string;
  tipo: string | null;
  tokens: number;
  costoUsd: number;
  aprobado: boolean;
  motivo?: string;
}

export default function PlatformIngestaPage() {
  const pf = usePlatformApi();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tenant, setTenant] = useState<string>("");
  const [quotes, setQuotes] = useState<Quoted[]>([]);
  const [submitted, setSubmitted] = useState<string[]>([]); // job_ids ya confirmados
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tenants de prueba sugeridos (alias → graph_name).
  const tenants = useQuery({
    queryKey: ["platform", "test-tenants"],
    queryFn: () => pf.get<{ tenants: Record<string, string> }>("/platform/test-ingesta/tenants"),
    enabled: !!pf.token,
  });

  // Progreso en vivo: reusa la cola tipada de plataforma; filtra a lo enviado.
  const jobs = useQuery({
    queryKey: ["platform", "jobs"],
    queryFn: () => pf.get<{ items: JobSummary[] }>("/platform/jobs"),
    enabled: !!pf.token && submitted.length > 0,
    refetchInterval: 4000,
  });
  const misJobs = useMemo(
    () => (jobs.data?.items ?? []).filter((j) => submitted.includes(j.job_id)),
    [jobs.data, submitted],
  );

  const tenantOk = /^(demo|test)-[a-z0-9-]+$/.test(tenant.trim());

  async function onFiles(list: FileList) {
    if (!tenantOk) {
      setError("Elige o escribe un tenant de prueba (debe empezar con 'demo-' o 'test-').");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const nuevos: Quoted[] = [];
      for (const f of Array.from(list)) {
        const form = new FormData();
        form.append("file", f, f.name);
        form.append("tenant", tenant.trim());
        const r = await pf.postForm<QuoteResp>("/platform/test-ingesta/documents", form);
        nuevos.push({
          jobId: r.job_id,
          name: f.name,
          tipo: r.tipo_documento ?? null,
          tokens: r.cotizacion.tokens_documento,
          costoUsd: r.cotizacion.costo_estimado_usd,
          aprobado: r.cotizacion.aprobado,
          motivo: r.cotizacion.motivo,
        });
      }
      setQuotes((q) => [...q, ...nuevos]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cotizar el documento.");
    } finally {
      setBusy(false);
    }
  }

  async function ingerir() {
    const aprobados = quotes.filter((q) => q.aprobado && !submitted.includes(q.jobId));
    if (aprobados.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const q of aprobados) {
        await pf.post(`/platform/test-ingesta/documents/${q.jobId}/confirm`);
      }
      setSubmitted((s) => [...s, ...aprobados.map((q) => q.jobId)]);
      setQuotes([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar la ingesta.");
    } finally {
      setBusy(false);
    }
  }

  const sugeridos = tenants.data?.tenants ?? {};
  const pendientes = quotes.filter((q) => q.aprobado).length;

  return (
    <>
      <div className="psec">
        <h2>Ingesta de documentos de prueba</h2>
        {submitted.length > 0 && (
          <span className="more" style={{ pointerEvents: "none" }}>
            <span className="live-tag"><span className="live-dot" /> En vivo</span>
          </span>
        )}
      </div>

      {/* Tenant de prueba destino */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="sec-h2"><h2>Tenant de prueba destino</h2></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(sugeridos).map(([alias, graph]) => (
            <button
              key={alias}
              className={"ing-mode" + (tenant === graph ? " on" : "")}
              onClick={() => setTenant(graph)}
              type="button"
            >
              <Icon name="flask-conical" size={14} /> {graph}
            </button>
          ))}
        </div>
        <input
          className="ct-select"
          style={{ width: "100%", maxWidth: 360 }}
          placeholder="demo-… o test-…"
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          aria-label="Tenant de prueba destino"
        />
        {tenant && !tenantOk && (
          <div className="manual-note warn" style={{ marginTop: 10 }}>
            <Icon name="alert-triangle" size={15} />
            El tenant debe empezar con <b>demo-</b> o <b>test-</b> (esta consola no ingiere a clientes).
          </div>
        )}
      </div>

      {/* Subida */}
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        data-testid="platform-ingesta-file"
        onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
      />
      <div
        className="dropzone"
        role="button"
        tabIndex={0}
        style={{ marginBottom: 16, opacity: tenantOk ? 1 : 0.55 }}
        onClick={() => tenantOk && fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && tenantOk && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files); }}
      >
        <Icon name="upload-cloud" size={26} />
        <div className="dz-t">Suelta documentos o haz clic para elegir</div>
        <div className="dz-m">PDF, DOCX, XLSX, imágenes — se ingieren con el pipeline real</div>
      </div>

      {busy && <StateBlock>Procesando…</StateBlock>}
      {error && (
        <div className="manual-note warn" role="alert" style={{ marginBottom: 14 }}>
          <Icon name="alert-triangle" size={15} /> {error}
        </div>
      )}

      {/* Cotización por documento (costo de cómputo; no se factura el tenant de prueba) */}
      {quotes.length > 0 && (
        <>
          <div className="sec-h2"><h2>Cotización</h2><span className="cnt">{quotes.length}</span></div>
          {quotes.map((q) => (
            <div key={q.jobId} className={"cot-card" + (q.aprobado ? "" : " rejected")} data-testid="platform-quote">
              <div className="ct-head">
                <span className="ct-ic"><Icon name="file-text" size={16} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ct-name">{q.name}</div>
                  <div className="ct-meta">
                    {(q.tipo ?? "tipo: el worker generará el schema")} · {(q.tokens / 1000).toFixed(1)}k tokens
                  </div>
                </div>
                <div className="ct-price">
                  <span className="price-chip cobro">{fmtMoney(q.costoUsd, "USD")}</span>
                  <div className="ct-price-sub">costo de cómputo estimado</div>
                </div>
              </div>
              {!q.aprobado && (
                <div className="cot-notice warn" role="alert">
                  <Icon name="alert-triangle" size={15} />
                  <span>{q.motivo ?? "El cotizador rechazó esta ingesta."}</span>
                </div>
              )}
            </div>
          ))}
          <button
            className="primary-btn"
            onClick={ingerir}
            disabled={busy || pendientes === 0}
            style={{ marginTop: 12 }}
          >
            <Icon name="play" size={15} /> Ingerir {pendientes} documento{pendientes === 1 ? "" : "s"}
          </button>
        </>
      )}

      {/* Progreso en vivo de lo enviado (cola real del worker) */}
      {misJobs.length > 0 && (
        <div className="ptbl-wrap" style={{ marginTop: 20 }}>
          <table className="ptbl">
            <thead><tr><th>Documento</th><th>Estado</th><th>Fase</th><th>Progreso</th></tr></thead>
            <tbody>
              {misJobs.map((j) => {
                const st = JOB_STATE[j.status] ?? { label: j.status, tone: "muted" as const, icon: "circle" };
                const done = j.status === "completed";
                return (
                  <tr key={j.job_id} className={done ? "dim" : ""}>
                    <td className="t-name">{j.nombre_archivo ?? j.job_id}</td>
                    <td><Badge tone={st.tone} icon={st.icon}>{st.label}</Badge></td>
                    <td>
                      {j.status === "failed" && j.error ? (
                        <span className="job-err"><Icon name="alert-triangle" size={12} /> {j.error}</span>
                      ) : j.phase ? (
                        <span className="phase-tag"><span className="pix" /> {PHASE_LABEL[j.phase] ?? j.phase}</span>
                      ) : <span className="t-sub">—</span>}
                    </td>
                    <td>
                      <span className="job-bar">
                        <i className={done ? "done" : j.status === "failed" ? "err" : ""} style={{ width: `${done ? 100 : (j.pct ?? 0)}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PrivacyNote>
        Ingesta de prueba para recorrer el producto. El tenant destino es de prueba (demo-/test-),
        no se factura, y la extracción corre por el pipeline real (Docling → Gemini → grafo). Aquí
        solo se ve metadata de cotización y progreso, nunca el contenido del documento.
      </PrivacyNote>
    </>
  );
}
