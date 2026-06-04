import { describe, it, expect } from "vitest";
import {
  REGIONS, REGION_KEYS, priceFor, fmtMoney, regionFromCountry, COMPARISON, PLAN_NAMES, ANNUAL_DISCOUNT,
} from "@/lib/pricing";

/** Regional pricing is the single source of truth for the live-swap + signup.
 *  These figures are non-negotiable per the Sprint B9 contract. */
describe("regional pricing", () => {
  it("has all 6 markets with the exact monthly base figures", () => {
    expect(REGION_KEYS).toHaveLength(6);
    expect(REGIONS["USA / CA"].plans).toEqual([299, 699, 2500]);
    expect(REGIONS["UE"].plans).toEqual([289, 679, 2450]);
    expect(REGIONS["UK"].plans).toEqual([249, 589, 2099]);
    expect(REGIONS["AU"].plans).toEqual([459, 1079, 3849]);
    expect(REGIONS["MX"].plans).toEqual([4990, 11990, 42500]);
    expect(REGIONS["LatAm"].plans).toEqual([229, 529, 2500]);
  });

  it("applies the −15% annual discount", () => {
    expect(ANNUAL_DISCOUNT).toBe(0.15);
    expect(priceFor("MX", 1, false)).toBe(11990);
    expect(priceFor("MX", 1, true)).toBe(Math.round(11990 * 0.85)); // 10192
  });

  it("formats currency per region", () => {
    expect(fmtMoney(11990, "MX")).toBe("MXN 11,990");
    expect(fmtMoney(699, "USA / CA")).toBe("$699 USD");
    expect(fmtMoney(289, "UE")).toBe("€289 EUR");
  });

  it("detects region from country code with LatAm fallback", () => {
    expect(regionFromCountry("MX")).toBe("MX");
    expect(regionFromCountry("US")).toBe("USA / CA");
    expect(regionFromCountry("ES")).toBe("UE");
    expect(regionFromCountry("AR")).toBe("LatAm");
    expect(regionFromCountry(null)).toBe("MX"); // default
  });

  it("exposes 3 plans and a complete comparison matrix", () => {
    expect(PLAN_NAMES).toEqual(["Esencial", "Profesional", "Enterprise"]);
    expect(COMPARISON.every((row) => row.length === 4)).toBe(true);
  });
});
