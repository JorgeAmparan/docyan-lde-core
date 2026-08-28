import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth", () => ({
  useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "T" }),
}));
vi.mock("@/lib/onboarding", () => ({
  listCodos: vi.fn(async () => ({
    items: [
      { id: "CD-001", tipo: "entidad", nombre: "Centrífuga Rotina 380", tipo_documento: null, documentos: 3, alertas: 0, estado: "ok" },
      { id: "DOC-9", tipo: "documento", nombre: "Ficha Técnica MAXI-10", tipo_documento: "ficha_tecnica", documentos: 1, alertas: 0, estado: "ok" },
    ],
    total: 2,
  })),
}));

import { SearchModal } from "@/components/search-modal";

function renderModal(open = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <SearchModal open={open} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

describe("P2 · SearchModal — command-palette del prototipo", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("no renderiza nada cuando está cerrado", () => {
    const { container } = renderModal(false);
    expect(container.querySelector(".dcs-scrim")).toBeNull();
  });

  it("lista CoDos y documentos REALES del backend, agrupados", async () => {
    renderModal();
    expect(await screen.findByText("Centrífuga Rotina 380")).toBeInTheDocument();
    expect(screen.getByText("Ficha Técnica MAXI-10")).toBeInTheDocument();
    expect(screen.getByText("Documentos")).toBeInTheDocument();
    expect(screen.getByText("CoDos")).toBeInTheDocument();
  });

  it("filtra por texto y ofrece 'Preguntar' con la consulta escrita", async () => {
    renderModal();
    await screen.findByText("Centrífuga Rotina 380");
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "rotina" } });
    expect(screen.getByText("Centrífuga Rotina 380")).toBeInTheDocument();
    expect(screen.queryByText("Ficha Técnica MAXI-10")).not.toBeInTheDocument();
    expect(screen.getByText(/Preguntar:/)).toBeInTheDocument();
  });

  it("navega al CoDo al elegir un resultado", async () => {
    renderModal();
    fireEvent.click(await screen.findByText("Centrífuga Rotina 380"));
    expect(push).toHaveBeenCalledWith("/admin/codos/CD-001");
  });

  it("Enter con consulta navega a /consult (preguntar directo)", async () => {
    renderModal();
    await screen.findByText("Centrífuga Rotina 380");
    const input = screen.getByLabelText("Buscar");
    fireEvent.change(input, { target: { value: "presión nominal" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/consult");
  });
});
