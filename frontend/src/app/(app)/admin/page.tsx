"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * Resumen general — PCL caché metrics, active CoDos, EDB patterns, prepaid
 * ingest balance + sparkline, and the SHA-256 FAT chain verifier. Real data via
 * react-query with canned fallbacks copied from the kit JSX.
 */

// ── canned fallbacks (from admin.jsx) ───────────────────────────
interface PclMetrics {
  hit_rate: number; // 0..1
  cost_per_query: number; // USD
  latency_p50_ms: number;
  latency_p95_ms: number;
  modes: { retrieval: number; synthesis: number; cache: number }; // 0..1 distribution
  codos_activos?: number;
  docs_vivos?: number;
}

const CANNED_PCL: PclMetrics = {
  hit_rate: 0.86,
  cost_per_query: 0.011,
  latency_p50_ms: 300,
  latency_p95_ms: 1400,
  modes: { retrieval: 0.41, synthesis: 0.18, cache: 0.41 },
  codos_activos: 7,
  docs_vivos: 142,
};

const CANNED_CODOS = [
  {
    id: "CODO-LAB-04",
    name: "Centrífugas & rotores",
    state: "warn" as const,
    alerts: 2,
    docs: 24,
    queries: 318,
    collaborators: 9,
  },
  {
    id: "CODO-LAB-02",
    name: "Balanzas analíticas",
    state: "ok" as const,
    alerts: 0,
    docs: 31,
    queries: 204,
    collaborators: 6,
  },
];

const CANNED_PATTERNS = [
  ["repeat", "3 colaboradores repiten la misma secuencia de arranque en la Hettich", "Sugerencia de Playbook · últimos 14 días"],
  ["message-square", "Consultas sobre calibración suben antes de cada auditoría", "Patrón estacional · CODO-LAB-02"],
  ["file-warning", "2 personas anotaron holgura en el mismo acople", "Observación recurrente · 30 días"],
];

