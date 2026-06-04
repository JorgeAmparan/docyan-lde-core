"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  REGIONS,
  REGION_KEYS,
  PLAN_NAMES,
  PLAN_BLURB,
  PLAN_FEAT,
  COMPARISON,
  PLAN_SLUGS,
  priceFor,
  fmtMoney,
  type PlanIndex,
} from "@/lib/pricing";
import { useRegion } from "@/lib/region-store";

/* DOCYAN commercial pricing — recreated 1:1 from the design bundle `pricing.jsx`,
   wired to the shared region store + Sprint B9 pricing source of truth. The region
   bar and billing toggle live-swap every figure/currency with no page reload. */

const PLAN_INDICES: PlanIndex[] = [0, 1, 2];

const FAQ: [string, string][] = [
  [
    "¿Qué pasa cuando alcanzo el límite de mi plan?",
    "El gate es estricto, sin bypass. En Esencial y Profesional, al tocar el límite de documentos vivos o pares lingüísticos te invitamos a subir de plan para seguir ingiriendo. En Enterprise el límite es flexible y se ajusta a tu volumen contratado.",
  ],
  [
    "¿Cómo cambio de plan?",
    "Subes o bajas de plan cuando quieras. El cobro se prorratea automáticamente vía Stripe: pagas solo la diferencia por los días restantes del ciclo, sin penalizaciones.",
  ],
  [
    "¿Qué incluye el setup inicial?",
    "Configuración de tu organización, alta de tu primer CoDo, calibración de Playbooks A·B·C y carga guiada de tu documentación base. En Enterprise el setup es a medida (onboarding in-situ y capacitación).",
  ],
  [
    "¿Cómo funciona la ingesta continua?",
    "Cada documento se cotiza antes de ingerir: tiktoken mide el documento, verificamos tu saldo y confirmas. El costo es el del stack de procesamiento más una tarifa fija de $0.02 USD por documento. Sin saldo o confirmación no hay ingesta.",
  ],
  [
    "Mi mercado no aparece en la lista, ¿qué hago?",
    "Contáctanos. Habilitamos precios y moneda para mercados no listados caso por caso; escríbenos a ventas y te cotizamos en tu jurisdicción.",
  ],
];

export default function PreciosPage() {
  const region = useRegion((s) => s.region);
  const setRegion = useRegion((s) => s.setRegion);
  const [annual, setAnnual] = useState(true);
  const r = REGIONS[region];

  return (
    <div>
      <div className="pricing-head">
        <div className="wrap">
          <span className="eyebrow">Precios</span>
          <h1>Planes claros. Cifras públicas.</h1>
          <div className="region-bar">
            {REGION_KEYS.map((k) => (
              <button
                key={k}
                className={"rb" + (k === region ? " on" : "")}
                onClick={() => setRegion(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="billing-toggle">
              <span style={{ color: annual ? "var(--fg-subtle)" : "var(--fg)" }}>Mensual</span>
              <div
                className={"sw" + (annual ? "" : " month")}
                onClick={() => setAnnual(!annual)}
              >
                <i />
              </div>
              <span style={{ color: annual ? "var(--fg)" : "var(--fg-subtle)" }}>Anual</span>
              <span className="save-pill">−15%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="plans">
          {PLAN_NAMES.map((name, i) => (
            <div className={"plan" + (i === 1 ? " rec" : "")} key={name}>
              {i === 1 && <span className="rec-tag">Recomendado</span>}
              <div className="pn">{name}</div>
              <div className="pp">
                <span className="amt">{fmtMoney(priceFor(region, i as PlanIndex, annual), region)}</span>
                <span className="per">/mes</span>
              </div>
              <div className="setup">Setup inicial: {r.setup[i]}</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "12px 0 0" }}>
                {PLAN_BLURB[i]}
              </p>
              <ul className="pfeat">
                {PLAN_FEAT[i].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              {i === 2 ? (
                <Link
                  className="btn sec"
                  style={{ width: "100%", justifyContent: "center" }}
                  href="/soporte"
                >
                  Hablar con ventas
                </Link>
              ) : (
                <Link
                  className={"btn " + (i === 1 ? "primary" : "sec")}
                  style={{ width: "100%", justifyContent: "center" }}
                  href={`/signup?plan=${PLAN_SLUGS[i]}`}
                >
                  Empezar
                </Link>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            margin: "8px 0 40px",
            fontSize: 13,
            color: "var(--fg-muted)",
          }}
        >
          <span>
            <Icon name="shield-check" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            30 días de garantía
          </span>
          <span>
            <Icon name="calendar" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Demo en vivo (sin trial gratuito)
          </span>
          <span>
            <Icon name="receipt" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Impuestos según jurisdicción
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Comparativa</h2>
        <table className="cmp">
          <thead>
            <tr>
              <th></th>
              <th className="c">Esencial</th>
              <th className="c">Profesional</th>
              <th className="c">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row[0]}>
                <td>{row[0]}</td>
                {PLAN_INDICES.map((c) => {
                  const val = row[c + 1];
                  return (
                    <td className={"c" + (c === 1 ? " reccol" : "")} key={c}>
                      {val === true ? (
                        <Icon name="check" size={16} style={{ color: "var(--success-600)" }} />
                      ) : val === false ? (
                        <Icon name="minus" size={16} style={{ color: "var(--stone-400)" }} />
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ height: 56 }} />
      </div>

      <div className="band paper">
        <div className="wrap">
          <span className="eyebrow">Add-ons</span>
          <h2 className="sec-title">Crece sin cambiar de plan.</h2>
          <ul className="pfeat" style={{ maxWidth: 720 }}>
            <li>
              <Icon name="check" size={16} />
              Ingesta continua — cotizada por documento (costo del stack + $0.02 USD fijo por documento).
            </li>
            <li>
              <Icon name="check" size={16} />
              Documentos vivos extra sobre el cupo de tu plan.
            </li>
            <li>
              <Icon name="check" size={16} />
              Pares lingüísticos extra sobre los incluidos.
            </li>
            <li>
              <Icon name="check" size={16} />
              Saldo prepagado desde $50 USD (equivalente regional), sin auto-recarga.
            </li>
          </ul>
        </div>
      </div>

      <div className="band">
        <div className="wrap">
          <span className="eyebrow">Preguntas frecuentes</span>
          <h2 className="sec-title">Lo que necesitas saber antes de empezar.</h2>
          <dl style={{ maxWidth: 760 }}>
            {FAQ.map(([q, a]) => (
              <div key={q} style={{ marginBottom: 24 }}>
                <dt style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{q}</dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 14.5,
                    color: "var(--fg-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
