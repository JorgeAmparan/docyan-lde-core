import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the typed HTTP client; assert the B13 data layer hits the right
// path/verb/token (sin red, sin backend). `vi.hoisted` para que `calls` exista
// cuando el factory hoisteado de vi.mock lo use.
const calls = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({})),
  post: vi.fn(() => Promise.resolve({})),
  del: vi.fn(() => Promise.resolve({})),
  patch: vi.fn(() => Promise.resolve({})),
  postForm: vi.fn(() => Promise.resolve({})),
}));
vi.mock("@/lib/api-client", () => ({ api: calls, ApiError: class ApiError extends Error {} }));

import {
  signup,
  activarPlan,
  getOrg,
  listUsuarios,
  createInvitation,
  listInvitations,
  acceptInvitation,
  listDocumentos,
  deleteDocumento,
  listCodos,
  getCodoContexto,
  getCuenta,
  logout,
  changePassword,
  updateProfile,
} from "@/lib/onboarding";

beforeEach(() => {
  Object.values(calls).forEach((f) => f.mockClear());
});

describe("B13 onboarding data layer", () => {
  it("signup → POST /onboarding/signup (público, sin token)", () => {
    signup({ email: "a@b.com", password: "pass1234", name: "A" });
    expect(calls.post).toHaveBeenCalledWith("/onboarding/signup", {
      email: "a@b.com",
      password: "pass1234",
      name: "A",
    });
  });

  it("activarPlan → POST /onboarding/plan con token", () => {
    activarPlan({ plan: "profesional", criticidad_segmento: "regulatorio" }, "T");
    expect(calls.post).toHaveBeenCalledWith(
      "/onboarding/plan",
      { plan: "profesional", criticidad_segmento: "regulatorio" },
      { token: "T" },
    );
  });

  it("getOrg + listUsuarios → GET con token", () => {
    getOrg("T");
    listUsuarios("T");
    expect(calls.get).toHaveBeenCalledWith("/onboarding/org", { token: "T" });
    expect(calls.get).toHaveBeenCalledWith("/onboarding/usuarios", { token: "T" });
  });

  it("invitaciones: crear (con token), listar (status), aceptar (público)", () => {
    createInvitation({ email: "x@y.com", role: "viewer" }, "T");
    expect(calls.post).toHaveBeenCalledWith("/invitations", { email: "x@y.com", role: "viewer" }, { token: "T" });

    listInvitations("T", "pending");
    expect(calls.get).toHaveBeenCalledWith("/invitations", { token: "T", query: { status: "pending" } });

    acceptInvitation({ token: "tok", password: "newpass123", name: "N" });
    expect(calls.post).toHaveBeenCalledWith("/invitations/accept", {
      token: "tok",
      password: "newpass123",
      name: "N",
    });
  });

  it("documentos: listar (token) y eliminar por id (encodeURIComponent)", () => {
    listDocumentos("T");
    expect(calls.get).toHaveBeenCalledWith("/mis-documentos", { token: "T" });

    deleteDocumento("doc 1/x", "T");
    expect(calls.del).toHaveBeenCalledWith("/mis-documentos/doc%201%2Fx", { token: "T" });
  });

  it("codos: listar (token) y contexto por id (encodeURIComponent)", () => {
    listCodos("T");
    expect(calls.get).toHaveBeenCalledWith("/mo/codos", { token: "T" });

    getCodoContexto("ent A/1", "T");
    expect(calls.get).toHaveBeenCalledWith("/mo/codos/ent%20A%2F1", { token: "T" });
  });

  it("cuenta: resumen real → GET /onboarding/cuenta con token", () => {
    getCuenta("T");
    expect(calls.get).toHaveBeenCalledWith("/onboarding/cuenta", { token: "T" });
  });

  it("auth: logout revoca refresh; change-password; updateProfile (PATCH /auth/me)", () => {
    logout("ref-1", "T");
    expect(calls.post).toHaveBeenCalledWith(
      "/auth/logout",
      { refresh_token: "ref-1", todos: false },
      { token: "T" },
    );

    logout("ref-1", "T", true);
    expect(calls.post).toHaveBeenCalledWith(
      "/auth/logout",
      { refresh_token: "ref-1", todos: true },
      { token: "T" },
    );

    changePassword({ current_password: "old12345", new_password: "new12345" }, "T");
    expect(calls.post).toHaveBeenCalledWith(
      "/auth/change-password",
      { current_password: "old12345", new_password: "new12345" },
      { token: "T" },
    );

    updateProfile("Jorge", "T");
    expect(calls.patch).toHaveBeenCalledWith("/auth/me", { name: "Jorge" }, { token: "T" });
  });
});
