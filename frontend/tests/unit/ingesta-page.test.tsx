import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import i18n from "@/i18n/config";

// ── Mocks ───────────────────────────────────────────────────────────────────
const postForm = vi.fn();
const post = vi.fn();
const get = vi.fn();

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { api: { postForm: (...a: unknown[]) => postForm(...a), post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) }, ApiError };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import IngestaPage from "@/app/(app)/admin/ingesta/page";
import { useIngestStore } from "@/lib/ingest-store";

function quoteResponse(jobId: string, costo: number, aprobado = true) {
  return {
    job_id: jobId,
    status: "pending_confirmation",
    cotizacion: {
      tokens_documento: 9000,
      costo_estimado_usd: costo,
      tiempo_estimado_seg: 600,
      decision: aprobado ? "aprobado_requiere_confirmacion" : "rechazado_presupuesto",
      aprobado,
      saldo_disponible_usd: 10.0,
    },
    advertencia: null,
  };
}

function pickFile(name = "calibracion.pdf") {
  const input = screen.getByTestId("ingesta-file-input") as HTMLInputElement;
  const file = new File(["contenido del documento"], name, { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(async () => {
  postForm.mockReset();
  post.mockReset();
  get.mockReset();
  useIngestStore.getState().clear();
  await i18n.changeLanguage("es");
});

describe("IngestaPage — sin datos canned", () => {
  it("NO renderiza la cotización falsa fija ($58.40) ni la cola hardcodeada", () => {
    render(<IngestaPage />);
    expect(screen.queryByText(/58\.40/)).toBeNull();
    expect(screen.queryByText(/Procedimiento de limpieza CIP/)).toBeNull();
    expect(screen.queryByText(/Bitácora calibración Q1/)).toBeNull();
  });
});

describe("IngestaPage — cotización real del backend", () => {
  it("muestra la cotización real devuelta (no un valor fijo)", async () => {
    postForm.mockResolvedValueOnce(quoteResponse("J1", 0.12));
    render(<IngestaPage />);
    pickFile();
    await waitFor(() => expect(screen.getByText(/\$0\.12 USD/)).toBeInTheDocument());
    // El costo total del lote refleja la cotización real, no $58.40.
    expect(screen.queryByText(/58\.40/)).toBeNull();
  });

  it("confirmar lote llama al confirm real por cada job que cabe", async () => {
    postForm.mockResolvedValueOnce(quoteResponse("J1", 0.12));
    post.mockResolvedValue({ encolado: true });
    render(<IngestaPage />);
    pickFile();
    await waitFor(() => expect(screen.getByText(/\$0\.12 USD/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Confirmar e ingerir lote/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(
      "/ingesta/documents/J1/confirm",
      undefined,
      expect.anything(),
    ));
    // El lote quedó activo en el store (orquestación en cliente).
    expect(useIngestStore.getState().jobIds).toContain("J1");
  });
});

describe("IngestaPage — backend no responde", () => {
  it("muestra error real, NO un fallback simulado", async () => {
    postForm.mockRejectedValueOnce(new Error("network down"));
    render(<IngestaPage />);
    pickFile();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // No aparece una cotización inventada.
    expect(screen.queryByText(/\$58\.40/)).toBeNull();
    expect(screen.queryByText(/USD/)).toBeNull();
  });
});