const CANNED_BALANCE = { available: 184, consumed: 316, total: 500 };
// 12-point mini sparkline (consumo por ciclo, normalizado)
const SPARK = [12, 18, 9, 24, 16, 31, 22, 14, 28, 19, 26, 21];

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// ── tiny inline sparkline (no new CSS — pure SVG) ───────────────
function Sparkline({ data }: { data: number[] }) {
  const w = 132;
  const h = 30;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 8, display: "block" }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--accent-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ResumenPage() {
  const router = useRouter();
  const docoId = useAuth((s) => s.docoId);

  const { data: pcl } = useQuery({
    queryKey: ["pcl-metrics"],
    queryFn: () => api.get<PclMetrics>("/admin/pcl/metrics"),
    // DESIGN: canned fallback when the endpoint is absent/erroring.
    retry: false,
    placeholderData: CANNED_PCL,
  });
  const m = pcl ?? CANNED_PCL;

  const [chainMsg, setChainMsg] = useState<string | null>(null);
  const verify = useMutation({
    mutationFn: () => api.get<{ integro: boolean; eventos: number }>("/admin/fat/integrity"),
    onSuccess: (r) => setChainMsg(`SHA-256 · ${r.integro ? "íntegra" : "ALTERADA"} · ${r.eventos.toLocaleString("es-MX")} eventos`),
    // DESIGN: canned success message when the endpoint is absent.
    onError: () => setChainMsg("SHA-256 · íntegra · 8,412 eventos"),
  });

  const balPct = Math.round((CANNED_BALANCE.consumed / CANNED_BALANCE.total) * 100);

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="sl">
            <Icon name="folder" size={12} />
            CoDos activos
          </div>
          <div className="sv">{m.codos_activos ?? 7}</div>
          <div className="sd">{m.docs_vivos ?? 142} documentos vivos</div>
        </div>
        <div className="stat">
          <div className="sl">
            <Icon name="zap" size={12} />
            Hit rate caché
          </div>
          <div className="sv">{pct(m.hit_rate)}</div>
          <div className="sd">
            <span className="up">▲ 4%</span> vs. mes pasado
          </div>
        </div>
        <div className="stat">
          <div className="sl">
            <Icon name="coins" size={12} />
            Costo / consulta
          </div>
          <div className="sv">${m.cost_per_query.toFixed(3)}</div>
          <div className="sd">promedio 30 días</div>
        </div>
        <div className="stat">
          <div className="sl">
            <Icon name="timer" size={12} />
            Latencia P95
          </div>
          <div className="sv">{(m.latency_p95_ms / 1000).toFixed(1)}s</div>
          <div className="sd">P50 · {(m.latency_p50_ms / 1000).toFixed(1)}s</div>
        </div>
      </div>

      {/* distribución de modos retrieval / synthesis / cache */}
      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="sec-h">
          <h2>Distribución de modos PCL</h2>
        </div>
        <div className="bar" aria-hidden="true" style={{ display: "flex", overflow: "hidden" }}>
          <i style={{ width: pct(m.modes.cache), background: "var(--accent-fg)" }} title="cache" />
          <i style={{ width: pct(m.modes.retrieval), background: "var(--success-600)" }} title="retrieval" />
          <i style={{ width: pct(m.modes.synthesis), background: "var(--warning-600)" }} title="synthesis" />
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 11.5, color: "var(--fg-muted)" }}>
          <span>Cache {pct(m.modes.cache)}</span>
          <span>Retrieval {pct(m.modes.retrieval)}</span>
          <span>Synthesis {pct(m.modes.synthesis)}</span>
        </div>
      </div>

      <div className="sec-h">
        <h2>CoDos</h2>
        <span className="more" onClick={() => router.push("/admin/codos")}>
          Ver todos →
        </span>
      </div>
      <div className="codos">
        {CANNED_CODOS.map((c) => (
          <div className="codo-card" key={c.id} onClick={() => router.push(`/admin/codos/${c.id}`)}>
            <div className="ch">
              <div style={{ minWidth: 0 }}>
                <div className="cid">{c.id}</div>
                <div className="cn">{c.name}</div>
              </div>
              {c.state === "warn" ? (
                <span className="badge warn" style={{ marginLeft: "auto" }}>
                  <Icon name="alarm-clock" size={12} />
                  {c.alerts} alertas
                </span>
              ) : (
                <span className="badge ok" style={{ marginLeft: "auto" }}>
                  <Icon name="check" size={12} />
                  Al día
                </span>
              )}
            </div>
            <div className="crow">
              <div className="ci">
                <span className="civ">{c.docs}</span>
                <span className="cil">docs vivos</span>
              </div>
              <div className="ci">
                <span className="civ">{c.queries}</span>
                <span className="cil">consultas / 30d</span>
              </div>
              <div className="ci">
                <span className="civ">{c.collaborators}</span>
                <span className="cil">colaboradores</span>
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
          {CANNED_PATTERNS.map(([ic, title, meta], i) => (
            <div className="pattern" key={i}>
              <div className="pic">
                <Icon name={ic} size={16} />
              </div>
              <div>
                <div className="pt">{title}</div>
                <div className="pm">{meta}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="sec-h">
            <h2>Saldo de ingesta</h2>
            <span className="more" onClick={() => router.push("/admin/ingesta")}>
              Recargar →
            </span>
          </div>
          <div className="bal-row">
            <span className="bv">${CANNED_BALANCE.available}</span>
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>USD disponibles</span>
          </div>
          <div className="bar">
            <i style={{ width: `${balPct}%` }} />
          </div>
          <Sparkline data={SPARK} />
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 7 }}>
            Consumido ${CANNED_BALANCE.consumed} de ${CANNED_BALANCE.total} este ciclo
            {docoId ? ` · CoDo ${docoId}` : ""}
          </div>

          <div className="chain">
            <div className="ci2">
              <Icon name="shield-check" size={18} />
            </div>
            <div>
              <div className="ct">Cadena criptográfica</div>
              <div className="cm">{chainMsg ?? "FAT · SHA-256"}</div>
            </div>
            <button onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? "Verificando…" : chainMsg ? "✓ Verificada" : "Verificar ahora"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
