import { test, expect, type Page } from "@playwright/test";

/**
 * B9.5 §2 (salida #8) — E2E de la PWA autenticada `/consult`: cada tipo de
 * intención renderiza su tarjeta con DATOS del payload real. El backend se
 * intercepta a nivel de red (route.fulfill) para que el test sea determinista y
 * CI-runnable sin un grafo poblado — pero ejercita el render REAL de cada tarjeta
 * a partir del shape del contrato OpenAPI (no constantes locales).
 */

const AUTH = { name: "docyan_token", value: "e2e-token", url: "http://localhost:3000" };

function envelope(payload: Record<string, unknown>) {
  return {
    resultado: {
      tipo_intencion: "x",
      score: 1,
      ruta: "r",
      metodo: "heuristico",
      cruces: [],
      degradado: false,
      payload,
    },
  };
}

async function stub(page: Page, payload: Record<string, unknown>) {
  await page.route("**/mo/query", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(payload)) }),
  );
  // El guardado no es objeto del test; respóndelo OK para no romper el flujo.
  await page.route("**/mo/queries/save", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([AUTH]);
});

test("Tipo 1 · InfoCard renders value + citation", async ({ page }) => {
  await stub(page, {
    kind: "info_card",
    titulo: "Torque del perno B",
    match_multiple: false,
    especificaciones: [
      { nombre: "Torque", valor: "85", unidad: "N·m", cita: { documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12 } },
    ],
    citas: [{ documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12 }],
  });
  await page.goto("/consult");
  await page.getByRole("button", { name: /Torque del perno B/i }).click();
  await expect(page.locator(".big").first()).toContainText("85");
  await expect(page.locator(".cite").first()).toContainText("Manual Rotina 380");
});

test("Tipo 2 · ProcedureCard renders steps + citation", async ({ page }) => {
  await stub(page, {
    kind: "procedure_card",
    titulo: "Cambio de filtro",
    modo_ejecutar_paso_a_paso: false,
    pasos: [{ orden: 1, descripcion: "Despresuriza el circuito.", epp: ["Guantes"], herramientas: ["Llave"], advertencias: ["No abrir presurizado."], precondiciones: [], postcondiciones: [] }],
    citas: [{ documento_nombre: "Manual Rotina 380" }],
  });
  await page.goto("/consult");
  await page.getByRole("button", { name: /Cómo cambio el filtro/i }).click();
  await expect(page.getByText("Despresuriza el circuito.")).toBeVisible();
  await expect(page.locator(".cite").first()).toContainText("Manual Rotina 380");
});

test("Tipo 3 · DiagramViewer renders payload labels", async ({ page }) => {
  await stub(page, {
    kind: "diagram_viewer",
    titulo: "Rotor y cabezal",
    recurso_url: "https://x/rotor.png",
    etiquetas: [{ texto: "Tapa del rotor", x: 0.33, y: 0.26 }],
    leyenda_simbolica: [],
    citas: [],
  });
  await page.goto("/consult");
  await page.getByRole("button", { name: /diagrama del rotor/i }).click();
  await expect(page.getByText("Tapa del rotor")).toBeVisible();
});

test("Tipo 5 · DiagnosticTree renders question + options", async ({ page }) => {
  await stub(page, {
    kind: "diagnostic_tree",
    titulo: "Vibración",
    nodo_actual_id: "n1",
    pregunta: "¿Aparece en vacío o con carga?",
    opciones: [{ etiqueta: "En vacío", siguiente_nodo_id: "n2" }],
    es_hoja: false,
    citas: [],
  });
  await page.goto("/consult");
  await page.getByRole("button", { name: /vibra al arrancar/i }).click();
  await expect(page.getByText("¿Aparece en vacío o con carga?")).toBeVisible();
  await expect(page.getByRole("button", { name: /En vacío/ })).toBeVisible();
});

test("Tipo 7 · AlertsDashboard shows admin-only banner (regulatory)", async ({ page }) => {
  await stub(page, {
    kind: "alerts_dashboard",
    titulo: "Alertas",
    solo_administrativas: true,
    alertas: [{ descripcion: "Calibración vence el 2026-06-20", fecha_vencimiento: "2026-06-20", urgencia: "alta", administrativa: true }],
    citas: [],
  });
  await page.goto("/consult");
  await page.getByRole("button", { name: /alertas tengo pendientes/i }).click();
  await expect(page.getByText(/No constituyen instrucciones operativas ni clínicas/i)).toBeVisible();
  await expect(page.locator(".alert-card.s-warn").first()).toBeVisible();
});

test("backend failure shows an honest error (no canned data)", async ({ page }) => {
  await page.route("**/mo/query", (route) => route.fulfill({ status: 500, body: "boom" }));
  await page.goto("/consult");
  await page.getByRole("button", { name: /Torque del perno B/i }).click();
  await expect(page.getByText(/No se pudo resolver la consulta/i)).toBeVisible();
});
