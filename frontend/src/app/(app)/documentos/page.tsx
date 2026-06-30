"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { OrgShell } from "@/components/org-shell";
import {
  listDocumentos,
  deleteDocumento,
  getCuenta,
  type DocumentoOut,
  type FreemiumExcedePayload,
} from "@/lib/onboarding";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { IngestProgressRow } from "@/components/ingesta/ingest-progress-row";
import { QuoteCard } from "@/components/ingesta/quote-card";

/** Respuesta de POST /ingesta/documents (cotización, NO ingiere). */
interface UploadResponse {
  job_id: string;
  tipo_documento?: string | null;
  tipo_resuelto_por?: string;
  cotizacion: {
    costo_estimado_usd: number;
    saldo_disponible_usd: number;
    aprobado: boolean;
    precio_setup_usd?: number;
    dentro_de_cupo?: boolean;
    cupo_restante?: number | null;
  };
  cotizacion_local?: { moneda: string; precio_setup: number } | null;
  advertencia?: string | null;
}

/** Cotización pendiente de APROBACIÓN explícita (control de gasto — todos los planes). */
interface PendingQuote {
  jobId: string;
  name: string;
  tipo: string | null;
  setupUsd: number;
  costUsd: number;
  setupLocal: number | null;
  aprobado: boolean;
  saldo: number;
  dentroCupo: boolean;
  cupoRestante: number | null;
  tipoNoCubierto: boolean;
  advertencia: string | null;
}

/**
 * Pantalla 6 (B13) — Gestión de documentos vivos. Lista real (`GET /mis-documentos`),
 * contador de cupo del plan, eliminar con confirmación (`DELETE /mis-documentos/{id}`),
 * y carga real que pasa por el cotizador: si una cuenta freemium sube un documento
 * de >100 páginas, el backend responde 402 con el payload de CONVERSIÓN (no un error
 * técnico seco). Portado de `ui_kits/onboarding/manage.jsx` → DocumentsView.
 */
