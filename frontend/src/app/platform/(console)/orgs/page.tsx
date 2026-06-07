"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { PlanTag, PrivacyNote, StateBlock, StatusBadge } from "@/components/platform/atoms";
import {
  usePlatformApi, deriveEstado, planClass, daysUntil, initials,
  fmtInt, fmtMoney, fmtBytes, fmtDate,
  type OrgEstado, type OrgSummary, type OrgMetrics, type BillingStatus, type AccessCodeOut,
} from "@/lib/platform";

const FILTERS: { key: "todas" | OrgEstado; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "activa", label: "Activas" },
  { key: "gracia", label: "Gracia" },
  { key: "suspendida", label: "Suspendidas" },
  { key: "piloto", label: "Pilotos" },
  { key: "freemium", label: "Freemium" },
  { key: "cancelada", label: "Canceladas" },
];

function minutos(seg?: number | null): string {
  if (seg === null || seg === undefined) return "—";
  if (seg < 60) return `${Math.round(seg)} s`;
  return `${(seg / 60).toFixed(1)} min`;
}

export default function OrgsPage() {
  const pf = usePlatformApi();
  const [filter, setFilter] = useState<"todas" | OrgEstado>("todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const orgs = useQuery({ queryKey: ["platform", "orgs"], queryFn: () => pf.get<{ items: OrgSummary[] }>("/platform/orgs"), enabled: !!pf.token });
  const codes = useQuery({ queryKey: ["platform", "codes"], queryFn: () => pf.get<{ items: AccessCodeOut[] }>("/platform/access-codes"), enabled: !!pf.token });

  // Mapa org→días restantes del piloto (vencimiento del código canjeado) — dato real.
  const pilotExpiry = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const c of codes.data?.items ?? []) {
      if (c.org_generada) m.set(c.org_generada, daysUntil(c.expires_at));
    }
    return m;
  }, [codes.data]);

  if (selected) return <OrgDetail orgId={selected} onBack={() => setSelected(null)} />;

  if (orgs.isLoading) return <StateBlock>Cargando organizaciones…</StateBlock>;
  if (orgs.isError) return <StateBlock kind="error">No se pudieron cargar las organizaciones.</StateBlock>;

  const all = orgs.data?.items ?? [];
  const withEstado = all.map((o) => ({ ...o, estado: deriveEstado(o) }));
  const counts: Record<string, number> = { todas: withEstado.length };
  for (const o of withEstado) counts[o.estado] = (counts[o.estado] ?? 0) + 1;

  const q = search.trim().toLowerCase();
  const rows = withEstado.filter((o) => {
    if (filter !== "todas" && o.estado !== filter) return false;
    if (!q) return true;
    return (o.display_name ?? "").toLowerCase().includes(q) || o.org_id.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`fpill${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>
            {f.label}<span className="fc">{counts[f.key] ?? 0}</span>
          </button>
        ))}
        <div className="fsearch">
          <Icon name="search" size={14} className="lic" />
          <input placeholder="Buscar org o ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar organización" />
        </div>
      </div>

      <div className="ptbl-wrap">
        <table className="ptbl">
          <thead>
            <tr>
              <th>Organización</th><th>Alta</th><th>Plan</th><th>Estado</th>
              <th className="num">Usuarios</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.org_id} className={`clik${o.estado === "cancelada" ? " dim" : ""}`} onClick={() => setSelected(o.org_id)}>
                <td>
                  <div className="t-name">{o.display_name ?? o.org_id}</div>
                  <div className="t-id">{o.org_id}</div>
                </td>
                <td className="t-sub">{fmtDate(o.created_at)}</td>
                <td><PlanTag plan={o.plan} cls={planClass(o.plan)} /></td>
                <td><StatusBadge estado={o.estado} dias={o.estado === "piloto" ? pilotExpiry.get(o.org_id) : undefined} /></td>
                <td className="num t-num">{fmtInt(o.users)}</td>
                <td className="chev-cell"><Icon name="chevron-right" size={16} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6}><div className="pstate">Ninguna organización en este filtro.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PrivacyNote>Conteos y estados administrativos por organización. Sin contenido de documentos, consultas ni grafos.</PrivacyNote>
    </>
  );
}

/* ── Detalle de organización (métricas reales por org) ─────────────────────── */
function OrgDetail({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const pf = usePlatformApi();
  const router = useRouter();
  const metrics = useQuery({ queryKey: ["platform", "org-metrics", orgId], queryFn: () => pf.get<OrgMetrics>(`/platform/orgs/${orgId}/metrics`), enabled: !!pf.token });
  const billing = useQuery({ queryKey: ["platform", "billing", orgId], queryFn: () => pf.get<BillingStatus>(`/platform/orgs/${orgId}/billing-status`), enabled: !!pf.token });

  if (metrics.isLoading) return <StateBlock>Cargando organización…</StateBlock>;
  if (metrics.isError || !metrics.data) return <StateBlock kind="error">No se pudieron cargar las métricas de la organización.</StateBlock>;

  const m = metrics.data;
  const b = billing.data;
  const estado = deriveEstado({ lifecycle_status: b?.lifecycle_status ?? "active", plan: b?.plan });
  const bytes = fmtBytes(m.almacenamiento_bytes);
  const cur = m.presupuesto?.moneda ?? "USD";
  const disponible = m.presupuesto?.saldo_actual_usd ?? null;
  const retenido = m.presupuesto?.retenido_usd ?? 0;
  const totalVivo = (disponible ?? 0) + (retenido ?? 0);
  const retPct = totalVivo > 0 ? Math.min(100, (retenido / totalVivo) * 100) : 0;

  return (
    <>
      <div className="back-row">
        <button className="linkbtn" onClick={onBack}><Icon name="arrow-left" size={15} /> Organizaciones</button>
      </div>

      <div className="od-head">
        <div className="od-mark">{initials(b?.org_id ?? orgId)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="od-name">{orgId}</div>
          <div className="od-meta">
            <span className="mid">{orgId}</span>
            <span className="sep">·</span>
            <PlanTag plan={b?.plan} cls={planClass(b?.plan)} />
            <StatusBadge estado={estado} />
          </div>
        </div>
        <div className="od-actions">
          <button className="pbtn ghost sm" onClick={() => router.push("/platform/ingresos")}><Icon name="receipt" size={14} /> Estado de cuenta</button>
          <button className="pbtn ghost sm" onClick={() => router.push("/platform/soporte")}><Icon name="life-buoy" size={14} /> Soporte</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <div className="ml"><Icon name="hard-drive" size={14} className="lic" /> Peso de almacenamiento</div>
          {bytes ? <div className="mv">{bytes.value}<span className="u">{bytes.unit}</span></div> : <div className="mv na">no disponible</div>}
          <div className="ms">{fmtInt(m.documentos_ingeridos)} documentos · metadata de peso</div>
        </div>
        <div className="metric">
          <div className="ml"><Icon name="files" size={14} className="lic" /> Documentos vivos</div>
          <div className="mv">{fmtInt(m.documentos_ingeridos)}</div>
          <div className="ms">{fmtInt(m.users)} usuarios con acceso</div>
        </div>
        <div className="metric">
          <div className="ml"><Icon name="timer" size={14} className="lic" /> Tiempo prom. de ingesta</div>
          {m.ingesta_tiempo_promedio_seg !== null && m.ingesta_tiempo_promedio_seg !== undefined
            ? <div className="mv">{minutos(m.ingesta_tiempo_promedio_seg)}</div>
            : <div className="mv na">no disponible</div>}
          <div className="ms">por documento · medido al ingerir</div>
        </div>
        <div className="metric">
          <div className="ml"><Icon name="activity" size={14} className="lic" /> Frecuencia de consultas</div>
          <div className="mv">{fmtInt(m.consultas_total)}</div>
          <div className="ms">consultas · frecuencia, no causa</div>
        </div>
      </div>

      <div className="split-bal" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="psec" style={{ margin: "0 0 10px" }}><h2>Saldo y consumo</h2></div>
          {disponible !== null ? (
            <>
              <div className="bal-row"><span className="bal-v">{fmtMoney(disponible, cur)}</span><span className="t-sub">disponibles</span></div>
              <div className="bar"><i className={retPct >= 75 ? "danger" : retPct >= 40 ? "warn" : ""} style={{ width: `${retPct}%` }} /></div>
              <div className="t-sub" style={{ marginTop: 8 }}>{fmtMoney(retenido, cur)} retenidos (reservas vivas) · {retPct.toFixed(0)}% del saldo vivo</div>
            </>
          ) : <div className="pstate">Sin presupuesto configurado para esta organización.</div>}
        </div>
        <div className="panel">
          <div className="psec" style={{ margin: "0 0 10px" }}><h2>Suscripción</h2></div>
          <div className="acct-row"><span className="al">Plan</span><span className="av">{b?.plan ?? "—"}</span></div>
          <div className="acct-row"><span className="al">Estado de ciclo de vida</span><span className="av"><StatusBadge estado={estado} /></span></div>
          <div className="acct-row"><span className="al">Próxima fecha de corte</span><span className="av">{fmtDate(b?.next_billing_date)}</span></div>
          <div className="acct-row"><span className="al">Pagado este periodo</span><span className="av">{fmtMoney(b?.total_pagado, b?.moneda ?? "MXN")}</span></div>
        </div>
      </div>

      <PrivacyNote>Métricas de peso, tiempo y frecuencia — metadata. La consola nunca abre el grafo ni los documentos de la organización.</PrivacyNote>
    </>
  );
}
