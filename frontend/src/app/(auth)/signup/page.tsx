"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { ValueAside, AsideMock, PwField, pwScore } from "@/components/onboarding/auth-bits";
import { signup } from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/lib/auth";

/**
 * Pantalla 1 (B13) — Signup Freemium. Credenciales primero: solo email +
 * contraseña, sin plan/fiscal/pago (reemplaza el signup de 4 pasos, el "embudo
 * invertido"). Crea la cuenta freemium real (`POST /onboarding/signup`), inicia
 * sesión con los tokens devueltos y entra al onboarding Fase 1. Portado de
 * `ui_kits/onboarding/auth.jsx` → SignupFreemium.
 */
export default function SignupFreemiumPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [orgName, setOrgName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = /\S+@\S+\.\S+/.test(email) && pwScore(pw) >= 1 && pw.length >= 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await signup({ email, password: pw, name: email.split("@")[0], org_name: orgName || null });
      const user: AuthUser = {
        id: res.user_id,
        email: res.email,
        role: res.role,
        org_id: res.org_id,
        org_name: orgName || undefined,
      };
      setSession(res.tokens.access_token, user);
      router.push("/onboarding");
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 409
          ? "Ese correo ya tiene una cuenta. Inicia sesión."
          : e instanceof ApiError
            ? e.message
            : "No pudimos conectar. Revisa tu red e intenta de nuevo.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="auth-stage">
      <div className="auth-split">
        <ValueAside
          tag="Gratis · sin tarjeta"
          title="Empieza hoy. Sin fricción."
          sub="Crea tu cuenta y vive el producto: ingiere un documento y haz tu primera consulta con cita a la fuente. El plan viene después."
          points={[
            ["file-check", "3 documentos vivos · 30 días", "Suficiente para ver el valor en tu propia operación."],
            ["scan-line", "Ingiere tus documentos como están", "PDF, manual, MSDS o ficha. DOCYAN los lee tal cual."],
            ["link", "Cada respuesta cita su fuente exacta", "Pedigree a span exacto, no resúmenes opacos."],
          ]}
          object={<AsideMock />}
        />
        <div className="auth-form">
          <form
            className="auth-card"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            noValidate
          >
            <div className="ac-head">
              <BrandRow size={26} />
              <h2>Crea tu cuenta</h2>
              <p className="ac-sub">
                Solo necesitas un correo y una contraseña. Sin plan, sin datos fiscales, sin pago.
              </p>
            </div>
            <div className="field">
              <label>Correo de trabajo</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="nombre@laboratorio.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Nombre de tu organización <span className="hint">(opcional)</span></label>
              <input
                type="text"
                placeholder="Laboratorio Estándar"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <PwField value={pw} onChange={setPw} show={show} setShow={setShow} strength autoComplete="new-password" />
            {err && (
              <p className="warn" role="alert" style={{ marginTop: 4 }}>
                {err}
              </p>
            )}
            <button className="btn primary full lg" style={{ marginTop: 6 }} type="submit" disabled={!valid || busy}>
              {busy ? "Creando cuenta…" : "Crear cuenta gratis"}
              {!busy && <Icon name="arrow-right" size={17} />}
            </button>
            <p className="auth-foot" style={{ marginTop: 14 }}>
              Al crear tu cuenta aceptas los términos y el aviso de privacidad de DOCYAN.
            </p>
            <div className="auth-div">o</div>
            <Link href="/codigo" className="btn sec full" style={{ textDecoration: "none" }}>
              <Icon name="ticket" size={16} />
              Tengo un código de acceso
            </Link>
            <p className="auth-foot">
              ¿Ya tienes cuenta?{" "}
              <Link className="link" href="/login">
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
