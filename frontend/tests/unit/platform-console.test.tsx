import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// next/navigation + sonner no existen fuera del runtime de Next: se mockean.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/platform/orgs",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

import { api } from "@/lib/api-client";
import { usePlatformAuth } from "@/lib/platform-auth";

import ResumenPage from "@/app/platform/(console)/resumen/page";
import OrgsPage from "@/app/platform/(console)/orgs/page";
import JobsPage from "@/app/platform/(console)/jobs/page";
import CodigosPage from "@/app/platform/(console)/codigos/page";
import IngresosPage from "@/app/platform/(console)/ingresos/page";
import SoportePage from "@/app/platform/(console)/soporte/page";

const SECRET = "CONTENIDO-CONFIDENCIAL-DEL-CLIENTE";

function mockGet(routes: [RegExp, unknown][]) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    for (const [re, val] of routes) if (re.test(path)) return val;
    return { items: [] };
  });
}

function renderPage(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  usePlatformAuth.setState({ token: "platform-jwt", admin: { id: "a", email: "f@xcid.com", name: "Fundador" } });
});

describe("Consola del fundador — render con datos REALES (no canned)", () => {
  it("Organizaciones: tabla con datos reales + 6 filtros de estado", async () => {
    mockGet([
      [/\/platform\/orgs$/, { items: [
        { org_id: "alpha", display_name: "Alpha Lab", plan: "profesional", lifecycle_status: "active", created_at: "2026-01-10T00:00:00Z", users: 12 },
        { org_id: "beta", display_name: "Beta Maquila", plan: "piloto", lifecycle_status: "active", created_at: "2026-03-02T00:00:00Z", users: 4 },
        { org_id: "gamma", display_name: "Gamma SA", plan: "profesional", lifecycle_status: "grace", created_at: "2026-02-01T00:00:00Z", users: 7 },
      ] }],
      [/\/platform\/access-codes/, { items: [] }],
    ]);
    renderPage(<OrgsPage />);
    expect(await screen.findByText("Alpha Lab")).toBeInTheDocument();
    expect(screen.getByText("Beta Maquila")).toBeInTheDocument();

    // Los 6 filtros + "Todas" están presentes con conteo.
    for (const f of ["Todas", "Activas", "Gracia", "Suspendidas", "Pilotos", "Freemium", "Canceladas"]) {
      expect(screen.getByRole("button", { name: new RegExp(f) })).toBeInTheDocument();
    }
    // Filtrar por "Gracia" deja solo gamma.
    fireEvent.click(screen.getByRole("button", { name: /Gracia/ }));
    await waitFor(() => {
      expect(screen.getByText("Gamma SA")).toBeInTheDocument();
      expect(screen.queryByText("Alpha Lab")).not.toBeInTheDocument();
    });
  });

  it("Jobs: muestra el motivo TÉCNICO de error y nunca el contenido", async () => {
    mockGet([[/\/platform\/jobs$/, { items: [
      { job_id: "JF", org_id: "alpha", status: "failed", phase: null, pct: 0, nombre_archivo: "msds.pdf",
        tiempo_estimado_seg: 120, error: "PDF protegido · OCR rechazado",
        // Campo de contenido que un endpoint podría filtrar por error: la UI NO debe mostrarlo.
        resultado: SECRET },
    ] }]]);
    renderPage(<JobsPage />);
    expect(await screen.findByText("PDF protegido · OCR rechazado")).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
  });

  it("Ingresos: registrado real; MRR y saldo vencido = 'no disponible' (no canned)", async () => {
    mockGet([
      [/\/platform\/payments/, { items: [
        { id: "p1", org_id: "alpha", monto: 1500, moneda: "MXN", concepto: "suscripcion", fecha: "2026-06-03T00:00:00Z" },
      ] }],
      [/\/platform\/orgs$/, { items: [{ org_id: "alpha", display_name: "Alpha Lab", plan: "profesional", lifecycle_status: "active", users: 1 }] }],
    ]);
    renderPage(<IngresosPage />);
    // "Alpha Lab" aparece como opción en los dos <select> de org (form de pago +
    // estado de cuenta): basta con que la org real esté presente.
    expect((await screen.findAllByText(/Alpha Lab/)).length).toBeGreaterThan(0);
    // MRR y saldo vencido se declaran no disponibles (honesto), no un número inventado.
    expect(screen.getAllByText(/no disponible/i).length).toBeGreaterThanOrEqual(2);
  });

  it("Resumen: banda 'Requiere acción' deriva de datos reales (jobs en error)", async () => {
    mockGet([
      [/\/platform\/metrics\/summary/, { total_orgs: 3, total_usuarios: 23, almacenamiento_total_bytes: 2048, jobs_activos: 1, ingresos_periodo: 1500, ingresos_moneda: "MXN" }],
      [/\/platform\/metrics\/trends/, { orgs_acumuladas: [{ label: "2026-05", value: 2 }, { label: "2026-06", value: 3 }], ingresos_por_mes: [{ label: "2026-06", value: 1500 }], consultas_por_mes: [], moneda: "MXN" }],
      [/\/platform\/orgs$/, { items: [] }],
      [/\/platform\/jobs$/, { items: [{ job_id: "JF", org_id: "a", status: "failed", pct: 0, error: "x" }] }],
      [/\/platform\/access-codes/, { items: [] }],
    ]);
    renderPage(<ResumenPage />);
    expect(await screen.findByText("Requiere acción")).toBeInTheDocument();
    expect(screen.getByText(/Jobs de ingesta con error/)).toBeInTheDocument();
  });
});

