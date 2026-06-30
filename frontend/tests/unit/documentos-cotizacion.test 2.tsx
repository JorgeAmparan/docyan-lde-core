import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Defecto del recorrido UI-2 (Jorge, 15-jun): el flujo de carga de /documentos
 * AUTO-CONFIRMABA y saltaba directo al progreso, sin mostrar la cotización. Regla
 * canónica: la cotización con control de gasto + APROBACIÓN se muestra SIEMPRE, en
 * TODOS los planes (freemium incluido). Este guard lo asegura: subir un documento
 * abre la tarjeta de cotización y NO confirma hasta que el usuario aprueba.
 */

const postForm = vi.fn();
const post = vi.fn();
const get = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    api: {
      postForm: (...a: unknown[]) => postForm(...a),
      post: (...a: unknown[]) => post(...a),
      get: (...a: unknown[]) => get(...a),
      del: (...a: unknown[]) => del(...a),
    },
    ApiError,
  };
});
vi.mock("@/lib/auth", () => ({
  useAuth: (sel: (s: { token: string; user: unknown }) => unknown) =>
    sel({ token: "t", user: { name: "Admin", role: "admin" } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/documentos",
}));
// Aísla la página: shell y progreso a stubs (sus deps no son el objeto de la prueba).
vi.mock("@/components/org-shell", () => ({
  OrgShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ingesta/ingest-progress-row", () => ({
  IngestProgressRow: () => <div data-testid="progress-row" />,
}));

import DocumentsPage from "@/app/(app)/documentos/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DocumentsPage />
    </QueryClientProvider>,
  );
}

function upload(container: HTMLElement, name = "IB-111-RDA.pdf") {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["contenido"], name, { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  postForm.mockReset();
  post.mockReset();
  get.mockReset();
  del.mockReset();
  // listDocumentos: cuenta freemium, 0 usados de 3.
  get.mockResolvedValue({ items: [], doc_limit: 3, usados: 0, disponibles: 3 });
});

const QUOTE = {
  job_id: "J1",
  tipo_documento: "manual técnico",
  tipo_resuelto_por: "heuristica",
  cotizacion: {
    costo_estimado_usd: 0.1,
    saldo_disponible_usd: 5,
    aprobado: true,
    precio_setup_usd: 15,
    dentro_de_cupo: false,
    cupo_restante: null,
  },
  advertencia: null,
};

describe("/documentos — cotización SIEMPRE visible (no auto-confirm)", () => {
  it("subir un documento abre la tarjeta de cotización y NO confirma solo", async () => {
    postForm.mockResolvedValueOnce(QUOTE);
    const { container } = renderPage();
    await screen.findByText("Documentos vivos");
    upload(container);

    // La tarjeta de cotización aparece…
    await screen.findByTestId("quote-card");
    // Freemium ve el valor real tachado + Total $0.00 (control de gasto, no gate de plan).
    expect(screen.getByTestId("quote-struck")).toHaveTextContent("$15.00 USD");
    expect(screen.getByTestId("quote-total")).toHaveTextContent("$0.00 USD");
    // …y NO se ha confirmado nada (el bug saltaba directo a progreso).
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByTestId("progress-row")).toBeNull();
  });

  it("recién al APROBAR se confirma y arranca el progreso", async () => {
    postForm.mockResolvedValueOnce(QUOTE);
    post.mockResolvedValue({ encolado: true });
    const { container } = renderPage();
    await screen.findByText("Documentos vivos");
    upload(container);
    await screen.findByTestId("quote-card");

    fireEvent.click(screen.getByRole("button", { name: /Aprobar e ingerir/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/ingesta/documents/J1/confirm", undefined, expect.anything()),
    );
  });
});
