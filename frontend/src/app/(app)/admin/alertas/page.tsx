"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";

/**
 * Alertas administrativas (Capa A admin desktop). Ported PIXEL-PERFECT from the
 * design bundle `app/org-views.jsx` → `AlertasView`. Markup, classes, icons and
 * Spanish copy match the prototype verbatim.
 *
 * REGULATORY — LÍNEA ABSOLUTA §11.1 (CLAUDE.md):
 *  - The `.admin-banner` administrative-only disclaimer is MANDATORY, on top, and
 *    states alerts are administrative reminders — never operative/clinical
 *    instructions ("DOCYAN no emite decisiones clínicas u operativas").
 *  - Severities are `warn` / `caution` ONLY — NEVER an ANSI danger red border.
 *  - Each alert cites its source via the corner-bracket `.cite-mini` cinnabar chip.
 *
 * Data: the admin alert list mirrors the prototype's canned `ADMIN_ALERTS` (this
 * admin view has no dedicated alerts endpoint yet — the consult-flow
 * `AlertsDashboardPayload` is a separate renderer). Grouping is by urgencia
 * (Por vencer ≤ 7 días / Próximas ≤ 30 días) exactly as the prototype.
 */

type Sev = "warn" | "caution";

// [sev, grupo, título, codo, cuándo, ref] — verbatim from prototype ADMIN_ALERTS.
const ADMIN_ALERTS: [Sev, string, string, string, string, string][] = [
  ["warn", "Por vencer · ≤ 7 días", "Calibración — Mezcladora MAXI-10ND", "CODO-OBR-07", "Vence 02 jul · en 4 días", "CAL-22-117"],
  ["warn", "Por vencer · ≤ 7 días", "Certificado del operador A. Ríos", "Org", "Venció 28 jun", "CERT-OP-AR"],
  ["caution", "Próximas · ≤ 30 días", "Cambio de aceite SAE-30 programado", "CODO-OBR-07", "En 22 días", "MTTO-OBR-03"],
  ["caution", "Próximas · ≤ 30 días", "MSDS refrigerante — Centrífuga", "CODO-LAB-04", "Expira 25 jul · en 27 días", "MSDS-REF-03"],
];

const DIAS_OPTS = [10, 5, 3, 2, 1] as const;

