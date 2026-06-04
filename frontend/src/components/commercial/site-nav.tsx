"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { RegionSwitcher } from "@/components/region-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";

/** Public shared nav (ported from `landing.jsx` Nav). Links navigate via Next. */
export function SiteNav() {
  const { t } = useTranslation("common");
  return (
    <nav className="nav">
      <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
        <DocyanMark size={26} />
        DOCYAN<span className="lde">LDE</span>
      </Link>
      <div className="links">
        <Link href="/">{t("nav.producto")}</Link>
        <Link href="/como-funciona">{t("nav.comoFunciona")}</Link>
        <Link href="/precios">{t("nav.precios")}</Link>
        <Link href="/verticales/laboratorios">{t("nav.verticales")}</Link>
        <Link href="/seguridad">{t("nav.seguridad")}</Link>
      </div>
      <div className="right">
        <RegionSwitcher />
        <LanguageSwitcher />
        <Link href="/login" className="btn ghost">{t("nav.entrar")}</Link>
        <Link href="/signup" className="btn primary">{t("actions.agendarDemo")}</Link>
      </div>
    </nav>
  );
}
