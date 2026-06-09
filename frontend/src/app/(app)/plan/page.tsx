"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { activarPlan } from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * Pantalla 5 (B13) — Onboarding Fase 2. Selección de plan (3 tiers · banda por
 * geolocalización) + criticidad del segmento (decisión #15, fija el umbral de
 * confianza) → activa el plan (`POST /onboarding/plan`). Portado de
 * `ui_kits/onboarding/plan.jsx`. Modelo comercial canónico del brief B13:
 * Esencial $250 / Profesional $550 / Enterprise desde $1,200 — banda A base, B +40%, C +50%.
 */
const BANDS: Array<[string, string, string, number]> = [
  ["A", "Base", "Norteamérica · Europa occidental", 1.0],
  ["B", "+40%", "UK · Australia · Golfo", 1.4],
  ["C", "+50%", "LatAm · mercados emergentes", 1.5],
];
const F2_PLANS = [
  { name: "Esencial", key: "esencial", base: 250, from: false, rec: false, blurb: "Para un equipo o un CoDo.", feat: ["50 documentos vivos", "1 par lingüístico", "1 admin · colaboradores ilimitados", "Memoria reactiva + Playbooks A·B·C"] },
  { name: "Profesional", key: "profesional", base: 550, from: false, rec: true, blurb: "Para operación multi-CoDo.", feat: ["300 documentos vivos", "3 pares lingüísticos", "3 admins · colaboradores ilimitados", "Métricas PCL + reportes EDB"] },
  { name: "Enterprise", key: "enterprise", base: 1200, from: true, rec: false, blurb: "Para organizaciones reguladas a escala.", feat: ["Documentos ilimitados", "Pares lingüísticos ilimitados", "SLA 99.5% · soporte 24/7", "On-premise opcional"] },
];
/** Niveles canónicos de criticidad del segmento (decisión #15) → umbral de confianza. */
const CRIT: Array<[string, string, string, number, string]> = [
  ["seguridad", "Seguridad", "Consultas donde un error compromete la integridad física.", 0.95, "var(--danger-600)"],
  ["regulatorio", "Regulatorio", "Cumplimiento normativo: NOM, ISO, IATF, FDA, TGA.", 0.9, "var(--cinnabar-500)"],
  ["calidad", "Calidad", "Control de calidad, especificaciones y tolerancias.", 0.85, "var(--warning-600)"],
  ["operacional", "Operacional", "Operación diaria del equipo y procedimientos.", 0.75, "var(--info-600)"],
  ["informativa", "Informativa", "Referencia general y contexto documental.", 0.6, "var(--success-600)"],
];

const fmtUSD = (n: number) => "$" + n.toLocaleString("en-US");

