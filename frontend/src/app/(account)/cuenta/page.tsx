"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { getCuenta, changePassword, logout as apiLogout } from "@/lib/onboarding";

/**
 * /cuenta — `CuentaOrg` del prototipo (app/org.jsx) portado 1:1: las tres
 * secciones Perfil / Organización / Seguridad con las clases `.acct-*`. Es UNA
 * sola página (P4, Matriz de Cierre): se eliminaron las subrutas (facturación,
 * usuarios, seguridad, notificaciones).
 *
 * Datos REALES: el perfil sale del usuario autenticado; la organización y el plan
 * de `GET /onboarding/cuenta`. La Seguridad cablea acciones reales — cambiar
 * contraseña (`POST /auth/change-password`) y cerrar sesión (`POST /auth/logout`).
 */
const PAR_LINGUISTICO_DEFAULT = "ES-MX · EN-US"; // par bilingüe día 1 (DTM, Pista B)

export default function CuentaPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const refreshToken = useAuth((s) => s.refreshToken);
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  const { data } = useQuery({
    queryKey: ["cuenta"],
    queryFn: () => getCuenta(token as string),
    enabled: !!token,
    retry: false,
  });

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [outBusy, setOutBusy] = useState(false);

  const pwdValid = pwd.next.length >= 8 && pwd.next === pwd.confirm && pwd.current.length > 0;

  const nombre = user?.name ?? user?.email ?? "—";
  const email = user?.email ?? "—";
  const rol = (user?.role ?? "").toUpperCase();
  const orgNombre = data?.nombre ?? user?.org_name ?? "—";
  const planNombre = data?.plan_nombre ?? "—";
  const initials =
    (user?.name ?? user?.email ?? "MC")
      .split(/[ @.]/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "MC";

  const savePassword = async () => {
    if (!token || !pwdValid || pwdBusy) return;
    setPwdBusy(true);
    setPwdMsg(null);
    try {
      await changePassword({ current_password: pwd.current, new_password: pwd.next }, token);
      setPwd({ current: "", next: "", confirm: "" });
      setPwdOpen(false);
      setPwdMsg({ ok: true, text: "Contraseña actualizada. Las demás sesiones se cerraron." });
    } catch (e) {
      setPwdMsg({
        ok: false,
        text:
          e instanceof ApiError && e.status === 401
            ? "La contraseña actual no es correcta."
            : e instanceof ApiError
              ? e.message
              : "No pudimos actualizar la contraseña.",
      });
    } finally {
      setPwdBusy(false);
    }
  };

  const logout = async () => {
    setOutBusy(true);
    try {
      await apiLogout(refreshToken, token, true);
    } catch {
      /* descarte local de todos modos */
    }
    clear();
    router.replace("/login");
  };

  return (
    <div className="wrap">
      <div className="acct">
        <h2>Mi cuenta</h2>
        <p className="lead">Tu perfil, tu organización y tu seguridad.</p>

        <div className="acct-sec">
          <h3>Perfil</h3>
          <div className="acct-prof">
            <div className="pav">{initials}</div>
            <div>
              <div className="pn">{nombre}</div>
              <div className="pe">{email}</div>
              {rol && <div className="pr">{rol}</div>}
            </div>
          </div>
        </div>

        <div className="acct-sec">
          <h3>Organización</h3>
          <div className="acct-row">
            <span className="l">Organización</span>
            <span className="v">{orgNombre}</span>
          </div>
          <div className="acct-row">
            <span className="l">Par lingüístico default</span>
            <span className="v">{PAR_LINGUISTICO_DEFAULT}</span>
          </div>
          <div className="acct-row">
            <span className="l">Plan</span>
            <span className="v">{planNombre}</span>
            <Link href="/plan" className="btn-sec">
              <Icon name="gem" size={15} />
              Gestionar en módulo Plan
            </Link>
          </div>
        </div>

        <div className="acct-sec">
          <h3>Seguridad</h3>
          <div className="acct-row">
            <span className="l">Contraseña</span>
            <span className="v">••••••••••</span>
            <button type="button" className="btn-sec" onClick={() => setPwdOpen((o) => !o)}>
              <Icon name="key-round" size={15} />
              Cambiar
            </button>
          </div>

          {pwdOpen && (
            <div style={{ padding: "4px 0 12px", display: "grid", gap: 10 }}>
              <div className="field">
                <label>Contraseña actual</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={pwd.current}
                  onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwd.next}
                  onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Confirmar</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                />
              </div>
              <div>
                <button type="button" className="btn-sec" disabled={!pwdValid || pwdBusy} onClick={savePassword}>
                  {pwdBusy ? "Actualizando…" : "Actualizar contraseña"}
                </button>
              </div>
            </div>
          )}

          {pwdMsg && (
            <p
              role={pwdMsg.ok ? undefined : "alert"}
              style={{ fontSize: 13, margin: "0 0 8px", color: pwdMsg.ok ? "var(--success-600)" : "var(--danger-600)" }}
            >
              {pwdMsg.text}
            </p>
          )}

          <div className="acct-row">
            <span className="l">Sesión</span>
            <span className="v" />
            <button type="button" className="btn-logout-lg" disabled={outBusy} onClick={logout}>
              <Icon name="log-out" size={15} />
              {outBusy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
