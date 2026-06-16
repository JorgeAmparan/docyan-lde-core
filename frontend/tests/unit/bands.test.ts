import { describe, it, expect } from "vitest";
import {
  BANDS, BAND_KEYS, DEFAULT_BAND, tierPrice, bandFromCountry, bandFromLocale, fmtUSD,
  bandCurrency, tierPriceLocal, pilotoLocal, fmtBand, fmtTierPrice,
} from "@/lib/bands";

/** F3 — Bandas v2.1 canónicas (Modelo de Precios Multimercado §2.1). Cifras firmes:
 *  superseden las 6 regiones B9. El selector de banda re-renderiza precios en vivo. */
describe("bandas de precio v2.1", () => {
  it("tiene 3 bandas con las cifras canónicas exactas", () => {
    expect(BAND_KEYS).toEqual(["A", "B", "C"]);
    expect(BANDS.A.tiers).toEqual({ esencial: 250, profesional: 550, enterprise: 1200 });
    expect(BANDS.B.tiers).toEqual({ esencial: 349, profesional: 770, enterprise: 1680 });
    expect(BANDS.C.tiers).toEqual({ esencial: 375, profesional: 825, enterprise: 1800 });
  });

  it("piloto = Esencial −30% sobre la banda activa (cifras del prototipo)", () => {
    expect(BANDS.A.piloto).toEqual({ list: 250, off: 175 });
    expect(BANDS.B.piloto).toEqual({ list: 349, off: 244 });
    expect(BANDS.C.piloto).toEqual({ list: 375, off: 262 });
  });

  it("B es +40% y C +50% sobre A en Esencial (aprox. al entero canónico)", () => {
    expect(BANDS.B.tiers.esencial).toBe(349); // 250×1.4 = 350, cifra firme 349
    expect(BANDS.C.tiers.esencial).toBe(375); // 250×1.5 = 375
  });

  it("tierPrice devuelve el precio de la banda/tier", () => {
    expect(tierPrice("A", "profesional")).toBe(550);
    expect(tierPrice("C", "enterprise")).toBe(1800);
  });

  it("geolocaliza país → banda (A ancla por defecto)", () => {
    expect(bandFromCountry("MX")).toBe("A");
    expect(bandFromCountry("ar")).toBe("A");
    expect(bandFromCountry("US")).toBe("B");
    expect(bandFromCountry("CA")).toBe("B");
    expect(bandFromCountry("DE")).toBe("C");
    expect(bandFromCountry("GB")).toBe("C");
    expect(bandFromCountry("AU")).toBe("C");
    expect(bandFromCountry(undefined)).toBe(DEFAULT_BAND);
    expect(bandFromCountry("ZZ")).toBe("A"); // desconocido → ancla
  });

  it("mapea locale de ruteo → banda", () => {
    expect(bandFromLocale("mx")).toBe("A");
    expect(bandFromLocale("us")).toBe("B");
    expect(bandFromLocale("eu")).toBe("C");
    expect(bandFromLocale("uk")).toBe("C");
    expect(bandFromLocale("zz")).toBeNull();
  });

  it("formatea USD", () => {
    expect(fmtUSD(1200)).toBe("$1,200");
    expect(fmtUSD(250)).toBe("$250");
  });

  // ── Moneda multimercado (decisión Jorge 12-jun-2026): Banda A = MXN tabla FIJA ──
  it("Banda A muestra MXN con la tabla FIJA (no FX en vivo)", () => {
    expect(bandCurrency("A")).toBe("MXN");
    expect(tierPriceLocal("A", "esencial")).toBe(4990);
    expect(tierPriceLocal("A", "profesional")).toBe(10900);
    expect(tierPriceLocal("A", "enterprise")).toBe(23900);
    expect(pilotoLocal("A")).toEqual({ list: 4990, off: 3490 });
  });

  it("Bandas B y C facturan en USD (sin tabla local)", () => {
    expect(bandCurrency("B")).toBe("USD");
    expect(bandCurrency("C")).toBe("USD");
    expect(tierPriceLocal("B", "esencial")).toBe(349); // = USD canónico
    expect(tierPriceLocal("C", "enterprise")).toBe(1800);
    expect(pilotoLocal("B")).toEqual({ list: 349, off: 244 });
  });

  it("formatea el precio en la moneda de la banda", () => {
    expect(fmtBand("A", 4990)).toBe("$4,990 MXN");
    expect(fmtBand("B", 349)).toBe("$349");
    expect(fmtTierPrice("A", "profesional")).toBe("$10,900 MXN");
    expect(fmtTierPrice("C", "esencial")).toBe("$375");
  });

  it("la tabla MXN es FIJA: no se deriva de los precios USD por ningún FX", () => {
    // 4990 MXN no es 250 USD × ningún múltiplo limpio — es una cifra calibrada a mano.
    expect(BANDS.A.local?.esencial).toBe(4990);
    expect(BANDS.A.local?.esencial).not.toBe(BANDS.A.tiers.esencial);
  });
});
