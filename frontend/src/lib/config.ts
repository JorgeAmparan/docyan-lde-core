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

/** Máximo de documentos por lote de ingesta (decisión rectora F1 #1). */
export const INGEST_BATCH_MAX = 10;
/**
 * Hard cap de sesión en USD (default alfa $20, decisión rectora F1 #2). Guardrail
 * de UX del lado cliente para "cuántos caben"; el gate financiero autoritativo
 * sigue siendo el cotizador del backend por documento (saldo + caps, sin bypass).
 */
export const SESSION_HARD_CAP_USD = Number(
  process.env.NEXT_PUBLIC_SESSION_HARD_CAP_USD ?? "20",
);

/**
 * Montos de recarga del saldo de ingesta. El saldo es en USD (gate de cómputo del
 * cotizador, `budget_manager.moneda = "USD"`), así que los presets son USD. (Antes
 * vivían en el `pricing.ts` legacy, ya retirado — fuente de precio única: bands.ts.)
 */
export const RECHARGE_PRESETS_USD = [50, 100, 250, 500];

/** Cookie that carries the access JWT (httpOnly, set by the route handler). */
export const AUTH_COOKIE = "docyan_token";
/** Cookie that carries the active CoDo (DoCo) id for multi-CoDo admins. */
export const DOCO_COOKIE = "docyan_doco";
/**
 * Cookie that mirrors a live `platform_admin` session (separate scope/JWT from the
 * tenant session). Presence gates `/platform/*` in the middleware. The Consola del
 * Fundador opera FUERA del aislamiento de tenant — su sesión es independiente. (F2)
 */
export const PLATFORM_AUTH_COOKIE = "docyan_platform_token";
