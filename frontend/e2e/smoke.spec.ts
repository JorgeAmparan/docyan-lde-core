import { test, expect } from "@playwright/test";

/** Smoke E2E against the running app (dev webServer). Covers the demo-critical
 *  public surfaces: landing renders, pricing live-swaps regional figures, and
 *  login is reachable. */

test("landing v2 (FLOW) renders the playable hero with the vertical selector", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Pregúntale a tus documentos\. Te responden con la fuente\./i })).toBeVisible();
  // Tapping a suggested question yields an answer carrying the cinnabar citation chip.
  await page.getByRole("button", { name: "¿Torque del perno B del rotor?" }).click();
  await expect(page.locator(".cite.chip-fn").first()).toBeVisible({ timeout: 5000 });
});

test("demo-CoDo explorer runs the full consult flow", async ({ page }) => {
  await page.goto("/demo/lab");
  await expect(page.getByText(/CODO-LAB-04/).first()).toBeVisible();
  await page.getByRole("button", { name: "¿Torque del perno B del rotor?" }).click();
  await expect(page.locator(".fa-card").first()).toBeVisible({ timeout: 5000 });
});

test("pricing live-swaps figures when region changes", async ({ page }) => {
  await page.goto("/precios");
  // Default region MX shows MXN figures.
  await expect(page.getByText(/MXN/).first()).toBeVisible();
  // Switch region to USA / CA and expect USD figures to appear (no reload).
  await page.getByRole("button", { name: "USA / CA" }).click();
  await expect(page.getByText(/\$/).first()).toBeVisible();
});

test("admin login screen is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible();
});
