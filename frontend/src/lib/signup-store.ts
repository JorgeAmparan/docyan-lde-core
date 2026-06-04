"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PLAN_SLUGS } from "./pricing";

export type PlanSlug = (typeof PLAN_SLUGS)[number];
export type BillingPeriod = "monthly" | "annual";
export type PaymentMethod = "card" | "oxxo" | "sepa";

/** Account + organization fields (step 2). */
export interface AccountFields {
  email: string;
  password: string;
  orgName: string;
  vertical: string;
  country: string;
  orgSize: string;
}

/**
 * Fiscal fields (step 3). Region-specific; only the relevant subset is filled per
 * region but the shape is unified so the store stays flat + persisted.
 */
export interface FiscalFields {
  // MX (CFDI)
  rfc: string;
  razonSocial: string;
  usoCfdi: string;
  // USA / CA
  companyName: string;
  taxId: string;
  // UE
  vatId: string;
  // AU
  abn: string;
  // Shared billing address
  addressLine: string;
  city: string;
  postalCode: string;
}

interface SignupState {
  plan: PlanSlug;
  billing: BillingPeriod;
  account: AccountFields;
  fiscal: FiscalFields;
  payment: PaymentMethod;
  /** Highest step the user has reached (for stepper "done" state). */
  maxStep: number;

  setPlan: (plan: PlanSlug) => void;
  setBilling: (billing: BillingPeriod) => void;
  setAccount: (account: Partial<AccountFields>) => void;
  setFiscal: (fiscal: Partial<FiscalFields>) => void;
  setPayment: (payment: PaymentMethod) => void;
  markStepReached: (step: number) => void;
  reset: () => void;
}

const emptyAccount: AccountFields = {
  email: "",
  password: "",
  orgName: "",
  vertical: "laboratorio",
  country: "MX",
  orgSize: "1-10",
};

const emptyFiscal: FiscalFields = {
  rfc: "",
  razonSocial: "",
  usoCfdi: "G03",
  companyName: "",
  taxId: "",
  vatId: "",
  abn: "",
  addressLine: "",
  city: "",
  postalCode: "",
};

/**
 * Persisted signup checkout state. Survives reloads across the 4-step flow so the
 * user can refresh / deep-link to a step without losing data. Cleared after the
 * confirmation hand-off to onboarding via `reset()`.
 */
export const useSignup = create<SignupState>()(
  persist(
    (set) => ({
      plan: "profesional",
      billing: "annual",
      account: emptyAccount,
      fiscal: emptyFiscal,
      payment: "card",
      maxStep: 1,

      setPlan: (plan) => set({ plan }),
      setBilling: (billing) => set({ billing }),
      setAccount: (account) => set((s) => ({ account: { ...s.account, ...account } })),
      setFiscal: (fiscal) => set((s) => ({ fiscal: { ...s.fiscal, ...fiscal } })),
      setPayment: (payment) => set({ payment }),
      markStepReached: (step) => set((s) => ({ maxStep: Math.max(s.maxStep, step) })),
      reset: () =>
        set({
          plan: "profesional",
          billing: "annual",
          account: emptyAccount,
          fiscal: emptyFiscal,
          payment: "card",
          maxStep: 1,
        }),
    }),
    { name: "docyan-signup" },
  ),
);

/** Map a plan slug to its index in the pricing arrays. */
export function planIndexFromSlug(slug: PlanSlug): 0 | 1 | 2 {
  const i = PLAN_SLUGS.indexOf(slug);
  return (i < 0 ? 1 : i) as 0 | 1 | 2;
}
