import { AuthShell } from "@/components/commercial/auth-shell";

/** Layout de entrada (F3 B4): provee idioma del sitio + salida "← Volver al sitio"
 *  a login/signup/codigo/invitación/reset, para que ninguna vista sea callejón
 *  sin salida y el idioma siga al del sitio público. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
