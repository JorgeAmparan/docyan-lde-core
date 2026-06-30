"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * Facturación — datos REALES del tenant (`GET /admin/account/billing`). Sin datos
 * enlatados (decisión rectora #11) ni el modelo muerto de saldo prepagado (P6,
 * Matriz de Cierre): si el backend no devuelve algo, se rinde un estado vacío
 * honesto, nunca un cargo/método de pago fabricado.
 */

interface BillingData {
  payment_method: { brand: string; last4: string; exp: string } | null;
  pending: Array<{ date: string; concept: string; amount: string }>;
  history: Array<{ date: string; concept: string; amount: string; invoice_url?: string }>;
  fiscal: { rfc?: string; razon_social?: string; uso_cfdi?: string; address?: string };
}

export default function FacturacionPage() {
  const token = useAuth((s) => s.token);
  const { data } = useQuery({
    queryKey: ["account-billing"],
    queryFn: () => api.get<BillingData>("/admin/account/billing", { token }),
    enabled: !!token,
    retry: false,
  });
  const pm = data?.payment_method ?? null;
  const pending = data?.pending ?? [];
  const history = data?.history ?? [];
  const fiscal = data?.fiscal ?? {};

  return (
    <>
      <h1>Facturación</h1>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Método de pago</h2>
        {pm ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="pr-ic">{pm.brand.toUpperCase()}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>•••• {pm.last4}</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Vence {pm.exp}</div>
            </div>
            <button className="btn sec" style={{ marginLeft: "auto" }} type="button">
              Cambiar
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
            Aún no hay un método de pago registrado.
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Facturas pendientes</h2>
          {pending.map((b, i) => (
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
        {history.length > 0 ? (
          history.map((b, i) => (
            <div className="billrow" key={i}>
              <span className="bd">{b.date}</span>
              <span>{b.concept}</span>
              <span className="amt">{b.amount}</span>
              <a href={b.invoice_url ?? "#"} aria-label={`Descargar factura ${b.date}`}>
                <Icon name="download" size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                PDF
              </a>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>Sin cargos registrados todavía.</div>
        )}
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
          <input defaultValue={fiscal.rfc ?? ""} placeholder="—" />
        </div>
        <div className="field">
          <label>Razón social</label>
          <input defaultValue={fiscal.razon_social ?? ""} placeholder="—" />
        </div>
        <div className="row2c">
          <div className="field">
            <label>Uso de CFDI</label>
            <input defaultValue={fiscal.uso_cfdi ?? ""} placeholder="—" />
          </div>
          <div className="field">
            <label>Dirección fiscal</label>
            <input defaultValue={fiscal.address ?? ""} placeholder="—" />
          </div>
        </div>
      </div>
    </>
  );
}
