"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { useAuth } from "@/lib/auth";
import { getCuenta } from "@/lib/onboarding";

/**
 * OrgShell — chrome de la organización, PORTADO 1:1 del prototipo
 * (`DOCYAN-Prototipo.html → OrgShell` + `app/app.css`):
 *   `.app` → `.header` (marca + búsqueda + cuenta) + `.body` (`.rail` hover-expand
 *   + `.main` → `.content`).
 *
 * El rail es de **hover-expand** (66px → 224px): labels, grupos y org ocultos hasta
 * el hover (clases `.rail`/`.rail-in`/`.label`/`.rail-org`, reglas verbatim en
 * kit-admin.css). La marca vive en el header (no en el rail) y NO hay `<h1>` de
 * título: cada vista trae su propio encabezado, igual que el prototipo.
 *
 * El cableado real se conserva: rutas Next (`Link`), `useAuth` (sesión/plan),
 * logout (`clear` + `/login`). Búsqueda global = input readOnly (el modal es ítem
 * aparte del punch list, aún no portado — no se finge).
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

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function isConsultRoute(pathname: string): boolean {
  return pathname === "/consult" || pathname === "/select-codo";
}

function initials(value?: string): string {
  if (!value) return "DY";
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function OrgShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const clear = useAuth((s) => s.clear);

  // Plan free/pro del rail: sale de `GET /onboarding/cuenta` (CuentaResumen.plan),
  // el MISMO origen que `admin/codos/page.tsx` (Mapa de Paridad §8.1). NO se deriva
  // de `auth`/AuthUser. `isFree` = el plan contiene "free" (freemium incluido).
  const { data: cuenta } = useQuery({
    queryKey: ["cuenta-shell"],
    queryFn: () => getCuenta(token as string),
    enabled: !!token,
    staleTime: 60_000,
  });
  const isFree = (cuenta?.plan ?? "").toLowerCase().includes("free");
  const orgName = cuenta?.nombre ?? user?.org_name ?? "Mi organización";
  const NAV = isFree ? NAV_FREE : NAV_PRO;
  const orgPlan = cuenta?.plan_nombre ?? (isFree ? "Plan gratuito" : "Plan Profesional");
  const userInitials = initials(user?.name ?? user?.email);

  function logout() {
    clear();
    router.push("/login");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="hbrand">
          <DocyanMark size={24} />
          <span className="w">DOCYAN</span>
          <span className="lde">LDE</span>
          <span className="role-tag">Org</span>
        </div>
        <div className="hsep" />
        <div className="search">
          <Icon name="search" size={16} className="lic" />
          <input readOnly placeholder="Busca un documento o pregunta directo…" aria-label="Buscar" />
        </div>
        <div className="haccount">
          <Link href="/cuenta" className="av-user" title="Mi cuenta">
            {userInitials}
          </Link>
        </div>
      </header>

      <div className="body">
        <aside className="rail">
          <div className="rail-in">
            <nav className="nav">
              {NAV.map((n, i) =>
                "group" in n ? (
                  <div className="grp" key={`g-${i}`}>
                    {n.group}
                  </div>
                ) : (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={isActive(pathname, n.href) ? "on" : ""}
                    aria-current={isActive(pathname, n.href) ? "page" : undefined}
                  >
                    <Icon name={n.icon} size={19} className="lic" />
                    <span className="label">{n.label}</span>
                  </Link>
                ),
              )}
            </nav>
            <div className="rail-foot">
              <button className="rail-logout" onClick={logout}>
                <Icon name="log-out" size={19} className="lic" />
                <span className="label">Cerrar sesión</span>
              </button>
              <div className="rail-org">
                <div className="av">{initials(orgName)}</div>
                <div className="ot">
                  <div className="otn">{orgName}</div>
                  <div className="otm">{orgPlan}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <div className={"content" + (isConsultRoute(pathname) ? " consult" : "")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
