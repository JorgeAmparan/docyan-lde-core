import { OrgShell } from "@/components/org-shell";

/**
 * Capa A admin shell. Toda la gestión de la org vive en el MISMO nav-rail
 * (`OrgShell`) — el shell se extrajo a `@/components/org-shell` para que las
 * vistas que viven fuera de `/admin/*` (Inteligencia `/saved`, Documentos
 * `/documentos`, Plan `/plan`) compartan exactamente el mismo chrome.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <OrgShell>{children}</OrgShell>;
}
