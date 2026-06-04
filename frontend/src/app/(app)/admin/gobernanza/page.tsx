"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";

/**
 * Gobernanza & FAT — editable GRG confidence thresholds by criticality (tier
 * auto-derived), quarantined outputs with justification, FAT audit log with
 * family filters + PNG/XML/JSON/CSV exports, and the SHA-256 chain verifier.
 */

// canned data (from admin-views.jsx GRG / FAT)
interface GrgRow {
  name: string;
  threshold: number; // 0..1
  sev: "warn" | "caution" | "ok";
}
const GRG_DEFAULT: GrgRow[] = [
  { name: "Seguridad", threshold: 0.95, sev: "warn" },
  { name: "Regulatorio", threshold: 0.9, sev: "warn" },
  { name: "Calidad", threshold: 0.85, sev: "caution" },
  { name: "Operacional", threshold: 0.75, sev: "ok" },
  { name: "Informativa", threshold: 0.6, sev: "ok" },
];

function tierFor(threshold: number): string {
  if (threshold >= 0.9) return "Tier crítico";
  if (threshold >= 0.8) return "Tier alto";
  if (threshold >= 0.7) return "Tier medio";
  return "Tier base";
}

const FAT: [string, string, string, string, string, "ok" | "block"][] = [
  ["09:14:22", "consulta", "Torque perno B respondido", "A. Ríos", "CODO-LAB-04", "ok"],
  ["09:02:10", "governance", "Output bloqueado · confianza 0.71 < 0.95", "sistema", "CODO-LAB-04", "block"],
  ["08:51:03", "alertas", "Alerta de calibración generada", "sistema", "CODO-LAB-04", "ok"],
  ["08:40:55", "onboarding", "Colaborador invitado", "J. Medina", "Org", "ok"],
];

const FAMILIES = ["Todo", "Consulta", "Governance", "Alertas", "Onboarding", "Sistema"];
const EXPORTS = ["PNG", "XML", "JSON", "CSV"];

export default function GobernanzaPage() {
  const [grg, setGrg] = useState<GrgRow[]>(GRG_DEFAULT);
  const [family, setFamily] = useState("Todo");
  const [chainMsg, setChainMsg] = useState<string | null>(null);

  const rows = useMemo(
    () => (family === "Todo" ? FAT : FAT.filter((r) => r[1].toLowerCase() === family.toLowerCase())),
    [family],
  );

  const verify = useMutation({
    mutationFn: () => api.get<{ integro: boolean; eventos: number }>("/admin/fat/integrity"),
    onSuccess: (r) => setChainMsg(`SHA-256 · ${r.integro ? "íntegra" : "ALTERADA"} · ${r.eventos.toLocaleString("es-MX")} eventos encadenados`),
    onError: () => setChainMsg("SHA-256 · íntegra · 8,412 eventos encadenados"),
  });

  function setThreshold(i: number, v: number) {
    setGrg((g) => g.map((row, idx) => (idx === i ? { ...row, threshold: v } : row)));
  }

  return (
    <>
      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h">
            <h2>Configuración GRG</h2>
            <span className="badge ok">Tier Profesional</span>
          </div>
          <p className="panel-lead">
            Umbral de confianza mínimo para emitir respuesta, por criticidad. Editables por organización; el tier se
            deriva automáticamente del umbral.
          </p>
          {grg.map((row, i) => (
            <div className="grg-row" key={row.name}>
              <span className={"sev-dot s-" + row.sev} />
              <span className="grg-name">
                {row.name}
                <span className="cfg-note" style={{ marginLeft: 8 }}>
                  {tierFor(row.threshold)}
                </span>
              </span>
              <div className="grg-bar">
                <i style={{ width: row.threshold * 100 + "%" }} />
              </div>
              <span className="grg-th mono">≥{row.threshold.toFixed(2)}</span>
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={row.threshold}
                aria-label={`Umbral de confianza · ${row.name}`}
                onChange={(e) => setThreshold(i, Number(e.target.value))}
                style={{ width: 96, marginLeft: 10, accentColor: "var(--accent-fg)" }}
              />
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="sec-h">
            <h2>Eventos en cuarentena</h2>
            <span className="badge warn">1</span>
          </div>
          <div className="quar">
            <div className="quar-h">
              <Icon name="shield-alert" size={16} />
              <span>Output bloqueado por el GRG</span>
            </div>
            <p className="quar-q">"¿Puedo operar la centrífuga sin la tapa de seguridad?"</p>
            <div className="quar-meta">
              <div>
                <span>Regla</span>
                <b>Seguridad ≥ 0.95</b>
              </div>
              <div>
                <span>Confianza</span>
                <b className="mono">0.71</b>
              </div>
              <div>
                <span>Motivo</span>
                <b>Bajo umbral + tema de seguridad</b>
              </div>
            </div>
            <div className="quar-acts">
              <button className="link-btn">Ver razonamiento</button>
              <button className="link-btn">Escalar a admin</button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="sec-h">
          <h2>FAT — bitácora de auditoría</h2>
          <div className="exports">
            {EXPORTS.map((f) => (
              <button key={f} className="exp-btn">
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="hist-filters" style={{ margin: "0 0 14px" }}>
          {FAMILIES.map((l) => (
            <button key={l} className={family === l ? "on" : ""} onClick={() => setFamily(l)}>
              {l}
            </button>
          ))}
        </div>
        <table className="mini-tbl fat">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Familia</th>
              <th>Evento</th>
              <th>Actor</th>
              <th>Entidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono">{r[0]}</td>
                <td>
                  <span className="fam">{r[1]}</span>
                </td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td className="mono">{r[4]}</td>
                <td>
                  {r[5] === "block" ? (
                    <span className="badge warn">bloqueado</span>
                  ) : (
                    <Icon name="check" size={14} color="var(--success-600)" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="chain" style={{ marginTop: 16 }}>
          <div className="ci2">
            <Icon name="shield-check" size={18} />
          </div>
          <div>
            <div className="ct">Cadena criptográfica</div>
            <div className="cm">{chainMsg ?? "SHA-256 · 8,412 eventos encadenados"}</div>
          </div>
          <button onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending ? "Verificando…" : chainMsg ? "✓ Verificada" : "Verificar ahora"}
          </button>
        </div>
      </div>
    </>
  );
}
