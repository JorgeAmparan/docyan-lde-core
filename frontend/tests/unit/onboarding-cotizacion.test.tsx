import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Recorrido UI-2 §1.1 — el onboarding (primer documento, "ájá") TAMBIÉN debe mostrar
 * la cotización con control de gasto + aprobación, no auto-confirmar. Freemium ve el
 * Total $0.00 tachado pero DEBE verlo y aprobar (principio canónico de Jorge).
 */

const postForm = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api-client", () => ({
  api: { postForm: (...a: unknown[]) => postForm(...a), post: (...a: unknown[]) => post(...a) },
  ApiError: class ApiError extends Error {},
}));
vi.mock("@/lib/auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "t" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// Pasos 2/3 (progreso y consulta embebida) no son el objeto de esta prueba.
vi.mock("@/components/ingesta/ingest-progress-row", () => ({ IngestProgressRow: () => <div /> }));
vi.mock("@/app/(app)/consult/consult-view", () => ({ ConsultView: () => <div /> }));

import OnboardingFase1Page from "@/app/(app)/onboarding/page";

const QUOTE = {
  job_id: "J1",
  paginas_estimadas: 18,
  tipo_documento: "MSDS",
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

beforeEach(() => {
  postForm.mockReset();
  post.mockReset();
});

function toUploadStep() {
  render(<OnboardingFase1Page />);
  fireEvent.click(screen.getByRole("button", { name: /Empezar/i })); // step 0 → 1
}

function upload() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["x"], "NOM-052.pdf", { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("onboarding — cotización antes de procesar (no auto-confirm)", () => {
  it("subir muestra la tarjeta (Total $0.00 tachado) y NO confirma solo", async () => {
    postForm.mockResolvedValueOnce(QUOTE);
    toUploadStep();
    upload();
    await screen.findByTestId("quote-card");
    expect(screen.getByTestId("quote-struck")).toHaveTextContent("$15.00 USD");
    expect(screen.getByTestId("quote-total")).toHaveTextContent("$0.00 USD");
    expect(post).not.toHaveBeenCalled();
  });

  it("recién al APROBAR se confirma", async () => {
    postForm.mockResolvedValueOnce(QUOTE);
    post.mockResolvedValue({ encolado: true });
    toUploadStep();
    upload();
    await screen.findByTestId("quote-card");
    fireEvent.click(screen.getByRole("button", { name: /Aprobar e ingerir/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/ingesta/documents/J1/confirm", undefined, expect.anything()),
    );
  });
});
