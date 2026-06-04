"use client";

import {
  REGIONS,
  PLAN_NAMES,
  PLAN_BLURB,
  PLAN_SLUGS,
  priceFor,
  fmtMoney,
  type PlanIndex,
} from "@/lib/pricing";
import { useRegion } from "@/lib/region-store";
import { useSignup } from "@/lib/signup-store";

const PLAN_INDICES: PlanIndex[] = [0, 1, 2];

/** Step 1 — plan selection + billing period toggle. */
export function StepPlan() {
  const region = useRegion((s) => s.region);
  const r = REGIONS[region];
  const plan = useSignup((s) => s.plan);
  const setPlan = useSignup((s) => s.setPlan);
  const billing = useSignup((s) => s.billing);
  const setBilling = useSignup((s) => s.setBilling);
  const annual = billing === "annual";

  return (
    <>
      <h2>Elige tu plan</h2>
      <p className="lead">Puedes cambiar de plan en cualquier momento.</p>

      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 18px" }}>
        <div className="billing-toggle">
          <span style={{ color: annual ? "var(--fg-subtle)" : "var(--fg)" }}>Mensual</span>
          <div
            className={"sw" + (annual ? "" : " month")}
            onClick={() => setBilling(annual ? "monthly" : "annual")}
            role="switch"
            aria-checked={annual}
          >
            <i />
          </div>
          <span style={{ color: annual ? "var(--fg)" : "var(--fg-subtle)" }}>Anual</span>
          <span className="save-pill">−15%</span>
        </div>
      </div>

      {PLAN_INDICES.map((i) => {
        const slug = PLAN_SLUGS[i];
        const selected = slug === plan;
        const enterprise = i === 2;
        return (
          <div
            key={slug}
            className={"pay-row" + (selected ? " on" : "")}
            onClick={() => setPlan(slug)}
            style={{ justifyContent: "space-between" }}
            role="radio"
            aria-checked={selected}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
              <div
                className="pr-ic"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: selected ? "6px solid var(--cinnabar-500)" : "2px solid var(--border-strong)",
                  background: "transparent",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 7 }}>
                  {PLAN_NAMES[i]}
                  {i === 1 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: "var(--accent-fg)",
                        background: "var(--cinnabar-50)",
                        border: "1px solid var(--cinnabar-100)",
                        borderRadius: "var(--radius-full)",
                        padding: "1px 7px",
                      }}
                    >
                      Recomendado
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 2 }}>{PLAN_BLURB[i]}</div>
              </div>
            </div>
            <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flex: "none" }}>
              {enterprise ? "Custom" : fmtMoney(priceFor(region, i, annual), region) + "/mes"}
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 12 }}>
        Precios en {r.currency}. Setup inicial: {r.setup[PLAN_SLUGS.indexOf(plan)]}.
      </p>
    </>
  );
}
