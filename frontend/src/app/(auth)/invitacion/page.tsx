"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";
import { ValueAside, PwField, pwScore } from "@/components/onboarding/auth-bits";
import { roleLabel } from "@/lib/roles";
import { acceptInvitation } from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/lib/auth";

/**
 * Pantalla 7 (B13) — Flujo del invitado. Llega desde el enlace del correo
 * (`/invitacion?token=…`): acepta → establece contraseña → entra como usuario de
 * la org con su rol, listo para consultar. Portado de `auth.jsx` → GuestFlow.
 *
 * No hay endpoint de "previsualizar invitación" (el token solo se canjea al
 * aceptar), así que el contexto de org/rol se confirma al recibir la respuesta de
 * `POST /invitations/accept` — sin inventar nombres de organización.
 */
function GuestFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const setSession = useAuth((s) => s.setSession);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acceptedRole, setAcceptedRole] = useState<string | null>(null);

  const pwValid = pwScore(pw) >= 1 && pw.length >= 8 && pw === pw2;

  const accept = async () => {
    if (!pwValid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await acceptInvitation({ token, password: pw, name: name || null });
      const user: AuthUser = {
        id: res.user_id,
        email: res.email,
        role: res.role,
        org_id: res.org_id,
      };
      setSession(res.tokens.access_token, user);
      setAcceptedRole(res.role);
      setStep(2);
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 404
          ? "Esta invitación no es válida."
          : e instanceof ApiError && e.status === 409
            ? "Esta invitación ya fue usada o expiró. Pide una nueva al administrador."
            : e instanceof ApiError
              ? e.message
              : "No pudimos conectar. Revisa tu red e intenta de nuevo.",
      );
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-stage">
        <div className="auth-form" style={{ width: "100%" }}>
          <div className="auth-card auth-centered" style={{ textAlign: "center" }}>
            <BrandRow size={28} />
            <h2 style={{ marginTop: 12 }}>Enlace de invitación inválido</h2>
            <p className="ac-sub">
              Falta el código de la invitación. Abre el enlace tal como llegó a tu correo, o pide
              uno nuevo al administrador de la organización.
            </p>
            <Link href="/login" className="btn sec full" style={{ marginTop: 8, textDecoration: "none" }}>
              Ir a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-stage">
      <div className="auth-split">
        <ValueAside
          tag="Invitación"
          title="Te sumas a un equipo en DOCYAN."
          sub="Aceptas la invitación, eliges tu contraseña y entras listo para consultar los documentos vivos de tu organización."
          points={[
            ["building-2", "Te unes a una organización", "Quedas dentro de la cuenta que te invitó."],
            ["shield-check", "Acceso aislado por organización", "Solo verás los CoDos y documentos de esta cuenta."],
            ["scan-line", "Listo para consultar", "Pregunta y recibe respuesta con cita a la fuente exacta."],
          ]}
        />
        <div className="auth-form">
          <div className="auth-card">
            {step === 0 && (
              <>
                <div className="ac-head">
                  <BrandRow size={26} />
                  <h2>Aceptar invitación</h2>
                  <p className="ac-sub">Te invitaron a unirte a una organización en DOCYAN.</p>
                </div>
                <div className="tenant-note">
                  <Icon name="lock" size={16} />
                  Entras únicamente a esta organización. DOCYAN aísla cada cuenta: no verás documentos
                  de otras empresas, ni ellas los tuyos.
                </div>
                <button
                  className="btn primary full lg"
                  style={{ marginTop: 18 }}
                  onClick={() => setStep(1)}
                >
                  Aceptar invitación
                  <Icon name="arrow-right" size={17} />
                </button>
                <p className="auth-foot">
                  ¿No reconoces esta invitación? <span className="link">Repórtala</span>
                </p>
              </>
            )}

            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  accept();
                }}
                noValidate
              >
                <div className="ac-head">
                  <BrandRow size={26} />
                  <h2>Establece tu contraseña</h2>
                  <p className="ac-sub">Crea una contraseña para entrar a tu organización.</p>
                </div>
                <div className="field">
                  <label>
                    Tu nombre <span className="hint">(opcional)</span>
                  </label>
                  <input type="text" placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <PwField value={pw} onChange={setPw} show={show} setShow={setShow} strength autoComplete="new-password" />
                <PwField
                  label="Confirma tu contraseña"
                  value={pw2}
                  onChange={setPw2}
                  show={show2}
                  setShow={setShow2}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                />
                {pw2 && pw !== pw2 && <p className="warn">Las contraseñas no coinciden.</p>}
                {err && (
                  <p className="warn" role="alert">
                    {err}
                  </p>
                )}
                <button className="btn primary full lg" style={{ marginTop: 6 }} type="submit" disabled={!pwValid || busy}>
                  {busy ? "Entrando…" : "Entrar a DOCYAN"}
                  {!busy && <Icon name="arrow-right" size={17} />}
                </button>
              </form>
            )}

            {step === 2 && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "var(--success-100)",
                    color: "var(--success-600)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "8px 0 0",
                  }}
                >
                  <Icon name="check" size={28} />
                </div>
                <h2 style={{ marginTop: 16 }}>Ya estás dentro</h2>
                <p className="ac-sub" style={{ margin: "0 auto" }}>
                  Tu rol es <b>{roleLabel(acceptedRole)}</b>. Puedes empezar a consultar los documentos
                  vivos de tu organización.
                </p>
                <button className="btn primary full lg" style={{ marginTop: 20 }} onClick={() => router.push("/consult")}>
                  <Icon name="scan-line" size={17} />
                  Empezar a consultar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuestPage() {
  return (
    <Suspense fallback={null}>
      <GuestFlow />
    </Suspense>
  );
}
