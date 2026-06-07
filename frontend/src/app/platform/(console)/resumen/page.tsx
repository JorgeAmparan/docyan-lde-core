"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { AreaChart, BarChart, PrivacyNote, StateBlock } from "@/components/platform/atoms";
import {
  usePlatformApi, deriveEstado, daysUntil, fmtInt, fmtBytes,
  type PlatformSummary, type PlatformTrends, type OrgSummary, type JobSummary, type AccessCodeOut,
} from "@/lib/platform";

type Crit = { kind: "danger" | "warn" | "caution" | "info"; icon: string; n: number; label: string; detail: string; cta: string; to: string };

export default function ResumenPage() {
  const pf = usePlatformApi();
  const router = useRouter();

  const summary = useQuery({ queryKey: ["platform", "summary"], queryFn: () => pf.get<PlatformSummary>("/platform/metrics/summary"), enabled: !!pf.token });
  const trends = useQuery({ queryKey: ["platform", "trends"], queryFn: () => pf.get<PlatformTrends>("/platform/metrics/trends"), enabled: !!pf.token });
  const orgs = useQuery({ queryKey: ["platform", "orgs"], queryFn: () => pf.get<{ items: OrgSummary[] }>("/platform/orgs"), enabled: !!pf.token });
  const jobs = useQuery({ queryKey: ["platform", "jobs"], queryFn: () => pf.get<{ items: JobSummary[] }>("/platform/jobs"), enabled: !!pf.token });
  const codes = useQuery({ queryKey: ["platform", "codes"], queryFn: () => pf.get<{ items: AccessCodeOut[] }>("/platform/access-codes"), enabled: !!pf.token });

  if (summary.isLoading) return <StateBlock>Cargando resumen…</StateBlock>;
  if (summary.isError) return <StateBlock kind="error">No se pudo cargar el resumen de plataforma.</StateBlock>;
  const s = summary.data!;

  // ── Banda "Requiere acción": derivada de datos REALES (orgs + jobs + códigos) ──
  const orgList = orgs.data?.items ?? [];
  const enGracia = orgList.filter((o) => o.lifecycle_status === "grace");
  const suspendidas = orgList.filter((o) => o.lifecycle_status === "suspended");
  const freemiumPorExpirar = orgList.filter((o) => deriveEstado(o) === "freemium");
  const jobsError = (jobs.data?.items ?? []).filter((j) => j.status === "failed");
  const pilotosPorVencer = (codes.data?.items ?? []).filter((c) => {
    const d = daysUntil(c.expires_at);
    return c.status !== "revoked" && c.status !== "expired" && d !== null && d >= 0 && d <= 14;
  });

  const crit: Crit[] = [];
  if (suspendidas.length) crit.push({ kind: "danger", icon: "ban", n: suspendidas.length, label: "Organizaciones suspendidas", detail: "Acceso cortado por impago. Regulariza el cobro para reactivar.", cta: "Gestionar cobro", to: "/platform/ingresos" });
  if (enGracia.length) crit.push({ kind: "warn", icon: "alarm-clock", n: enGracia.length, label: "Organizaciones en gracia", detail: "Pago vencido dentro del periodo de gracia. Revisa el estado de cuenta.", cta: "Revisar cuenta", to: "/platform/ingresos" });
  if (jobsError.length) crit.push({ kind: "danger", icon: "x-octagon", n: jobsError.length, label: "Jobs de ingesta con error", detail: "Fallaron tras agotar reintentos. Revisa el motivo técnico y reencola.", cta: "Ver jobs", to: "/platform/jobs" });
  if (pilotosPorVencer.length) crit.push({ kind: "caution", icon: "flask-conical", n: pilotosPorVencer.length, label: "Pilotos próximos a vencer", detail: "Vencen en ≤14 días. Conviértelos antes de que expire el acceso.", cta: "Convertir piloto", to: "/platform/codigos" });
  if (freemiumPorExpirar.length) crit.push({ kind: "info", icon: "gift", n: freemiumPorExpirar.length, label: "Freemiums por expirar", detail: "Cuentas freemium llegando al límite. Oferta de upgrade.", cta: "Ofertar upgrade", to: "/platform/orgs" });

  const bytes = fmtBytes(s.almacenamiento_total_bytes);

  // Deltas reales desde las series (último vs penúltimo mes), cuando hay 2+ puntos.
  const orgSerie = trends.data?.orgs_acumuladas ?? [];
  const ingSerie = trends.data?.ingresos_por_mes ?? [];
  const conSerie = trends.data?.consultas_por_mes ?? [];
  const delta = (arr: { value: number }[]) =>
    arr.length >= 2 ? arr[arr.length - 1].value - arr[arr.length - 2].value : null;
  const orgDelta = delta(orgSerie);
  const ingDelta = delta(ingSerie);

  return (
    <>
      {/* ── Requiere acción ────────────────────────────────────────────────── */}
      {crit.length > 0 && (
        <>
          <div className="crit-head">
            <Icon name="siren" size={18} className="lic" />
            <span className="ct">Requiere acción</span>
            <span className="cs">estado crítico y oportunidades comerciales con fecha límite</span>
          </div>
          <div className="crit-grid">
            {crit.map((c, i) => (
              <div key={i} className={`crit-card k-${c.kind}`}>
                <div className="crit-ic"><Icon name={c.icon} size={16} /></div>
                <div className="crit-body">
                  <div className="crit-t"><span className="cn">{c.n}</span>{c.label}</div>
                  <div className="crit-d">{c.detail}</div>
                  <button className="crit-cta" onClick={() => router.push(c.to)}>
                    {c.cta} <Icon name="arrow-right" size={13} className="lic" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="psec"><span className="eb">Estado de plataforma</span></div>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-l"><Icon name="building-2" size={14} className="lic" /> Organizaciones</div>
          <div className="kpi-v">{fmtInt(s.total_orgs)}</div>
          <div className="kpi-foot">
            <span className="kpi-d">{orgDelta !== null && orgDelta !== 0 && <span className="up">{orgDelta > 0 ? "+" : ""}{orgDelta}</span>} este periodo</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Icon name="users" size={14} className="lic" /> Usuarios</div>
          <div className="kpi-v">{fmtInt(s.total_usuarios)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Icon name="hard-drive" size={14} className="lic" /> Almacenamiento</div>
          {bytes ? <div className="kpi-v">{bytes.value}<span className="u">{bytes.unit}</span></div> : <div className="kpi-v na">no disponible</div>}
          <div className="kpi-foot"><span className="kpi-d">metadata de peso · sin contenido</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Icon name="server" size={14} className="lic" /> Jobs activos</div>
          <div className="kpi-v">{fmtInt(s.jobs_activos)}</div>
          <div className="kpi-foot"><span className="kpi-d">procesando · en cola</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Icon name="banknote" size={14} className="lic" /> Ingresos</div>
          <div className="kpi-v">{fmtInt(s.ingresos_periodo)}<span className="u">{s.ingresos_moneda}</span></div>
          <div className="kpi-foot"><span className="kpi-d">{ingDelta !== null && ingDelta !== 0 && <span className="up">{ingDelta > 0 ? "+" : ""}{fmtInt(ingDelta)}</span>} registrados</span></div>
        </div>
      </div>

      {/* ── Tendencias (series reales) ─────────────────────────────────────── */}
      <div className="psec">
        <span className="eb">Tendencias</span>
        <button className="more" onClick={() => router.push("/platform/orgs")}>Ver organizaciones →</button>
      </div>
      <div className="trends">
        <div className="tcard">
          <div className="tcard-h"><span className="tcard-t">Crecimiento de organizaciones</span>
            <span className="tcard-v">{orgSerie.length ? fmtInt(orgSerie[orgSerie.length - 1].value) : "—"}</span></div>
          <AreaChart points={orgSerie} color="var(--success-600)" fill="var(--success-100)" />
        </div>
        <div className="tcard">
          <div className="tcard-h"><span className="tcard-t">Ingresos por mes</span>
            <span className="tcard-v">{ingSerie.length ? fmtInt(ingSerie[ingSerie.length - 1].value) : "—"}<span className="u">{trends.data?.moneda}</span></span></div>
          <BarChart points={ingSerie} color="var(--accent)" />
        </div>
        <div className="tcard">
          <div className="tcard-h"><span className="tcard-t">Consultas de plataforma</span>
            <span className="tcard-v">{conSerie.length ? fmtInt(conSerie[conSerie.length - 1].value) : "—"}</span></div>
          <AreaChart points={conSerie} color="var(--info-600)" fill="var(--info-100)" />
        </div>
      </div>

      <PrivacyNote>
        Todo lo que ves es metadata agregada (conteos, pesos, tiempos, ingresos). La
        consola del fundador nunca muestra contenido de documentos, consultas ni grafos.
      </PrivacyNote>
    </>
  );
}
