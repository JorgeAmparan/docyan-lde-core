"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { usePlatformAuth } from "@/lib/platform-auth";
import { usePlatformApi, initials, type JobSummary, type SupportThreadOut } from "@/lib/platform";

type NavGroup = { groupKey: string };
type NavLink = { icon: string; key: string; href: string; badge?: "jobs" | "soporte" };
type NavEntry = NavGroup | NavLink;

const NAV: NavEntry[] = [
  { groupKey: "nav.grupoOperacion" },
  { icon: "layout-dashboard", key: "nav.resumen", href: "/platform/resumen" },
  { icon: "building-2", key: "nav.orgs", href: "/platform/orgs" },
  { icon: "server", key: "nav.jobs", href: "/platform/jobs", badge: "jobs" },
  { groupKey: "nav.grupoComercial" },
  { icon: "ticket", key: "nav.codigos", href: "/platform/codigos" },
  { icon: "banknote", key: "nav.ingresos", href: "/platform/ingresos" },
  { groupKey: "nav.grupoRelacion" },
  { icon: "life-buoy", key: "nav.soporte", href: "/platform/soporte", badge: "soporte" },
];

const CRUMB: Record<string, string> = {
  "/platform/resumen": "PLATAFORMA / RESUMEN",
  "/platform/orgs": "PLATAFORMA / ORGANIZACIONES",
  "/platform/jobs": "PLATAFORMA / JOBS",
  "/platform/codigos": "PLATAFORMA / CÓDIGOS",
  "/platform/ingresos": "PLATAFORMA / INGRESOS",
  "/platform/soporte": "PLATAFORMA / SOPORTE",
};
const TITLE_KEY: Record<string, string> = {
  "/platform/resumen": "title.resumen",
  "/platform/orgs": "title.orgs",
  "/platform/jobs": "title.jobs",
  "/platform/codigos": "title.codigos",
  "/platform/ingresos": "title.ingresos",
  "/platform/soporte": "title.soporte",
};

function periodoActual(): string {
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
    "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const d = new Date();
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation("platform");
  const { token, admin, clear } = usePlatformAuth();
  const pf = usePlatformApi();

  // Guarda de cliente: sin sesión platform_admin → al login (el middleware ya
  // protege SSR; esto cubre el cliente y garantiza token para las llamadas).
  useEffect(() => {
    if (!token) router.replace("/platform/login");
  }, [token, router]);

  // Badges de navegación (datos reales): jobs con error + hilos de soporte abiertos.
  const { data: jobs } = useQuery({
    queryKey: ["platform", "jobs"],
    queryFn: () => pf.get<{ items: JobSummary[] }>("/platform/jobs"),
    enabled: !!token,
    refetchInterval: 8000,
  });
  const { data: threads } = useQuery({
    queryKey: ["platform", "support"],
    queryFn: () => pf.get<{ items: SupportThreadOut[] }>("/platform/support/threads"),
    enabled: !!token,
    refetchInterval: 15000,
  });
  const badges = {
    jobs: (jobs?.items ?? []).filter((j) => j.status === "failed").length,
    soporte: (threads?.items ?? []).filter((t) => t.estado === "abierto").length,
  };

  if (!token) return null;

  const title = TITLE_KEY[pathname] ? t(TITLE_KEY[pathname]) : "Plataforma";
  const crumb = CRUMB[pathname] ?? "PLATAFORMA";
  const isOn = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="papp">
      <aside className="pside">
        <Link href="/platform/resumen" className="pslogo">
          <DocyanMark size={24} tone="light" />
          <span className="w">DOCYAN</span>
          <span className="pl">PLATAFORMA</span>
        </Link>

        {/* Señal de seguridad, no estética: estás FUERA del aislamiento de tenant. */}
        <div className="psbadge">
          <Icon name="shield-half" size={16} className="lic" />
          <div style={{ minWidth: 0 }}>
            <div className="pb-t">{t("scope.name")}</div>
            <div className="pb-s">{t("scope.sub")}</div>
          </div>
        </div>

        <nav className="pnav">
          {NAV.map((n, i) =>
            "groupKey" in n ? (
              <div className="grp" key={`g-${i}`}>{t(n.groupKey)}</div>
            ) : (
              <Link key={n.href} href={n.href} className={isOn(n.href) ? "on" : ""}
                aria-current={isOn(n.href) ? "page" : undefined}>
                <Icon name={n.icon} size={17} className="lic" />
                {t(n.key)}
                {n.badge && badges[n.badge] > 0 && (
                  <span className={`ncount${n.badge === "jobs" ? " alert" : ""}`}>{badges[n.badge]}</span>
                )}
              </Link>
            ),
          )}
        </nav>

        <div className="psfoot">
          <div className="pf-id">
            <div className="av">{initials(admin?.name ?? admin?.email)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="pf-n">{admin?.name ?? t("scope.founder")}</div>
              <div className="pf-r">{t("scope.name")}</div>
            </div>
          </div>
          <button className="pf-logout" onClick={() => { clear(); router.replace("/platform/login"); }}>
            <Icon name="log-out" size={14} /> {t("scope.logout")}
          </button>
          <div className="pf-guard">
            <Icon name="shield-check" size={13} className="lic" />
            {t("scope.guard")}
          </div>
        </div>
      </aside>

      <div className="pmain">
        <header className="ptop">
          <h1>{title}</h1>
          <span className="crumb">{crumb}</span>
          <div className="period">
            <Icon name="calendar" size={14} className="lic" />
            {periodoActual()}
          </div>
        </header>
        <div className="pcontent">
          <div className="pwrap">{children}</div>
        </div>
      </div>
    </div>
  );
}
