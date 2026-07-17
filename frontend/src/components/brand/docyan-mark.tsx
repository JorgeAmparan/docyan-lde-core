/**
 * DOCYAN bracket-frame mark — the corner-bracket "span" motif that is also the
 * logo. Ported 1:1 from the design bundle (`ui_kits/pwa/atoms.jsx` → Mark).
 * `tone` selects ink (on light) vs light (on dark ink surfaces).
 */
export function DocyanMark({
  size = 26,
  tone = "ink",
  className,
}: {
  size?: number;
  tone?: "ink" | "light";
  className?: string;
}) {
  const stroke = tone === "light" ? "var(--amate-50)" : "var(--fg)";
  const dot = tone === "light" ? "#D9633F" : "#CF4124";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="DOCYAN"
      className={className}
    >
      <g
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 23 V13 H23" />
        <path d="M41 13 H51 V23" />
        <path d="M51 41 V51 H41" />
        <path d="M23 51 H13 V41" />
      </g>
      <rect x="25.5" y="25.5" width="13" height="13" rx="3" fill={dot} />
    </svg>
  );
}
