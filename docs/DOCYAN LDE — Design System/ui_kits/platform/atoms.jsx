/* DOCYAN — Consola del fundador. Átomos compartidos + gráficas a mano. */
const { useState, useEffect, useRef, useMemo } = React;

/* Lucide icon, rendered imperatively. */
function Icon({ name, size = 18, color, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    el.appendChild(i);
    try { window.lucide.createIcons({ icons: window.lucide.icons, attrs: {} }); }
    catch (e) { window.lucide.createIcons(); }
  }, [name]);
  return <span className="lic" ref={ref} style={{ width: size, height: size, color, ...style }} />;
}

/* DOCYAN bracket-frame mark. tone = ink|light. */
function Mark({ size = 26, tone = "ink" }) {
  const stroke = tone === "light" ? "var(--amate-50)" : "var(--fg)";
  const dot = tone === "light" ? "#D9633F" : "#CF4124";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="DOCYAN">
      <g stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 23 V13 H23" /><path d="M41 13 H51 V23" />
        <path d="M51 41 V51 H41" /><path d="M23 51 H13 V41" />
      </g>
      <rect x="25.5" y="25.5" width="13" height="13" rx="3" fill={dot} />
    </svg>
  );
}

/* Generic tone badge (dot + icon + text — never color alone, WCAG). */
function Badge({ tone = "muted", icon, children, soft = true }) {
  return (
    <span className={"pbadge t-" + tone + (soft ? " soft" : "")}>
      {icon ? <Icon name={icon} size={12} /> : <span className="pdot" />}
      {children}
    </span>
  );
}

/* Lifecycle status badge for an org. Shows días restantes for piloto/freemium/gracia. */
function StatusBadge({ estado, dias }) {
  const m = LIFECYCLE[estado] || LIFECYCLE.activa;
  const showDays = (estado === "piloto" || estado === "freemium" || estado === "gracia") && dias != null;
  return (
    <span className={"pbadge t-" + m.tone + " soft"}>
      <Icon name={m.icon} size={12} />
      {m.label}
      {showDays && <span className="bdays mono">{dias}d</span>}
    </span>
  );
}

/* Plan tag. */
function PlanTag({ plan }) {
  const m = PLANS[plan] || PLANS.Esencial;
  return <span className={"plan-tag pt-" + m.tone}>{plan}</span>;
}

/* ── Charts (hand-built with tokens) ─────────────────────────────────────── */

/* Area + line chart over a small series. */
function AreaChart({ data, w = 560, h = 132, pad = 6, color = "var(--accent)", fill = "var(--accent-weak)", labels, fmt }) {
  const max = Math.max(...data) * 1.08, min = Math.min(...data) * 0.92;
  const n = data.length;
  const px = (i) => pad + (i * (w - pad * 2)) / (n - 1);
  const py = (v) => h - pad - 18 - ((v - min) / (max - min || 1)) * (h - pad * 2 - 18);
  const pts = data.map((v, i) => [px(i), py(v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${px(n - 1).toFixed(1)} ${(h - pad - 18).toFixed(1)} L ${px(0).toFixed(1)} ${(h - pad - 18).toFixed(1)} Z`;
  const last = data[n - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={(pad + (h - pad * 2 - 18) * g)} y2={(pad + (h - pad * 2 - 18) * g)} className="grid" />
      ))}
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === n - 1 ? 3.6 : 2.2} fill={i === n - 1 ? color : "var(--surface)"} stroke={color} strokeWidth="1.6" />)}
      {labels && labels.map((l, i) => <text key={i} x={px(i)} y={h - 4} className="clab" textAnchor="middle">{l}</text>)}
    </svg>
  );
}

/* Vertical bar chart. */
function BarChart({ data, w = 560, h = 132, pad = 6, color = "var(--accent)", labels, last }) {
  const max = Math.max(...data) * 1.08;
  const n = data.length;
  const gap = 14;
  const bw = (w - pad * 2 - gap * (n - 1)) / n;
  const bh = (v) => ((v / max) * (h - pad * 2 - 18));
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={(pad + (h - pad * 2 - 18) * g)} y2={(pad + (h - pad * 2 - 18) * g)} className="grid" />
      ))}
      {data.map((v, i) => {
        const x = pad + i * (bw + gap), by = h - pad - 18 - bh(v);
        const on = i === n - 1;
        return <rect key={i} x={x} y={by} width={bw} height={bh(v)} rx="3" fill={on ? color : "var(--amate-300)"} />;
      })}
      {labels && labels.map((l, i) => <text key={i} x={pad + i * (bw + gap) + bw / 2} y={h - 4} className="clab" textAnchor="middle">{l}</text>)}
    </svg>
  );
}

/* Tiny sparkline (no axes) for KPI cards. */
function Spark({ data, w = 96, h = 30, color = "var(--success-600)" }) {
  const max = Math.max(...data), min = Math.min(...data);
  const n = data.length;
  const px = (i) => (i * w) / (n - 1);
  const py = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const line = data.map((v, i) => (i ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1)).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

Object.assign(window, {
  Icon, Mark, Badge, StatusBadge, PlanTag, AreaChart, BarChart, Spark,
  useState, useEffect, useRef, useMemo,
});
