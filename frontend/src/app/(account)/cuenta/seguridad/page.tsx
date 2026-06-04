"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";

interface Session {
  id: string;
  device: string;
  location: string;
  last_active: string;
  current: boolean;
}

const FALLBACK_SESSIONS: Session[] = [
  { id: "1", device: "Chrome · macOS", location: "Ciudad Juárez, MX", last_active: "Ahora", current: true },
  { id: "2", device: "Safari · iPhone", location: "Ciudad Juárez, MX", last_active: "Hace 2 h", current: false },
  { id: "3", device: "Edge · Windows", location: "El Paso, US", last_active: "Hace 3 días", current: false },
];

export default function SeguridadPage() {
  const token = useAuth((s) => s.token);
  const [twoFa, setTwoFa] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  const { data } = useQuery({
    queryKey: ["account-sessions"],
    queryFn: () => api.get<Session[]>("/admin/account/sessions", { token }),
    placeholderData: FALLBACK_SESSIONS,
    retry: false,
  });
  const sessions = data ?? FALLBACK_SESSIONS;
  const pwdValid = pwd.next.length >= 8 && pwd.next === pwd.confirm && pwd.current.length > 0;

  return (
    <>
      <h1>Seguridad</h1>

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
        <button className="btn primary" type="button" disabled={!pwdValid}>
          Actualizar contraseña
        </button>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <Icon name="shield-check" size={20} color="var(--cinnabar-600)" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Autenticación en dos pasos (2FA)</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Añade una capa extra con una app de autenticación.
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Switch checked={twoFa} onCheckedChange={setTwoFa} aria-label="Activar 2FA" />
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Sesiones activas</h2>
          <button className="btn sec" style={{ marginLeft: "auto", height: 30 }} type="button">
            Cerrar las demás
          </button>
        </div>
        {sessions.map((s) => (
          <div className="billrow" key={s.id}>
            <span className="bd" style={{ fontVariantNumeric: "normal" }}>
              {s.device}
            </span>
            <span>{s.location}</span>
            <span className="amt" style={{ fontWeight: 500 }}>
              {s.last_active}
            </span>
            {s.current ? (
              <span style={{ fontSize: 12, color: "var(--success-600)", fontWeight: 600 }}>Esta sesión</span>
            ) : (
              <button
                type="button"
                aria-label="Cerrar sesión"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-600)" }}
              >
                <Icon name="log-out" size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
