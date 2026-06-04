/* DOCYAN commercial kit — shared atoms. */
const { useState, useEffect, useRef, useCallback } = React;

function Icon({ name, size = 18, color, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    el.appendChild(i);
    try { window.lucide.createIcons({ icons: window.lucide.icons }); } catch (e) { window.lucide.createIcons(); }
  }, [name]);
  return <span className="lic" ref={ref} style={{ width: size, height: size, color, ...style }} />;
}

function Mark({ size = 24, tone = "ink" }) {
  const stroke = tone === "light" ? "var(--amate-50)" : "var(--fg)";
  const dot = tone === "light" ? "#D9633F" : "#CF4124";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="DOCYAN">
      <g stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 23 V13 H23" /><path d="M41 13 H51 V23" /><path d="M51 41 V51 H41" /><path d="M23 51 H13 V41" />
      </g>
      <rect x="25.5" y="25.5" width="13" height="13" rx="3" fill={dot} />
    </svg>
  );
}

Object.assign(window, { Icon, Mark, useState, useEffect, useRef, useCallback });
