"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { changePassword, updateProfile, logout as apiLogout } from "@/lib/onboarding";

/**
 * /cuenta/seguridad — Perfil + Seguridad, datos y acciones REALES (B13/D4):
 *  · Editar nombre  → PATCH /auth/me.
 *  · Cambiar contraseña → POST /auth/change-password (verifica la actual; revoca
 *    las demás sesiones en el servidor).
 *  · Cerrar sesión en todos los dispositivos → POST /auth/logout (todos=true):
 *    revoca TODOS los refresh tokens y cierra la sesión local.
 * Se eliminó la lista de sesiones y el toggle 2FA enlatados (no había backend que
 * los respaldara: UI decorativa = fake-success).
 */
export default function SeguridadPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const refreshToken = useAuth((s) => s.refreshToken);
  const user = useAuth((s) => s.user);
  const setSession = useAuth((s) => s.setSession);
  const clear = useAuth((s) => s.clear);

  const [name, setName] = useState(user?.name ?? "");
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const [outBusy, setOutBusy] = useState(false);

  const pwdValid = pwd.next.length >= 8 && pwd.next === pwd.confirm && pwd.current.length > 0;

  const saveName = async () => {
    if (!token || !name.trim() || nameBusy) return;
    setNameBusy(true);
    setNameMsg(null);
    try {
      const u = await updateProfile(name.trim(), token);
      if (user) setSession(token, { ...user, name: u.name }, refreshToken);
      setNameMsg("Nombre actualizado.");
    } catch (e) {
      setNameMsg(e instanceof ApiError ? e.message : "No pudimos actualizar tu nombre.");
    } finally {
      setNameBusy(false);
    }
  };

  const savePassword = async () => {
    if (!token || !pwdValid || pwdBusy) return;
    setPwdBusy(true);
    setPwdMsg(null);
    try {
      await changePassword({ current_password: pwd.current, new_password: pwd.next }, token);
      setPwd({ current: "", next: "", confirm: "" });
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

  const logoutEverywhere = async () => {
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
    <>
      <h1>Perfil y seguridad</h1>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Tu perfil</h2>
        <div className="field">
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
        </div>
        {user?.email && (
          <div className="field">
            <label>Correo</label>
            <input value={user.email} disabled />
          </div>
        )}
        {nameMsg && (
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "4px 0 10px" }}>{nameMsg}</p>
        )}
        <button className="btn primary" type="button" disabled={!name.trim() || nameBusy} onClick={saveName}>
          {nameBusy ? "Guardando…" : "Guardar nombre"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Cambiar contraseña</h2>
        <div className="field">
          <label>Contraseña actual</label>
          <input
            type="password"
            autoComplete="current-password"
            value={pwd.current}
            onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
          />
        </div>
        <div className="row2c">
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
        </div>
        {pwdMsg && (
          <p
            className={pwdMsg.ok ? undefined : "warn"}
            style={{ fontSize: 13, color: pwdMsg.ok ? "var(--success-600)" : undefined, margin: "0 0 10px" }}
            role={pwdMsg.ok ? undefined : "alert"}
          >
            {pwdMsg.text}
          </p>
        )}
        <button className="btn primary" type="button" disabled={!pwdValid || pwdBusy} onClick={savePassword}>
          {pwdBusy ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Icon name="log-out" size={20} color="var(--danger-600)" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Cerrar sesión en todos los dispositivos</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Revoca todas tus sesiones activas. Tendrás que iniciar sesión de nuevo.
          </div>
        </div>
        <button
          className="btn sec"
          type="button"
          style={{ marginLeft: "auto" }}
          disabled={outBusy}
          onClick={logoutEverywhere}
        >
          {outBusy ? "Cerrando…" : "Cerrar todas"}
        </button>
      </div>
    </>
  );
}
