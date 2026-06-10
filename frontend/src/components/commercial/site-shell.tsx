"use client";

/**
 * DOCYAN sitio público v2 — shell (F3 §A/§B). Envuelve cada página pública en el
 * contenedor `.s2` (aísla el kit-sitio-v2 de los demás kits), el provider de
 * idioma/banda, el banner geo de primera visita (desechable) y el nav/footer v2.
 */
import { useEffect, useState } from "react";
import { SiteLangProvider } from "@/lib/site-i18n";
import { GeoBanner, SiteFooter2, SiteNav2 } from "./site-chrome";

const SEEN = "docyan_geo_seen";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [showBanner, setShowBanner] = useState(false);
  useEffect(() => {
    // Hidratación cliente: el banner de primera visita depende de localStorage, que
    // no existe en SSR. setState-en-effect es el patrón correcto aquí (no hay sistema
    // externo que sincronizar; es estado derivado de almacenamiento sólo-cliente).
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN)) setShowBanner(true);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  const dismiss = () => {
    setShowBanner(false);
    try { localStorage.setItem(SEEN, "1"); } catch { /* ignore */ }
  };
  return (
    <SiteLangProvider>
      <div className="s2">
        {showBanner && <GeoBanner onDismiss={dismiss} />}
        <SiteNav2 />
        <main>{children}</main>
        <SiteFooter2 />
      </div>
    </SiteLangProvider>
  );
}
