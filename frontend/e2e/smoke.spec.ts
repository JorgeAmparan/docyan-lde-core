import { test, expect, type Page } from "@playwright/test";

/** Smoke E2E del sitio público v2 (F3). Cubre las superficies demo-críticas: el hero
 *  y los CoDos consultan vía /demo/query y renderizan respuesta CITADA; precios
 *  conmuta banda en vivo; login es alcanzable. Se fija el cookie del sitio a `es.A`
 *  para determinismo. El backend `/demo/query` se intercepta (en CI no hay backend
 *  vivo): el demo del sitio v2 rutea TODA consulta al backend real (cero enlatado),
 *  así que el e2e verifica el render de la cita con una respuesta fija del endpoint. */

const SITE_COOKIE = { name: "docyan_site", value: "es.A", url: "http://localhost:3000" };

// Verbatim del documento (lo que la UI DEBE mostrar como fragmento) vs el texto
// sintetizado por el LLM (`valor`, que NUNCA debe mostrarse como fuente).
const VERBATIM = "Flash Point: 113 o F (45 o C)";
const GENERADO = "Límite de exposición ACGIH TLV.";
const CITED = {
  servido: true,
  kind: "consulta",
  resultado: {
    payload: {
      kind: "info_card",
      especificaciones: [
        {
          nombre: "500 ppm, 8-hr TWA",
          valor: GENERADO,
          unidad: null,
          cita: { documento_nombre: "msds", fragmento: VERBATIM, span_inicio: 0, span_fin: VERBATIM.length },
        },
      ],
    },
  },
  fallback: null,
  codo: "hero",
  tenant_demo: "demo-hero",
};

async function mockDemo(page: Page) {
  await page.route("**/demo/query", (route) => route.fulfill({ json: CITED }));
}

test("hero v2: la consulta sugerida devuelve respuesta con cita", async ({ page, context }) => {
  await context.addCookies([SITE_COOKIE]);
  await mockDemo(page);
  await page.goto("/");
  await expect(page.locator(".hero2 h1")).toBeVisible();
  await page.locator(".dc2-sug").first().click();
  // El chip corner-bracket de cita (.cite2) aparece al componerse la respuesta.
  await expect(page.locator(".cite2").first()).toBeVisible({ timeout: 5000 });
});

// DEMO-CIERRE: se eliminó la ruta huérfana /demo/[vertical]; la cobertura de
// "sugerida → respuesta citada" la da el test del hero (arriba, misma DemoAnswerCard).
// El GUARD de integridad de cita se conserva, re-apuntado al hero (mismo componente
// `.dc2-a`/`.cite2`/`.dc2-src` con la misma lógica verbatim).
test("integridad de cita: el fragmento inline muestra el VERBATIM del documento, no el texto generado", async ({ page, context }) => {
  await context.addCookies([SITE_COOKIE]);
  await mockDemo(page);
  await page.goto("/");
  await page.locator(".dc2-sug").first().click();
  // Abrir el sello de cita expande el fragmento inline (.dc2-src).
  await page.locator(".cite2").first().click({ timeout: 5000 });
  // El fragmento inline bajo el sello es el verbatim del documento…
  const mark = page.locator(".dc2-src mark").first();
  await expect(mark).toBeVisible({ timeout: 5000 });
  await expect(mark).toHaveText(VERBATIM);
  // …y NUNCA el texto sintetizado por el LLM (regla de integridad de cita).
  await expect(page.locator(".dc2-src")).not.toContainText(GENERADO);
});

test("precios conmuta la banda en vivo (3 bandas v2.1)", async ({ page, context }) => {
  await context.addCookies([SITE_COOKIE]);
  await page.goto("/precios");
  await expect(page.getByText("$250").first()).toBeVisible();
  await page.getByRole("button", { name: "EE. UU. · Canadá" }).first().click();
  await expect(page.getByText("$349").first()).toBeVisible({ timeout: 5000 });
});

test("admin login screen is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible();
});
