import { test, type Page } from "@playwright/test";

/**
 * Sprint UI-2 — capturas de evidencia (desktop + móvil) de las superficies tocadas.
 * Solo captura: no es un test de aserción (esos viven en los specs unitarios/E2E).
 * Usa la ruta PÚBLICA del QR (sin auth) para consulta, y siembra el store de auth
 * + intercepta la red para las pantallas autenticadas (ingesta, usuarios).
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const DIR = "screenshots/ui2";

// ── Consulta (público /q/[token]) — cita en línea (§1.2.7) ───────────────────
const QR_CTX = {
  tenant_id: "t-e2e",
  entidad_id: "ent-e2e",
  entidad: { id: "ent-e2e", nombre: "Centrífuga Hettich", tipo: "equipo" },
  documentos: [{ id: "doc-e2e", nombre: "Manual Rotina 380" }],
};
const INFO = {
  resultado: {
    tipo_intencion: "informativa", score: 1, ruta: "r", metodo: "heuristico",
    cruces: [], degradado: false,
    payload: {
      kind: "info_card", titulo: "Torque del perno B", match_multiple: false,
      especificaciones: [{
        nombre: "Torque", valor: "85", unidad: "N·m",
        cita: { documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12,
                fragmento: "El par de apriete del perno B es de 85 N·m según la tabla §4.2.1." },
      }],
      citas: [{ documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12,
                fragmento: "El par de apriete del perno B es de 85 N·m según la tabla §4.2.1." }],
    },
  },
};

async function consultSetup(page: Page) {
  await page.route("**/qr/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(QR_CTX) }));
  await page.route("**/mo/query", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(INFO) }));
  await page.route("**/mo/queries/save", (r) => r.fulfill({ status: 200, body: "{}" }));
}

for (const [tag, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]] as const) {
  test(`consulta · cita en línea (${tag})`, async ({ page }) => {
    await page.setViewportSize(vp);
    await consultSetup(page);
    await page.goto("/q/test-token");
    await page.getByPlaceholder(/Pregunta sobre/i).fill("¿Cuál es el torque del perno B?");
    await page.getByRole("button", { name: /Enviar/i }).click();
    await page.locator(".big").first().waitFor();
    await page.screenshot({ path: `${DIR}/consulta-respuesta-${tag}.png`, fullPage: true });
    // Nivel 2: desplegar el fragmento verbatim EN LÍNEA.
    await page.locator(".cite").first().click();
    await page.getByTestId("cita-inline-fragment").waitFor();
    await page.screenshot({ path: `${DIR}/consulta-cita-inline-${tag}.png`, fullPage: true });
  });
}

// ── Autenticadas: siembra de auth + red mockeada ─────────────────────────────
async function seedAuth(page: Page, role = "admin") {
  await page.addInitScript(
    ([r]) => {
      localStorage.setItem(
        "docyan-auth",
        JSON.stringify({
          state: { token: "e2e-token", refreshToken: "e2e-refresh", docoId: null,
                   user: { id: "u1", email: "admin@lab.mx", name: "Admin", role: r } },
          version: 0,
        }),
      );
    },
    [role],
  );
}

const ORG_FREEMIUM = { org_id: "o1", nombre: "Lab Estándar", banda_mercado: "A", idioma: "es",
                       plan: "freemium", lifecycle_status: "active", doc_limit: 3 };

test.describe("ingesta · cotización freemium (§1.1.2)", () => {
  for (const [tag, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]] as const) {
    test(`tarjeta tachada (${tag})`, async ({ page }) => {
      await page.setViewportSize(vp);
      await seedAuth(page);
      await page.route("**/onboarding/org", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ORG_FREEMIUM) }));
      await page.route("**/ingesta/documents", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          job_id: "J1", status: "pending_confirmation", tipo_documento: "NOM",
          tipo_resuelto_por: "heuristica",
          cotizacion: { tokens_documento: 12000, costo_estimado_usd: 0.12, costo_total_usd: 0.12,
                        tiempo_estimado_seg: 600, decision: "aprobado_requiere_confirmacion",
                        aprobado: true, saldo_disponible_usd: 5, precio_setup_usd: 15,
                        dentro_de_cupo: false, cupo_restante: null },
          paginas_estimadas: 18, extraccion_confiable: true, advertencia: null,
          requiere_confirmacion: true,
        }) }));
      await page.goto("/admin/ingesta");
      const input = page.getByTestId("ingesta-file-input");
      await input.setInputFiles({ name: "NOM-052.pdf", mimeType: "application/pdf",
                                  buffer: Buffer.from("contenido NOM-052 de prueba") });
      await page.getByTestId("quote-card").first().waitFor();
      await page.screenshot({ path: `${DIR}/ingesta-cotizacion-freemium-${tag}.png`, fullPage: true });
    });
  }
});

test.describe("usuarios · selector de rol (§1.3)", () => {
  for (const [tag, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]] as const) {
    test(`sin óvalo rosa (${tag})`, async ({ page }) => {
      await page.setViewportSize(vp);
      await seedAuth(page);
      await page.route("**/onboarding/org", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ORG_FREEMIUM) }));
      await page.route("**/invitations**", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
      await page.route("**/usuarios", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [
          { id: "u1", email: "admin@lab.mx", name: "Admin", role: "admin" },
        ], total: 1 }) }));
      await page.goto("/usuarios");
      await page.locator(".role-opt").first().waitFor();
      await page.locator(".role-opt").first().click();
      await page.screenshot({ path: `${DIR}/usuarios-roles-${tag}.png`, fullPage: true });
    });
  }
});
