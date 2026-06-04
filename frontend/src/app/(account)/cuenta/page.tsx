"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

interface AccountSummary {
  plan_name: string;
  billing_period: string;
  next_invoice_date: string;
  next_invoice_amount: string;
  usage: {
    docs: { used: number; limit: number };
    storage_gb: { used: number; limit: number };
    ingest_balance: { remaining_usd: number; total_usd: number };
  };
  recent: Array<{ date: string; concept: string; amount: string }>;
}

/** Canned fallback mirrors the design kit figures; replaced by the real GET when up. */
const FALLBACK: AccountSummary = {
  plan_name: "Plan Profesional",
  billing_period: "anual",
  next_invoice_date: "12 jul 2026",
  next_invoice_amount: "MXN 10,191/mes",
  usage: {
    docs: { used: 218, limit: 300 },
    storage_gb: { used: 12.4, limit: 20 },
    ingest_balance: { remaining_usd: 184, total_usd: 500 },
  },
  recent: [
    { date: "12 jun 2026", concept: "Suscripción Profesional", amount: "MXN 10,191" },
    { date: "12 may 2026", concept: "Suscripción Profesional", amount: "MXN 10,191" },
    { date: "28 abr 2026", concept: "Recarga de saldo", amount: "MXN 5,000" },
  ],
};

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function ResumenPage() {
  const token = useAuth((s) => s.token);

  const { data } = useQuery({
    queryKey: ["account-summary"],
    queryFn: () => api.get<AccountSummary>("/admin/account/summary", { token }),
    placeholderData: FALLBACK,
    retry: false,
  });

  const s = data ?? FALLBACK;
  const docsPct = pct(s.usage.docs.used, s.usage.docs.limit);
  const storagePct = pct(s.usage.storage_gb.used, s.usage.storage_gb.limit);
  const consumed = s.usage.ingest_balance.total_usd - s.usage.ingest_balance.remaining_usd;
  const balancePct = pct(s.usage.ingest_balance.remaining_usd, s.usage.ingest_balance.total_usd);
  const nearLimit = docsPct >= 85 || storagePct >= 85 || balancePct <= 15;

  return (
    <>
      <h1>Resumen de cuenta</h1>

      {nearLimit && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
            padding: 16,
            borderColor: "var(--warning-300, var(--border-strong))",
            background: "var(--warning-50, var(--amate-100))",
          }}
        >
          <Icon name="triangle-alert" size={20} color="var(--warning-600, var(--cinnabar-600))" />
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
            Estás cerca de un límite de tu plan. Considera subir de plan o recargar saldo de ingesta.
          </div>
          <Link href="/cuenta/recharge" className="btn sec" style={{ marginLeft: "auto" }}>
            Recargar
          </Link>
        </div>
      )}

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
          <Icon name="badge-check" size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {s.plan_name} · {s.billing_period}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Próxima factura: {s.next_invoice_date} · {s.next_invoice_amount}
          </div>
        </div>
        <Link href="/cuenta/facturacion" className="btn sec" style={{ marginLeft: "auto" }}>
          Cambiar plan
        </Link>
      </div>

      <div className="usage">
        <div className="ucard">
          <div className="ul">Documentos vivos</div>
          <div className="uv">
            {s.usage.docs.used} / {s.usage.docs.limit}
          </div>
          <div className="bar">
            <i style={{ width: `${docsPct}%` }} />
          </div>
          <div className="ud">{docsPct}% del plan usado</div>
        </div>
        <div className="ucard">
          <div className="ul">Almacenamiento</div>
          <div className="uv">
            {s.usage.storage_gb.used} / {s.usage.storage_gb.limit} GB
          </div>
          <div className="bar">
            <i style={{ width: `${storagePct}%` }} />
          </div>
          <div className="ud">{storagePct}% usado</div>
        </div>
        <div className="ucard">
          <div className="ul">Saldo de ingesta</div>
          <div className="uv">${s.usage.ingest_balance.remaining_usd} USD</div>
          <div className="bar">
            <i style={{ width: `${balancePct}%` }} />
          </div>
          <div className="ud">
            Consumido ${consumed} de ${s.usage.ingest_balance.total_usd}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Facturación reciente</h2>
          <Link
            href="/cuenta/facturacion"
            style={{ marginLeft: "auto", fontSize: 13, color: "var(--accent-fg)", fontWeight: 500 }}
          >
            Ver todo
          </Link>
        </div>
        {s.recent.map((b, i) => (
          <div className="billrow" key={i}>
            <span className="bd">{b.date}</span>
            <span>{b.concept}</span>
            <span className="amt">{b.amount}</span>
            <a href="#" aria-label={`Descargar factura ${b.date}`}>
              <Icon name="download" size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              PDF
            </a>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Icon name="wallet" size={20} color="var(--cinnabar-600)" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Recargar saldo de ingesta</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Presets: $50 · $100 · $250 · $500</div>
        </div>
        <Link href="/cuenta/recharge" className="btn primary" style={{ marginLeft: "auto" }}>
          Recargar
        </Link>
      </div>
    </>
  );
}
