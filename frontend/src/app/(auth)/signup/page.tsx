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
import { useT } from "@/lib/site-i18n";

/**
 * Pantalla 1 (B13) — Signup Freemium. Credenciales primero: solo email +
 * contraseña, sin plan/fiscal/pago (reemplaza el signup de 4 pasos, el "embudo
 * invertido"). Crea la cuenta freemium real (`POST /onboarding/signup`), inicia
 * sesión con los tokens devueltos y entra al onboarding Fase 1. Portado de
 * `ui_kits/onboarding/auth.jsx` → SignupFreemium.
 */
export default function SignupFreemiumPage() {
  const t = useT();
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
      setSession(res.tokens.access_token, user, res.tokens.refresh_token ?? null);
      router.push("/onboarding");
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 409
          ? t({ es: "Ese correo ya tiene una cuenta. Inicia sesión.", en: "That email already has an account. Sign in." })
          : e instanceof ApiError
            ? e.message
            : t({ es: "No pudimos conectar. Revisa tu red e intenta de nuevo.", en: "We couldn't connect. Check your network and try again." }),
      );
      setBusy(false);
    }
  };

  return (
    <div className="onb-kit">
    <div className="auth-stage">
      <div className="auth-split">
        <ValueAside
          tag={t({ es: "Gratis · sin tarjeta", en: "Free · no card" })}
          title={t({ es: "Empieza hoy. Sin fricción.", en: "Start today. No friction." })}
          sub={t({
            es: "Crea tu cuenta y vive el producto: ingiere un documento y haz tu primera consulta con cita a la fuente. El plan viene después.",
            en: "Create your account and experience the product: ingest a document and run your first query with a citation to the exact source. The plan comes later.",
          })}
          points={[
            [
              "file-check",
              t({ es: "3 documentos vivos · 30 días", en: "3 live documents · 30 days" }),
              t({ es: "Suficiente para ver el valor en tu propia operación.", en: "Enough to see the value in your own operation." }),
            ],
            [
              "scan-line",
              t({ es: "Ingiere tus documentos como están", en: "Ingest your documents as they are" }),
              t({ es: "PDF, manual, MSDS o ficha. DOCYAN los lee tal cual.", en: "PDF, manual, MSDS or datasheet. DOCYAN reads them as-is." }),
            ],
            [
              "link",
              t({ es: "Cada respuesta cita su fuente exacta", en: "Every answer cites its exact source" }),
              t({ es: "Pedigree a span exacto, no resúmenes opacos.", en: "Pedigree to the exact span, not opaque summaries." }),
            ],
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
              <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
                <BrandRow size={26} />
              </Link>
              <h2>{t({ es: "Crea tu cuenta", en: "Create your account" })}</h2>
              <p className="ac-sub">
                {t({
                  es: "Solo necesitas un correo y una contraseña. Sin plan, sin datos fiscales, sin pago.",
                  en: "All you need is an email and a password. No plan, no tax details, no payment.",
                })}
              </p>
            </div>
            <div className="field">
              <label>{t({ es: "Correo de trabajo", en: "Work email" })}</label>
              <input
                type="email"
                autoComplete="email"
                placeholder={t({ es: "nombre@laboratorio.mx", en: "name@lab.com" })}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                {t({ es: "Nombre de tu organización", en: "Your organization's name" })}{" "}
                <span className="hint">{t({ es: "(opcional)", en: "(optional)" })}</span>
              </label>
              <input
                type="text"
                placeholder={t({ es: "Laboratorio Estándar", en: "Acme Laboratory" })}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <PwField
              label={t({ es: "Contraseña", en: "Password" })}
              placeholder={t({ es: "Mínimo 8 caracteres", en: "At least 8 characters" })}
              value={pw}
              onChange={setPw}
              show={show}
              setShow={setShow}
              strength
              autoComplete="new-password"
            />
            {err && (
              <p className="warn" role="alert" style={{ marginTop: 4 }}>
                {err}
              </p>
            )}
            <button className="btn primary full lg" style={{ marginTop: 6 }} type="submit" disabled={!valid || busy}>
              {busy ? t({ es: "Creando cuenta…", en: "Creating account…" }) : t({ es: "Crear cuenta gratis", en: "Create free account" })}
              {!busy && <Icon name="arrow-right" size={17} />}
            </button>
            <p className="auth-foot" style={{ marginTop: 14 }}>
              {t({
                es: "Al crear tu cuenta aceptas los términos y el aviso de privacidad de DOCYAN.",
                en: "By creating your account you accept DOCYAN's terms and privacy notice.",
              })}
            </p>
            <div className="auth-div">{t({ es: "o", en: "or" })}</div>
            <Link href="/codigo" className="btn sec full" style={{ textDecoration: "none" }}>
              <Icon name="ticket" size={16} />
              {t({ es: "Tengo un código de acceso", en: "I have an access code" })}
            </Link>
            <p className="auth-foot">
              {t({ es: "¿Ya tienes cuenta?", en: "Already have an account?" })}{" "}
              <Link className="link" href="/login">
                {t({ es: "Inicia sesión", en: "Sign in" })}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}
