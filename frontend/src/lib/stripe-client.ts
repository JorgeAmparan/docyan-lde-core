"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { STRIPE_ENABLED, STRIPE_PUBLISHABLE_KEY } from "./config";

/**
 * Singleton Stripe.js loader. Created once at module scope (per Stripe's guidance
 * to avoid re-instantiating on every render) and ONLY when a real publishable key
 * is present — otherwise `null`, and the UI degrades to the B9.1 config state.
 */
export const stripePromise: Promise<Stripe | null> | null = STRIPE_ENABLED
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;
