"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { logout as apiLogout } from "@/lib/onboarding";

/**
 * Menú de cuenta de la cabecera (B13/D4): el avatar ABRE un menú real —
 * Mi cuenta · Cambiar contraseña · Cerrar sesión. Cerrar sesión revoca el refresh
 * token en el servidor (denylist) y descarta la sesión en cliente, volviendo a
 * /login. Antes esta cabecera estaba muerta (avatar decorativo).
 */
export function AccountMenu({ initials }: { initials: string }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const refreshToken = useAuth((s) => s.refreshToken);
  const clear = useAuth((s) => s.clear);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const doLogout = async () => {
    setBusy(true);
    // Revoca en servidor; aun si la red falla, se descarta la sesión local (el TTL
    // corto del access token cierra la ventana). Verdad operacional: best-effort
    // revocación + descarte garantizado.
    try {
      await apiLogout(refreshToken, token);
    } catch {
      /* descarte local de todos modos */
    }
    clear();
    router.replace("/login");
  };

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <div className="acct-menu" ref={ref}>
      <button
        type="button"
        className="avatar acct-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de cuenta"
        onClick={() => setOpen((o) => !o)}
      >
        {initials}
      </button>
      {open && (
        <div className="acct-pop" role="menu">
          <div className="acct-head">
            <div className="acct-n">{user?.name ?? user?.email ?? "Mi cuenta"}</div>
            {user?.email && <div className="acct-e">{user.email}</div>}
          </div>
          <button type="button" className="acct-item" role="menuitem" onClick={() => go("/cuenta")}>
            <Icon name="user" size={15} />
            Mi cuenta
          </button>
          <button type="button" className="acct-item" role="menuitem" onClick={() => go("/cuenta")}>
            <Icon name="lock" size={15} />
            Cambiar contraseña
          </button>
          <div className="acct-sep" />
          <button type="button" className="acct-item danger" role="menuitem" onClick={doLogout} disabled={busy}>
            <Icon name="log-out" size={15} />
            {busy ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}
