"use client";

/*
 * DEMO-READY (Pilar 3 anónimo) — solicitud de DEMOSTRACIÓN sin auth.
 *
 * En el demo público el visitante no tiene sesión ni Directorio: el botón "Solicitar"
 * abre ESTE modal (no el `SolicitudModal` autenticado). El envío es REAL —
 * `POST /demo/solicitud` dispara un correo etiquetado como demostración a un destino
 * FIJO del backend ("Proveedor Demo DOCYAN"), rate-limited por IP. Nunca se finge:
 * si el canal falla, se muestra el fallo honesto. El contacto del visitante es
 * OPCIONAL (solo como reply-to). Vocabulario visual del Design System (Dialog).
 */
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { demoSolicitud, type DemoSolicitudPayload } from "@/lib/demo-query";
import type { SolicitarPrefill } from "./solicitud-modal";

/** Deriva el tipo de solicitud legible desde el tipo sugerido por el backend. */
function tipoLegible(tipoSugerido?: string | null): string {
  const t = (tipoSugerido ?? "").toLowerCase();
  if (t.includes("cotiz") || t.includes("parte") || t.includes("refacc")) return "Cotización de refacción";
  if (t.includes("manten")) return "Programar mantenimiento";
  if (t.includes("insumo") || t.includes("reabas")) return "Reabastecimiento de insumo";
  if (t.includes("inspec") || t.includes("revis")) return "Inspección / revisión";
  return "Solicitud de demostración";
}

export function DemoSolicitudModal({
  open,
  onOpenChange,
  prefill,
  codo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: SolicitarPrefill;
  codo: string;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  const tipo = tipoLegible(prefill.tipoSugerido);
  const dato = (prefill.dato ?? prefill.cita?.fragmento ?? "").trim() || "Dato de la respuesta";
  const docNombre = prefill.cita?.documento_nombre ?? null;
  const pagina = prefill.cita?.pagina ?? null;
  const fragmento = prefill.cita?.fragmento ?? null;

  async function enviar() {
    setEstado("enviando");
    const payload: DemoSolicitudPayload = {
      tipo,
      dato,
      codo,
      documento_nombre: docNombre,
      pagina,
      fragmento,
      contacto_nombre: nombre.trim() || null,
      contacto_email: email.trim() || null,
    };
    const res = await demoSolicitud(payload);
    setEstado(res.enviada ? "ok" : "error");
    setMensaje(res.mensaje);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar — {tipo}</DialogTitle>
          <DialogDescription>
            Demostración del Pilar 3: un dato accionable viaja como solicitud a su
            destinatario. En esta demo pública se envía a <strong>Proveedor Demo
            DOCYAN</strong> con la etiqueta «solicitud de demostración».
          </DialogDescription>
        </DialogHeader>

        {estado === "ok" ? (
          <div className="demo-sol-ok" role="status">
            ✓ {mensaje}
          </div>
        ) : (
          <div className="demo-sol-form">
            <div className="demo-sol-dato">
              <span className="demo-sol-lbl">Dato</span>
              <span className="demo-sol-val">{dato}</span>
              {docNombre ? (
                <span className="demo-sol-cita">
                  {docNombre}
                  {pagina != null ? ` · p. ${pagina}` : ""}
                </span>
              ) : null}
            </div>

            <label className="demo-sol-field">
              <span>Tu nombre (opcional)</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre"
                maxLength={120}
              />
            </label>
            <label className="demo-sol-field">
              <span>Tu correo (opcional, para respuesta)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                maxLength={200}
              />
            </label>

            {estado === "error" ? (
              <div className="demo-sol-err" role="alert">
                {mensaje}
              </div>
            ) : null}

            <button
              type="button"
              className="demo-sol-send"
              onClick={enviar}
              disabled={estado === "enviando"}
            >
              {estado === "enviando" ? "Enviando…" : "Enviar solicitud de demostración"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
