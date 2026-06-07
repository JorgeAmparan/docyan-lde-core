import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { PLATFORM_AUTH_COOKIE } from "@/lib/config";

/**
 * F2 — guarda de ruta de la Consola del Fundador. `/platform/*` exige el cookie de
 * sesión `platform_admin` (scope separado del de tenant). Sin él → redirige al
 * login de plataforma. `/platform/login` es público.
 */
function req(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`https://app.docyan.com${path}`, { headers });
}

describe("platform route guard (middleware)", () => {
  it("sin sesión platform_admin redirige /platform/* al login de plataforma", () => {
    const res = middleware(req("/platform/resumen"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location")!;
    expect(new URL(loc).pathname).toBe("/platform/login");
    expect(new URL(loc).searchParams.get("next")).toBe("/platform/resumen");
  });

  it("un cookie de tenant NO abre /platform (solo el cookie de plataforma)", () => {
    const res = middleware(req("/platform/orgs", "docyan_token=1"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/platform/login");
  });

  it("con sesión platform_admin deja pasar /platform/*", () => {
    const res = middleware(req("/platform/orgs", `${PLATFORM_AUTH_COOKIE}=1`));
    // NextResponse.next() no redirige.
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("/platform/login es público (sin sesión)", () => {
    const res = middleware(req("/platform/login"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
