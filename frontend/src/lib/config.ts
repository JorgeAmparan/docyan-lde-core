/** Runtime config. Public values are inlined at build; secrets stay server-side. */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "https://docyan-lde-api.fly.dev";

/** Stripe publishable key — test mode placeholder until B9.1 wires the real account. */
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/** Whether Stripe is configured (drives recharge button vs mailto fallback, B.10). */
export const STRIPE_ENABLED = STRIPE_PUBLISHABLE_KEY.startsWith("pk_");

export const CONTACT_EMAIL = "hola@docyan.com";
export const SUPPORT_EMAIL = "soporte@docyan.com";

/** Cookie that carries the access JWT (httpOnly, set by the route handler). */
export const AUTH_COOKIE = "docyan_token";
/** Cookie that carries the active CoDo (DoCo) id for multi-CoDo admins. */
export const DOCO_COOKIE = "docyan_doco";