describe("Consola del fundador — acciones en vivo", () => {
  it("Códigos: generar usa defaults cerrados (50 docs / 60 días) y muestra el código", async () => {
    mockGet([[/\/platform\/access-codes/, { items: [] }]]);
    vi.mocked(api.post).mockResolvedValue({
      id: "c1", code: "DOCYAN-AB12CD34", tipo: "piloto", cuota_documentos: 50, cuota_saldo_usd: 0,
      expires_at: "2026-08-05T00:00:00Z", status: "active", created_at: "2026-06-06T00:00:00Z",
    });
    renderPage(<CodigosPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Generar código/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [path, body] = vi.mocked(api.post).mock.calls[0];
    expect(path).toBe("/platform/access-codes");
    expect(body).toMatchObject({ cuota_documentos: 50, dias_vigencia: 60, tipo: "piloto" });
    expect(await screen.findByText("DOCYAN-AB12CD34")).toBeInTheDocument();
  });

  it("Soporte: responder un hilo envía el cuerpo al endpoint de reply", async () => {
    mockGet([[/\/platform\/support\/threads/, { items: [
      { id: "t1", org_id: "alpha", user_id: "u1", pantalla_origen: "Admin › Ingesta", estado: "abierto",
        created_at: "2026-06-06T00:00:00Z", updated_at: "2026-06-06T00:00:00Z",
        mensajes: [{ id: "m1", thread_id: "t1", autor_tipo: "usuario", cuerpo: "No veo el progreso del lote", created_at: "2026-06-06T00:00:00Z" }] },
    ] }]]);
    vi.mocked(api.post).mockResolvedValue({});
    renderPage(<SoportePage />);
    // El mensaje del usuario (soporte, permitido) se muestra; el contexto también.
    // Ambos aparecen dos veces (resumen en la lista + cuerpo/contexto del hilo
    // auto-abierto): basta con que estén presentes.
    expect((await screen.findAllByText("No veo el progreso del lote")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin › Ingesta").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText(/Responder al hilo/), { target: { value: "Ya está arreglado." } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    // El 3er arg confirma que la llamada lleva el JWT de PLATAFORMA (aislamiento).
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/platform/support/threads/t1/reply", { cuerpo: "Ya está arreglado.", cerrar: false }, { token: "platform-jwt" }));
  });

  it("Ingresos: registrar pago manual postea al endpoint con el cuerpo correcto", async () => {
    mockGet([
      [/\/platform\/payments/, { items: [] }],
      [/\/platform\/orgs$/, { items: [{ org_id: "alpha", display_name: "Alpha Lab", plan: "profesional", lifecycle_status: "active", users: 1 }] }],
    ]);
    vi.mocked(api.post).mockResolvedValue({ id: "p1" });
    renderPage(<IngresosPage />);
    fireEvent.change(await screen.findByLabelText("Organización"), { target: { value: "alpha" } });
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar pago/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/platform/payments",
      expect.objectContaining({ org_id: "alpha", monto: 2500, moneda: "MXN", concepto: "suscripcion" }),
      { token: "platform-jwt" }));
  });
});
