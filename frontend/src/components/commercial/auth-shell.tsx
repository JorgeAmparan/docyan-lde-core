"use client";

/**
 * Shell de las páginas de entrada (login/signup/codigo) — F3 B4.
 * Provee el estado de idioma/banda del sitio (mismo cookie `docyan_site`, para que
 * el idioma siga al del sitio público) y un enlace discreto "← Volver al sitio".
 * Ningún visitante queda encerrado en una vista (mismo principio que B13.1).
 */
import Link from "next/link";
import { SiteLangProvider, useT } from "@/lib/site-i18n";

function BackToSite() {
  const t = useT();
  // Estilo inline: las páginas (auth) no están bajo el contenedor `.s2`, así que no
  // heredan kit-sitio-v2. Enlace discreto, fijo arriba-izquierda, sobre el formulario.
  return (
    <Link
      href="/"
      aria-label={t({ es: "Volver al sitio", en: "Back to site" })}
      style={{
        position: "fixed", top: 16, left: 16, zIndex: 50,
        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
        color: "var(--fg-muted)", textDecoration: "none",
        padding: "6px 12px", borderRadius: "var(--radius-full)",
        border: "1px solid var(--border)", background: "var(--surface)",
      }}
    >
      ← {t({ es: "Volver al sitio", en: "Back to site" })}
    </Link>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <SiteLangProvider>
      <BackToSite />
      {children}
    </SiteLangProvider>
  );
}
