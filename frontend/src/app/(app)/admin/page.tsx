"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { listCodos, getCuenta, type CodoOut, type CuentaResumen } from "@/lib/onboarding";

/**
 * Resumen general (home admin) — portado pixel-perfect del prototipo
 * `docs/DOCYAN LDE — Design System/app/resumen.jsx` (`ResumenView`).
 *
 * Cableado a datos reales:
 *  - CoDos activos + documentos vivos + tarjetas → `GET /mo/codos` (CodoOut).
 *  - Hit-rate / costo / latencia caché → `GET /admin/pcl/metrics`.
 *  - Cupo de ingestas → `GET /onboarding/cuenta` (CuentaResumen).
 *  - Cadena criptográfica FAT → `GET /admin/fat/integrity`.
 * Donde el prototipo muestra un dato sin fuente real (consultas/colaboradores por
 * CoDo, delta de hit-rate), se mantiene la estructura visual y se rinde honesto
 * («—») en vez de fabricar un número. Los «Patrones detectados» son contenido de
 * diseño del prototipo (no hay endpoint de patrones que case con su copy).
 */

interface PclMetrics {
  hit_rate: number; // 0..1
  cost_per_query: number; // USD
  latency_p50_ms: number;
  latency_p95_ms: number;
}

// Patrones detectados — contenido del prototipo (sin fuente backend que case con
// su copy). Línea de seguridad: observaciones administrativas/de frecuencia, nunca
// instrucciones operativas o clínicas.
const PATTERNS: Array<[string, string, string]> = [
  ["repeat", "3 colaboradores repiten la misma secuencia de arranque en la MAXI-10ND", "Sugerencia de Playbook · últimos 14 días"],
  ["message-square", "Las consultas de calibración suben antes de cada auditoría", "Patrón estacional · CODO-LAB-04"],
  ["file-warning", "2 personas anotaron holgura en el mismo acople", "Observación recurrente · 30 días"],
];

