"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
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
import { Switch } from "@/components/ui/switch";

/**
 * Usuarios — org admins (with per-plan seat cost) + colaboradores (unlimited,
 * no cost, enter via QR). Invite dialog (email + rol). Per-user prefs: default
 * language pair, regional variant, IA proactiva toggle, silenciar sugerencias.
 */

const ADMINS = [
  { id: "a1", av: "JM", name: "Jorge Medina", role: "Admin · propietario", cost: "—" },
  { id: "a2", av: "RC", name: "Rosa Cantú", role: "Admin", cost: "$12 / mes" },
];

interface Operator {
  id: string;
  av: string;
  name: string;
  pair: string;
  region: string;
  ai: boolean;
  muted: boolean;
}
const OPERATORS_INIT: Operator[] = [
  { id: "o1", av: "AR", name: "A. Ríos", pair: "ES-MX", region: "MX", ai: true, muted: false },
  { id: "o2", av: "LP", name: "L. Peña", pair: "ES-MX", region: "MX", ai: true, muted: false },
  { id: "o3", av: "DK", name: "D. Kim", pair: "EN-US", region: "US", ai: false, muted: true },
];

const inviteSchema = z.object({
  email: z.string().email("Correo no válido"),
  role: z.enum(["admin", "colaborador"]),
});
type InviteForm = z.infer<typeof inviteSchema>;

export default function UsuariosPage() {
  const [operators, setOperators] = useState<Operator[]>(OPERATORS_INIT);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [defaultRole, setDefaultRole] = useState<"admin" | "colaborador">("colaborador");
  const [editing, setEditing] = useState<Operator | null>(null);

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "colaborador" },
  });

  const invite = useMutation({
    mutationFn: (data: InviteForm) => api.post("/admin/users/invite", data),
    onSettled: () => {
      // DESIGN: best-effort — close regardless (endpoint shape may be absent).
      setInviteOpen(false);
      form.reset();
    },
  });

  function openInvite(role: "admin" | "colaborador") {
    setDefaultRole(role);
    form.reset({ email: "", role });
    setInviteOpen(true);
  }

  function patchOperator(id: string, patch: Partial<Operator>) {
    setOperators((ops) => ops.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    // DESIGN: best-effort persist; ignore failure (canned-first).
    api.patch(`/admin/users/${id}/prefs`, patch).catch(() => {});
  }

  return (
    <>
      <div className="panel">
        <div className="sec-h">
          <h2>Admins</h2>
          <button className="mini-btn" onClick={() => openInvite("admin")}>
            <Icon name="plus" size={14} />
            Invitar admin
          </button>
        </div>
        <p className="panel-lead">
          Cada admin adicional suma un costo de seat según el plan. Los colaboradores son ilimitados y sin costo.
        </p>
        {ADMINS.map((u) => (
          <div className="urow" key={u.id}>
            <span className="uav ink">{u.av}</span>
            <div className="uinfo">
              <div className="un">{u.name}</div>
              <div className="ur">{u.role}</div>
            </div>
            <span className="useat mono">{u.cost}</span>
            <Icon name="more-horizontal" size={16} color="var(--fg-subtle)" />
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="sec-h">
          <h2>
            Colaboradores <span className="cnt">{operators.length}</span>
          </h2>
          <button className="mini-btn" onClick={() => openInvite("colaborador")}>
            <Icon name="plus" size={14} />
            Invitar colaborador
          </button>
        </div>
        {operators.map((u) => (
          <div className="urow" key={u.id}>
            <span className="uav cin">{u.av}</span>
            <div className="uinfo">
              <div className="un">{u.name}</div>
              <div className="ur">Colaborador · entra por QR</div>
            </div>
            <div className="uprefs">
              <span className="pref mono">
                {u.pair} · {u.region}
              </span>
              <span
                className={"pref toggle" + (u.ai ? " on" : "")}
                role="button"
                tabIndex={0}
                onClick={() => patchOperator(u.id, { ai: !u.ai })}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && patchOperator(u.id, { ai: !u.ai })}
              >
                <Icon name="sparkles" size={12} />
                IA proactiva {u.ai ? "on" : "off"}
              </span>
            </div>
            <button className="link-btn" onClick={() => setEditing(u)}>
              Preferencias
            </button>
          </div>
        ))}
        <div className="manual-note" style={{ marginTop: 14 }}>
          <Icon name="settings" size={15} />
          Por usuario: par lingüístico default, variante regional, permiso de IA proactiva y "silenciar sugerencias".
        </div>
      </div>

      {/* ── Invite dialog ─────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar {defaultRole === "admin" ? "admin" : "colaborador"}</DialogTitle>
            <DialogDescription>
              {defaultRole === "admin"
                ? "Los admins gestionan la organización. Suman costo de seat según el plan."
                : "Los colaboradores entran escaneando el QR — no necesitan cuenta. Esta invitación es opcional."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((d) => invite.mutate(d))}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div className="field2">
              <label>Correo</label>
              <input type="email" placeholder="nombre@empresa.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <span style={{ fontSize: 12, color: "var(--warning-600)" }}>{form.formState.errors.email.message}</span>
              )}
            </div>
            <div className="field2">
              <label>Rol</label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as "admin" | "colaborador")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (con costo de seat)</SelectItem>
                  <SelectItem value="colaborador">Colaborador (sin costo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="qr-acts" style={{ marginTop: 4 }}>
              <button className="primary-btn" type="submit" disabled={invite.isPending}>
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

      {/* ── Per-user prefs dialog ─────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Preferencias · {editing.name}</DialogTitle>
                <DialogDescription>Configuración individual del colaborador.</DialogDescription>
              </DialogHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="field2">
                  <label>Par lingüístico default</label>
                  <Select value={editing.pair} onValueChange={(v) => patchOperator(editing.id, { pair: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ES-MX">ES-MX</SelectItem>
                      <SelectItem value="EN-US">EN-US</SelectItem>
                      <SelectItem value="ES-ES">ES-ES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="field2">
                  <label>Variante regional</label>
                  <Select value={editing.region} onValueChange={(v) => patchOperator(editing.id, { region: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MX">México</SelectItem>
                      <SelectItem value="US">Estados Unidos</SelectItem>
                      <SelectItem value="ES">España</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                  <Switch
                    checked={editing.ai}
                    onCheckedChange={(c) => {
                      patchOperator(editing.id, { ai: c });
                      setEditing({ ...editing, ai: c });
                    }}
                  />
                  Permiso de IA proactiva
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                  <Switch
                    checked={editing.muted}
                    onCheckedChange={(c) => {
                      patchOperator(editing.id, { muted: c });
                      setEditing({ ...editing, muted: c });
                    }}
                  />
                  Silenciar sugerencias
                </label>
              </div>
              <div className="qr-acts" style={{ marginTop: 8 }}>
                <DialogClose asChild>
                  <button className="primary-btn" type="button">
                    Listo
                  </button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
