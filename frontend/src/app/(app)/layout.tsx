/**
 * Thin authenticated wrapper for Capa A (PWA) routes. Auth is enforced by
 * `src/middleware.ts` (cookie gate) — this layout adds no chrome so that admin
 * (built separately) and the full-screen consult view can each own their inner
 * layout. Intentionally minimal: it only renders children.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
