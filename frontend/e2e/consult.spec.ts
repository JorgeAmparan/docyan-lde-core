import { test, expect, type Page } from "@playwright/test";

/**
 * E2E de la vista de Consulta: cada tipo de intención renderiza su tarjeta con
 * DATOS del payload real. Se ejercita por la ruta PÚBLICA del QR (`/q/[token]`),
 * autocontenida (sin auth): el contexto del CoDo lo resuelve `GET /qr/{token}` y la
 * respuesta `POST /mo/query` — ambos interceptados a nivel de red para ser
 * deterministas y CI-runnable sin grafo poblado, pero ejercitando el render REAL.
 *
 * NOTA (B13.1): se eliminaron las sugerencias precargadas (eran datos enlatados de
 * un CoDo demo). El usuario ESCRIBE su pregunta en el qbox — el test refleja ese
 * flujo real (fill + Enviar), no clicks a chips inexistentes.
 */

// Contexto del CoDo que `/q/[token]` resuelve (shape de ResolvedQr del backend).
const QR_CTX = {
  tenant_id: "t-e2e",
  entidad_id: "ent-e2e",
  entidad: { id: "ent-e2e", nombre: "Centrífuga Hettich", tipo: "equipo" },
  documentos: [{ id: "doc-e2e", nombre: "Manual Rotina 380" }],
};

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

/** Mockea el contexto del QR + (opcional) la respuesta de /mo/query. */
async function setup(page: Page, payload?: Record<string, unknown>) {
  await page.route("**/qr/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(QR_CTX) }),
  );
  if (payload !== undefined) {
    await page.route("**/mo/query", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(payload)) }),
    );
  }
  await page.route("**/mo/queries/save", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

/** Abre la consulta y hace una pregunta (flujo real: escribir + enviar). */
async function preguntar(page: Page, texto: string) {
  await page.goto("/q/test-token");
  await page.getByPlaceholder(/Pregunta sobre/i).fill(texto);
  await page.getByRole("button", { name: /Enviar/i }).click();
}

test("Tipo 1 · InfoCard renders value + citation", async ({ page }) => {
  await setup(page, {
    kind: "info_card",
    titulo: "Torque del perno B",
    match_multiple: false,
    especificaciones: [
      { nombre: "Torque", valor: "85", unidad: "N·m", cita: { documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12 } },
    ],
    citas: [{ documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12 }],
  });
  await preguntar(page, "¿Cuál es el torque del perno B?");
  await expect(page.locator(".big").first()).toContainText("85");
  await expect(page.locator(".cite").first()).toContainText("Manual Rotina 380");
});

test("Tipo 2 · ProcedureCard renders steps + citation", async ({ page }) => {
  await setup(page, {
    kind: "procedure_card",
    titulo: "Cambio de filtro",
    modo_ejecutar_paso_a_paso: false,
    pasos: [{ orden: 1, descripcion: "Despresuriza el circuito.", epp: ["Guantes"], herramientas: ["Llave"], advertencias: ["No abrir presurizado."], precondiciones: [], postcondiciones: [] }],
    citas: [{ documento_nombre: "Manual Rotina 380" }],
  });
  await preguntar(page, "¿Cómo cambio el filtro?");
  await expect(page.getByText("Despresuriza el circuito.")).toBeVisible();
  await expect(page.locator(".cite").first()).toContainText("Manual Rotina 380");
});

test("Tipo 3 · DiagramViewer renders payload labels", async ({ page }) => {
  await setup(page, {
    kind: "diagram_viewer",
    titulo: "Rotor y cabezal",
    recurso_url: "https://x/rotor.png",
    etiquetas: [{ texto: "Tapa del rotor", x: 0.33, y: 0.26 }],
    leyenda_simbolica: [],
    citas: [],
  });
  await preguntar(page, "Muéstrame el diagrama del rotor");
  await expect(page.getByText("Tapa del rotor")).toBeVisible();
});

test("Tipo 5 · DiagnosticTree renders question + options", async ({ page }) => {
  await setup(page, {
    kind: "diagnostic_tree",
    titulo: "Vibración",
    nodo_actual_id: "n1",
    pregunta: "¿Aparece en vacío o con carga?",
    opciones: [{ etiqueta: "En vacío", siguiente_nodo_id: "n2" }],
    es_hoja: false,
    citas: [],
  });
  await preguntar(page, "La centrífuga vibra al arrancar");
  await expect(page.getByText("¿Aparece en vacío o con carga?")).toBeVisible();
  await expect(page.getByRole("button", { name: /En vacío/ })).toBeVisible();
});

test("Tipo 7 · AlertsDashboard shows admin-only banner (regulatory)", async ({ page }) => {
  await setup(page, {
    kind: "alerts_dashboard",
    titulo: "Alertas",
    solo_administrativas: true,
    alertas: [{ descripcion: "Calibración vence el 2026-06-20", fecha_vencimiento: "2026-06-20", urgencia: "alta", administrativa: true }],
    citas: [],
  });
  await preguntar(page, "¿Qué alertas tengo pendientes?");
  await expect(page.getByText(/No constituyen instrucciones operativas ni clínicas/i)).toBeVisible();
  await expect(page.locator(".alert-card.s-warn").first()).toBeVisible();
});

test("backend failure shows an honest error (no canned data)", async ({ page }) => {
  await setup(page);
  await page.route("**/mo/query", (route) => route.fulfill({ status: 500, body: "boom" }));
  await preguntar(page, "¿Cuál es el torque del perno B?");
  await expect(page.getByText(/No se pudo resolver la consulta/i)).toBeVisible();
});
