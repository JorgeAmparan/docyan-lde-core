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
  email: z.string().email("Correo no válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
  remember: z.boolean().optional(),
});
type LoginValues = z.infer<typeof loginSchema>;

interface LoginResponse {
  access_token?: string;
  token?: string;
  user?: Partial<AuthUser> & { name?: string; nombre?: string };
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

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
        setServerError("Respuesta de autenticación inválida.");
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
      setSession(token, user);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/select-codo");
    } catch (err) {
      // Surface the REAL error — no canned success here (this is the admin gate).
      if (err instanceof ApiError) {
        setServerError(
          err.status === 401 || err.status === 403
            ? "Correo o contraseña incorrectos."
            : err.message,
        );
      } else {
        setServerError("No pudimos conectar. Revisa tu red e intenta de nuevo.");
      }
    }
  });

  return (
    <div className="access-stage">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <DocyanMark size={34} />
          <span className="lw">
            DOCYAN<span className="lde">LDE</span>
          </span>
        </div>
        <h1>Ingresa a tu organización</h1>
        <p className="login-sub">
          Para admins de organización. Los colaboradores entran escaneando el QR del equipo — sin login.
        </p>

        <div className="field2">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="email" placeholder="tú@empresa.mx" {...register("email")} />
          {errors.email && <span className="warn">{errors.email.message}</span>}
        </div>
        <div className="field2">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" placeholder="••••••••••" {...register("password")} />
          {errors.password && <span className="warn">{errors.password.message}</span>}
        </div>

        <div className="login-row">
          <label className="chk">
            <input type="checkbox" {...register("remember")} />
            Recordarme
          </label>
          <Link className="link" href="/reset-password">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {serverError && (
          <p className="warn" role="alert" style={{ marginBottom: 8 }}>
            {serverError}
          </p>
        )}

        <button className="primary-btn full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>

        <div className="qr-alt">
          <Icon name="scan-line" size={16} />
          <div>
            <div className="qa-t">¿Eres colaborador?</div>
            <div className="qa-m">Escanea el QR del equipo para consultar directo.</div>
          </div>
        </div>
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
