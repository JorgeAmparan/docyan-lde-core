"use client";

import Link from "next/link";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { Icon } from "@/components/icon";
import { AccountMenu } from "@/components/onboarding/account-menu";
import { useAuth } from "@/lib/auth";

/**
 * Account shell — cabecera + contenido centrado. La cuenta es UNA sola página
 * (P4, Matriz de Cierre): se consolidó en Perfil/Organización/Seguridad (el
 * `CuentaOrg` del prototipo), así que ya no hay sidebar ni subrutas.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const orgName = user?.org_name ?? "Mi organización";
  const initials =
    (user?.name ?? user?.email ?? "MC")
      .split(/[ @.]/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "MC";

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
          <AccountMenu initials={initials} />
        </div>
      </div>
      {children}
    </div>
  );
}
