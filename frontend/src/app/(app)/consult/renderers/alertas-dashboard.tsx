"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { CitedFragment } from "./cited-fragment";
import { SolicitarBtn } from "./solicitar-btn";
import type { AlertsDashboardPayload } from "../consult-data";
import type { SolicitarPrefill } from "./solicitud-modal";

/**
 * Tipo 7 · Alertas administrativas. REGULATORY ABSOLUTE (CLAUDE.md §11.1):
 *  - El banner administrativo (`.ans-banner`) es OBLIGATORIO.
 *  - Alertas SOLO administrativas (vencimientos/calibración/expiración).
 *  - NUNCA rojo de peligro ANSI: solo severidades `warn`/`caution`.
 * Datos del payload real (el backend ya filtró por `safety_validator`).
 */
type AlertaItem = NonNullable<AlertsDashboardPayload["alertas"]>[number];

/** urgencia → severidad visual. `alta` = warn (ámbar), resto = caution. Nunca danger. */
function sevOf(urgencia: string | undefined): "warn" | "caution" {
  return urgencia === "alta" ? "warn" : "caution";
}
function grupoOf(urgencia: string | undefined): string {
  if (urgencia === "alta") return "Por vencer · prioridad alta";
  if (urgencia === "media") return "Próximas";
  return "Programadas";
}

function AnsAlertCard({
  a,
  onSolicitar,
}: {
  a: AlertaItem;
  onSolicitar?: (p: SolicitarPrefill) => void;
}) {
  const [state, setState] = useState<"read" | "snooze" | null>(null);
  return (
    <div className={"al-card alert-card s-" + sevOf(a.urgencia) + (state ? " done" : "")}>
      <div className="al-top">
        <span className="al-t">{a.descripcion}</span>
        {state && <span className="al-state">{state === "read" ? "Leída" : "Pospuesta"}</span>}
      </div>
      {a.fecha_vencimiento && <span className="al-m">Vence: {a.fecha_vencimiento}</span>}
      <div className="al-foot">
        {!state && (
          <div className="al-acts">
            <button type="button" onClick={() => setState("read")}>
              Marcar leída
            </button>
            <button type="button" onClick={() => setState("snooze")}>
              Posponer
            </button>
            {/* ED-2 §2.4: "Solicitar" SOLO si el backend marcó la alerta accionable. */}
            {a.accionable && onSolicitar ? (
              <SolicitarBtn
                onClick={() =>
                  onSolicitar({
                    cita: a.cita ?? null,
                    tipoSugerido: a.tipo_sugerido ?? null,
                    entidadId: a.entidad_id ?? undefined,
                  })
                }
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function AlertasDashboard({
  payload,
  saved,
  onSave,
  onSolicitar,
}: {
  payload: AlertsDashboardPayload;
  saved: boolean;
  onSave: () => void;
  onCite: () => void;
  /** PROVISIONAL-ED2: abre el formulario de solicitud (solo en sesión autenticada). */
  onSolicitar?: (p: SolicitarPrefill) => void;
}) {
  const alertas = payload.alertas ?? [];
  const grupos = Array.from(new Set(alertas.map((a) => grupoOf(a.urgencia))));

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Alertas administrativas"}</div>
      {/* Línea ABSOLUTA §11.1 — banner obligatorio. El texto fuerte (incluye
          "ni clínicas") prevalece sobre el microcopy corto del prototipo: es un
          requisito regulatorio con test guard. */}
      <div className="ans-banner">
        <Icon name="info" size={15} />
        Recordatorios administrativos. No constituyen instrucciones operativas ni clínicas — DOCYAN
        presenta lo que el documento dice (vencimientos, faltantes); la decisión es del profesional.
      </div>
      {alertas.length === 0 && (
        <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>Sin alertas pendientes.</p>
      )}
      {grupos.map((g) => (
        <div className="al-group" key={g}>
          <div className="al-glab">{g}</div>
          {alertas
            .filter((a) => grupoOf(a.urgencia) === g)
            .map((a, i) => (
              <AnsAlertCard key={i} a={a} onSolicitar={onSolicitar} />
            ))}
        </div>
      ))}
      <CitedFragment cita={null} saved={saved} onSave={onSave} onOpenDoc={() => {}} />
    </div>
  );
}
