"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";

type PrefKey = "facturacion" | "alertas_saldo" | "novedades" | "soporte";

interface NotifPrefs {
  facturacion: boolean;
  alertas_saldo: boolean;
  novedades: boolean;
  soporte: boolean;
}

const FALLBACK: NotifPrefs = {
  facturacion: true,
  alertas_saldo: true,
  novedades: false,
  soporte: true,
};

const ROWS: Array<[PrefKey, string, string]> = [
  ["facturacion", "Facturación", "Recibos, cargos y avisos de cobro."],
  ["alertas_saldo", "Alertas de saldo", "Aviso cuando tu saldo de ingesta esté por agotarse."],
  ["novedades", "Novedades del producto", "Nuevas funciones y mejoras de DOCYAN LDE."],
  ["soporte", "Soporte", "Respuestas a tus tickets y avisos de servicio."],
];

export default function NotificacionesPage() {
  const token = useAuth((s) => s.token);
  const { data } = useQuery({
    queryKey: ["account-notif-prefs"],
    queryFn: () => api.get<NotifPrefs>("/admin/account/notifications", { token }),
    placeholderData: FALLBACK,
    retry: false,
  });
  const [prefs, setPrefs] = useState<NotifPrefs>(data ?? FALLBACK);

  const toggle = (key: PrefKey, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    // Best-effort persist; UI is optimistic.
    api.patch("/admin/account/notifications", next, { token }).catch(() => {});
  };

  return (
    <>
      <h1>Notificaciones</h1>
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Preferencias de correo</h2>
        <p className="lead" style={{ marginBottom: 14 }}>
          Elige qué correos quieres recibir.
        </p>
        {ROWS.map(([key, title, desc]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 0",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>{desc}</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => toggle(key, v)}
                aria-label={`Activar correos de ${title}`}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
