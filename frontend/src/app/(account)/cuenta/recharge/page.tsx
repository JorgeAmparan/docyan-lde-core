"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { STRIPE_ENABLED, CONTACT_EMAIL } from "@/lib/config";
import { RECHARGE_PRESETS_USD, fmtMoney } from "@/lib/pricing";
import { useRegion } from "@/lib/region-store";

interface RechargeData {
  balance_usd: number;
  total_usd: number;
  history: Array<{ date: string; type: "recarga" | "consumo"; concept: string; amount: string }>;
}

const FALLBACK: RechargeData = {
  balance_usd: 184,
  total_usd: 500,
  history: [
    { date: "28 abr 2026", type: "recarga", concept: "Recarga prepagada", amount: "+$300 USD" },
    { date: "22 abr 2026", type: "consumo", concept: "Ingesta · NOM-052 (lote)", amount: "−$48 USD" },
    { date: "15 abr 2026", type: "consumo", concept: "Ingesta · MSDS x12", amount: "−$31 USD" },
    { date: "02 abr 2026", type: "recarga", concept: "Recarga prepagada", amount: "+$200 USD" },
  ],
};

export default function RechargePage() {
  const token = useAuth((s) => s.token);
  const region = useRegion((s) => s.region);
  const [selected, setSelected] = useState<number>(RECHARGE_PRESETS_USD[1]);

  const { data } = useQuery({
    queryKey: ["account-recharge"],
    queryFn: () => api.get<RechargeData>("/admin/account/ingest-balance", { token }),
    placeholderData: FALLBACK,
    retry: false,
  });
  const d = data ?? FALLBACK;
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Recarga de saldo de ingesta (${fmtMoney(selected, region)})`,
  )}`;

  return (
    <>
      <h1>Recargar saldo de ingesta</h1>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, padding: 18 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "var(--radius-md)",
            background: "var(--cinnabar-50)",
            color: "var(--cinnabar-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="wallet" size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 18 }}>${d.balance_usd} USD</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Saldo disponible · sin auto-recarga (protección financiera)
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Elige un monto</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {RECHARGE_PRESETS_USD.map((amt) => (
            <button
              key={amt}
              type="button"
              className={"pay-row" + (selected === amt ? " on" : "")}
              style={{ flex: "1 1 120px", justifyContent: "center", fontWeight: 600 }}
              onClick={() => setSelected(amt)}
              role="radio"
              aria-checked={selected === amt}
            >
              {fmtMoney(amt, region)}
            </button>
          ))}
        </div>

        {STRIPE_ENABLED ? (
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} type="button">
            Recargar {fmtMoney(selected, region)}
            <Icon name="arrow-right" size={16} />
          </button>
        ) : (
          <>
            <a className="btn primary" style={{ width: "100%", justifyContent: "center" }} href={mailto}>
              <Icon name="mail" size={16} />
              Solicitar recarga de {fmtMoney(selected, region)}
            </a>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
                fontSize: 13,
                color: "var(--fg-muted)",
              }}
            >
              <Icon name="info" size={15} />
              Pagos en línea se habilitan en B9.1; por ahora la recarga se gestiona por correo.
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Histórico de recargas y consumo</h2>
        {d.history.map((h, i) => (
          <div className="billrow" key={i}>
            <span className="bd">{h.date}</span>
            <span>{h.concept}</span>
            <span
              className="amt"
              style={{ color: h.type === "recarga" ? "var(--success-600)" : "var(--fg)" }}
            >
              {h.amount}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
