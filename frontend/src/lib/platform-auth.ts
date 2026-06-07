"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PLATFORM_AUTH_COOKIE } from "./config";

/**
 * Sesión del `platform_admin` (Consola del Fundador, F2). Es INDEPENDIENTE de la
 * sesión de tenant (`useAuth`): distinto JWT, distinto scope, distinto cookie. El
 * fundador opera fuera del aislamiento de cliente, así que su sesión nunca se
 * mezcla con la del admin de org. El token va en memoria (+ localStorage) para que
 * el api-client lo adjunte como Bearer; un cookie espejo deja que el middleware de
 * Next proteja las rutas SSR `/platform/*`.
 */
export interface PlatformAdmin {
  id: string;
  email: string;
  name?: string;
}

interface PlatformAuthState {
  token: string | null;
  admin: PlatformAdmin | null;
  setSession: (token: string, admin: PlatformAdmin) => void;
  clear: () => void;
}

function writeCookie(name: string, value: string, maxAgeDays = 1) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeDays * 86400}; SameSite=Lax${secure}`;
}
function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export const usePlatformAuth = create<PlatformAuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setSession: (token, admin) => {
        writeCookie(PLATFORM_AUTH_COOKIE, "1");
        set({ token, admin });
      },
      clear: () => {
        deleteCookie(PLATFORM_AUTH_COOKIE);
        set({ token: null, admin: null });
      },
    }),
    { name: "docyan-platform-auth" },
  ),
);
