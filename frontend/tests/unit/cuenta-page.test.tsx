import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// P4 — la cuenta es UNA sola página (CuentaOrg del prototipo), con datos reales.
const user = { id: "u1", email: "ana@lab.mx", name: "Ana López", role: "admin", org_name: "Laboratorio X" };

vi.mock("@/lib/auth", () => ({
  useAuth: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ token: "T", refreshToken: "R", user, clear: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/onboarding", () => ({
  getCuenta: vi.fn(async () => ({
    org_id: "o1",
    nombre: "Laboratorio X SA de CV",
    plan: "freemium",
    plan_nombre: "Plan gratuito",
    fase2_completada: false,
    docs_usados: 0,
    saldo_actual_usd: 0,
  })),
  changePassword: vi.fn(),
  logout: vi.fn(),
}));

import CuentaPage from "@/app/(account)/cuenta/page";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CuentaPage />
    </QueryClientProvider>,
  );
}

describe("P4 · /cuenta — CuentaOrg del prototipo (una sola página)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza las tres secciones del prototipo con clases .acct-*", () => {
    const { container } = renderPage();
    expect(screen.getByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organización" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seguridad" })).toBeInTheDocument();
    // Estructura verbatim del prototipo.
    expect(container.querySelector(".acct .acct-sec .acct-prof")).not.toBeNull();
    expect(container.querySelectorAll(".acct-row").length).toBeGreaterThanOrEqual(4);
  });

  it("muestra datos REALES del perfil (usuario autenticado)", () => {
    renderPage();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("ana@lab.mx")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
  });

  it("cablea acciones reales de seguridad (cambiar contraseña + cerrar sesión)", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Cambiar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerrar sesión/ })).toBeInTheDocument();
  });
});
