"use client";

/*
 * PROVISIONAL-ED2 — Bandeja de solicitudes (ED-2 §2.8).
 *
 * Superficie provisional autorizada para demo: enviadas / recibidas con estado y
 * transiciones de ciclo de vida. Vocabulario visual existente (OrgShell + `.acard`
 * del kit). Se reemplaza por el porteo fiel del prototipo en ED-4.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { OrgShell } from "@/components/org-shell";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { components } from "@/types/api";

type Solicitud = components["schemas"]["SolicitudOut"];
type Listado = components["schemas"]["SolicitudListado"];

type Buzon = "enviadas" | "recibidas";

const ESTADO_LABEL: Record<string, string> = {
  creado: "Creada",
  notificado: "Enviada",
  leido: "Leída",
  reconocido: "Reconocida",
  en_proceso: "En proceso",
  resuelto: "Resuelta",
  escalado: "Escalada",
  cancelado: "Cancelada",
};

// Acciones ofrecidas por estado (transiciones válidas de la máquina común).
const ACCIONES_POR_ESTADO: Record<string, Array<{ accion: string; label: string }>> = {
  creado: [{ accion: "marcar_leida", label: "Marcar leída" }, { accion: "cancelar", label: "Cancelar" }],
  notificado: [
    { accion: "marcar_leida", label: "Marcar leída" },
    { accion: "iniciar_proceso", label: "Iniciar" },
    { accion: "cancelar", label: "Cancelar" },
  ],
  leido: [{ accion: "iniciar_proceso", label: "Iniciar" }, { accion: "resolver", label: "Resolver" }],
  en_proceso: [{ accion: "resolver", label: "Resolver" }, { accion: "cancelar", label: "Cancelar" }],
};

export default function SolicitudesPage() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const [buzon, setBuzon] = useState<Buzon>("enviadas");

  const lista = useQuery({
    queryKey: ["solicitudes", buzon, token],
    enabled: !!token,
    queryFn: async () => {
      const r = await api.get<Listado>("/solicitudes", { token, query: { buzon } });
      return r.solicitudes ?? [];
    },
  });
  const items: Solicitud[] = lista.data ?? [];

  const transicion = useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: string }) =>
      api.post(`/solicitudes/${id}/transicion`, { accion }, { token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["solicitudes"] }),
  });

  const error =
    (lista.error instanceof ApiError && lista.error.message) ||
    (transicion.error instanceof ApiError && transicion.error.message) ||
    (lista.isError ? "No se pudieron cargar las solicitudes." : null);
  const loading = lista.isLoading;

  function transicionar(id: string, accion: string) {
    transicion.mutate({ id, accion });
  }

  return (
    <OrgShell>
      <div className="consult-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 0" }}>
        <div className="ctxbar" style={{ marginBottom: 16 }}>
          <div className="eyebrow">
            <span className="dot" />
            Data accionable
          </div>
          <h1>Solicitudes</h1>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["enviadas", "recibidas"] as Buzon[]).map((b) => (
            <button
              key={b}
              type="button"
              className={"savebtn" + (buzon === b ? " on" : "")}
              style={{ marginLeft: 0 }}
              onClick={() => setBuzon(b)}
            >
              {b === "enviadas" ? "Enviadas" : "Recibidas"}
            </button>
          ))}
        </div>

        {error ? (
          <div className="acard" style={{ marginBottom: 12 }}>
            <div className="warn">
              <Icon name="triangle-alert" size={16} />
              <div className="wt">{error}</div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>Cargando…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
            Sin solicitudes {buzon === "enviadas" ? "enviadas" : "recibidas"}.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((s) => {
              const acciones = buzon === "recibidas" ? ACCIONES_POR_ESTADO[s.estado] ?? [] : [];
              return (
                <div className="acard" key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {s.tipo_nombre || s.etiqueta_libre || "Solicitud"}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        color: "var(--fg-subtle)",
                      }}
                    >
                      {ESTADO_LABEL[s.estado] ?? s.estado}
                    </span>
                  </div>
                  {s.mensaje ? (
                    <p className="note" style={{ marginTop: 6 }}>
                      {s.mensaje}
                    </p>
                  ) : null}
                  {s.fragmento ? (
                    <p
                      className="note"
                      style={{ marginTop: 6, fontStyle: "italic", color: "var(--fg-subtle)" }}
                    >
                      «{s.fragmento}»
                    </p>
                  ) : null}
                  {acciones.length > 0 ? (
                    <div className="al-acts" style={{ marginTop: 10, marginLeft: 0 }}>
                      {acciones.map((a) => (
                        <button
                          key={a.accion}
                          type="button"
                          onClick={() => transicionar(s.id, a.accion)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OrgShell>
  );
}
