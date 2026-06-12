"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { ValueAside, PwField, pwScore } from "@/components/onboarding/auth-bits";
import { signup } from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/lib/auth";
import { useT } from "@/lib/site-i18n";

/**
 * Pantalla 3 (B13) — Canje de código (puerta Piloto). El usuario llega con un
 * código de acceso; al registrarse con `codigo_acceso` el backend lo canjea y la
 * cuenta entra con el plan piloto YA activo. Portado de `auth.jsx` → RedeemCode,
 * con un solo campo de código (los códigos reales son `DOCYAN-XXXXXXXX`).
 */
export default function RedeemCodePage() {
  const t = useT();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [orgName, setOrgName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid =
    code.trim().length >= 6 && /\S+@\S+\.\S+/.test(email) && pwScore(pw) >= 1 && pw.length >= 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await signup({
        email,
        password: pw,
        name: email.split("@")[0],
        org_name: orgName || null,
        codigo_acceso: code.trim().toUpperCase(),
      });
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
        e instanceof ApiError && e.status === 404
          ? t({ es: "No encontramos ese código. Revísalo e intenta de nuevo.", en: "We couldn't find that code. Check it and try again." })
          : e instanceof ApiError && e.status === 409
            ? t({ es: "Ese código ya fue canjeado o expiró.", en: "That code was already redeemed or has expired." })
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
          tag={t({ es: "Acceso piloto", en: "Pilot access" })}
          title={t({ es: "Entras con tu plan ya activo.", en: "You get in with your plan already active." })}
          sub={t({
            es: "A diferencia del registro gratuito, un código de acceso piloto activa de inmediato tu plan con el precio especial del programa. Listo para ingerir y consultar.",
            en: "Unlike the free signup, a pilot access code activates your plan right away at the program's special price. Ready to ingest and query.",
          })}
          points={[
            [
              "badge-check",
              t({ es: "Plan piloto activo al entrar", en: "Pilot plan active on entry" }),
              t({ es: "Sin periodo de prueba ni límite de 3 documentos.", en: "No trial period and no 3-document limit." }),
            ],
            [
              "percent",
              t({ es: "Precio piloto bloqueado", en: "Pilot price locked in" }),
              t({ es: "Tu tarifa preferente se mantiene durante el programa.", en: "Your preferred rate holds throughout the program." }),
            ],
            [
              "headset",
              t({ es: "Acompañamiento directo de DOCYAN", en: "Direct support from DOCYAN" }),
              t({ es: "Onboarding y soporte cercano del equipo XCID.", en: "Onboarding and close support from the XCID team." }),
            ],
          ]}
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
              <h2>{t({ es: "Canjea tu código", en: "Redeem your code" })}</h2>
              <p className="ac-sub">
                {t({
                  es: "Ingresa el código de acceso que te compartió DOCYAN y crea tu cuenta piloto.",
                  en: "Enter the access code DOCYAN shared with you and create your pilot account.",
                })}
              </p>
            </div>

            <div className="field">
              <label>{t({ es: "Código de acceso", en: "Access code" })}</label>
              <input
                type="text"
                placeholder="DOCYAN-XXXXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}
              />
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
                placeholder={t({ es: "Manufactura del Norte", en: "Northern Manufacturing Co." })}
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
              {busy ? t({ es: "Activando…", en: "Activating…" }) : t({ es: "Activar mi cuenta piloto", en: "Activate my pilot account" })}
              {!busy && <Icon name="arrow-right" size={17} />}
            </button>

            <p className="auth-foot">
              {t({ es: "¿No tienes código?", en: "Don't have a code?" })}{" "}
              <Link className="link" href="/signup">
                {t({ es: "Empieza gratis", en: "Start free" })}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}
