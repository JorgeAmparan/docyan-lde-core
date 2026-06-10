import { SiteShell } from "@/components/commercial/site-shell";

/** Capa pública v2 (F3): shell con provider idioma/banda + nav + footer + banner geo,
 *  todo bajo el contenedor `.s2` que aísla el kit-sitio-v2. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
