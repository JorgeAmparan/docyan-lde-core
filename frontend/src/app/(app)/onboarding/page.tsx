"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { FreemiumExcedePayload } from "@/lib/onboarding";

/**
 * Pantalla 4 (B13) — Onboarding Fase 1 (el momento "ájá"): bienvenida → sube tu
 * primer documento (cotización real, gate freemium) → DOCYAN lo procesa → haz tu
 * primera consulta citada → listo. Portado de `ui_kits/onboarding/onboarding-flow.jsx`.
 *
 * La carga del documento es REAL (`POST /ingesta/documents` → `/confirm`): pasa por
 * el cotizador y el gate de tamaño freemium (402). La primera consulta enlaza a la
 * superficie real `/consult` — no se fabrica una respuesta citada (verdad operacional).
 */
const STEPS: Array<[string, string]> = [
  ["sparkles", "Bienvenida"],
  ["upload-cloud", "Tu primer documento"],
  ["cpu", "DOCYAN lo procesa"],
  ["scan-line", "Tu primera consulta"],
  ["check-circle-2", "Listo"],
];

export default function OnboardingFase1Page() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [convert, setConvert] = useState<FreemiumExcedePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const cur = STEPS[step];

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setUploading(true);
    setErr(null);
    setConvert(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postForm<{ job_id: string; paginas_estimadas?: number }>(
        "/ingesta/documents",
        form,
        { token },
      );
      setFileName(file.name);
      setPages(res.paginas_estimadas ?? null);
      setJobId(res.job_id);
      // Confirma para que el worker procese (idempotente; el cobro lo gobierna el backend).
      await api.post(`/ingesta/documents/${res.job_id}/confirm`, undefined, { token }).catch(() => null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        const body = e.body as { detail?: FreemiumExcedePayload } | undefined;
        if (body?.detail?.error === "freemium_documento_excede_paginas") {
          setConvert(body.detail);
        } else {
          setErr(e.message);
        }
      } else {
        setErr(e instanceof ApiError ? e.message : "No pudimos cargar el documento.");
      }
    } finally {
      setUploading(false);
    }
  };

  const canNext = step === 1 ? !!jobId : true;
  const next = () => {
    if (step === STEPS.length - 1) {
      router.push("/documentos");
      return;
    }
    setStep(step + 1);
  };

  return (
    <div className="onb">
      <aside className="onb-rail">
        <BrandRow tone="light" size={26} />
        <span className="onb-free">
          <Icon name="gift" size={13} />
          Plan gratuito · 3 docs · 30 días
        </span>
        <div className="onb-steps">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={"onb-step" + (i === step ? " on" : "") + (i < step ? " done" : "")}
              onClick={() => i < step && setStep(i)}
            >
              <span className="osn">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>
              {s[1]}
            </div>
          ))}
        </div>
        <div className="rail-foot">
          El objetivo de hoy: llegar a tu primera respuesta con cita a la fuente. Eso es DOCYAN.
        </div>
      </aside>

      <div className="onb-main">
        <div className="onb-card">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.xlsx,.pptx"
            style={{ display: "none" }}
            onChange={onFile}
          />
          <div className="onb-progress">
            <span>
              {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </span>
            <span className="opbar">
              <i style={{ width: pct + "%" }} />
            </span>
            <span>{pct}%</span>
          </div>
          <div className="onb-ic">
            <Icon name={cur[0]} size={27} />
          </div>

          {step === 0 && (
            <>
              <h1>Bienvenido a DOCYAN</h1>
              <p className="onb-lead">
                Tus documentos dejan de estar muertos y dispersos. En los próximos minutos vas a
                ingerir uno y a hacer tu primera consulta con respuesta citada — el momento que lo
                explica todo.
              </p>
              <div className="onb-body">
                <div className="onb-hl">
                  {[
                    ["zap", "Time-to-value en días, no meses", "Sin proyecto de implementación de seis meses."],
                    ["file-check", "Ingiere tu documento como está", "DOCYAN lo lee tal cual: PDF, manual, MSDS o ficha."],
                    ["link", "Cada respuesta cita su fuente", "Pedigree a span exacto, encadenado criptográficamente."],
                  ].map((h) => (
                    <div className="hl" key={h[1]}>
                      <span className="hi">
                        <Icon name={h[0]} size={18} />
                      </span>
                      <div>
                        <div className="ht">{h[1]}</div>
                        <div className="hm">{h[2]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Sube tu primer documento</h1>
              <p className="onb-lead">
                Súbelo como está. DOCYAN lo lee tal cual — no necesitas prepararlo ni reformatearlo.
                Te mostramos el costo estimado antes de procesar.
              </p>
              <div className="onb-body">
                {!jobId ? (
                  <div className="dropzone" onClick={onPick}>
                    <div className="dz-ic">
                      <Icon name={uploading ? "loader-2" : "upload-cloud"} size={24} />
                    </div>
                    <div className="dz-t">
                      {uploading ? (
                        "Cotizando…"
                      ) : (
                        <>
                          Arrastra tu documento o <b>selecciona un archivo</b>
                        </>
                      )}
                    </div>
                    <div className="dz-m">PDF, DOCX, manual, MSDS o ficha — hasta ~100 páginas en el plan gratuito.</div>
                    <div className="dz-formats">
                      <span>PDF</span>
                      <span>DOCX</span>
                      <span>MANUAL</span>
                      <span>MSDS</span>
                      <span>FICHA</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="doc-sel">
                      <span className="ds-ic">
                        <Icon name="file-text" size={20} />
                      </span>
                      <div>
                        <div className="ds-n">{fileName}</div>
                        <div className="ds-m">
                          {pages != null ? `${pages} páginas` : "documento"} · en cola de procesamiento
                        </div>
                      </div>
                      <button
                        className="ds-x"
                        aria-label="Quitar"
                        onClick={() => {
                          setJobId(null);
                          setFileName(null);
                        }}
                      >
                        <Icon name="x" size={17} />
                      </button>
                    </div>
                    <div className="cost-row">
                      <Icon name="calculator" size={17} />
                      <span className="cr-t">Cotización aceptada</span>
                      <span className="cr-v">incluido en tu plan gratuito</span>
                    </div>
                  </>
                )}
                {err && (
                  <p className="warn" role="alert" style={{ marginTop: 12 }}>
                    {err}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>DOCYAN procesa tu documento</h1>
              <p className="onb-lead">
                Lo leemos como está, detectamos la entidad operativa que describe y lo dejamos
                consultable. El procesamiento corre en segundo plano; puedes seguir mientras termina.
              </p>
              <div className="onb-body">
                <div className="note info">
                  <Icon name="cpu" size={16} />
                  <span>
                    Tu documento está en la cola de ingesta. Cuando termine aparecerá como <b>vivo</b>{" "}
                    en Mis documentos, listo para consultar. No necesitas esperar aquí.
                  </span>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Haz tu primera consulta</h1>
              <p className="onb-lead">
                Este es el momento. Pregunta en tu idioma y recibe la respuesta con una cita
                cliqueable al span exacto de tu documento.
              </p>
              <div className="onb-body">
                <div className="onb-hl">
                  <div className="hl" style={{ cursor: "pointer" }} onClick={() => router.push("/consult")}>
                    <span className="hi">
                      <Icon name="scan-line" size={18} />
                    </span>
                    <div>
                      <div className="ht">Abrir la consulta</div>
                      <div className="hm">Pregunta y recibe respuesta con cita a la fuente exacta.</div>
                    </div>
                    <Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} />
                  </div>
                </div>
                <div className="aha">
                  <span className="aha-ic">
                    <Icon name="sparkles" size={20} />
                  </span>
                  <div>
                    <div className="aha-t">Eso es DOCYAN.</div>
                    <div className="aha-m">
                      Tu colaborador obtiene lo mismo escaneando el QR del equipo — sin cuenta, al pie
                      de la máquina.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>Listo. Tu primer CoDo está vivo.</h1>
              <p className="onb-lead">
                Ya viste el valor. Desde aquí puedes gestionar tus documentos, invitar a tu equipo o
                elegir un plan cuando lo necesites.
              </p>
              <div className="onb-body">
                <div className="onb-hl">
                  <div className="hl" style={{ cursor: "pointer" }} onClick={() => router.push("/documentos")}>
                    <span className="hi">
                      <Icon name="files" size={18} />
                    </span>
                    <div>
                      <div className="ht">Gestiona tus documentos</div>
                      <div className="hm">Hasta 3 documentos en el plan gratuito.</div>
                    </div>
                    <Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} />
                  </div>
                  <div className="hl" style={{ cursor: "pointer" }} onClick={() => router.push("/usuarios")}>
                    <span className="hi">
                      <Icon name="users" size={18} />
                    </span>
                    <div>
                      <div className="ht">Invita a tu equipo</div>
                      <div className="hm">Suma admins y editores; los colaboradores entran por QR.</div>
                    </div>
                    <Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} />
                  </div>
                  <div className="hl" style={{ cursor: "pointer" }} onClick={() => router.push("/plan")}>
                    <span className="hi">
                      <Icon name="gem" size={18} />
                    </span>
                    <div>
                      <div className="ht">Elige un plan</div>
                      <div className="hm">Cuando estés listo para más documentos y CoDos.</div>
                    </div>
                    <Icon name="chevron-right" size={18} style={{ marginLeft: "auto", color: "var(--fg-subtle)" }} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="onb-nav">
            {step > 0 && step < 4 && (
              <button className="btn ghost" onClick={() => setStep(step - 1)}>
                <Icon name="arrow-left" size={16} />
                Atrás
              </button>
            )}
            <button className="btn primary" style={{ marginLeft: "auto" }} disabled={!canNext} onClick={next}>
              {step === 0 ? "Empezar" : step === 4 ? "Ir a mis documentos" : "Continuar"}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </div>

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
              <b style={{ color: "var(--fg)" }}>~{convert.limite_paginas} páginas</b>. Pruébalo con
              uno más pequeño, o pasa a un plan pagado y sube documentos de{" "}
              <b style={{ color: "var(--fg)" }}>cualquier tamaño</b>.
            </p>
            <div className="m-actions stack">
              <button className="btn primary full" onClick={() => router.push("/plan")}>
                <Icon name="gem" size={16} />
                Pasar a un plan pagado
              </button>
              <button
                className="btn sec full"
                onClick={() => {
                  setConvert(null);
                  onPick();
                }}
              >
                <Icon name="arrow-left" size={16} />
                Probar con uno más pequeño
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
