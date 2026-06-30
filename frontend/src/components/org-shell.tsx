"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { useAuth } from "@/lib/auth";

/**
 * OrgShell — shell de NAV-RAIL único de la organización (rol admin/org).
 *
 * Es la ley visual del prototipo (`NAV_ORG.pro` en `app/data.jsx`): TODAS las
 * vistas de gestión de la org (Resumen, Inteligencia, CoDos, Documentos,
 * Alertas, Ingesta, Catálogo de schemas, Glosario, Gobernanza & FAT, Generar
 * QRs, Usuarios, Plan) se renderizan DENTRO de este mismo shell.
 *
 * El kit's `.admin` class es un frame fijo 1120×760; aquí se construye un flex
 * full-height fluido (`.side` + `.main`) conservando cada className del kit
 * verbatim (`.side`, `.side-logo`, `.nav`, `.grp`, `.org`, `.main`, `.topbar`,
 * `.search`, `.av-user`). Los hijos van en `.main > .content`.
 */

type NavGroup = { group: string };
type NavLink = { icon: string; label: string; href: string };
type NavEntry = NavGroup | NavLink;

// Paridad con `app/data.jsx → NAV_ORG`. Ambos juegos INCLUYEN "Consultar" (scan-line).
const NAV_PRO: NavEntry[] = [
  { group: "Operación" },
  { icon: "layout-dashboard", label: "Resumen", href: "/admin" },
  { icon: "sparkles", label: "Inteligencia", href: "/saved" },
  { icon: "folder-tree", label: "CoDos", href: "/admin/codos" },
  { icon: "scan-line", label: "Consultar", href: "/consult" },
  { icon: "bell", label: "Alertas", href: "/admin/alertas" },
  { group: "Administración" },
  { icon: "files", label: "Documentos", href: "/documentos" },
  { icon: "upload", label: "Ingesta", href: "/admin/ingesta" },
  { icon: "library", label: "Catálogo de schemas", href: "/admin/schemas" },
  { icon: "book-marked", label: "Glosario", href: "/admin/glosario" },
  { icon: "shield-check", label: "Gobernanza & FAT", href: "/admin/gobernanza" },
  { icon: "qr-code", label: "Generar QRs", href: "/admin/qrs" },
  { icon: "users", label: "Usuarios", href: "/admin/usuarios" },
  { icon: "gem", label: "Plan", href: "/plan" },
];

// Freemium: "Documentos" apunta a la lista de CoDos (vista "codos" del prototipo).
const NAV_FREE: NavEntry[] = [
  { icon: "files", label: "Documentos", href: "/admin/codos" },
  { icon: "scan-line", label: "Consultar", href: "/consult" },
  { icon: "users", label: "Usuarios", href: "/admin/usuarios" },
  { icon: "gem", label: "Plan", href: "/plan" },
];

const TITLES: Record<string, string> = {
  "/admin": "Resumen general",
  "/consult": "Consultar",
  "/select-codo": "Consultar",
  "/saved": "Inteligencia",
  "/admin/codos": "CoDos",
  "/documentos": "Documentos vivos",
  "/admin/alertas": "Alertas administrativas",
  "/admin/ingesta": "Ingesta de documentos",
  "/admin/schemas": "Catálogo de schemas",
  "/admin/glosario": "Glosario + lock terminológico",
  "/admin/gobernanza": "Gobernanza & FAT",
  "/admin/qrs": "Generar QRs",
  "/admin/usuarios": "Usuarios",
  "/plan": "Plan",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function isConsultRoute(pathname: string): boolean {
  return pathname === "/consult" || pathname === "/select-codo";
}

function titleFor(pathname: string): string {
  // longest matching prefix wins (so /admin/codos/[id] keeps the CoDos title)
  const match = Object.keys(TITLES)
    .filter((h) => (h === "/admin" ? pathname === "/admin" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : "DOCYAN LDE";
}

function initials(value?: string): string {
  if (!value) return "DY";
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function OrgShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);

  // DESIGN: org identity defaults to canned kit values until /auth/me populates.
  const orgName = user?.org_name ?? "Laboratorio Estándar";
  // ⚠️ El plan sale de la sesión/`/auth/me` (mismo origen que org_name). Si el campo NO existe
  // aún, fallback a "pro" para NO ocultar opciones — y reporta a Jorge que falta exponer `plan`.
  // NUNCA dejes el rail vacío ni oculto.
  const plan = user?.plan === "free" ? "free" : "pro";
  const NAV = plan === "free" ? NAV_FREE : NAV_PRO;
  const orgPlan = plan === "free" ? "Plan gratuito" : "Plan Profesional";
  const userInitials = initials(user?.name ?? user?.email);

  return (
    <div style={{ display: "flex", height: "100dvh", width: "100%", background: "var(--bg)" }}>
      <aside className="side">
        <Link href="/admin" className="side-logo" style={{ textDecoration: "none", color: "inherit" }}>
          <DocyanMark size={24} />
          <span className="w">DOCYAN</span>
          <span className="lde">LDE</span>
        </Link>
        <nav className="nav">
          {NAV.map((n, i) =>
            "group" in n ? (
              <div className="grp" key={`g-${i}`}>
                {n.group}
              </div>
            ) : (
              <Link className={isActive(pathname, n.href) ? "on" : ""} key={n.href} href={n.href}>
                <Icon name={n.icon} size={17} className="lic" />
                {n.label}
              </Link>
            ),
          )}
        </nav>
        <div className="org">
          <div className="av">{initials(orgName)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="ot">{orgName}</div>
            <div className="om">{orgPlan}</div>
          </div>
          <Icon name="chevrons-up-down" size={15} color="var(--fg-subtle)" />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{titleFor(pathname)}</h1>
          <div className="search">
            <Icon name="search" size={15} />
            <input placeholder="Buscar en todos los CoDos…" aria-label="Buscar en todos los CoDos" />
          </div>
          <div className="av-user" aria-label="Cuenta">
            {userInitials}
          </div>
        </header>

        <div className={"content" + (isConsultRoute(pathname) ? " consult" : "")}>{children}</div>
      </div>
    </div>
  );
}
