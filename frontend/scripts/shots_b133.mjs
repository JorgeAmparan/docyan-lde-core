import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE || "https://docyan-lde.vercel.app";
const OUT = process.env.SHOT_OUT || "../docs/demo/screenshots_b133";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

// [vertical, query, slug]
const SHOTS = [
  [null, null, "hub"], // /demo hub
  ["lab", "¿cuándo vence la calibración?", "lab-vence"],
  ["lab", "¿cuál es el rango de medición?", "lab-rango"],
  ["maq", "what is the chemical name?", "maq-chemical"],
  // Cierre acceptance #2 (ranking por intención): la frase de IDENTIDAD en español
  // que antes devolvía un :Riesgo ahora encabeza la :Sustancia; "LEL?" ya no
  // encabeza un :Riesgo de pura cercanía semántica (sale el dato de inflamabilidad).
  ["maq", "¿cómo se llama el químico?", "maq-nombre-quimico"],
  ["maq", "LEL?", "maq-lel"],
  ["maq", "OSHA PEL", "maq-osha"],
  ["pharma", "¿Cuál es el procedimiento CIP?", "pharma-cip-procedure"],
];

const browser = await chromium.launch();
for (const [device, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const [vert, query, slug] of SHOTS) {
    const url = vert ? `${BASE}/demo/${vert}` : `${BASE}/demo`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(800);
    if (query) {
      const input = page.locator(".dc-box input, input[placeholder^='Pregunta'], input[placeholder^='Ask']").first();
      await input.fill(query);
      await input.press("Enter");
      // Espera la tarjeta de respuesta (cita/verbatim) o el fallback.
      await page.waitForTimeout(9000);
    }
    const file = `${OUT}/${device}-${slug}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log("✓", file);
    // Expande el desglose de la cita (muestra el verbatim + "Abrir PDF").
    if (query) {
      const chip = page.locator(".cite2").first();
      if (await chip.count()) {
        await chip.click();
        await page.waitForTimeout(700);
        const f2 = `${OUT}/${device}-${slug}-open.png`;
        await page.screenshot({ path: f2, fullPage: false });
        console.log("✓", f2);
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log("done");
