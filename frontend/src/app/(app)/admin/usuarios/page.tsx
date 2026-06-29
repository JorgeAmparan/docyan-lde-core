"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
  type InvitationOut,
  type UsuarioOut,
} from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * Usuarios — Capa A admin desktop. Portado PIXEL-PERFECT del bundle de diseño
 * `app/org-views.jsx` → `UsuariosView`. Markup, clases, iconos y copy en español
 * coinciden verbatim con el prototipo (paneles Admins / Colaboradores con filas
 * `.urow` → `.uav`/`.uinfo`/`.useat`/`.uprefs`/`.pref`).
 *
 * Datos REALES (no canned): usuarios activos vía `/onboarding/usuarios` e
 * invitaciones pendientes vía `/invitations`. El modelo de roles del backend es
 * `admin | editor | viewer` (viewer = "Consulta"). Split del prototipo:
 *   · Admins        = role === "admin" (consumen seat).
 *   · Colaboradores = el resto (editor/viewer) — entran por QR, sin costo.
 *
 * Honestidad de datos (CLAUDE.md modelo de precios v2.1): el costo por seat NO se
 * publica (precio por documentos vivos, usuarios ilimitados → se cotiza con el
 * ejecutivo). Por eso el `.useat` muestra "—" (neutral/real), nunca una cifra
 * inventada. La `.pref` del colaborador muestra su ROL real (no un par lingüístico
 * ni un toggle IA fabricados — no hay fuente por-usuario para esos campos).
 *
 * Colisión CSS (footgun conocido): el valor crudo del rol NO se usa como clase.
 * El pill de rol usa `role-pill rp-<rol>` (prefijo `rp-`) para no chocar con la
 * clase de layout `.admin` del kit (óvalo rosa gigante).
 */

const ROLE_PILL_LABEL: Record<OrgRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Consulta",
};

function rolePillLabel(role: string): string {
  if (role in ROLE_PILL_LABEL) return ROLE_PILL_LABEL[role as OrgRole];
  return roleLabel(role) || role;
}

function initials(value: string): string {
  return value
    .split(/[ @.]/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function UsuariosPage() {
  const token = useAuth((s) => s.token);
  const myRole = useAuth((s) => s.user?.role) ?? "admin";
  const allowed = invitableRoles(myRole);
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>(allowed[allowed.length - 1] ?? "viewer");
  const [err, setErr] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<InvitationOut | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: async () => {
      const [us, inv] = await Promise.all([
        listUsuarios(token as string),
        listInvitations(token as string, "pending"),
      ]);
      return { users: us.items ?? [], pending: inv.items ?? [] };
    },
    enabled: !!token,
  });

  const users: UsuarioOut[] = useMemo(() => data?.users ?? [], [data]);
  const pending = data?.pending ?? [];
  const admins = useMemo(() => users.filter((u) => u.role === "admin"), [users]);
  const colaboradores = useMemo(() => users.filter((u) => u.role !== "admin"), [users]);

  const invite = useMutation({
    mutationFn: (body: { email: string; role: OrgRole }) =>
      createInvitation(body, token as string),
    onSuccess: (inv) => {
      setLastInvite(inv);
      setEmail("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
    },
    onError: (e) => {
      setErr(
        e instanceof ApiError && e.status === 403
          ? "Tu rol no puede invitar a ese rol. Un editor solo puede invitar usuarios de Consulta."
          : e instanceof ApiError && e.status === 409
            ? "Ese correo ya tiene una cuenta."
            : e instanceof ApiError
              ? e.message
              : "No pudimos enviar la invitación.",
      );
    },
  });

  function openInvite(preferred: OrgRole) {
    setRole(allowed.includes(preferred) ? preferred : (allowed[allowed.length - 1] ?? "viewer"));
    setEmail("");
    setErr(null);
    setLastInvite(null);
    setInviteOpen(true);
  }

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const canInviteAdmin = allowed.includes("admin");

  return (
    <div className="wrap">
      {/* ── Admins ─────────────────────────────────────────────── */}
      <div className="panel">
        <div className="sec-h2">
          <h2>Admins</h2>
          {canInviteAdmin && (
            <button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => openInvite("admin")}>
              <Icon name="plus" size={14} />
              Invitar admin
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
          Cada admin adicional suma un costo de seat según el plan. Los colaboradores son ilimitados
          y sin costo.
        </p>
        {admins.map((u) => (
          <div className="urow" key={u.id}>
            <span className="uav ink">{initials(u.name ?? u.email)}</span>
            <div className="uinfo">
              <div className="un">{u.name ?? u.email}</div>
              <div className="ur">{u.name ? u.email : "Admin"}</div>
            </div>
            <span className="useat">—</span>
            <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />
          </div>
        ))}
      </div>

      {/* ── Colaboradores ──────────────────────────────────────── */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="sec-h2">
          <h2>
            Colaboradores{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)", fontWeight: 400 }}>
              {colaboradores.length}
            </span>
          </h2>
          <button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => openInvite("viewer")}>
            <Icon name="plus" size={14} />
            Invitar colaborador
          </button>
        </div>
        {colaboradores.map((u) => (
          <div className="urow" key={u.id}>
            <span className="uav cin">{initials(u.name ?? u.email)}</span>
            <div className="uinfo">
              <div className="un">{u.name ?? u.email}</div>
              <div className="ur">Colaborador · entra por QR</div>
            </div>
            <div className="uprefs">
              <span className={"role-pill rp-" + u.role}>{rolePillLabel(u.role)}</span>
            </div>
            <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />
          </div>
        ))}
        {pending.map((u) => (
          <div className="urow" key={u.id}>
            <span className="uav cin">
              <Icon name="mail" size={15} />
            </span>
            <div className="uinfo">
              <div className="un">{u.email}</div>
              <div className="ur">Invitación enviada · esperando que acepte</div>
            </div>
            <div className="uprefs">
              <span className={"role-pill rp-" + u.role}>{rolePillLabel(u.role)}</span>
              <span className="pref">pendiente</span>
            </div>
            <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />
          </div>
        ))}
        <div className="manual-note" style={{ marginTop: 14, marginBottom: 0 }}>
          <Icon name="settings" size={15} />
          Por usuario: par lingüístico default, variante regional, permiso de IA proactiva y
          “silenciar sugerencias”.
        </div>
      </div>

      {/* ── Invitar (real) ─────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{role === "admin" ? "Invitar admin" : "Invitar colaborador"}</DialogTitle>
            <DialogDescription>
              {role === "admin"
                ? "Se enviará una invitación por correo. Cada admin suma un costo de seat según el plan."
                : "Entra por QR, sin costo. Recibirá un enlace para activar su cuenta."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (emailValid && !invite.isPending) invite.mutate({ email, role });
            }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div className="field2">
              <label>Correo</label>
              <input
                type="email"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field2">
              <label>Rol</label>
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {err && <span style={{ fontSize: 12, color: "var(--warning-600)" }}>{err}</span>}
            {lastInvite && (
              <div className="manual-note" style={{ margin: 0 }}>
                <Icon name={lastInvite.email_enviado ? "mail-check" : "info"} size={15} />
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
            <div className="qr-acts" style={{ marginTop: 4 }}>
              <button className="primary-btn" type="submit" disabled={!emailValid || invite.isPending}>
                <Icon name="send" size={14} />
                {invite.isPending ? "Enviando…" : "Enviar invitación"}
              </button>
              <DialogClose asChild>
                <button className="mini-btn" type="button">
                  Cancelar
                </button>
              </DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
