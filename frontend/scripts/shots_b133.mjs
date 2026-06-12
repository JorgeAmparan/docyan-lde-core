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
  ["maq", "OSHA PEL", "maq-osha"],
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
  }
  await ctx.close();
}
await browser.close();
console.log("done");
