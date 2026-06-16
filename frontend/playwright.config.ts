import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // `ui2-screens.spec.ts` es CAPTURA de evidencia (screenshots), no aserciones de
  // comportamiento — su propósito es generar PNGs de las superficies de UI-2. NO
  // gatea CI (las E2E de aserción —consult/smoke— sí). Se corre a demanda:
  //   RUN_SCREENSHOTS=1 npx playwright test ui2-screens
  testIgnore: process.env.RUN_SCREENSHOTS ? [] : ["**/ui2-screens.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
