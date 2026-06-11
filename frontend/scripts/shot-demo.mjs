// Evidencia visual (regla): screenshots del hero y del CoDo en el preview
// desplegado, desktop + móvil, tras consultar una sugerida. Uso:
//   PREVIEW=https://... node scripts/shot-demo.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const PREVIEW = process.env.PREVIEW;
if (!PREVIEW) { console.error("falta PREVIEW=https://..."); process.exit(1); }
const origin = new URL(PREVIEW).origin;
const OUT = "/tmp";

const VIEWPORTS = [
  { tag: "desktop", width: 1280, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

async function shot(page, url, sugSel, cardSel, file) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const sug = page.locator(sugSel).first();
  await sug.waitFor({ state: "visible", timeout: 15000 });
  await sug.click();
  // esperar la tarjeta de respuesta (real, vía /demo/query)
  await page.locator(cardSel).first().waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  console.log("shot:", file);
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies([{ name: "docyan_site", value: "es.A", url: origin }]);
  const page = await ctx.newPage();
  try {
    await shot(page, `${PREVIEW}/`, ".dc2-sug", ".dc2-a .cite2", `hero_${vp.tag}.png`);
  } catch (e) { console.error("hero", vp.tag, e.message); }
  try {
    await shot(page, `${PREVIEW}/demo/lab`, ".demo-sug", ".dc2-a", `codo_${vp.tag}.png`);
  } catch (e) { console.error("codo", vp.tag, e.message); }
  await ctx.close();
}
await browser.close();
console.log("listo");
