"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { api, ApiError } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/lib/auth";
import { useT } from "@/lib/site-i18n";

/**
 * Capa A · Acceso — admin login. Collaborators NEVER pass through here; they
 * enter via /q/[token] (the QR is the credential). Recreated from access.jsx
 * (`AccessView` login step) with real RHF+zod + a real /auth/login call.
 *
 * DESIGN: /auth/login is untyped (`unknown`) in the generated OpenAPI. The
 * backend (per CLAUDE.md register flow) returns access_token + the user; we type
 * the response locally and tolerate snake/camel + `name`/`nombre` variants.
 */
const loginSchema = z.object({
  email: z.string().email("email_invalid"),
  password: z.string().min(1, "password_required"),
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
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        email: values.email,
        password: values.password,
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
      router.push(next && next.startsWith("/") ? next : "/select-codo");
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
    <div className="access-stage">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <Link href="/" className="login-brand" style={{ textDecoration: "none", color: "inherit" }}>
          <DocyanMark size={34} />
          <span className="lw">
            DOCYAN<span className="lde">LDE</span>
          </span>
        </Link>
        <h1>{t({ es: "Ingresa a tu organización", en: "Sign in to your organization" })}</h1>
        <p className="login-sub">
          {t({
            es: "Para admins de organización. Los colaboradores entran escaneando el QR del equipo — sin login.",
            en: "For organization admins. Collaborators get in by scanning the team QR — no login.",
          })}
        </p>

        <div className="field2">
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
        <div className="field2">
          <label htmlFor="password">{t({ es: "Contraseña", en: "Password" })}</label>
          <input id="password" type="password" autoComplete="current-password" placeholder="••••••••••" {...register("password")} />
          {errors.password && <span className="warn">{fieldError(errors.password.message)}</span>}
        </div>

        <div className="login-row">
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

        <button className="primary-btn full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t({ es: "Entrando…", en: "Signing in…" }) : t({ es: "Entrar", en: "Sign in" })}
        </button>

        <div className="qr-alt">
          <Icon name="scan-line" size={16} />
          <div>
            <div className="qa-t">{t({ es: "¿Eres colaborador?", en: "Are you a collaborator?" })}</div>
            <div className="qa-m">
              {t({ es: "Escanea el QR del equipo para consultar directo.", en: "Scan the team QR to look things up directly." })}
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
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
