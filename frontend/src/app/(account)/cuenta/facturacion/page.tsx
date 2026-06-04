"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

interface BillingData {
  payment_method: { brand: string; last4: string; exp: string } | null;
  pending: Array<{ date: string; concept: string; amount: string }>;
  history: Array<{ date: string; concept: string; amount: string; invoice_url?: string }>;
  fiscal: { rfc?: string; razon_social?: string; uso_cfdi?: string; address?: string };
}

const FALLBACK: BillingData = {
  payment_method: { brand: "Visa", last4: "4242", exp: "08 / 27" },
  pending: [],
  history: [
    { date: "12 jun 2026", concept: "Suscripción Profesional", amount: "MXN 10,191" },
    { date: "12 may 2026", concept: "Suscripción Profesional", amount: "MXN 10,191" },
    { date: "28 abr 2026", concept: "Recarga de saldo", amount: "MXN 5,000" },
    { date: "12 abr 2026", concept: "Suscripción Profesional", amount: "MXN 10,191" },
  ],
  fiscal: {
    rfc: "XAXX010101000",
    razon_social: "Laboratorio Estándar SA de CV",
    uso_cfdi: "G03 — Gastos en general",
    address: "Av. Tecnológico 123, Col. Industrial, CP 32000",
  },
};

export default function FacturacionPage() {
  const token = useAuth((s) => s.token);
  const { data } = useQuery({
    queryKey: ["account-billing"],
    queryFn: () => api.get<BillingData>("/admin/account/billing", { token }),
    placeholderData: FALLBACK,
    retry: false,
  });
  const d = data ?? FALLBACK;

  return (
    <>
      <h1>Facturación</h1>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Método de pago</h2>
        {d.payment_method ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="pr-ic">{d.payment_method.brand.toUpperCase()}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>•••• {d.payment_method.last4}</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Vence {d.payment_method.exp}</div>
            </div>
            <button className="btn sec" style={{ marginLeft: "auto" }} type="button">
              Cambiar
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
            Sin método de pago — se configura en B9.1.
          </div>
        )}
      </div>

      {d.pending.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Facturas pendientes</h2>
          {d.pending.map((b, i) => (
            <div className="billrow" key={i}>
              <span className="bd">{b.date}</span>
              <span>{b.concept}</span>
              <span className="amt">{b.amount}</span>
              <button className="btn primary" type="button" style={{ height: 28, padding: "0 12px" }}>
                Pagar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Historial de cargos</h2>
        {d.history.map((b, i) => (
          <div className="billrow" key={i}>
            <span className="bd">{b.date}</span>
            <span>{b.concept}</span>
            <span className="amt">{b.amount}</span>
            <a href={b.invoice_url ?? "#"} aria-label={`Descargar factura ${b.date}`}>
              <Icon name="download" size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              PDF
            </a>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Datos fiscales</h2>
          <button className="btn sec" style={{ marginLeft: "auto", height: 30 }} type="button">
            Editar
          </button>
        </div>
        <div className="field">
          <label>RFC</label>
          <input defaultValue={d.fiscal.rfc} />
        </div>
        <div className="field">
          <label>Razón social</label>
          <input defaultValue={d.fiscal.razon_social} />
        </div>
        <div className="row2c">
          <div className="field">
            <label>Uso de CFDI</label>
            <input defaultValue={d.fiscal.uso_cfdi} />
          </div>
          <div className="field">
            <label>Dirección fiscal</label>
            <input defaultValue={d.fiscal.address} />
          </div>
        </div>
      </div>
    </>
  );
}
