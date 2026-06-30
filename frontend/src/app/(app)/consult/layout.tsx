import { OrgShell } from "@/components/org-shell";

/**
 * Capa A · Consulta DENTRO del shell de la org (paridad con el prototipo:
 * `view === "consultar"` vive en `OrgShell`, con rail + topbar visibles).
 * NO es full-screen. El cableado de `consult/page.tsx` (CoDo activo → /mo/query)
 * NO cambia: solo se le devuelve el chrome.
 */
export default function ConsultLayout({ children }: { children: React.ReactNode }) {
  return <OrgShell>{children}</OrgShell>;
}
