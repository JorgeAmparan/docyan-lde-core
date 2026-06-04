import { describe, it, expect } from "vitest";
import { playbookEarned, savedSurfaceLabel } from "@/lib/playbook-naming";

/**
 * Progressive naming (design non-negotiable): "Playbook" appears only at ≥2
 * related saved consultas. Verifies the 0/1/2 boundary + backend override.
 */
describe("progressive Playbook naming", () => {
  it("is NOT earned with 0 related saves", () => {
    expect(playbookEarned(0)).toBe(false);
    expect(savedSurfaceLabel(0)).toBe("Mis consultas guardadas");
  });

  it("is NOT earned with 1 related save", () => {
    expect(playbookEarned(1)).toBe(false);
    expect(savedSurfaceLabel(1)).toBe("Mis consultas guardadas");
  });

  it("IS earned with 2+ related saves (the word 'Playbook' may now appear)", () => {
    expect(playbookEarned(2)).toBe(true);
    expect(playbookEarned(5)).toBe(true);
    expect(savedSurfaceLabel(2)).toBe("Tus consultas");
  });

  it("honors the backend authority over the local count", () => {
    expect(playbookEarned(5, false)).toBe(false); // backend says not earned
    expect(playbookEarned(0, true)).toBe(true); // backend says earned
  });
});
