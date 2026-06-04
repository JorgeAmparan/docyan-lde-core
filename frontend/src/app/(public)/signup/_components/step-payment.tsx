"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Icon } from "@/components/icon";
import { STRIPE_ENABLED } from "@/lib/config";
import { stripePromise } from "@/lib/stripe-client";
import {
  REGIONS,
  PLAN_NAMES,
  PLAN_SLUGS,
  priceFor,
  fmtMoney,
  type PlanIndex,
} from "@/lib/pricing";
import { useRegion } from "@/lib/region-store";
import { useSignup, planIndexFromSlug, type PaymentMethod } from "@/lib/signup-store";

/**
 * Step 4 — Stripe payment. When Stripe is configured (B9.1) renders the real
 * `<PaymentElement>` inside `<Elements>`; otherwise renders a disabled card with a
 * clear "configuración B9.1" note while preserving the full layout + summary.
 */
export function StepPayment({ formId }: { formId: string }) {
  const region = useRegion((s) => s.region);
  const planSlug = useSignup((s) => s.plan);
  const billing = useSignup((s) => s.billing);
  const r = REGIONS[region];
  const planIdx = planIndexFromSlug(planSlug);
  const annual = billing === "annual";

  // Deferred-intent Elements: the real PaymentIntent/Subscription is created by the
  // backend in B9.1; here we render the element pre-priced so the user sees a live
  // total. Amount is in the currency's minor unit (cents).
  const amount = Math.max(50, priceFor(region, planIdx as PlanIndex, annual) * (annual ? 12 : 1) * 100);
  const elementsOptions: StripeElementsOptions = {
    mode: "subscription",
    currency: r.currency.toLowerCase(),
    amount,
  };

  return (
    <>
      <h2>Pago</h2>
      <p className="lead">Procesado de forma segura con Stripe.</p>
      {STRIPE_ENABLED && stripePromise ? (
        <Elements stripe={stripePromise} options={elementsOptions}>
          <PaymentInner formId={formId} />
        </Elements>
      ) : (
        <PaymentInner formId={formId} />
      )}
    </>
  );
}

function PaymentInner({ formId }: { formId: string }) {
  const region = useRegion((s) => s.region);
  const r = REGIONS[region];
  const planSlug = useSignup((s) => s.plan);
  const planIdx = planIndexFromSlug(planSlug);
  const billing = useSignup((s) => s.billing);
  const setBilling = useSignup((s) => s.setBilling);
  const payment = useSignup((s) => s.payment);
  const setPayment = useSignup((s) => s.setPayment);
  const markStepReached = useSignup((s) => s.markStepReached);
  const annual = billing === "annual";

  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthly = priceFor(region, planIdx as PlanIndex, annual);
  const dueToday = annual ? monthly * 12 : monthly;

  const methods: Array<{ id: PaymentMethod; tag: string; label: string; show: boolean }> = [
    { id: "card", tag: "VISA", label: "Tarjeta de crédito o débito", show: true },
    { id: "oxxo", tag: "OXXO", label: "OXXO / SPEI (pago referenciado)", show: region === "MX" },
    { id: "sepa", tag: "SEPA", label: "Domiciliación SEPA (anual)", show: region === "UE" && annual },
  ];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // B9.1: no Stripe yet → jump straight to the (placeholder) confirmation.
    if (!STRIPE_ENABLED || !stripe || !elements) {
      markStepReached(5);
      window.dispatchEvent(new CustomEvent("signup:advance", { detail: { from: 4 } }));
      return;
    }

    setSubmitting(true);
    // In B9.1 this submits the PaymentElement + confirms a subscription/SetupIntent
    // created by the backend. Until then we validate the element and advance.
    const { error: submitError } = await elements.submit();
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message ?? "No se pudo validar el método de pago.");
      return;
    }
    markStepReached(5);
    window.dispatchEvent(new CustomEvent("signup:advance", { detail: { from: 4 } }));
  };

  return (
    <form id={formId} onSubmit={onSubmit} noValidate>
      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 16px" }}>
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

      {methods
        .filter((m) => m.show)
        .map((m) => (
          <div
            key={m.id}
            className={"pay-row" + (payment === m.id ? " on" : "")}
            onClick={() => setPayment(m.id)}
            role="radio"
            aria-checked={payment === m.id}
          >
            <span className="pr-ic">{m.tag}</span>
            {m.label}
          </div>
        ))}

      {payment === "card" && (
        <div className="card" style={{ marginTop: 10, padding: 16 }}>
          {STRIPE_ENABLED && stripe ? (
            <PaymentElement />
          ) : (
            <div style={{ opacity: 0.6, pointerEvents: "none" }}>
              <div className="field">
                <label>Número de tarjeta</label>
                <input placeholder="4242 4242 4242 4242" disabled />
              </div>
              <div className="row2c">
                <div className="field">
                  <label>Vencimiento</label>
                  <input placeholder="MM / AA" disabled />
                </div>
                <div className="field">
                  <label>CVC</label>
                  <input placeholder="123" disabled />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!STRIPE_ENABLED && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--amate-100)",
            color: "var(--fg-muted)",
            fontSize: 13,
          }}
        >
          <Icon name="info" size={15} />
          Pagos en modo configuración — Stripe se conecta en B9.1.
        </div>
      )}

      {error && (
        <div style={{ color: "var(--danger-600)", fontSize: 13, marginTop: 10 }}>{error}</div>
      )}

      <div className="summary">
        <div className="sr">
          <span>
            {PLAN_NAMES[planIdx]} · {annual ? "anual (−15%)" : "mensual"}
          </span>
          <span>{fmtMoney(monthly, region)}/mes</span>
        </div>
        <div className="sr">
          <span>Setup inicial</span>
          <span>{r.setup[planIdx]}</span>
        </div>
        <div className="sr">
          <span>Impuestos</span>
          <span>según jurisdicción</span>
        </div>
        <div className="sr total">
          <span>Hoy{annual ? " (12 meses)" : ""}</span>
          <span>{fmtMoney(dueToday, region)}</span>
        </div>
      </div>

      {/* Hidden marker so the page can detect this is the pay step's form. */}
      <input type="hidden" name="__paystep" value={PLAN_SLUGS[planIdx]} />
      <input type="hidden" value={submitting ? "1" : "0"} readOnly />
    </form>
  );
}
