"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUTH_COOKIE, DOCO_COOKIE } from "./config";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: "admin" | "colaborador" | string;
  org_id?: string;
  org_name?: string;
  plan?: "free" | "pro";
}

interface AuthState {
  token: string | null;
  /** Refresh token (B5): habilita renovar el access token y revocar en logout. */
  refreshToken: string | null;
  user: AuthUser | null;
  docoId: string | null;
  setSession: (token: string, user: AuthUser, refreshToken?: string | null) => void;
  setDoco: (docoId: string) => void;
  clear: () => void;
}

function writeCookie(name: string, value: string, maxAgeDays = 7) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeDays * 86400}; SameSite=Lax${secure}`;
}
function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Client auth store. The JWT lives in memory (+ localStorage for reloads) so the
 * api-client can attach it to `Authorization`; a mirrored cookie lets the Next
 * middleware guard SSR routes. (B9.1: harden to httpOnly + server-side proxy.)
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      docoId: null,
      setSession: (token, user, refreshToken = null) => {
        writeCookie(AUTH_COOKIE, "1");
        set({ token, user, refreshToken });
      },
      setDoco: (docoId) => {
        writeCookie(DOCO_COOKIE, docoId);
        set({ docoId });
      },
      clear: () => {
        deleteCookie(AUTH_COOKIE);
        deleteCookie(DOCO_COOKIE);
        set({ token: null, refreshToken: null, user: null, docoId: null });
      },
    }),
    { name: "docyan-auth" },
  ),
);