export default function PlanFase2Page() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [step, setStep] = useState(0); // 0 plan · 1 criticidad · 2 confirmar
  const [band, setBand] = useState(0);
  const [plan, setPlan] = useState(1);
  const [crit, setCrit] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mult = BANDS[band][3];
  const price = (base: number) => Math.round((base * mult) / 5) * 5;
  const STEPS = ["Plan", "Criticidad", "Confirmar"];

  const activar = async () => {
    if (busy || !token) return;
    setBusy(true);
    setErr(null);
    try {
      await activarPlan(
        {
          plan: F2_PLANS[plan].key,
          criticidad_segmento: CRIT[crit][0],
          doc_limit: null,
          banda_mercado: BANDS[band][0],
        },
        token,
      );
      router.push("/documentos");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No pudimos activar tu plan. Intenta de nuevo.");
      setBusy(false);
    }
  };

  return (
    <div className="onb-kit">
    <div className="plan-stage">
      <div className="plan-wrap">
        <div className="plan-head">
          <span className="eyebrow">Onboarding · Fase 2</span>
          <h1>{step === 0 ? "Elige tu plan" : step === 1 ? "Criticidad del segmento" : "Confirma tu configuración"}</h1>
          <p>
            {step === 0
              ? "Pasa de gratuito a pagado cuando estés listo. Cambia de plan en cualquier momento."
              : step === 1
                ? "DOCYAN usa la criticidad de tu segmento para fijar el umbral de confianza con el que responde."
                : "Revisa tu plan y criticidad antes de activar."}
          </p>
        </div>

        <div className="f2-steps">
          {STEPS.map((s, i) => (
            <Fragment key={s}>
              <div className={"s" + (i === step ? " on" : i < step ? " done" : "")}>
                <span className="sc">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>
                <span>{s}</span>
              </div>
              {i < STEPS.length - 1 && <span className="bar" />}
            </Fragment>
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="band-bar">
              {BANDS.map((b, i) => (
                <button key={b[0]} className={"bb" + (i === band ? " on" : "")} onClick={() => setBand(i)}>
                  Banda {b[0]}
                  <small>{b[1]}</small>
                </button>
              ))}
            </div>
            <p className="band-note">
              <Icon name="map-pin" size={14} />
              Banda heredada por tu ubicación ({BANDS[band][2]}) · ajustable
            </p>

            <div className="plan-cards">
              {F2_PLANS.map((p, i) => (
                <div
                  key={p.name}
                  className={"pcard" + (i === plan ? " on" : "") + (p.rec ? " rec" : "")}
                  onClick={() => setPlan(i)}
                >
                  {p.rec && <span className="rec-tag">Recomendado</span>}
                  <span className="pc-radio" />
                  <div className="pn">{p.name}</div>
                  <div className="pblurb">{p.blurb}</div>
                  <div className="pp">
                    {p.from && <span className="pre">desde</span>}
                    <span className="amt">{fmtUSD(price(p.base))}</span>
                    <span className="per"> USD/mes</span>
                  </div>
                  <div className="psetup">Facturación mensual · 30 días de garantía</div>
                  <ul className="pfeat">
                    {p.feat.map((f) => (
                      <li key={f}>
                        <Icon name="check" size={15} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 1000, margin: "30px auto 0" }}>
              <button className="btn ghost" onClick={() => router.push("/documentos")}>
                <Icon name="arrow-left" size={16} />
                Seguir en gratuito
              </button>
              <button className="btn primary lg" onClick={() => setStep(1)}>
                Continuar
                <Icon name="arrow-right" size={17} />
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="crit-grid">
              {CRIT.map((c, i) => (
                <div key={c[0]} className={"crit-opt" + (i === crit ? " on" : "")} onClick={() => setCrit(i)}>
                  <span className="co-radio" />
                  <span className="co-dot" style={{ background: c[4] }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="co-t">{c[1]}</div>
                    <div className="co-m">{c[2]}</div>
                  </div>
                  <div className="co-th">
                    <div className="thv">≥{c[3].toFixed(2)}</div>
                    <div className="thl">umbral confianza</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="note info" style={{ maxWidth: 640, margin: "16px auto 0" }}>
              <Icon name="info" size={16} />
              <span>
                El umbral define qué tan segura debe estar una respuesta del caché antes de
                entregarse sin re-síntesis. A mayor criticidad, mayor exigencia. Puedes ajustarlo por
                CoDo más adelante; el admin marca o delega a inferencia automática.
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 640, margin: "26px auto 0" }}>
              <button className="btn ghost" onClick={() => setStep(0)}>
                <Icon name="arrow-left" size={16} />
                Atrás
              </button>
              <button className="btn primary lg" onClick={() => setStep(2)}>
                Continuar
                <Icon name="arrow-right" size={17} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="f2-summary">
              <div className="fs-row">
                <span className="fs-l">Plan</span>
                <span className="fs-v">
                  {F2_PLANS[plan].name}
                  <small>
                    Banda {BANDS[band][0]} · {BANDS[band][1]}
                  </small>
                </span>
              </div>
              <div className="fs-row">
                <span className="fs-l">Criticidad del segmento</span>
                <span className="fs-v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="co-dot" style={{ background: CRIT[crit][4], width: 10, height: 10, borderRadius: "50%" }} />
                  {CRIT[crit][1]}
                  <small>umbral ≥{CRIT[crit][3].toFixed(2)}</small>
                </span>
              </div>
              <div className="fs-row total">
                <span className="fs-l" style={{ fontWeight: 600, color: "var(--fg)" }}>
                  {F2_PLANS[plan].from ? "Desde" : "Total"} mensual
                </span>
                <span className="fs-v">
                  {fmtUSD(price(F2_PLANS[plan].base))}
                  <small>USD/mes · IVA según jurisdicción</small>
                </span>
              </div>
            </div>
            <div className="note" style={{ maxWidth: 560, margin: "16px auto 0" }}>
              <Icon name="headset" size={16} />
              <span>
                Durante la fase piloto el cobro es manual: DOCYAN te contacta para activar tu plan y
                configurar la facturación. No se solicita pago en esta pantalla.
              </span>
            </div>
            {err && (
              <p className="warn" role="alert" style={{ maxWidth: 560, margin: "10px auto 0", textAlign: "center" }}>
                {err}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 560, margin: "26px auto 0" }}>
              <button className="btn ghost" onClick={() => setStep(1)} disabled={busy}>
                <Icon name="arrow-left" size={16} />
                Atrás
              </button>
              <button className="btn primary lg" onClick={activar} disabled={busy}>
                <Icon name="check" size={17} />
                {busy ? "Activando…" : "Solicitar activación"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
