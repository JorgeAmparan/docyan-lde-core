import { describe, it, expect } from "vitest";
import {
  ORG_ROLES, ROLE_LABELS, roleLabel, invitableRoles, canInvite,
} from "@/lib/roles";

/** El modelo de UI es Admin / Editor / Consulta; el backend sigue en
 *  admin/editor/viewer. `viewer` se RE-ETIQUETA a "Consulta" (B13). */
describe("relabel de roles (viewer → Consulta)", () => {
  it("mantiene los valores del backend intactos", () => {
    expect(ORG_ROLES).toEqual(["admin", "editor", "viewer"]);
  });

  it("muestra 'Consulta' para viewer, sin cambiar el valor", () => {
    expect(ROLE_LABELS.viewer).toBe("Consulta");
    expect(ROLE_LABELS.admin).toBe("Admin");
    expect(ROLE_LABELS.editor).toBe("Editor");
    expect(roleLabel("viewer")).toBe("Consulta");
  });

  it("tolera roles desconocidos / vacíos", () => {
    expect(roleLabel(undefined)).toBe("");
    expect(roleLabel("otro")).toBe("otro");
  });
});

/** Espejo de la regla del backend (que es la autoridad): admin invita a
 *  cualquiera; editor solo a Consulta (viewer); viewer no invita. */
describe("regla de rol-destino de invitación", () => {
  it("admin puede invitar cualquier rol", () => {
    expect(invitableRoles("admin")).toEqual(["admin", "editor", "viewer"]);
    expect(canInvite("admin", "admin")).toBe(true);
    expect(canInvite("admin", "editor")).toBe(true);
    expect(canInvite("admin", "viewer")).toBe(true);
  });

  it("editor solo puede invitar viewer (Consulta)", () => {
    expect(invitableRoles("editor")).toEqual(["viewer"]);
    expect(canInvite("editor", "viewer")).toBe(true);
    expect(canInvite("editor", "editor")).toBe(false);
    expect(canInvite("editor", "admin")).toBe(false);
  });

  it("viewer no puede invitar a nadie", () => {
    expect(invitableRoles("viewer")).toEqual([]);
    expect(canInvite("viewer", "viewer")).toBe(false);
  });
});
