"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/config";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "titular" | "admin";
}

interface UsersData {
  /** plan index: Esencial=0 (sin admins extra) · Profesional=1 · Enterprise=2. */
  plan_index: 0 | 1 | 2;
  included_seats: number;
  admins: AdminUser[];
}

const FALLBACK: UsersData = {
  plan_index: 1,
  included_seats: 3,
  admins: [
    { id: "1", name: "Jorge Mendoza", email: "jorge@laboratorio.mx", role: "titular" },
    { id: "2", name: "Ana Ruiz", email: "ana@laboratorio.mx", role: "admin" },
  ],
};

export default function UsuariosPage() {
  const token = useAuth((s) => s.token);
  const [newEmail, setNewEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["account-users"],
    queryFn: () => api.get<UsersData>("/admin/account/users", { token }),
    placeholderData: FALLBACK,
    retry: false,
  });
  const d = data ?? FALLBACK;

  // El plan permite admins adicionales a partir de Profesional. El PRECIO por seat
  // adicional NO se publica en el modelo v2.1 (precio por documentos vivos, usuarios
  // ilimitados) → se cotiza al contacto, no se inventa una cifra por región.
  const allowsExtra = d.plan_index > 0;
  const overIncluded = Math.max(0, d.admins.length - d.included_seats);

  return (
    <>
      <h1>Usuarios</h1>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, padding: 16 }}>
        <Icon name="users" size={20} color="var(--cinnabar-600)" />
        <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
          {d.included_seats} admins incluidos en tu plan.{" "}
          {allowsExtra
            ? "Admins adicionales se cotizan con tu ejecutivo de cuenta."
            : "Tu plan no permite admins adicionales (sube a Profesional)."}
          {overIncluded > 0 && allowsExtra && (
            <strong> {overIncluded} seat(s) adicional(es) por confirmar.</strong>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Administradores</h2>
        {d.admins.map((u) => (
          <div className="billrow" key={u.id}>
            <span
              className="bd"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontVariantNumeric: "normal",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--amate-200, var(--amate-100))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                {u.name
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p.charAt(0))
                  .join("")}
              </span>
              {u.name}
            </span>
            <span>{u.email}</span>
            <span className="amt" style={{ textTransform: "capitalize" }}>
              {u.role}
            </span>
            {u.role === "titular" ? (
              <span style={{ fontSize: 12, color: "var(--fg-subtle)" }}>—</span>
            ) : (
              <button
                type="button"
                aria-label={`Quitar ${u.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-600)" }}
              >
                <Icon name="trash-2" size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Agregar administrador</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, margin: 0 }}>
            <label>Correo</label>
            <input
              placeholder="nombre@laboratorio.mx"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <button className="btn primary" type="button" disabled={!newEmail.includes("@")}>
            <Icon name="user-plus" size={16} />
            Invitar
          </button>
        </div>
        {allowsExtra && (
          <p style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 10 }}>
            Si superas los {d.included_seats} incluidos, los admins adicionales se cotizan
            con tu ejecutivo de cuenta (<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>).
          </p>
        )}
      </div>
    </>
  );
}