export default function AlertasPage() {
  const groups = [...new Set(ADMIN_ALERTS.map((a) => a[1]))];

  const [cfg, setCfg] = useState(false);
  const [dias, setDias] = useState<Record<number, boolean>>({ 10: true, 5: true, 3: true, 2: false, 1: true });
  const [mails, setMails] = useState<string[]>(["jorge@lab-estandar.mx", "rosa@lab-estandar.mx"]);
  const [mailVal, setMailVal] = useState("");
  const [adding, setAdding] = useState(false);

  const toggleDia = (d: number) => setDias((s) => ({ ...s, [d]: !s[d] }));
  const delMail = (m: string) => setMails((list) => list.filter((x) => x !== m));
  const addMail = () => {
    const v = mailVal.trim();
    if (!v || mails.includes(v)) {
      setAdding(false);
      setMailVal("");
      return;
    }
    setMails((m) => [...m, v]);
    setMailVal("");
    setAdding(false);
  };

  const diasActivos = Object.keys(dias)
    .filter((d) => dias[Number(d)])
    .map(Number)
    .sort((a, b) => b - a);

  const guardar = () => {
    toast.success("Avisos guardados", {
      description:
        "Los avisos se enviarán a " +
        mails.length +
        " destinatarios, " +
        (diasActivos.join(", ") || "—") +
        " días hábiles antes de cada vencimiento.",
    });
  };

  return (
    <>
      {/* MANDATORY administrative-only banner — never removed (LÍNEA ABSOLUTA §11.1). */}
      <div className="admin-banner">
        <Icon name="info" size={15} />
        Recordatorio administrativo — no es una instrucción operativa. DOCYAN no emite decisiones clínicas u
        operativas.
      </div>

      {/* Configuración de avisos automáticos pre-vencimiento */}
      <div className="panel" style={{ marginTop: 16 }}>
        <button className="alert-cfg-h" onClick={() => setCfg((v) => !v)}>
          <span className="acfg-ic">
            <Icon name="mail" size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div className="acfg-t">Avisos automáticos por correo</div>
            <div className="acfg-s">
              {mails.length} destinatarios ·{" "}
              {diasActivos.length ? diasActivos.join(" · ") + " días hábiles antes" : "sin avisos activos"}
            </div>
          </div>
          <Icon name="chevron-right" size={16} color="var(--fg-subtle)" className={"chev" + (cfg ? " open" : "")} />
        </button>
        {cfg && (
          <div className="alert-cfg-body">
            <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              DOCYAN envía el recordatorio a esta lista, los días hábiles que elijas antes de cada vencimiento. Sigue
              siendo administrativo — avisa, no instruye.
            </p>
            <div className="acfg-field">
              <label>Enviar aviso · días hábiles antes del vencimiento</label>
              <div className="dias-seg">
                {DIAS_OPTS.map((d) => (
                  <button key={d} className={"dia-chip" + (dias[d] ? " on" : "")} onClick={() => toggleDia(d)}>
                    {dias[d] && <Icon name="check" size={12} />}
                    {d} {d === 1 ? "día" : "días"}
                  </button>
                ))}
              </div>
            </div>
            <div className="acfg-field">
              <label>Destinatarios</label>
              <div className="mail-list">
                {mails.map((m) => (
                  <span className="mail-chip" key={m}>
                    <Icon name="user" size={12} />
                    {m}
                    <button onClick={() => delMail(m)} aria-label={"Quitar " + m}>
                      <Icon name="x" size={12} />
                    </button>
                  </span>
                ))}
                {adding ? (
                  <span className="mail-add">
                    <input
                      autoFocus
                      type="email"
                      value={mailVal}
                      placeholder="correo@empresa.mx"
                      aria-label="Correo del destinatario"
                      onChange={(e) => setMailVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addMail();
                        if (e.key === "Escape") {
                          setAdding(false);
                          setMailVal("");
                        }
                      }}
                    />
                    <button
                      className="ok"
                      aria-label="Agregar destinatario"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addMail();
                      }}
                    >
                      <Icon name="check" size={14} />
                    </button>
                  </span>
                ) : (
                  <button className="mail-addbtn" onClick={() => setAdding(true)}>
                    <Icon name="plus" size={13} />
                    Agregar correo
                  </button>
                )}
              </div>
            </div>
            <div className="acfg-foot">
              <span className="acfg-note">
                <Icon name="info" size={13} />
                Aplica a todas las alertas por vencer (calibraciones, MSDS, certificados). Días hábiles: omite fines de
                semana.
              </span>
              <button className="btn primary" onClick={guardar}>
                Guardar avisos
              </button>
            </div>
          </div>
        )}
      </div>

      {groups.map((g) => (
        <div key={g} style={{ marginTop: 18 }}>
          <div className="ag-lab">{g}</div>
          <div className="panel" style={{ padding: 0 }}>
            {ADMIN_ALERTS.filter((a) => a[1] === g).map((a, i) => (
              // s-warn / s-caution ONLY — never an ANSI red danger border (§11.1).
              <div className={"arow s-" + a[0]} key={i}>
                <span className="aico">
                  <Icon name={a[0] === "warn" ? "alarm-clock" : "clock"} size={16} />
                </span>
                <div className="ainfo">
                  <div className="at">{a[2]}</div>
                  <div className="am">
                    <span className="codo-pill">{a[3]}</span>
                    {a[4]}
                  </div>
                </div>
                <span className="cite-mini">
                  <span className="brk" />
                  {a[5]} ↗
                </span>
                <div className="arow-acts">
                  <button>Marcar leída</button>
                  <button>Posponer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
