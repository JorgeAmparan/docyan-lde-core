/**
 * Thin authenticated wrapper for Capa A (PWA) routes. Auth is enforced by
 * `src/middleware.ts` (cookie gate) — this layout adds no chrome so that admin
 * (admin, consult y select-codo) traen su propio OrgShell vía layout de ruta.
 * Este layout es passthrough a propósito: NO añade chrome aquí para no envolver
 * onboarding ni las rutas públicas. Intentionally minimal: it only renders children.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
