"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import {
  type OrgEstado,
  type Tone,
  ESTADO_META,
  monthLabel,
} from "@/lib/platform";

/* ── Tone badge (dot + texto; nunca solo color — regla AA) ─────────────────── */
export function Badge({
  tone = "muted",
  icon,
  dias,
  children,
}: {
  tone?: Tone;
  icon?: string;
  dias?: number | null;
  children: ReactNode;
}) {
  return (
    <span className={`pbadge soft t-${tone}`}>
      {icon ? <Icon name={icon} size={12} className="lic" /> : <span className="pdot" />}
      {children}
      {dias !== null && dias !== undefined && (
        <span className="bdays">{dias > 0 ? `${dias} d` : "vencido"}</span>
      )}
    </span>
  );
}

/* ── Badge de estado de ciclo de vida (6 estados) ──────────────────────────── */
export function StatusBadge({ estado, dias }: { estado: OrgEstado; dias?: number | null }) {
  const m = ESTADO_META[estado];
  return (
    <Badge tone={m.tone} icon={m.icon} dias={dias}>
      {m.label}
    </Badge>
  );
}

/* ── Plan tag ──────────────────────────────────────────────────────────────── */
export function PlanTag({ plan, cls }: { plan?: string | null; cls: string }) {
  return <span className={`plan-tag ${cls}`}>{plan ?? "—"}</span>;
}

/* ── Nota de privacidad (recordatorio: metadata, nunca contenido) ──────────── */
export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="privacy">
      <Icon name="shield-check" size={15} className="lic" />
      <span>{children}</span>
    </div>
  );
}

/* ── Bloques de estado (cargando / error / vacío) ──────────────────────────── */
export function StateBlock({ kind, children }: { kind?: "loading" | "error" | "empty"; children: ReactNode }) {
  return <div className={`pstate${kind === "error" ? " err" : ""}`}>{children}</div>;
}

/* ── Gráficas hechas a mano (SVG, sin dependencias) ────────────────────────── */
type Point = { label: string; value: number };

function bounds(points: Point[]) {
  const vals = points.map((p) => p.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  return { max, min, span: max - min || 1 };
}

export function AreaChart({ points, color = "var(--accent)", fill = "var(--accent-weak)" }: {
  points: Point[];
  color?: string;
  fill?: string;
}) {
  if (!points.length) return <div className="tcard-empty">Sin datos todavía</div>;
  const w = 560, h = 132, pad = 10, baseY = h - 18, topY = 10;
  const { min, span } = bounds(points);
  const n = points.length;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (v: number) => baseY - ((v - min) / span) * (baseY - topY);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${baseY} L${x(0).toFixed(1)},${baseY} Z`;
  const rows = [0, 0.5, 1];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img">
      {rows.map((r) => (
        <line key={r} className="grid" x1={pad} x2={w - pad} y1={topY + r * (baseY - topY)} y2={topY + r * (baseY - topY)} />
      ))}
      <path d={area} fill={fill} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <text key={i} className="clab" x={x(i)} y={h - 4} textAnchor="middle">{monthLabel(p.label)}</text>
      ))}
    </svg>
  );
}

export function BarChart({ points, color = "var(--accent)" }: { points: Point[]; color?: string }) {
  if (!points.length) return <div className="tcard-empty">Sin datos todavía</div>;
  const w = 560, h = 132, pad = 10, baseY = h - 18, topY = 10;
  const { max } = bounds(points);
  const n = points.length;
  const slot = (w - 2 * pad) / n;
  const bw = Math.min(slot * 0.6, 46);
  const y = (v: number) => baseY - (v / max) * (baseY - topY);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img">
      {[0, 0.5, 1].map((r) => (
        <line key={r} className="grid" x1={pad} x2={w - pad} y1={topY + r * (baseY - topY)} y2={topY + r * (baseY - topY)} />
      ))}
      {points.map((p, i) => {
        const cx = pad + slot * i + slot / 2;
        const yy = y(p.value);
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={yy} width={bw} height={Math.max(0, baseY - yy)} rx={3}
              fill={i === n - 1 ? color : "var(--amate-300)"} />
            <text className="clab" x={cx} y={h - 4} textAnchor="middle">{monthLabel(p.label)}</text>
          </g>
        );
      })}
    </svg>
  );
}
