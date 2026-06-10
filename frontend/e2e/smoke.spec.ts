import { test, expect } from "@playwright/test";

/** Smoke E2E del sitio público v2 (F3). Cubre las superficies demo-críticas:
 *  el hero renderiza y su demo vivo responde citado, precios conmuta banda en vivo,
 *  el CoDo demo corre el flujo, y login es alcanzable. Se fija el cookie del sitio
 *  a `es.A` para determinismo (Playwright corre en en-US y el sitio detecta idioma). */

const SITE_COOKIE = { name: "docyan_site", value: "es.A", url: "http://localhost:3000" };

test("hero v2 renderiza y su demo vivo responde con cita", async ({ page, context }) => {
  await context.addCookies([SITE_COOKIE]);
  await page.goto("/");
  await expect(page.locator(".hero2 h1")).toBeVisible();
  // Una pregunta preparada del demo del hero produce una respuesta con la cita
  // corner-bracket (.cite2) — el contrato visual del producto.
  await page.locator(".dc2-sug").first().click();
  await expect(page.locator(".cite2").first()).toBeVisible({ timeout: 5000 });
});

test("demo-CoDo explorer corre el flujo de consulta", async ({ page }) => {
  await page.goto("/demo/lab");
  await expect(page.getByText(/CODO-LAB-04/).first()).toBeVisible();
  await page.getByRole("button", { name: "¿Torque del perno B del rotor?" }).click();
  await expect(page.locator(".fa-card").first()).toBeVisible({ timeout: 5000 });
});

test("precios conmuta la banda en vivo (3 bandas v2.1)", async ({ page, context }) => {
  await context.addCookies([SITE_COOKIE]);
  await page.goto("/precios");
  // Banda A por defecto: Esencial $250 USD.
  await expect(page.getByText("$250").first()).toBeVisible();
  // Cambiar a banda B (EE. UU. · Canadá): Esencial $349, sin recargar.
  await page.getByRole("button", { name: "EE. UU. · Canadá" }).first().click();
  await expect(page.getByText("$349").first()).toBeVisible({ timeout: 5000 });
});

test("admin login screen is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible();
});