// Ícono por tipo de CoDo (mismo vocabulario del prototipo).
function codoIcon(c: CodoOut): string {
  const t = (c.tipo_documento ?? c.tipo ?? "").toLowerCase();
  if (t.includes("centrif") || t.includes("rotor")) return "disc-3";
  if (t.includes("cnc") || t.includes("maquin")) return "cog";
  if (t.includes("mezcl") || t.includes("concret")) return "blend";
  return "folder";
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function ResumenPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const { data: codosData } = useQuery({
    queryKey: ["codos"],
    queryFn: () => listCodos(token as string),
    enabled: !!token,
    retry: false,
  });
  const codos: CodoOut[] = codosData?.items ?? [];
  const docsVivos = codos.reduce((acc, c) => acc + (c.documentos ?? 0), 0);

  const { data: cuenta } = useQuery<CuentaResumen>({
    queryKey: ["cuenta"],
    queryFn: () => getCuenta(token as string),
    enabled: !!token,
    retry: false,
  });

  const { data: pcl } = useQuery<PclMetrics>({
    queryKey: ["pcl-metrics"],
    queryFn: () => api.get<PclMetrics>("/admin/pcl/metrics", { token }),
    enabled: !!token,
    retry: false,
  });

  const [verified, setVerified] = useState<string | null>(null);
  const verify = useMutation({
    mutationFn: () => api.get<{ integro: boolean; eventos: number }>("/admin/fat/integrity", { token }),
    onSuccess: (r) =>
      setVerified(`SHA-256 · ${r.integro ? "íntegra" : "ALTERADA"} · ${r.eventos.toLocaleString("es-MX")} eventos`),
  });

  // Cupo de ingestas (datos reales del plan). doc_limit = cupo del ciclo.
  const docLimit = cuenta?.doc_limit ?? null;
  const docsUsados = cuenta?.docs_usados ?? 0;
  const restante = cuenta?.docs_disponibles ?? (docLimit != null ? Math.max(0, docLimit - docsUsados) : null);
  const cupoPct = docLimit ? Math.round((100 * docsUsados) / docLimit) : 0;
  const planNombre = cuenta?.plan_nombre ?? "tu plan";

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="sl">
            <Icon name="folder" size={12} />
            CoDos activos
          </div>
          <div className="sv">{codos.length}</div>
          <div className="sd">{docsVivos} documentos vivos</div>
        </div>
        <div className="stat">
          <div className="sl">
            <Icon name="zap" size={12} />
            Hit-rate caché
          </div>
          <div className="sv">{pcl?.hit_rate != null ? pct(pcl.hit_rate) : "—"}</div>
          <div className="sd">consultas resueltas de caché</div>
        </div>
        <div className="stat">
          <div className="sl">
            <Icon name="coins" size={12} />
            Costo / consulta
          </div>
          <div className="sv">
            {pcl?.cost_per_query != null ? `$${pcl.cost_per_query.toFixed(3)}` : "—"}
          </div>
          <div className="sd">promedio 30 días</div>
        </div>
        <div className="stat">
          <div className="sl">
            <Icon name="timer" size={12} />
            Latencia P95
          </div>
          <div className="sv">
            {pcl?.latency_p95_ms != null ? `${(pcl.latency_p95_ms / 1000).toFixed(1)}s` : "—"}
          </div>
          <div className="sd">
            P50 · {pcl?.latency_p50_ms != null ? `${(pcl.latency_p50_ms / 1000).toFixed(1)}s` : "—"}
          </div>
        </div>
      </div>

      <div className="sec-h">
        <h2>CoDos</h2>
        <span className="more" onClick={() => router.push("/admin/codos")}>
          Ver todos →
        </span>
      </div>
      <div className="codo-grid" style={{ marginBottom: 22 }}>
        {codos.slice(0, 2).map((c) => (
          <div key={c.id} className="codo-card" onClick={() => router.push(`/admin/codos/${c.id}`)}>
            <div className="ch">
              <span className="ci">
                <Icon name={codoIcon(c)} size={21} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="cid">{c.id}</div>
                <div className="cn">{c.nombre}</div>
              </div>
              {c.estado === "warn" ? (
                <span className="badge warn">
                  <Icon name="alarm-clock" size={12} />
                  {c.alertas} {c.alertas === 1 ? "alerta" : "alertas"}
                </span>
              ) : (
                <span className="badge ok">
                  <Icon name="check" size={12} />
                  Al día
                </span>
              )}
            </div>
            <div className="crow">
              <div className="cstat">
                <div className="cv">{c.documentos}</div>
                <div className="cl">docs vivos</div>
              </div>
              <div className="cstat">
                <div className="cv">—</div>
                <div className="cl">consultas / 30d</div>
              </div>
              <div className="cstat">
                <div className="cv">—</div>
                <div className="cl">colaboradores</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="two">
        <div className="panel">
          <div className="sec-h">
            <h2>Patrones detectados</h2>
          </div>
          {PATTERNS.map((p, i) => (
            <div className="pattern" key={i}>
              <div className="pic">
                <Icon name={p[0]} size={16} />
              </div>
              <div>
                <div className="pt">{p[1]}</div>
                <div className="pm">{p[2]}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="sec-h">
            <h2>Cupo de ingestas</h2>
            <span className="more" onClick={() => router.push("/admin/ingesta")}>
              Ir a ingesta →
            </span>
          </div>
          <div className="bal-row">
            <span className="bv">{restante ?? "—"}</span>
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              {docLimit != null ? `de ${docLimit} incluidas este mes` : "incluidas este mes"}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${cupoPct}%` }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 7 }}>
            Plan {planNombre} · adicionales desde $15, cotizados antes de cobrar
          </div>
          <div className="chain">
            <div className="ci2">
              <Icon name="shield-check" size={18} />
            </div>
            <div>
              <div className="ct">Cadena criptográfica</div>
              <div className="cm">{verified ?? "FAT · SHA-256"}</div>
            </div>
            <button onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? "Verificando…" : verified ? "✓ Verificada" : "Verificar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
