"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { api, ApiError } from "@/lib/api-client";
import { usePlatformAuth } from "@/lib/platform-auth";

/**
 * Login de la Consola del Fundador — SEPARADO del login de organización. Llama a
 * `POST /platform/auth/login` (scope platform_admin) y abre una sesión propia. Un
 * admin de org no entra por aquí; este es el acceso del fundador, fuera del tenant.
 */
const schema = z.object({
  email: z.string().email("Correo no válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type Values = z.infer<typeof schema>;

interface PlatformLoginResponse {
  access_token?: string;
  token?: string;
  admin?: { id?: string; email?: string; name?: string };
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = usePlatformAuth((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api.post<PlatformLoginResponse>("/platform/auth/login", {
        email: values.email,
        password: values.password,
      });
      const token = res.access_token ?? res.token;
      if (!token) {
        setServerError("Respuesta de autenticación inválida.");
        return;
      }
      setSession(token, {
        id: res.admin?.id ?? values.email,
        email: res.admin?.email ?? values.email,
        name: res.admin?.name,
      });
      const next = params.get("next");
      router.replace(next && next.startsWith("/platform") ? next : "/platform/resumen");
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(
          err.status === 401 || err.status === 403
            ? "Credenciales de plataforma inválidas."
            : err.message,
        );
      } else {
        setServerError("No pudimos conectar. Revisa tu red e intenta de nuevo.");
      }
    }
  });

  return (
    <div className="plogin">
      <form className="plogin-card" onSubmit={onSubmit} noValidate>
        <div className="plogin-brand">
          <DocyanMark size={28} />
          <span className="w">DOCYAN</span>
          <span className="pl">PLATAFORMA</span>
        </div>
        <h1>Consola del fundador</h1>
        <p className="plogin-sub">
          Acceso de <strong>platform_admin</strong>, separado del acceso de organización.
          Operas fuera del aislamiento de cliente: solo metadata, nunca contenido.
        </p>

        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" className="inp" type="email" autoComplete="email"
            placeholder="fundador@xcid.com" {...register("email")} />
          {errors.email && <span className="warn">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" className="inp" type="password" autoComplete="current-password"
            placeholder="••••••••••" {...register("password")} />
          {errors.password && <span className="warn">{errors.password.message}</span>}
        </div>

        {serverError && (
          <p className="warn" role="alert" style={{ marginBottom: 10 }}>{serverError}</p>
        )}

        <button className="pbtn primary full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>

        <div className="plogin-guard">
          <Icon name="shield-check" size={13} className="lic" />
          Fuera del aislamiento de tenant · metadata, nunca contenido
        </div>
      </form>
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
