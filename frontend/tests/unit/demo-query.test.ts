import { describe, it, expect, vi, beforeEach } from "vitest";

/** F3 §D — el cliente de la consulta demo pública: pasa el resultado del backend
 *  cuando responde, y degrada al fallback honesto ante error de red/límite (la UX
 *  del visitante nunca rompe). */

const post = vi.fn();
vi.mock("@/lib/api-client", () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

import { demoQuery, DEMO_FALLBACK } from "@/lib/demo-query";

describe("demoQuery", () => {
  beforeEach(() => post.mockReset());

  it("pasa el resultado servido del backend", async () => {
    post.mockResolvedValueOnce({
      servido: true, kind: "info", resultado: { payload: { valor: "85" } },
      fallback: null, codo: "lab", tenant_demo: "demo-lab",
    });
    const r = await demoQuery("¿torque?", "lab");
    expect(post).toHaveBeenCalledWith("/demo/query", { texto: "¿torque?", codo: "lab", documento_id: null });
    expect(r.servido).toBe(true);
    expect(r.kind).toBe("info");
  });

  it("acota la consulta al documento activo (doc-tabs — fix §2.4)", async () => {
    post.mockResolvedValueOnce({
      servido: true, kind: "info", resultado: { payload: { valor: "85" } },
      fallback: null, codo: "lab", tenant_demo: "demo-lab",
    });
    await demoQuery("¿torque?", "lab", "doc-mitutoyo-1");
    expect(post).toHaveBeenCalledWith(
      "/demo/query",
      { texto: "¿torque?", codo: "lab", documento_id: "doc-mitutoyo-1" },
    );
  });

  it("degrada al fallback honesto ante error", async () => {
    post.mockRejectedValueOnce(new Error("network"));
    const r = await demoQuery("x", "lab");
    expect(r.servido).toBe(false);
    expect(r.fallback).toBe(DEMO_FALLBACK);
    expect(r.resultado).toBeNull();
  });
});
