"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import {
  createDestinatario,
  listDestinatarios,
  listReglas,
  saveRegla,
  type ReglaAlertaOut,
} from "@/lib/alertas";

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
 * ED-1 §2.6 — DATA WIRING ONLY (zero visual change): the configuración panel now
 * reads/persists the real `ReglaAlerta` (`GET/PUT /alertas/reglas`) and the email
 * recipients resolve against the real Directorio de Destinatarios (`/destinatarios`):
 * los correos que el admin agrega se dan de alta como `proveedor_externo` y la regla
 * referencia sus `destinatario_id` (guardrail §2.5: el admin da de alta). El markup,
 * clases y copy NO cambian — el porteo visual de esta vista pertenece al Mapa §2.3.
 * Delta reportado para §2.3 (no se diseña UI nueva aquí): la vista NO expone urgencia
 * por threshold, canal in_app, ni la regla de escalación; y los toggles de días fijos
 * [10,5,3,2,1] no representan thresholds fuera de ese conjunto (p. ej. el default
 * [30,15,7]). La lista de alertas de abajo sigue siendo el mock del prototipo (su
 * conexión al listado real `/alertas` es porteo del Mapa, no lógica de datos de ED-1).
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

  const token = useAuth((s) => s.token);

  const [cfg, setCfg] = useState(false);
  const [dias, setDias] = useState<Record<number, boolean>>({ 10: true, 5: true, 3: true, 2: false, 1: true });
  const [mails, setMails] = useState<string[]>(["jorge@lab-estandar.mx", "rosa@lab-estandar.mx"]);
  const [mailVal, setMailVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  // Mapa correo → destinatario_id del Directorio (para referenciar la regla, §2.5).
  const [emailToId, setEmailToId] = useState<Record<string, string>>({});
  // Regla cargada: preserva campos que esta vista no expone (escalación) al guardar.
  const [reglaBase, setReglaBase] = useState<ReglaAlertaOut | null>(null);

  // Carga los datos REALES (regla global + directorio) y rehidrata los controles.
  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    (async () => {
      try {
        const [reglas, dests] = await Promise.all([listReglas(token), listDestinatarios(token)]);
        if (cancelado) return;
        const idByEmail: Record<string, string> = {};
        const emailById: Record<string, string> = {};
        for (const d of dests) {
          if (d.email) {
            idByEmail[d.email] = d.id;
            emailById[d.id] = d.email;
          }
        }
        setEmailToId(idByEmail);
        const regla = reglas[0];
        if (regla) {
          setReglaBase(regla);
          setDias(() => {
            const next: Record<number, boolean> = {};
            for (const d of DIAS_OPTS) next[d] = regla.thresholds.includes(d);
            return next;
          });
          const emails = (regla.destinatarios ?? [])
            .map((id) => emailById[id])
            .filter((e): e is string => Boolean(e));
          setMails(emails);
        }
      } catch {
        // Sin datos aún (o error de red): la vista conserva sus valores por defecto.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

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

  const guardar = async () => {
    if (!token || saving) return;
    setSaving(true);
    try {
      // Guardrail §2.5: el admin da de alta. Cada correo se asegura como
      // `proveedor_externo` en el Directorio; la regla referencia sus IDs.
      const nextMap = { ...emailToId };
      const ids: string[] = [];
      for (const email of mails) {
        let id = nextMap[email];
        if (!id) {
          const creado = await createDestinatario(
            { tipo: "proveedor_externo", nombre: email, email, activo: true },
            token,
          );
          id = creado.id;
          nextMap[email] = id;
        }
        ids.push(id);
      }
      setEmailToId(nextMap);
      await saveRegla(
        {
          tipo: "*",
          thresholds: diasActivos,
          destinatarios: ids,
          // Correos = proveedores externos → canal email (in_app requiere usuario
          // interno; su toggle es delta del Mapa §2.3, no se diseña aquí).
          canales: ["email"],
          // Preserva la escalación configurada por otra vía (no se expone aquí).
          escalacion_dias: reglaBase?.escalacion_dias ?? 7,
          escalacion_destinatario_id: reglaBase?.escalacion_destinatario_id ?? null,
          activo: reglaBase?.activo ?? true,
        },
        token,
      );
      toast.success("Avisos guardados", {
        description:
          "Los avisos se enviarán a " +
          mails.length +
          " destinatarios, " +
          (diasActivos.join(", ") || "—") +
          " días hábiles antes de cada vencimiento.",
      });
    } catch {
      toast.error("No se pudieron guardar los avisos", {
        description: "Revisa tu conexión e inténtalo de nuevo.",
      });
    } finally {
      setSaving(false);
    }
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
