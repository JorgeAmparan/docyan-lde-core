"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";

const NAV: Array<[string, string, string]> = [
  ["layout-dashboard", "Resumen", "/cuenta"],
  ["receipt", "Facturación", "/cuenta/facturacion"],
  ["wallet", "Recargar saldo", "/cuenta/recharge"],
  ["users", "Usuarios", "/cuenta/usuarios"],
  ["lock", "Seguridad", "/cuenta/seguridad"],
  ["bell", "Notificaciones", "/cuenta/notificaciones"],
];

/** Authenticated account shell (Capa B §6.5) — top nav + sidebar + main. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const orgName = user?.org_name ?? "Laboratorio Estándar";
  const initials =
    (user?.name ?? user?.email ?? "JM")
      .split(/[ @.]/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "JM";

  return (
    <div>
      <div className="nav">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <DocyanMark size={26} />
          DOCYAN<span className="lde">LDE</span>
        </Link>
        <div className="right">
          <span className="region">
            <Icon name="building-2" size={13} />
            {orgName}
          </span>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--cinnabar-500)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {initials}
          </div>
        </div>
      </div>

      <div className="acct">
        <aside className="acct-side">
          <h4>Cuenta</h4>
          {NAV.map(([ic, label, href]) => {
            const active = href === "/cuenta" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "on" : ""}>
                <Icon name={ic} size={17} />
                {label}
              </Link>
            );
          })}
        </aside>
        <main className="acct-main">{children}</main>
      </div>
    </div>
  );
}
