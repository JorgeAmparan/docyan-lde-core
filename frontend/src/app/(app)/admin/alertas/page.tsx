"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";

/**
 * Alertas administrativas. REGULATORY ABSOLUTE:
 *  - the `.admin-banner` administrative-only disclaimer is MANDATORY and on top.
 *  - only `warn` / `caution` severities — NEVER ANSI danger red. Admin reminders
 *    are not operative/clinical instructions.
 */

type Sev = "warn" | "caution";
type Status = "pendiente" | "pospuesta" | "accionada";

interface Alert {
  id: string;
  sev: Sev;
  group: string;
  title: string;
  codo: string;
  when: string;
  ref: string;
  status: Status;
}

// canned data (from admin-views.jsx ADMIN_ALERTS)
const ALERTS: Alert[] = [
  {
    id: "CAL-22-117",
    sev: "warn",
    group: "Por vencer · ≤ 7 días",
    title: "Calibración — Centrífuga Hettich",
    codo: "CODO-LAB-04",
    when: "Vence 07 jun · en 4 días",
    ref: "CAL-22-117",
    status: "pendiente",
  },
  {
    id: "CAL-21-088",
    sev: "warn",
    group: "Por vencer · ≤ 7 días",
    title: "Certificado CAL-21 vencido",
    codo: "CODO-LAB-04",
    when: "Venció 28 may",
    ref: "CAL-21-088",
    status: "pendiente",
  },
  {
    id: "MSDS-REF-03",
    sev: "caution",
    group: "Próximas · ≤ 30 días",
    title: "MSDS refrigerante sintético",
    codo: "CODO-LAB-04",
    when: "Expira 25 jun · en 22 días",
    ref: "MSDS-REF-03",
    status: "pendiente",
  },
  {
    id: "CERT-OP-AR",
    sev: "caution",
    group: "Próximas · ≤ 30 días",
    title: "Certificación del colaborador A. Ríos",
    codo: "Org",
    when: "Renueva en 28 días",
    ref: "CERT-OP-AR",
    status: "pendiente",
  },
];

const FILTERS: { key: Status; label: string }[] = [
  { key: "pendiente", label: "Pendientes" },
  { key: "pospuesta", label: "Pospuestas" },
  { key: "accionada", label: "Accionadas" },
];

export default function AlertasPage() {
  const [state, setState] = useState<Record<string, Status>>(
    Object.fromEntries(ALERTS.map((a) => [a.id, a.status])),
  );
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Status>("pendiente");

  const visible = useMemo(() => ALERTS.filter((a) => state[a.id] === filter), [state, filter]);
  const groups = useMemo(() => [...new Set(visible.map((a) => a.group))], [visible]);

  function setStatus(id: string, status: Status) {
    setState((s) => ({ ...s, [id]: status }));
  }

  return (
    <>
      {/* MANDATORY administrative-only banner — never removed. */}
      <div className="admin-banner" style={{ marginTop: 0 }}>
        <Icon name="info" size={15} />
        Recordatorios administrativos. No constituyen instrucciones operativas ni clínicas decisorias. DOCYAN no emite
        decisiones clínicas u operativas.
      </div>

      <div className="hist-filters" style={{ margin: "16px 0 4px" }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>
            {f.label}
            <span className="cnt" style={{ marginLeft: 6 }}>
              {ALERTS.filter((a) => state[a.id] === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="panel" style={{ marginTop: 16, color: "var(--fg-muted)", fontSize: 13 }}>
          Sin alertas en esta vista.
        </div>
      )}

      {groups.map((g) => (
        <div key={g} style={{ marginTop: 18 }}>
          <div className="ag-lab">{g}</div>
          <div className="panel" style={{ padding: 0 }}>
            {visible
              .filter((a) => a.group === g)
              .map((a) => (
                // s-warn / s-caution only — NEVER an ANSI red danger border.
                <div className={"arow s-" + a.sev} key={a.id} style={read[a.id] ? { opacity: 0.62 } : undefined}>
                  <span className="aico">
                    <Icon name={a.sev === "warn" ? "alarm-clock" : "clock"} size={16} />
                  </span>
                  <div className="ainfo">
                    <div className="at">{a.title}</div>
                    <div className="am">
                      <span className="codo-pill">{a.codo}</span>
                      {a.when}
                    </div>
                  </div>
                  <span className="cite" style={{ marginTop: 0 }}>
                    <span className="brk" />
                    {a.ref} ↗
                  </span>
                  <div className="arow-acts">
                    {filter === "pendiente" && (
                      <>
                        <button onClick={() => setRead((r) => ({ ...r, [a.id]: true }))}>
                          {read[a.id] ? "Leída ✓" : "Marcar leída"}
                        </button>
                        <button onClick={() => setStatus(a.id, "pospuesta")}>Posponer</button>
                        <button onClick={() => setStatus(a.id, "accionada")}>Accionada</button>
                      </>
                    )}
                    {filter === "pospuesta" && (
                      <button onClick={() => setStatus(a.id, "pendiente")}>Reactivar</button>
                    )}
                    {filter === "accionada" && (
                      <button onClick={() => setStatus(a.id, "pendiente")}>Reabrir</button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
