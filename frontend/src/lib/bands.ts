/**
 * DOCYAN — Bandas de precio v2.1 (Modelo de Precios Multimercado §2.1, canónico).
 *
 * FUENTE ÚNICA del precio del sitio público (F3). Reemplaza el modelo de 6 regiones
 * B9 (`pricing.ts`, superseded para lo público). Tres bandas por poder adquisitivo:
 *   A — MX · LatAm (ancla)        · Esencial 250 / Profesional 550 / Enterprise 1200
 *   B — US · Canadá (+40%)        · 349 / 770 / 1680
 *   C — UE · UK · Australia (+50%)· 375 / 825 / 1800
 * Piloto: Esencial −30% sobre la banda activa (60 días). Cifras firmes (decisión #13),
 * recalibrables tras pilotos. Todo en USD/mes. Métrica: documentos vivos, no usuarios.
 */

export type BandKey = "A" | "B" | "C";

export interface Band {
  key: BandKey;
  regions: { es: string; en: string };
  /** Geo-IP country codes that default to this band. */
  countries: string[];
  /** USD/month [Esencial, Profesional, Enterprise-from]. */
  tiers: { esencial: number; profesional: number; enterprise: number };
  /** Pilot: list price struck through, −30% offer. */
  piloto: { list: number; off: number };
}

export const BANDS: Record<BandKey, Band> = {
  A: {
    key: "A",
    regions: { es: "MX · LatAm", en: "MX · LatAm" },
    countries: ["MX", "AR", "CO", "CL", "PE", "BR", "UY", "EC", "BO", "PY", "VE", "GT", "CR", "PA"],
    tiers: { esencial: 250, profesional: 550, enterprise: 1200 },
    piloto: { list: 250, off: 175 },
  },
  B: {
    key: "B",
    regions: { es: "EE. UU. · Canadá", en: "US · Canada" },
    countries: ["US", "CA"],
    tiers: { esencial: 349, profesional: 770, enterprise: 1680 },
    piloto: { list: 349, off: 244 },
  },
  C: {
    key: "C",
    regions: { es: "UE · UK · Australia", en: "EU · UK · Australia" },
    countries: ["ES", "DE", "FR", "IT", "PT", "NL", "BE", "IE", "AT", "FI", "GR", "PL", "GB", "AU", "NZ"],
    tiers: { esencial: 375, profesional: 825, enterprise: 1800 },
    piloto: { list: 375, off: 262 },
  },
};

export const BAND_KEYS = Object.keys(BANDS) as BandKey[];
export const DEFAULT_BAND: BandKey = "A";

/** Tres tiers de DOCYAN v1 (documentos vivos). */
export const TIER_KEYS = ["esencial", "profesional", "enterprise"] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export const fmtUSD = (n: number): string => "$" + n.toLocaleString("en-US");

/** Precio mensual de un tier en una banda (USD). Enterprise es "desde". */
export function tierPrice(band: BandKey, tier: TierKey): number {
  return BANDS[band].tiers[tier];
}

/** Banda por país (geolocalización). Default A (ancla) si no se reconoce. */
export function bandFromCountry(country: string | undefined | null): BandKey {
  if (!country) return DEFAULT_BAND;
  const cc = country.toUpperCase();
  for (const k of BAND_KEYS) {
    if (BANDS[k].countries.includes(cc)) return k;
  }
  return DEFAULT_BAND;
}

/** Locale de ruteo (`/mx`, `/us`, `/eu`) → banda. Para el routing por locale en Next. */
export const LOCALE_TO_BAND: Record<string, BandKey> = {
  mx: "A", latam: "A", us: "B", ca: "B", eu: "C", uk: "C", au: "C",
};

export function bandFromLocale(locale: string | undefined | null): BandKey | null {
  if (!locale) return null;
  return LOCALE_TO_BAND[locale.toLowerCase()] ?? null;
}
