/* DOCYAN PWA kit — shared atoms. Exposed on window for cross-file use. */
const { useState, useEffect, useRef, useCallback } = React;

/* Lucide icon, rendered imperatively so React reconciliation never fights
   lucide's DOM replacement. */
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

/* The DOCYAN bracket-frame mark. `tone` = ink|light. */
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

/* Citation pedigree chip — the signature object. */
function Cite({ label, onOpen }) {
  return (
    <button className="cite" onClick={onOpen}>
      <span className="brk" />{label} <span style={{ opacity: .6 }}>↗</span>
    </button>
  );
}

Object.assign(window, { Icon, Mark, Cite, useState, useEffect, useRef, useCallback });
