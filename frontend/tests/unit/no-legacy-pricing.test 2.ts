import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Moneda Multimercado §1/§4 (decisión Jorge) — UNA sola fuente de precio: `bands.ts`.
 * El modelo legacy de 6 regiones (`pricing.ts`) + su `region-store`/`region-switcher`
 * quedaron retirados. Este guard asegura que NINGUNA superficie de usuario vuelva a
 * leer precio de ahí (regresión silenciosa) y que los archivos legacy no reaparezcan.
 */

const SRC = join(__dirname, "..", "..", "src");
const RETIRED = [
  "@/lib/pricing",
  "lib/region-store",
  "components/region-switcher",
  "commercial/site-nav",
  "commercial/site-footer",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("una sola fuente de precio (bands.ts) — sin legacy", () => {
  const files = walk(SRC);

  it("ninguna superficie importa el pricing/region legacy retirado", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const code = readFileSync(f, "utf8");
      for (const needle of RETIRED) {
        if (code.includes(needle)) offenders.push(`${f} → ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("los archivos legacy de precio/región fueron eliminados", () => {
    expect(existsSync(join(SRC, "lib", "pricing.ts"))).toBe(false);
    expect(existsSync(join(SRC, "lib", "region-store.ts"))).toBe(false);
    expect(existsSync(join(SRC, "components", "region-switcher.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "components", "commercial", "site-nav.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "components", "commercial", "site-footer.tsx"))).toBe(false);
  });
});
