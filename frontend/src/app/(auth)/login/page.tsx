"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { PwField } from "@/components/onboarding/auth-bits";
import { api, ApiError } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/lib/auth";
import { useT } from "@/lib/site-i18n";

/**
 * Superficie de ENTRADA — Iniciar sesión (entry.jsx → Login). Layout centrado
 * (`auth-card auth-centered`), marca, campo de contraseña con mostrar/ocultar,
 * fila Recordarme/¿Olvidaste tu contraseña?, callout de QR para colaboradores.
 *
 * Cableado REAL preservado: RHF + zod → `POST /auth/login` → setSession → redirect.
 * Los colaboradores NUNCA pasan por aquí; entran por /q/[token] (el QR es la
 * credencial). /auth/login es `unknown` en el OpenAPI generado: tipamos la
 * respuesta localmente y toleramos variantes snake/camel + name/nombre.
 */
const loginSchema = z.object({
  email: z.string().email("email_invalid"),
  remember: z.boolean().optional(),
});
type LoginValues = z.infer<typeof loginSchema>;

interface LoginResponse {
  access_token?: string;
  token?: string;
  refresh_token?: string;
  user?: Partial<AuthUser> & { name?: string; nombre?: string };
}

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  // PwField es controlado; el password vive en estado local (no en watch() de RHF,
  // que dispara un warning de react-hooks/incompatible-library).
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  const fieldError = (code?: string) => {
    if (!code) return undefined;
    if (code === "email_invalid") return t({ es: "Correo no válido", en: "Invalid email" });
    if (code === "password_required") return t({ es: "Ingresa tu contraseña", en: "Enter your password" });
    return code;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", remember: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (password.length < 1) {
      setPwError(fieldError("password_required") ?? null);
      return;
    }
    setPwError(null);
    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        email: values.email,
        password,
      });
      const token = res.access_token ?? res.token;
      if (!token) {
        setServerError(t({ es: "Respuesta de autenticación inválida.", en: "Invalid authentication response." }));
        return;
      }
      const u = res.user ?? {};
      const user: AuthUser = {
        id: u.id ?? values.email,
        email: u.email ?? values.email,
        name: u.name ?? u.nombre,
        role: u.role,
        org_id: u.org_id,
        org_name: u.org_name,
      };
      setSession(token, user, res.refresh_token ?? null);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/admin/codos");
    } catch (err) {
      // Surface the REAL error — no canned success here (this is the admin gate).
      if (err instanceof ApiError) {
        setServerError(
          err.status === 401 || err.status === 403
            ? t({ es: "Correo o contraseña incorrectos.", en: "Incorrect email or password." })
            : err.message,
        );
      } else {
        setServerError(
          t({ es: "No pudimos conectar. Revisa tu red e intenta de nuevo.", en: "We couldn't connect. Check your network and try again." }),
        );
      }
    }
  });

  return (
    <div className="entry-view">
      <div className="auth-stage">
        <div className="auth-form" style={{ width: "100%" }}>
          <form className="auth-card auth-centered" onSubmit={onSubmit} noValidate>
            <div className="ac-head" style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
                  <BrandRow size={30} />
                </Link>
              </div>
              <h2>{t({ es: "Bienvenido de vuelta", en: "Welcome back" })}</h2>
              <p className="ac-sub">
                {t({
                  es: "Ingresa a tu organización para gestionar documentos, CoDos e invitaciones.",
                  en: "Sign in to your organization to manage documents, CoDos and invitations.",
                })}
              </p>
            </div>

            <div className="field">
              <label htmlFor="email">{t({ es: "Correo", en: "Email" })}</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t({ es: "tú@empresa.mx", en: "you@company.com" })}
                {...register("email")}
              />
              {errors.email && <span className="warn">{fieldError(errors.email.message)}</span>}
            </div>

            <PwField
              label={t({ es: "Contraseña", en: "Password" })}
              placeholder="••••••••••"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (pwError) setPwError(null);
              }}
              show={show}
              setShow={setShow}
              autoComplete="current-password"
            />
            {pwError && (
              <span className="warn" style={{ marginTop: -10, marginBottom: 16 }}>
                {pwError}
              </span>
            )}

            <div className="field-row">
              <label className="chk">
                <input type="checkbox" {...register("remember")} />
                {t({ es: "Recordarme", en: "Remember me" })}
              </label>
              <Link className="link" href="/reset-password">
                {t({ es: "¿Olvidaste tu contraseña?", en: "Forgot your password?" })}
              </Link>
            </div>

            {serverError && (
              <p className="warn" role="alert" style={{ marginBottom: 8 }}>
                {serverError}
              </p>
            )}

            <button className="btn primary full lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t({ es: "Entrando…", en: "Signing in…" }) : t({ es: "Entrar", en: "Sign in" })}
              {!isSubmitting && <Icon name="arrow-right" size={17} />}
            </button>

            <div className="qr-alt">
              <Icon name="scan-line" size={18} />
              <div>
                <div className="qa-t">{t({ es: "¿Eres colaborador?", en: "Are you a collaborator?" })}</div>
                <div className="qa-m">
                  {t({
                    es: "Escanea el QR del equipo para consultar — sin cuenta ni login.",
                    en: "Scan the team QR to look things up — no account, no login.",
                  })}
                </div>
              </div>
            </div>
            <p className="auth-foot">
              {t({ es: "¿Aún no tienes cuenta?", en: "Don't have an account yet?" })}{" "}
              <Link className="link" href="/signup">
                {t({ es: "Empieza gratis", en: "Start free" })}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
