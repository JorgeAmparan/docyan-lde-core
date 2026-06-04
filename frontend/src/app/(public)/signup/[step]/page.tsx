"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { PLAN_SLUGS } from "@/lib/pricing";
import { useSignup, type PlanSlug } from "@/lib/signup-store";
import { StepPlan } from "../_components/step-plan";
import { StepAccount } from "../_components/step-account";
import { StepFiscal } from "../_components/step-fiscal";
import { StepPayment } from "../_components/step-payment";
import { StepConfirm } from "../_components/step-confirm";

const STEPS = ["Plan", "Cuenta", "Fiscal", "Pago"] as const;
const FORM_ID = "signup-step-form";

function isPlanSlug(v: string | null): v is PlanSlug {
  return !!v && (PLAN_SLUGS as readonly string[]).includes(v);
}

export default function SignupStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepParam } = use(params);
  const router = useRouter();
  const search = useSearchParams();

  const setPlan = useSignup((s) => s.setPlan);
  const markStepReached = useSignup((s) => s.markStepReached);
  const maxStep = useSignup((s) => s.maxStep);

  const parsed = Number(stepParam);
  const step = Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1;

  // Pre-select plan from ?plan= on first mount (step 1 only).
  useEffect(() => {
    if (step === 1) {
      const planQs = search.get("plan");
      if (isPlanSlug(planQs)) setPlan(planQs);
    }
    markStepReached(step);
  }, [step, search, setPlan, markStepReached]);

  // Steps 2–4 advance by validating/submitting their form, which dispatches
  // `signup:advance` on success → we navigate forward here.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ from: number }>).detail;
      const next = detail.from + 1;
      markStepReached(next);
      router.push(`/signup/${next}`);
    };
    window.addEventListener("signup:advance", handler);
    return () => window.removeEventListener("signup:advance", handler);
  }, [router, markStepReached]);

  if (step === 5) {
    return <StepConfirm />;
  }

  const goBack = () => router.push(`/signup/${step - 1}`);
  const goNext = () => {
    // Step 1 has no form; advance directly. Steps 2–4 submit their form.
    if (step === 1) {
      markStepReached(2);
      router.push("/signup/2");
    } else {
      // Trigger the active form's submit (RHF validation / payment confirm).
      const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
      form?.requestSubmit();
    }
  };

  return (
    <div className="auth">
      <div className="steps-nav">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n === step ? " on" : n < step || n < maxStep ? " done" : "";
          return (
            <span key={s} style={{ display: "contents" }}>
              <div className={"sn" + state}>
                <span className="sc">{n < step ? <Icon name="check" size={13} /> : n}</span>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="bar" />}
            </span>
          );
        })}
      </div>

      <div className="card">
        {step === 1 && <StepPlan />}
        {step === 2 && <StepAccount formId={FORM_ID} />}
        {step === 3 && <StepFiscal formId={FORM_ID} />}
        {step === 4 && <StepPayment formId={FORM_ID} />}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 1 && (
            <button className="btn sec" onClick={goBack} type="button">
              <Icon name="arrow-left" size={16} />
              Atrás
            </button>
          )}
          <button className="btn primary" style={{ marginLeft: "auto" }} onClick={goNext} type="button">
            {step === 4 ? "Pagar y crear cuenta" : "Continuar"}
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
