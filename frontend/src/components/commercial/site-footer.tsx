"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { useRegion } from "@/lib/region-store";

/** Public shared footer (ported from `landing.jsx` Footer). */
export function SiteFooter() {
  const { t } = useTranslation("common");
  const region = useRegion((s) => s.region);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <div className="brand">
              <DocyanMark size={24} tone="light" />
              DOCYAN
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, maxWidth: "34ch", marginTop: 14 }}>
              {t("tagline")}. Un producto de XCID SA de CV, México.
            </p>
          </div>
          <div>
            <h4>{t("footer.producto")}</h4>
            <Link href="/precios">{t("nav.precios")}</Link>
            <Link href="/como-funciona">{t("nav.comoFunciona")}</Link>
            <Link href="/seguridad">{t("nav.seguridad")}</Link>
            <Link href="/verticales/laboratorios">{t("nav.verticales")}</Link>
          </div>
          <div>
            <h4>{t("footer.empresa")}</h4>
            <Link href="/acerca">{t("nav.acerca")}</Link>
            <Link href="/soporte">Contacto</Link>
            <Link href="/seguridad">Privacidad</Link>
            <Link href="/seguridad">Términos</Link>
          </div>
          <div>
            <h4>{t("nav.soporte")}</h4>
            <Link href="/soporte">Centro de ayuda</Link>
            <Link href="/como-funciona">Documentación</Link>
            <Link href="/estado">{t("footer.estado")}</Link>
          </div>
        </div>
        <div className="fbottom">
          <span>© 2026 XCID SA de CV</span>
          <div className="sp">
            <span className="region" style={{ color: "var(--amate-300)", borderColor: "rgba(244,238,227,.2)" }}>
              <Globe size={13} strokeWidth={1.75} />
              {region} · ES
            </span>
            <Link href="/estado" className="status" style={{ color: "var(--amate-300)", textDecoration: "none" }}>
              <span className="d" />
              {t("footer.operational")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
