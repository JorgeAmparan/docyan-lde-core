"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { useAuth } from "@/lib/auth";

/**
 * Shell de las superficies de producto del ciclo de uso (Documentos · Usuarios).
 * Portado de `ui_kits/onboarding/manage.jsx` → ProductShell. El contador del plan
 * y el nombre de org salen de datos reales (no enlatados).
 */
export function ProductShell({
  active,
  counter,
  isFreemium,
  children,
}: {
  active: "documents" | "invite";
  counter?: string | null;
  isFreemium?: boolean;
  children: ReactNode;
}) {
  const user = useAuth((s) => s.user);
  const orgName = user?.org_name ?? "Mi organización";
  const initials =
    (user?.name ?? user?.email ?? "DOCYAN")
      .split(/[ @.]/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "DY";

  return (
    <div className="app-stage">
      <div className="appbar">
        <BrandRow size={24} />
        <div className="org">
          <span className="avatar">{orgName.slice(0, 2).toUpperCase()}</span>
          <div>
            <div className="org-n">{orgName}</div>
            <div className="org-m">multi-tenant aislado</div>
          </div>
        </div>
        <div className="ab-right">
          {isFreemium && counter && (
            <span className="plan-chip">
              <Icon name="gift" size={14} style={{ color: "var(--cinnabar-500)" }} />
              Gratuito · <span className="pc-cnt">{counter}</span>
              <Link href="/plan" className="pc-up">
                Elegir plan
              </Link>
            </span>
          )}
          <span className="avatar">{initials}</span>
        </div>
      </div>
      <div className="app-wrap">
        <div className="app-tabs">
          <Link href="/documentos" className={active === "documents" ? "on" : ""}>
            <Icon name="files" size={15} style={{ verticalAlign: "-3px", marginRight: 7 }} />
            Documentos
          </Link>
          <Link href="/usuarios" className={active === "invite" ? "on" : ""}>
            <Icon name="users" size={15} style={{ verticalAlign: "-3px", marginRight: 7 }} />
            Usuarios
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
