import { describe, it, expect } from "vitest";
import {
  BANDS, BAND_KEYS, DEFAULT_BAND, tierPrice, bandFromCountry, bandFromLocale, fmtUSD,
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
});