export default function DocumentsPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mis-documentos"],
    queryFn: () => listDocumentos(token as string),
    enabled: !!token,
  });
  // Nombre real del plan para la línea de conteo (".cnt"): "plan Profesional",
  // "plan gratuito", etc. No se hardcodea — viene de /onboarding/cuenta.
  const { data: cuenta } = useQuery({
    queryKey: ["cuenta-resumen"],
    queryFn: () => getCuenta(token as string),
    enabled: !!token,
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["mis-documentos"] });

  const docs: DocumentoOut[] = data?.items ?? [];
  const limit = data?.doc_limit ?? null;
  const usados = data?.usados ?? 0;
  const disponibles = data?.disponibles ?? null;
  const loading = isLoading;
  const loadErr = error ? (error instanceof ApiError ? error.message : "No pudimos cargar tus documentos.") : null;

  const [toDelete, setToDelete] = useState<DocumentoOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [convert, setConvert] = useState<FreemiumExcedePayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Cotización pendiente de aprobación (gate de gasto SIEMPRE visible, incl. freemium).
  const [pendingQuote, setPendingQuote] = useState<PendingQuote | null>(null);
  const [approving, setApproving] = useState(false);
  // Job en ingesta activa: se sondea su estado real (D6) hasta término. No se
  // adivina con un timeout: el documento aparece cuando el worker termina.
  const [activeJob, setActiveJob] = useState<{ id: string; name: string } | null>(null);

  const isFreemium = limit !== null;
  const atLimit = limit !== null && usados >= limit;
  const remaining = disponibles ?? 0;

  const confirmDelete = async () => {
    if (!toDelete || !token) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteDocumento(toDelete.id, token);
      setToDelete(null);
      reload();
    } catch (e) {
      setDeleteErr(e instanceof ApiError ? e.message : "No pudimos eliminar el documento.");
    } finally {
      setDeleting(false);
    }
  };

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setUploading(true);
    setNotice(null);
    setConvert(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postForm<UploadResponse>("/ingesta/documents", form, { token });
      // PRINCIPIO CANÓNICO: la cotización con control de gasto + aprobación se muestra
      // SIEMPRE, en TODOS los planes (freemium ve Total $0.00 tachado pero DEBE
      // aprobar). NO se auto-confirma: se presenta la tarjeta y el usuario decide.
      const c = res.cotizacion;
      setPendingQuote({
        jobId: res.job_id,
        name: file.name,
        tipo: res.tipo_documento ?? null,
        setupUsd: c.precio_setup_usd ?? c.costo_estimado_usd,
        costUsd: c.costo_estimado_usd,
        setupLocal: res.cotizacion_local?.moneda === "MXN" ? res.cotizacion_local.precio_setup : null,
        aprobado: c.aprobado,
        saldo: c.saldo_disponible_usd,
        dentroCupo: c.dentro_de_cupo ?? false,
        cupoRestante: c.cupo_restante ?? null,
        tipoNoCubierto: res.tipo_resuelto_por === "worker_generara" || !res.tipo_documento,
        advertencia: res.advertencia ?? null,
      });
    } catch (err) {
      // 402 = gate de tamaño freemium → payload de conversión (no muro seco).
      if (err instanceof ApiError && err.status === 402) {
        const body = err.body as { detail?: FreemiumExcedePayload } | undefined;
        if (body?.detail?.error === "freemium_documento_excede_paginas") {
          setConvert(body.detail);
        } else {
          setNotice(err.message);
        }
      } else if (err instanceof ApiError && err.status === 409) {
        setNotice("Alcanzaste el límite de documentos de tu plan. Elimina uno o elige un plan.");
      } else {
        setNotice(err instanceof ApiError ? err.message : "No pudimos cargar el documento.");
      }
    } finally {
      setUploading(false);
    }
  };

  // Aprobación explícita → recién aquí se confirma y encola (gate de gasto).
  const approveQuote = async () => {
    if (!pendingQuote || !token) return;
    setApproving(true);
    try {
      await api.post(`/ingesta/documents/${pendingQuote.jobId}/confirm`, undefined, { token });
      setActiveJob({ id: pendingQuote.jobId, name: pendingQuote.name });
      setPendingQuote(null);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "No pudimos confirmar la ingesta.");
    } finally {
      setApproving(false);
    }
  };
  // Cancelar: el job queda en pending_confirmation y nunca se ingiere (sin cobro).
  const cancelQuote = () => setPendingQuote(null);

  const quoteCurrency: "USD" | "MXN" =
    pendingQuote?.setupLocal != null ? "MXN" : "USD";

  // Línea de conteo del prototipo: "N consultables · plan … · cupo …".
  // Bind real: conteo = lista real; plan = plan_nombre real; cupo = límite real
  // (ilimitado cuando el plan no impone doc_limit, como Profesional).
  const planNombre = cuenta?.plan_nombre ?? null;
  const cupoTexto =
    limit !== null
      ? `cupo ${limit} ${limit === 1 ? "documento" : "documentos"}`
      : "cupo ilimitado";
  const cntPartes = [
    `${docs.length} ${docs.length === 1 ? "consultable" : "consultables"}`,
    planNombre ? `plan ${planNombre}` : null,
    cupoTexto,
  ].filter(Boolean);
  const cnt = cntPartes.join(" · ");

  return (
    <OrgShell>
      <div className="documentos-view">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.xlsx,.pptx"
        style={{ display: "none" }}
        onChange={onFile}
      />

      <div className="sec-h2">
        <h2>Documentos vivos</h2>
        <span className="cnt">{cnt}</span>
      </div>
      <p className="dv-lead">
        Todo lo que ingieres queda aquí, consultable y citado. Eliminar un documento lo borra del
        grafo <b>sin residuo</b> y libera cupo del plan; el borrado se registra en el FAT.
      </p>

      {isFreemium && (
        <div className="usage-bar">
          <div className="ub-info">
            <div className="ub-t">Plan gratuito</div>
            <div className="ub-m">
              {remaining > 0
                ? `Te ${remaining === 1 ? "queda" : "quedan"} ${remaining} documento${remaining === 1 ? "" : "s"}`
                : "Has alcanzado el límite del plan gratuito"}
            </div>
          </div>
          <div className="ub-track">
            <div className="tk">
              <i className={atLimit ? "warn" : ""} style={{ width: (usados / (limit || 1)) * 100 + "%" }} />
            </div>
          </div>
          <div className="ub-num">
            <b>{usados}</b> / {limit}
          </div>
        </div>
      )}

      {loading && <p className="ac-sub" style={{ padding: "8px 2px" }}>Cargando tus documentos…</p>}
      {loadErr && (
        <p className="warn" role="alert">
          {loadErr}
        </p>
      )}
      {notice && (
        <div className="note" style={{ marginBottom: 12 }}>
          <Icon name="info" size={16} />
          <span>{notice}</span>
        </div>
      )}

      {activeJob && (
        <div style={{ marginBottom: 12 }}>
          <IngestProgressRow
            jobId={activeJob.id}
            name={activeJob.name}
            token={token}
            onCompleted={() => {
              setNotice(`“${activeJob.name}” quedó vivo y consultable.`);
              setActiveJob(null);
              reload();
            }}
            onError={(d) => {
              setNotice(d.error?.message ?? "La ingesta falló. Puedes reintentar.");
            }}
          />
        </div>
      )}

      {!loading && !loadErr && (
        <div className="panel flush">
          <div className="dv-head">
            <span className="dv-c-name">Documento</span>
            <span className="dv-c-tipo">Tipo documental</span>
            <span className="dv-c-meta">Detalle</span>
            <span className="dv-c-act" />
          </div>
          {docs.map((d) => {
            const sub = [
              d.idioma_origen?.toUpperCase(),
              d.version ? (d.version.startsWith("v") ? d.version : `v${d.version}`) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div className="dv-row" key={d.id}>
                <span className="dv-c-name">
                  <span className="dv-ic">
                    <Icon name="file-text" size={15} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="dv-n">{d.nombre_archivo ?? "Documento"}</span>
                    {sub && <span className="dv-sub">{sub}</span>}
                  </span>
                </span>
                <span className="dv-c-tipo">
                  {d.tipo_documento ? (
                    <span className="dv-tipo">{d.tipo_documento}</span>
                  ) : (
                    <span className="dv-tipo muted">genérico</span>
                  )}
                </span>
                <span className="dv-c-meta">
                  {d.contenido_directo}{" "}
                  {d.contenido_directo === 1 ? "nodo de contenido" : "nodos de contenido"}
                </span>
                <span className="dv-c-act">
                  <button
                    className="dv-del"
                    title="Eliminar y liberar cupo"
                    aria-label="Eliminar y liberar cupo"
                    onClick={() => setToDelete(d)}
                  >
                    <Icon name="trash-2" size={15} />
                  </button>
                </span>
              </div>
            );
          })}
          {docs.length === 0 && (
            <div className="dv-empty">
              No quedan documentos vivos. Ingiere desde <b>Ingesta</b> para empezar.
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {!atLimit ? (
          <>
            <div className="upload-cta" onClick={onPick}>
              <span className="uc-ic">
                <Icon name="upload-cloud" size={22} />
              </span>
              <div>
                <div className="uc-t">Cargar documento</div>
                <div className="uc-m">
                  Súbelo como está{isFreemium ? ` · ${remaining} disponible${remaining === 1 ? "" : "s"} en tu plan` : ""}
                </div>
              </div>
              <button
                className="btn sec uc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick();
                }}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Icon name="loader-2" size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Subiendo…
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={16} />
                    Cargar
                  </>
                )}
              </button>
            </div>
            {isFreemium && (
              <div className="limit-note">
                <Icon name="info" size={16} />
                <span>
                  Tu cuenta gratuita incluye hasta <b>{limit} documentos</b>, de hasta{" "}
                  <b>~100 páginas</b> cada uno. Para documentos más grandes o más volumen, elige un plan.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="upload-cta locked">
            <span className="uc-ic">
              <Icon name="lock" size={20} />
            </span>
            <div>
              <div className="uc-t">Límite del plan gratuito alcanzado</div>
              <div className="uc-m">Elimina un documento o elige un plan para cargar más.</div>
            </div>
            <button className="btn primary uc-btn" onClick={() => router.push("/plan")}>
              <Icon name="gem" size={16} />
              Elegir plan
            </button>
          </div>
        )}
      </div>

      <div className="manual-note" style={{ marginTop: 14 }}>
        <Icon name="shield-check" size={15} />
        Reemplazar = eliminar + volver a ingerir. Al borrar liberas cupo; luego cargas otro dentro
        del límite. El rastro auditable se conserva 7 años aunque canceles.
      </div>

      {toDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="m-ic danger">
              <Icon name="trash-2" size={24} />
            </div>
            <h3>Eliminar documento vivo</h3>
            <p>
              Se elimina “{toDelete.nombre_archivo ?? "Documento"}” del grafo, sin residuo, y se
              libera una posición de tu cupo. El evento queda en la bitácora FAT (auditoría),
              aunque el contenido deje de ser consultable. Para reemplazarlo, vuelve a ingerirlo.
            </p>
            <div className="m-doc">
              <Icon name="file-text" size={17} />
              {toDelete.nombre_archivo ?? "Documento"}
            </div>
            {deleteErr && (
              <p className="warn" role="alert">
                {deleteErr}
              </p>
            )}
            <div className="m-actions">
              <button className="btn sec" onClick={() => setToDelete(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn danger" onClick={confirmDelete} disabled={deleting}>
                <Icon name="trash-2" size={16} />
                {deleting ? "Eliminando…" : "Eliminar y liberar cupo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §1.1 — cotización SIEMPRE visible + aprobación explícita (todos los planes). */}
      {pendingQuote && (
        <div className="modal-overlay" onClick={() => !approving && cancelQuote()}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="m-ic" style={{ background: "var(--cinnabar-50)", color: "var(--cinnabar-600)" }}>
              <Icon name="receipt-text" size={22} />
            </div>
            <h3>Cotización de ingesta</h3>
            <p style={{ marginBottom: 4 }}>
              {isFreemium
                ? "Tu plan gratuito cubre el 100% de esta ingesta. Revisa el valor y aprueba para procesar."
                : "Revisa el costo de esta ingesta y aprueba para procesar. Sin aprobación no se cobra ni se ingiere."}
            </p>
            <div style={{ width: "100%", margin: "6px 0 4px" }}>
              <QuoteCard
                name={pendingQuote.name}
                tipo={pendingQuote.tipo}
                isFreemium={isFreemium}
                valueUsd={quoteCurrency === "MXN" ? (pendingQuote.setupLocal ?? pendingQuote.setupUsd) : pendingQuote.setupUsd}
                totalUsd={quoteCurrency === "MXN" ? (pendingQuote.setupLocal ?? pendingQuote.costUsd) : pendingQuote.costUsd}
                currency={quoteCurrency}
                saldoUsd={quoteCurrency === "USD" ? pendingQuote.saldo : null}
                dentroCupo={pendingQuote.dentroCupo}
                cupoRestante={pendingQuote.cupoRestante}
                tipoNoCubierto={pendingQuote.tipoNoCubierto}
                rejected={!pendingQuote.aprobado}
                advertencia={pendingQuote.advertencia}
              />
            </div>
            <div className="m-actions">
              <button className="btn sec" onClick={cancelQuote} disabled={approving}>
                Cancelar
              </button>
              <button
                className="btn primary"
                onClick={approveQuote}
                disabled={approving || !pendingQuote.aprobado}
              >
                <Icon name="check" size={16} />
                {approving ? "Aprobando…" : "Aprobar e ingerir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {convert && (
        <div className="modal-overlay" onClick={() => setConvert(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="m-ic" style={{ background: "var(--cinnabar-50)", color: "var(--cinnabar-600)" }}>
              <Icon name="sparkles" size={24} />
            </div>
            <h3>Este documento es grande para tu cuenta gratuita</h3>
            <span className="convert-pages">
              <Icon name="file-text" size={13} />
              {convert.paginas} páginas
            </span>
            <p>
              Tu cuenta gratuita admite documentos de hasta{" "}
              <b style={{ color: "var(--fg)" }}>~{convert.limite_paginas} páginas</b>. Este tiene{" "}
              {convert.paginas} — justo el tipo de documento donde DOCYAN rinde más. Pruébalo con uno
              más pequeño, o pasa a un plan pagado y sube documentos de{" "}
              <b style={{ color: "var(--fg)" }}>cualquier tamaño</b>.
            </p>
            <div className="m-actions stack">
              <button className="btn primary full" onClick={() => router.push("/plan")}>
                <Icon name="gem" size={16} />
                Pasar a un plan pagado
              </button>
              <button className="btn sec full" onClick={() => { setConvert(null); onPick(); }}>
                <Icon name="arrow-left" size={16} />
                Probar con uno más pequeño
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </OrgShell>
  );
}
