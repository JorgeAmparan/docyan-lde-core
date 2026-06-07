"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { Badge, PrivacyNote, StateBlock } from "@/components/platform/atoms";
import { usePlatformApi, JOB_STATE, PHASE_LABEL, fmtInt, type JobSummary } from "@/lib/platform";

function eta(j: JobSummary): string {
  if (j.status !== "processing" || !j.tiempo_estimado_seg) return "—";
  const rest = Math.max(0, j.tiempo_estimado_seg * (1 - (j.pct ?? 0) / 100));
  const m = Math.floor(rest / 60), s = Math.round(rest % 60);
  return `~${m}:${String(s).padStart(2, "0")}`;
}

export default function JobsPage() {
  const pf = usePlatformApi();
  const jobs = useQuery({
    queryKey: ["platform", "jobs"],
    queryFn: () => pf.get<{ items: JobSummary[] }>("/platform/jobs"),
    enabled: !!pf.token,
    refetchInterval: 5000, // "en vivo": polling cross-org
  });

  if (jobs.isLoading) return <StateBlock>Cargando jobs…</StateBlock>;
  if (jobs.isError) return <StateBlock kind="error">No se pudieron cargar los jobs de ingesta.</StateBlock>;

  const items = jobs.data?.items ?? [];
  const by = (st: string) => items.filter((j) => j.status === st).length;
  const kpis = [
    { icon: "loader", label: "Procesando", n: by("processing"), tone: "" },
    { icon: "list-ordered", label: "En cola", n: by("queued"), tone: "" },
    { icon: "x-octagon", label: "Con error", n: by("failed"), tone: by("failed") > 0 ? "danger" : "" },
    { icon: "circle-check", label: "Completados", n: by("completed"), tone: "" },
  ];

  return (
    <>
      <div className="psec">
        <h2>Jobs de ingesta</h2>
        <span className="more" style={{ pointerEvents: "none" }}>
          <span className="live-tag"><span className="live-dot" /> En vivo · cross-org</span>
        </span>
      </div>

      <div className="kpis k4">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-l"><Icon name={k.icon} size={14} className="lic" /> {k.label}</div>
            <div className="kpi-v" style={k.tone === "danger" ? { color: "var(--danger-600)" } : undefined}>{fmtInt(k.n)}</div>
          </div>
        ))}
      </div>

      <div className="ptbl-wrap" style={{ marginTop: 16 }}>
        <table className="ptbl">
          <thead>
            <tr><th>Job</th><th>Organización</th><th>Estado</th><th>Fase</th><th>Progreso</th><th>Tiempo est.</th></tr>
          </thead>
          <tbody>
            {items.map((j) => {
              const st = JOB_STATE[j.status] ?? { label: j.status, tone: "muted" as const, icon: "circle" };
              const done = j.status === "completed";
              return (
                <tr key={j.job_id} className={done ? "dim" : ""}>
                  <td>
                    <div className="t-name">{j.job_id}</div>
                    <div className="t-id">{j.nombre_archivo ?? "—"}</div>
                  </td>
                  <td className="t-name">{j.org_id}</td>
                  <td><Badge tone={st.tone} icon={st.icon}>{st.label}</Badge></td>
                  <td>
                    {j.status === "failed" && j.error ? (
                      // Motivo TÉCNICO (por qué falló), nunca el contenido del documento.
                      <span className="job-err"><Icon name="alert-triangle" size={12} /> {j.error}</span>
                    ) : j.phase ? (
                      <span className="phase-tag"><span className="pix" /> {PHASE_LABEL[j.phase] ?? j.phase}</span>
                    ) : <span className="t-sub">—</span>}
                  </td>
                  <td>
                    {j.status === "processing" || (j.pct ?? 0) > 0 ? (
                      <span className="job-bar"><i className={done ? "done" : j.status === "failed" ? "err" : ""} style={{ width: `${done ? 100 : (j.pct ?? 0)}%` }} /></span>
                    ) : j.status === "queued" ? <span className="t-sub">en cola</span> : <span className="t-sub">—</span>}
                  </td>
                  <td className="t-num">{eta(j)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6}><div className="pstate">No hay jobs de ingesta recientes.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PrivacyNote>
        Estado operativo cross-org: fase, progreso y motivo técnico de fallo. El motivo
        explica por qué falló el procesamiento (formato, OCR, tamaño), nunca qué decía el documento.
      </PrivacyNote>
    </>
  );
}
