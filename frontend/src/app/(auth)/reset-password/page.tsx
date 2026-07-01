"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { api, ApiError } from "@/lib/api-client";

/**
 * Superficie de ENTRADA — recuperar contraseña. El prototipo (`entry.jsx`) no
 * define esta pantalla; se construye con el mismo vocabulario `.entry-view` /
 * `.auth-*` que Login (tarjeta centrada única), sin inventar clases nuevas.
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
    <div className="entry-view">
      <div className="auth-stage">
        <div className="auth-form" style={{ width: "100%" }}>
          <div className="auth-card auth-centered">
            <div className="ac-head" style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
                  <BrandRow size={30} />
                </Link>
              </div>
              <h2>{sent ? "Revisa tu correo" : "Restablece tu contraseña"}</h2>
              <p className="ac-sub">
                {sent
                  ? "Si hay una cuenta asociada a ese correo, te enviamos un enlace para restablecer tu contraseña. El enlace caduca en 30 minutos."
                  : "Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva contraseña."}
              </p>
            </div>

            {sent ? (
              <Link href="/login" className="btn primary full lg" style={{ textDecoration: "none" }}>
                Volver a iniciar sesión
              </Link>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="field">
                  <label htmlFor="reset-email">Correo</label>
                  <input id="reset-email" type="email" autoComplete="email" placeholder="tú@empresa.mx" {...register("email")} />
                  {errors.email && <span className="warn">{errors.email.message}</span>}
                </div>
                <button className="btn primary full lg" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Enviar enlace"}
                  {!isSubmitting && <Icon name="arrow-right" size={17} />}
                </button>
              </form>
            )}

            <div className="qr-alt">
              <Icon name="arrow-left" size={18} />
              <div>
                <div className="qa-t">
                  <Link className="link" href="/login">
                    Volver a iniciar sesión
                  </Link>
                </div>
                <div className="qa-m">Los colaboradores entran por QR, sin contraseña.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
