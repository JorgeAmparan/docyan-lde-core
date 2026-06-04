"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import { SaveBtn } from "./save-btn";

/**
 * Tipo 7 · Alertas administrativas. REGULATORY ABSOLUTE (CLAUDE.md §11.1):
 *  - The administrative-only `.admin-banner` is MANDATORY.
 *  - Alerts are SOLO administrativas (vencimientos/calibración/expiración).
 *  - NEVER ANSI danger red: only `warn`/`caution` severities exist here.
 * Ported from consult.jsx AlertsAnswer. Read/snooze persist in the card state.
 */
type Sev = "warn" | "caution";
interface Alert {
  sev: Sev;
  grp: string;
  title: string;
  meta: string;
  cite: string;
}

const ALERTS: Alert[] = [
  { sev: "warn", grp: "Por vencer · ≤ 7 días", title: "Calibración de la centrífuga", meta: "Vence en 4 días · 07 jun", cite: "Certificado CAL-22-117" },
  { sev: "caution", grp: "Próximas · ≤ 30 días", title: "MSDS del refrigerante", meta: "Expira en 22 días · 25 jun", cite: "DOC-MSDS-REF-03" },
  { sev: "caution", grp: "Próximas · ≤ 30 días", title: "Certificación del colaborador", meta: "Renovación en 28 días · A. Ríos", cite: "RH · CERT-OP-AR" },
];

function AlertCard({ a, onCite }: { a: Alert; onCite: () => void }) {
  const [state, setState] = useState<"read" | "snooze" | null>(null);
  return (
    <div className={"alert-card s-" + a.sev + (state ? " done" : "")}>
      <div className="al-top">
        <span className="al-t">{a.title}</span>
        {state && <span className="al-state">{state === "read" ? "Leída" : "Pospuesta"}</span>}
      </div>
      <span className="al-m">{a.meta}</span>
      <div className="al-foot">
        <CitationChip label={a.cite} onOpen={onCite} />
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

export function AlertasDashboard({ saved, onSave, onCite }: { saved: boolean; onSave: () => void; onCite: () => void }) {
  const groups = [...new Set(ALERTS.map((a) => a.grp))];
  return (
    <div className="acard">
      <div className="q">Alertas administrativas</div>
      <div className="admin-banner">
        <Icon name="info" size={15} />
        Recordatorios administrativos. No constituyen instrucciones operativas ni clínicas.
      </div>
      {groups.map((g) => (
        <div className="alert-group" key={g}>
          <div className="ag-lab">{g}</div>
          {ALERTS.filter((a) => a.grp === g).map((a, i) => (
            <AlertCard key={i} a={a} onCite={onCite} />
          ))}
        </div>
      ))}
      <div className="acard-foot">
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
