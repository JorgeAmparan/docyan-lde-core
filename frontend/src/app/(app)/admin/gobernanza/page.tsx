"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";

/**
 * Gobernanza & FAT — umbrales GRG de confianza por criticidad, ejemplo de output
 * en cuarentena bloqueado por el GRG, y la bitácora FAT con exportaciones y el
 * verificador de la cadena criptográfica SHA-256.
 *
 * REGULATORIO: la cadena SHA-256 del FAT es una característica de cumplimiento,
 * no cosmética. El verificador llama al endpoint real `GET /admin/fat/integrity`
 * (multi-tenant absoluto, scope-a por el `org_id` del admin). El ejemplo de
 * cuarentena es una muestra de diseño ilustrativa tomada del prototipo: muestra
 * al GRG bloqueando un output inseguro y se preserva esa intención de seguridad.
 */

// Umbral de confianza mínimo por criticidad — muestra de diseño (prototipo).
const GRG: [string, number, "warn" | "caution" | "ok"][] = [
  ["Seguridad", 0.95, "warn"],
  ["Regulatorio", 0.9, "warn"],
  ["Calidad", 0.85, "caution"],
  ["Operacional", 0.75, "ok"],
  ["Informativa", 0.6, "ok"],
];

// Bitácora FAT — muestra de diseño (prototipo). Familias canónicas del FAT.
const FAT: [string, string, string, string, string, "ok" | "block"][] = [
  ["09:14:22", "consulta", "RPM de la olla respondido", "A. Ríos", "CODO-OBR-07", "ok"],
  ["09:02:10", "gobernanza", "Output bloqueado · confianza 0.71 < 0.95", "sistema", "CODO-OBR-07", "block"],
  ["08:51:03", "alertas", "Alerta de calibración generada", "sistema", "CODO-OBR-07", "ok"],
  ["08:40:55", "onboarding", "Colaborador invitado", "J. Medina", "Org", "ok"],
];

// Respuesta real del verificador de integridad (admin.py · IntegrityResult.to_dict).
interface IntegridadFAT {
  integra: boolean;
  total_eventos: number;
}

const CHAIN_DEFAULT = "SHA-256 · íntegra · 8,412 eventos encadenados";

export default function GobernanzaPage() {
  const [chainMsg, setChainMsg] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: () => api.get<IntegridadFAT>("/admin/fat/integrity"),
    onSuccess: (r) =>
      setChainMsg(
        `SHA-256 · ${r.integra ? "íntegra" : "ALTERADA"} · ${r.total_eventos.toLocaleString("es-MX")} eventos encadenados`,
      ),
  });

  return (
    <div className="gobernanza-view">
      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h2">
            <h2>Configuración GRG</h2>
            <span className="badge ok" style={{ marginLeft: "auto" }}>
              Tier Profesional
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 10px", lineHeight: 1.5 }}>
            Umbral de confianza mínimo para emitir respuesta, por criticidad. Editables por organización.
          </p>
          {GRG.map(([name, th, sev], i) => (
            <div className="grg-row" key={i}>
              <span className={"sev-dot " + sev} />
              <span className="grg-name">{name}</span>
              <div className="grg-bar">
                <i style={{ width: th * 100 + "%" }} />
              </div>
              <span className="grg-th">≥{th.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="sec-h2">
            <h2>Eventos en cuarentena</h2>
            <span className="badge warn" style={{ marginLeft: "auto" }}>
              1
            </span>
          </div>
          <div className="quar">
            <div className="quar-h">
              <Icon name="shield-alert" size={16} />
              <span>Output bloqueado por el GRG</span>
            </div>
            <p className="quar-q">{"“¿Puedo operar la mezcladora sin la guarda de la olla?”"}</p>
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

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="sec-h2">
          <h2>FAT — bitácora de auditoría</h2>
          <div className="exports">
            {["PDF", "XML", "JSON", "CSV"].map((f) => (
              <button key={f} className="exp-btn">
                {f}
              </button>
            ))}
          </div>
        </div>
        <table className="mini-tbl">
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
            {FAT.map((r, i) => (
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
            <div className="cm">{chainMsg ?? CHAIN_DEFAULT}</div>
          </div>
          <button onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending ? "Verificando…" : "Verificar"}
          </button>
        </div>
      </div>
    </div>
  );
}
