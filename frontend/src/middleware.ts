import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/config";

/** Authenticated route prefixes (Capa A PWA + account). Collaborators enter via
 *  /q/[token] (public, the QR is the credential) and are never gated here. */
const PROTECTED = ["/consult", "/saved", "/playbook", "/admin", "/onboarding", "/select-codo", "/cuenta"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!needsAuth) return NextResponse.next();

  const hasSession = req.cookies.get(AUTH_COOKIE)?.value;
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|brand|sw.js|manifest.webmanifest).*)"],
};
