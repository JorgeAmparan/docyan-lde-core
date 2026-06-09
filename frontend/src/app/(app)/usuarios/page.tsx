"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { ProductShell } from "@/components/onboarding/product-shell";
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  invitableRoles,
  roleLabel,
  type OrgRole,
} from "@/lib/roles";
import {
  createInvitation,
  listInvitations,
  listUsuarios,
  getOrg,
  type InvitationOut,
} from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * Pantalla 7 (B13) — Invitar usuarios. El admin (o editor, limitado a Consulta)
 * invita por correo; lista de invitaciones pendientes + usuarios activos. La regla
 * de rol-destino se aplica en el backend (autoridad); aquí la UI solo ofrece los
 * roles permitidos. Portado de `ui_kits/onboarding/manage.jsx` → InviteView.
 */
export default function UsuariosPage() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const myRole = useAuth((s) => s.user?.role) ?? "admin";
  const allowed = invitableRoles(myRole);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>(allowed[allowed.length - 1] ?? "viewer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<InvitationOut | null>(null);

  const { data } = useQuery({
    queryKey: ["org-usuarios"],
    queryFn: async () => {
      const [inv, us, org] = await Promise.all([
        listInvitations(token as string, "pending"),
        listUsuarios(token as string),
        getOrg(token as string).catch(() => null),
      ]);
      return { pending: inv.items ?? [], users: us.items ?? [], total: us.total, org };
    },
    enabled: !!token,
  });

  const pending = data?.pending ?? [];
  const users = data?.users ?? [];
  const isFreemium = data?.org?.plan === "freemium";
  const counter =
    data?.org?.doc_limit != null && data
      ? `${data.total} usuario${data.total === 1 ? "" : "s"}`
      : null;

  const send = async () => {
    if (!token || !/\S+@\S+\.\S+/.test(email) || busy) return;
    setBusy(true);
    setErr(null);
    setLastInvite(null);
    try {
      const inv = await createInvitation({ email, role }, token);
      setLastInvite(inv);
      setEmail("");
      setRole(allowed[allowed.length - 1] ?? "viewer");
      qc.invalidateQueries({ queryKey: ["org-usuarios"] });
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 403
          ? "Tu rol no puede invitar a ese rol. Un editor solo puede invitar usuarios de Consulta."
          : e instanceof ApiError && e.status === 409
            ? "Ese correo ya tiene una cuenta."
            : e instanceof ApiError
              ? e.message
              : "No pudimos enviar la invitación.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProductShell active="invite" counter={counter} isFreemium={isFreemium}>
      <div className="app-head">
        <div>
          <h1>Usuarios de la cuenta</h1>
          <p>
            Invita por correo. Los colaboradores en piso entran escaneando el QR — sin cuenta.
          </p>
        </div>
      </div>

      <div className="invite-form">
        <div className="if-grid">
          <div className="field">
            <label>Correo a invitar</label>
            <input
              type="email"
              placeholder="nombre@laboratorio.mx"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
              {allowed.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn primary"
            style={{ height: 46 }}
            disabled={!/\S+@\S+\.\S+/.test(email) || busy}
            onClick={send}
          >
            <Icon name="send" size={16} />
            {busy ? "Enviando…" : "Enviar invitación"}
          </button>
        </div>

        <div className="role-opts">
          {allowed.map((r) => (
            <div key={r} className={"role-opt" + (role === r ? " on" : "")} onClick={() => setRole(r)}>
              <span className="ro-radio" />
              <div>
                <div className="ro-t">
                  {ROLE_LABELS[r]}
                  <span className={"role-pill " + r}>{r === "viewer" ? "solo lectura" : r}</span>
                </div>
                <div className="ro-perms">{ROLE_DESCRIPTIONS[r]}</div>
              </div>
            </div>
          ))}
        </div>

        {err && (
          <p className="warn" role="alert" style={{ marginTop: 10 }}>
            {err}
          </p>
        )}
        {lastInvite && (
          <div className="note" style={{ marginTop: 10 }}>
            <Icon name={lastInvite.email_enviado ? "mail-check" : "info"} size={16} />
            <span>
              {lastInvite.email_enviado
                ? `Invitación enviada a ${lastInvite.email}.`
                : "Invitación creada. El correo no pudo enviarse; comparte el enlace manualmente:"}
              {!lastInvite.email_enviado && lastInvite.invite_url && (
                <>
                  {" "}
                  <span className="mono" style={{ wordBreak: "break-all" }}>
                    {lastInvite.invite_url}
                  </span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="user-section">
          <h2>
            <Icon name="clock" size={14} />
            Invitaciones pendientes <span className="cnt">{pending.length}</span>
          </h2>
          {pending.map((u) => (
            <div className="user-row" key={u.id}>
              <span className="avatar ghost">
                <Icon name="mail" size={15} />
              </span>
              <div className="ur-main">
                <div className="ur-n">{u.email}</div>
                <div className="ur-e">Invitación enviada · esperando que acepte</div>
              </div>
              <div className="ur-right">
                <span className={"role-pill " + u.role}>{roleLabel(u.role)}</span>
                <span className="ur-stat pending">
                  <span className="d" />
                  pendiente
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-gap" />

      <div className="user-section">
        <h2>
          <Icon name="user-check" size={14} />
          Usuarios activos <span className="cnt">{users.length}</span>
        </h2>
        {users.map((u) => (
          <div className="user-row" key={u.id}>
            <span className="avatar">
              {(u.name ?? u.email).split(/[ @.]/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="ur-main">
              <div className="ur-n">{u.name ?? u.email}</div>
              <div className="ur-e">{u.email}</div>
            </div>
            <div className="ur-right">
              <span className={"role-pill " + u.role}>{roleLabel(u.role)}</span>
              <span className="ur-stat active">
                <span className="d" />
                activo
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="note" style={{ marginTop: 20 }}>
        <Icon name="scan-line" size={16} />
        <span>
          Los colaboradores en piso <b>no necesitan cuenta</b>: el QR pegado al equipo es su
          credencial al CoDo. Aquí solo gestionas a quienes administran o editan la organización.
        </span>
      </div>
    </ProductShell>
  );
}
