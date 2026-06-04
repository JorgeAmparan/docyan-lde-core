/**
 * DOCYAN regional pricing — exact figures from the Sprint B9 contract + bundle
 * `pricing.jsx`. Single source of truth for the pricing page live-swap, signup
 * summary, and Stripe price mapping (B9.1). Figures are non-negotiable.
 */

export type RegionKey = "USA / CA" | "UE" | "UK" | "AU" | "MX" | "LatAm";

export interface RegionPricing {
  key: RegionKey;
  /** ISO-ish currency for Stripe + Intl formatting. */
  currency: string;
  /** Symbol/prefix shown before the figure. */
  cur: string;
  /** Suffix shown after the figure (e.g. " USD"). */
  suf: string;
  /** Monthly base price per plan [Esencial, Profesional, Enterprise-from]. */
  plans: [number, number, number];
  /** Setup fee per plan (display strings; Enterprise = Custom). */
  setup: [string, string, string];
  /** Additional admin seat / month [Profesional, Enterprise]. */
  seats: [number, number];
  /** Geo-IP country codes that default to this region. */
  countries: string[];
}

export const REGIONS: Record<RegionKey, RegionPricing> = {
  "USA / CA": { key: "USA / CA", currency: "USD", cur: "$", suf: " USD", plans: [299, 699, 2500], setup: ["$199", "$499", "Custom"], seats: [49, 39], countries: ["US", "CA"] },
  "UE": { key: "UE", currency: "EUR", cur: "€", suf: " EUR", plans: [289, 679, 2450], setup: ["€199", "€499", "Custom"], seats: [47, 37], countries: ["ES", "DE", "FR", "IT", "PT", "NL", "BE", "IE", "AT", "FI", "GR", "PL"] },
  "UK": { key: "UK", currency: "GBP", cur: "£", suf: " GBP", plans: [249, 589, 2099], setup: ["£179", "£429", "Custom"], seats: [42, 34], countries: ["GB"] },
  "AU": { key: "AU", currency: "AUD", cur: "AUD ", suf: "", plans: [459, 1079, 3849], setup: ["AUD 309", "AUD 769", "Custom"], seats: [75, 60], countries: ["AU", "NZ"] },
  "MX": { key: "MX", currency: "MXN", cur: "MXN ", suf: "", plans: [4990, 11990, 42500], setup: ["MXN 3,490", "MXN 8,490", "Custom"], seats: [825, 660], countries: ["MX"] },
  "LatAm": { key: "LatAm", currency: "USD", cur: "$", suf: " USD", plans: [229, 529, 2500], setup: ["$159", "$379", "Custom"], seats: [49, 39], countries: ["AR", "CO", "CL", "PE", "BR", "UY", "EC", "BO", "PY", "VE", "GT", "CR", "PA"] },
};

export const REGION_KEYS = Object.keys(REGIONS) as RegionKey[];
export const DEFAULT_REGION: RegionKey = "MX";

export const PLAN_NAMES = ["Esencial", "Profesional", "Enterprise"] as const;
export type PlanIndex = 0 | 1 | 2;
export const PLAN_SLUGS = ["esencial", "profesional", "enterprise"] as const;

export const PLAN_BLURB = [
  "Para un equipo o un CoDo.",
  "Para operación multi-CoDo.",
  "Para organizaciones reguladas a escala.",
];

export const PLAN_FEAT: string[][] = [
  ["50 documentos vivos", "1 par lingüístico", "1 admin · colaboradores ilimitados", "Memoria reactiva + Playbooks A·B·C", "Soporte email 48h"],
  ["300 documentos vivos", "3 pares lingüísticos", "3 admins · colaboradores ilimitados", "Dashboard métricas PCL + reportes EDB", "Playbooks precargados por vertical", "Soporte email + chat 24h"],
  ["Documentos ilimitados", "Pares lingüísticos ilimitados", "Reportes regulatorios custom", "SLA 99.5% · soporte 24/7", "Onboarding in-situ", "On-premise opcional"],
];

/** Full comparison table — `true`/`false` render as check/dash, strings as text. */
export const COMPARISON: Array<[string, string | boolean, string | boolean, string | boolean]> = [
  ["Documentos vivos", "50", "300", "Ilimitados"],
  ["CoDos", "Ilimitados", "Ilimitados", "Ilimitados"],
  ["Pares lingüísticos", "1", "3", "Ilimitados"],
  ["Admins incluidos", "1", "3", "3"],
  ["Seat admin adicional", false, "Costo regional", "Regional c/descuento"],
  ["Colaboradores con QR", "Ilimitados", "Ilimitados", "Ilimitados"],
  ["Memoria reactiva PCL", true, true, true],
  ["Pedigree clickeable", true, true, true],
  ["Playbooks A·B·C completos", true, true, true],
  ["Métricas PCL + reportes EDB", false, true, true],
  ["Playbooks precargados por vertical", false, true, true],
  ["Reportes regulatorios custom", false, false, true],
  ["Almacenamiento", "5 GB", "20 GB", "Ilimitado"],
  ["SLA", "—", "—", "99.5%"],
  ["Soporte", "Email 48h", "Email + chat 24h", "24/7 prioritario"],
  ["Onboarding", "Auto-servicio", "2 sesiones/mes", "In-situ + capacitación"],
  ["Integraciones custom", false, false, true],
  ["On-premise opcional", false, false, true],
];

export const ANNUAL_DISCOUNT = 0.15;

export function priceFor(region: RegionKey, plan: PlanIndex, annual: boolean): number {
  const base = REGIONS[region].plans[plan];
  return annual ? Math.round(base * (1 - ANNUAL_DISCOUNT)) : base;
}

export function fmtMoney(n: number, region: RegionKey): string {
  const r = REGIONS[region];
  return r.cur + n.toLocaleString("en-US") + r.suf;
}

/** Recharge presets (B.16 / C.7) — USD-equivalent, displayed in region currency. */
export const RECHARGE_PRESETS_USD = [50, 100, 250, 500];

export function regionFromCountry(country: string | undefined | null): RegionKey {
  if (!country) return DEFAULT_REGION;
  const cc = country.toUpperCase();
  for (const k of REGION_KEYS) {
    if (REGIONS[k].countries.includes(cc)) return k;
  }
  return "LatAm";
}
