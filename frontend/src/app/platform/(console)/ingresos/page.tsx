"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { PrivacyNote, StateBlock } from "@/components/platform/atoms";
import {
  usePlatformApi, fmtMoney, fmtDate,
  type PaymentOut, type OrgSummary, type BillingStatus,
} from "@/lib/platform";

// v2.1 (sin saldo prepagado): los ingresos son suscripción (plan) + setup del
// excedente de ingesta. No hay "recarga de saldo".
const CONCEPTOS = [
  { v: "suscripcion", label: "Suscripción" },
  { v: "setup", label: "Setup" },
];

export default function IngresosPage() {
  const pf = usePlatformApi();
  const qc = useQueryClient();

  const pagos = useQuery({ queryKey: ["platform", "payments"], queryFn: () => pf.get<{ items: PaymentOut[] }>("/platform/payments"), enabled: !!pf.token });
  const orgs = useQuery({ queryKey: ["platform", "orgs"], queryFn: () => pf.get<{ items: OrgSummary[] }>("/platform/orgs"), enabled: !!pf.token });

  const [org, setOrg] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [concepto, setConcepto] = useState("suscripcion");
  const [cuenta, setCuenta] = useState("");

  const registrar = useMutation({
    mutationFn: () => pf.post<PaymentOut>("/platform/payments", {
      org_id: org, monto: Number(monto), moneda, concepto,
    }),
    onSuccess: () => {
      setMonto("");
      qc.invalidateQueries({ queryKey: ["platform", "payments"] });
      qc.invalidateQueries({ queryKey: ["platform", "billing"] });
      toast.success("Pago registrado");
    },
    onError: () => toast.error("No se pudo registrar el pago"),
  });

  const billing = useQuery({
    queryKey: ["platform", "billing", cuenta],
    queryFn: () => pf.get<BillingStatus>(`/platform/orgs/${cuenta}/billing-status`),
    enabled: !!pf.token && !!cuenta,
  });

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of pagos.data?.items ?? []) t[p.moneda] = (t[p.moneda] ?? 0) + Number(p.monto);
    return t;
  }, [pagos.data]);

  if (pagos.isLoading) return <StateBlock>Cargando ingresos…</StateBlock>;
  if (pagos.isError) return <StateBlock kind="error">No se pudieron cargar los ingresos.</StateBlock>;

  const items = pagos.data?.items ?? [];
  const orgOptions = (orgs.data?.items ?? []).filter((o) => o.lifecycle_status !== "cancelled");
  const valid = !!org && !!monto && Number(monto) > 0;

  return (
    <>
      <div className="psec"><span className="eb">Ingresos registrados</span></div>
      <div className="kpis k3">
        <div className="kpi">
          <div className="kpi-l"><Icon name="banknote" size={14} className="lic" /> Registrado</div>
          <div className="kpi-v">{fmtMoney(totals["MXN"] ?? 0, "MXN")}</div>
          <div className="kpi-foot"><span className="kpi-d">{totals["USD"] ? `+ ${fmtMoney(totals["USD"], "USD")}` : ""} · {items.length} pagos</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Icon name="alarm-clock" size={14} className="lic" /> Saldo vencido</div>
          <div className="kpi-v na">no disponible</div>
          <div className="kpi-foot"><span className="kpi-d">requiere precios de plan (Stripe · F4)</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Icon name="repeat" size={14} className="lic" /> MRR estimado</div>
          <div className="kpi-v na">no disponible</div>
          <div className="kpi-foot"><span className="kpi-d">requiere precios de plan (Stripe · F4)</span></div>
        </div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div>
          <div className="psec" style={{ marginTop: 0 }}><h2>Historial de pagos</h2><span className="scount">{items.length}</span></div>
          <div className="ptbl-wrap">
            <table className="ptbl">
              <thead><tr><th>Fecha</th><th>Organización</th><th>Concepto</th><th className="num">Monto</th></tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="t-sub t-num">{fmtDate(p.fecha)}</td>
                    <td className="t-name">{p.org_id}</td>
                    <td className="t-sub">{p.concepto}{p.nota ? ` · ${p.nota}` : ""}</td>
                    <td className="num"><span className="t-num" style={{ fontWeight: 600 }}>{fmtMoney(p.monto, p.moneda)}</span></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={4}><div className="pstate">Sin pagos registrados todavía.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="psec" style={{ margin: "0 0 6px" }}><h2>Registrar pago manual</h2></div>
          <p className="panel-lead">Cobro manual durante el piloto. Queda en el historial y actualiza el estado de cuenta de la organización.</p>
          <div className="field">
            <label htmlFor="p-org">Organización</label>
            <select id="p-org" className="sel" value={org} onChange={(e) => setOrg(e.target.value)}>
              <option value="">Selecciona…</option>
              {orgOptions.map((o) => <option key={o.org_id} value={o.org_id}>{o.display_name ?? o.org_id}</option>)}
            </select>
          </div>
          <div className="frow">
            <div className="field">
              <label htmlFor="p-monto">Monto</label>
              <input id="p-monto" className="inp mono" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field">
              <label htmlFor="p-moneda">Moneda</label>
              <select id="p-moneda" className="sel" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="p-concepto">Concepto</label>
            <select id="p-concepto" className="sel" value={concepto} onChange={(e) => setConcepto(e.target.value)}>
              {CONCEPTOS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </div>
          <button className="pbtn primary full" disabled={!valid || registrar.isPending} onClick={() => registrar.mutate()}>
            <Icon name="plus" size={15} /> {registrar.isPending ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>

      <div className="psec"><h2>Estado de cuenta por organización</h2></div>
      <div className="field" style={{ maxWidth: 360 }}>
        <select className="sel" value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Organización (estado de cuenta)">
          <option value="">Selecciona una organización…</option>
          {(orgs.data?.items ?? []).map((o) => <option key={o.org_id} value={o.org_id}>{o.display_name ?? o.org_id}</option>)}
        </select>
      </div>
      {cuenta && billing.data && (
        <div className="acct-card" style={{ maxWidth: 520 }}>
          <div className="acct-row"><span className="al">Plan</span><span className="av">{billing.data.plan}</span></div>
          <div className="acct-row"><span className="al">Estado de ciclo de vida</span><span className="av">{billing.data.lifecycle_status}</span></div>
          <div className="acct-row"><span className="al">Próxima fecha de corte</span><span className="av">{fmtDate(billing.data.next_billing_date)}</span></div>
          <div className="acct-row"><span className="al">Pagos registrados</span><span className="av">{billing.data.pagos_registrados}</span></div>
          <div className="acct-row"><span className="al">Total pagado ({billing.data.moneda})</span><span className="av">{fmtMoney(billing.data.total_pagado, billing.data.moneda)}</span></div>
        </div>
      )}

      <PrivacyNote>Pagos, conceptos y estado de cuenta son datos administrativos. MRR queda en “no disponible” hasta que existan precios de plan (Stripe, F4) — no se inventa el número.</PrivacyNote>
    </>
  );
}
