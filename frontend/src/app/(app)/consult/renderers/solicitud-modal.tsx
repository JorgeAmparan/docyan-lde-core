"use client";

/*
 * PROVISIONAL-ED2 — Formulario de solicitud (Pilar 3, Data Accionable).
 *
 * Superficie provisional autorizada para demo (ED-2 §2.8): usa el vocabulario visual
 * existente del Design System (Dialog de shadcn/ui sobre Radix + tokens Tailwind del
 * kit). Se reemplaza por el porteo fiel del prototipo en ED-4.
 *
 * Prellenado con el dato de origen y su cita (provenance heredado). El tipo abre
 * preseleccionado por la inferencia del backend (§2.3); el usuario lo cambia con un
 * tap. Destinatario SIEMPRE del Directorio (selector) — jamás un email libre.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api-client";
import type { components } from "@/types/api";
import type { Cita } from "../consult-data";

type TipoSolicitud = components["schemas"]["TipoSolicitudOut"];
type Destinatario = components["schemas"]["DestinatarioOut"];

export interface SolicitarPrefill {
  cita: Cita | null;
  tipoSugerido?: string | null;
  entidadId?: string;
  codoId?: string;
  consultaId?: string;
}

const OTRA = "__otra__";

export function SolicitudModal({
  open,
  onOpenChange,
  prefill,
  token,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: SolicitarPrefill | null;
  token: string | null;
}) {
  // Catálogo + Directorio (react-query: sin setState-en-effect). Se recarga por
  // apertura vía el queryKey, y solo corre autenticado y con el modal abierto.
  const catalogo = useQuery({
    queryKey: ["solicitud-form", token],
    enabled: open && !!token,
    queryFn: async () => {
      const [tipos, destinatarios] = await Promise.all([
        api.get<TipoSolicitud[]>("/tipos-solicitud", { token }),
        api.get<Destinatario[]>("/destinatarios", { token, query: { solo_activos: true } }),
      ]);
      return { tipos, destinatarios };
    },
  });
  const tipos = catalogo.data?.tipos ?? [];
  const destinatarios = catalogo.data?.destinatarios ?? [];

  // Selección: override del usuario ?? default derivado (tipo sugerido por el backend).
  const [tipoOverride, setTipoOverride] = useState<string | null>(null);
  const [destinatarioOverride, setDestinatarioOverride] = useState<string | null>(null);
  const [etiquetaLibre, setEtiquetaLibre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [camposVal, setCamposVal] = useState<Record<string, string>>({});

  const tipoSugeridoMatch = prefill?.tipoSugerido
    ? tipos.find((t) => t.clave === prefill.tipoSugerido)
    : undefined;
  const defaultTipoId = tipoSugeridoMatch?.id ?? tipos[0]?.id ?? "";
  const tipoSel = tipoOverride ?? defaultTipoId;
  const destinatarioSel = destinatarioOverride ?? destinatarios[0]?.id ?? "";

  const tipoActual = tipos.find((t) => t.id === tipoSel);
  const campos = tipoSel === OTRA ? [] : tipoActual?.campos ?? [];

  const crear = useMutation({
    mutationFn: async () => {
      await api.post(
        "/solicitudes",
        {
          tipo_id: tipoSel === OTRA ? null : tipoSel,
          etiqueta_libre: tipoSel === OTRA ? etiquetaLibre.trim() : null,
          destinatario_id: destinatarioSel,
          mensaje: mensaje.trim() || null,
          campos_tipados: camposVal,
          dato_origen: prefill?.cita
            ? {
                documento_id: prefill.cita.documento_id ?? null,
                documento_nombre: prefill.cita.documento_nombre ?? null,
                span_inicio: prefill.cita.span_inicio ?? null,
                span_fin: prefill.cita.span_fin ?? null,
                fragmento: prefill.cita.fragmento ?? null,
              }
            : null,
          consulta_id: prefill?.consultaId ?? null,
          entidad_id: prefill?.entidadId ?? null,
          codo_id: prefill?.codoId ?? null,
        },
        { token },
      );
    },
  });

  function close() {
    // Reset de selección local para la próxima apertura (event handler, no effect).
    setTipoOverride(null);
    setDestinatarioOverride(null);
    setEtiquetaLibre("");
    setMensaje("");
    setCamposVal({});
    crear.reset();
    onOpenChange(false);
  }

  const errorMsg =
    (catalogo.error instanceof ApiError && catalogo.error.message) ||
    (crear.error instanceof ApiError && crear.error.message) ||
    (crear.isError ? "No se pudo crear la solicitud." : null);

  const puedeEnviar =
    !!destinatarioSel &&
    (tipoSel !== OTRA || etiquetaLibre.trim().length > 0) &&
    !crear.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar</DialogTitle>
          <DialogDescription>
            Se enviará al destinatario que elijas del Directorio, con la cita del documento.
          </DialogDescription>
        </DialogHeader>

        {crear.isSuccess ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-fg">Solicitud creada y enviada.</p>
            <button type="button" className="savebtn" style={{ marginLeft: 0 }} onClick={close}>
              Cerrar
            </button>
          </div>
        ) : catalogo.isLoading ? (
          <p className="text-sm text-fg-muted py-4">Cargando…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {prefill?.cita?.fragmento ? (
              <div className="rounded-md border border-border bg-amate-50 p-3 text-[13px] text-fg-muted">
                <span className="block text-[10px] uppercase tracking-wide text-fg-subtle mb-1">
                  Dato de referencia
                </span>
                <mark className="bg-transparent text-fg">«{prefill.cita.fragmento}»</mark>
                {prefill.cita.documento_nombre ? (
                  <span className="block mt-1 text-[11px] text-fg-subtle">
                    {prefill.cita.documento_nombre}
                  </span>
                ) : null}
              </div>
            ) : null}

            <label className="text-[12px] font-medium text-fg-muted">
              Tipo
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg"
                value={tipoSel}
                onChange={(e) => setTipoOverride(e.target.value)}
              >
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
                <option value={OTRA}>Otra…</option>
              </select>
            </label>

            {tipoSel === OTRA ? (
              <label className="text-[12px] font-medium text-fg-muted">
                Etiqueta
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg"
                  value={etiquetaLibre}
                  onChange={(e) => setEtiquetaLibre(e.target.value)}
                  placeholder="Ej. verificación metrológica"
                />
              </label>
            ) : null}

            <label className="text-[12px] font-medium text-fg-muted">
              Destinatario
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg"
                value={destinatarioSel}
                onChange={(e) => setDestinatarioOverride(e.target.value)}
              >
                {destinatarios.length === 0 ? (
                  <option value="">— sin destinatarios en el Directorio —</option>
                ) : null}
                {destinatarios.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                    {d.empresa ? ` · ${d.empresa}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {campos.map((c) => (
              <label key={c.clave} className="text-[12px] font-medium text-fg-muted">
                {c.etiqueta}
                <input
                  type={c.tipo === "number" ? "number" : c.tipo === "date" ? "date" : "text"}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg"
                  value={camposVal[c.clave] ?? ""}
                  onChange={(e) => setCamposVal((v) => ({ ...v, [c.clave]: e.target.value }))}
                />
              </label>
            ))}

            <label className="text-[12px] font-medium text-fg-muted">
              Mensaje
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg"
                rows={3}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Detalle de la solicitud…"
              />
            </label>

            {errorMsg ? <p className="text-[13px] text-danger-600">{errorMsg}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="savebtn" style={{ marginLeft: 0 }} onClick={close}>
                Cancelar
              </button>
              <button
                type="button"
                className="savebtn on"
                disabled={!puedeEnviar}
                style={{ marginLeft: 0, opacity: puedeEnviar ? 1 : 0.5 }}
                onClick={() => crear.mutate()}
              >
                {crear.isPending ? "Enviando…" : "Enviar solicitud"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
