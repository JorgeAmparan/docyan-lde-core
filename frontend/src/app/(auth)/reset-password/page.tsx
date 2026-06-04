"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { api, ApiError } from "@/lib/api-client";

/**
 * Capa A · Acceso — password reset request. Email → reset request. Reuses the
 * `.login-card` surface from access.jsx.
 *
 * DESIGN: there is no /auth/reset-password endpoint in the generated OpenAPI
 * yet. We POST optimistically and ALWAYS show the same confirmation regardless
 * of outcome (no account enumeration). When the endpoint lands the call wires
 * through unchanged. PENDIENTE DE JORGE: confirm endpoint path/shape.
 */
const resetSchema = z.object({ email: z.string().email("Correo no válido") });
type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/auth/reset-password", { email: values.email });
    } catch (err) {
      // Swallow 404 (endpoint not wired) and any error: no account enumeration.
      if (!(err instanceof ApiError)) {
        /* network — still confirm; the email queue is best-effort */
      }
    } finally {
      setSent(true);
    }
  });

  return (
    <div className="access-stage">
      <div className="login-card">
        <div className="login-brand">
          <DocyanMark size={34} />
          <span className="lw">
            DOCYAN<span className="lde">LDE</span>
          </span>
        </div>

        {sent ? (
          <>
            <h1>Revisa tu correo</h1>
            <p className="login-sub">
              Si hay una cuenta asociada a ese correo, te enviamos un enlace para restablecer tu contraseña. El enlace caduca en 30 minutos.
            </p>
            <Link className="primary-btn full" href="/login" style={{ textDecoration: "none" }}>
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <h1>Restablece tu contraseña</h1>
            <p className="login-sub">
              Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva contraseña.
            </p>
            <div className="field2">
              <label htmlFor="reset-email">Correo</label>
              <input id="reset-email" type="email" autoComplete="email" placeholder="tú@empresa.mx" {...register("email")} />
              {errors.email && <span className="warn">{errors.email.message}</span>}
            </div>
            <button className="primary-btn full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviar enlace"}
            </button>
            <div className="qr-alt">
              <Icon name="arrow-left" size={16} />
              <div>
                <div className="qa-t">
                  <Link className="link" href="/login">
                    Volver a iniciar sesión
                  </Link>
                </div>
                <div className="qa-m">Los colaboradores entran por QR, sin contraseña.</div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
