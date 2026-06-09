"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { SaveBtn } from "./save-btn";
import type { AlertsDashboardPayload } from "../consult-data";

/**
 * Tipo 7 · Alertas administrativas. REGULATORY ABSOLUTE (CLAUDE.md §11.1):
 *  - El `.admin-banner` administrativo es OBLIGATORIO.
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

function AlertCard({ a }: { a: AlertaItem }) {
  const [state, setState] = useState<"read" | "snooze" | null>(null);
  return (
    <div className={"alert-card s-" + sevOf(a.urgencia) + (state ? " done" : "")}>
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
}: {
  payload: AlertsDashboardPayload;
  saved: boolean;
  onSave: () => void;
  onCite: () => void;
}) {
  const alertas = payload.alertas ?? [];
  const grupos = Array.from(new Set(alertas.map((a) => grupoOf(a.urgencia))));

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Alertas administrativas"}</div>
      {/* Línea ABSOLUTA §11.1 — banner obligatorio, siempre administrativo. */}
      <div className="admin-banner">
        <Icon name="info" size={15} />
        Recordatorios administrativos. No constituyen instrucciones operativas ni clínicas.
      </div>
      {alertas.length === 0 && (
        <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>Sin alertas pendientes.</p>
      )}
      {grupos.map((g) => (
        <div className="alert-group" key={g}>
          <div className="ag-lab">{g}</div>
          {alertas
            .filter((a) => grupoOf(a.urgencia) === g)
            .map((a, i) => (
              <AlertCard key={i} a={a} />
            ))}
        </div>
      ))}
      <div className="acard-foot">
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
