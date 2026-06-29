/* DOCYAN — shared parts: Icon, Mark, QR plate */
const { useState, useEffect, useRef } = React;

function Icon({ name, size = 18, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el || !window.lucide) return; el.innerHTML = "";
    const i = document.createElement("i"); i.setAttribute("data-lucide", name); el.appendChild(i);
    try { window.lucide.createIcons(); } catch (e) {}
  }, [name]);
  return <span className="lic" ref={ref} style={{ width: size, height: size, color }} />;
}

function Mark({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="DOCYAN" style={{ flex: "none" }}>
    <g stroke="var(--ink-900)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M13 23 V13 H23" /><path d="M41 13 H51 V23" /><path d="M51 41 V51 H41" /><path d="M23 51 H13 V41" /></g>
    <rect x="25.5" y="25.5" width="13" height="13" rx="3" fill="#CF4124" /></svg>;
}

function qrCells(seed) {
  const n = 21, on = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (fx, fy) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
    const isFinder = finder(0, 0) || finder(n - 7, 0) || finder(0, n - 7);
    if (isFinder) {
      const rx = x >= n - 7 ? x - (n - 7) : x, ry = y >= n - 7 ? y - (n - 7) : y;
      const cx = x < 7 ? x : rx, cy = y < 7 ? y : ry;
      const ring = cx === 0 || cx === 6 || cy === 0 || cy === 6, core = cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4;
      on.push(ring || core);
    } else on.push(((x * 73 + y * 151 + seed * 31 + x * y) % 7) < 3);
  }
  return on;
}
function QRPlate({ size = 188, seed = 7, label }) {
  const cells = qrCells(seed);
  return <div className="qr-plate" style={{ width: size + 36 }}>
    <div className="qr-frame" style={{ width: size, height: size }}>
      <span className="qb tl" /><span className="qb tr" /><span className="qb bl" /><span className="qb br" />
      <div className="qr-grid" style={{ width: size - 30, height: size - 30 }}>{cells.map((c, i) => <span key={i} className={c ? "m on" : "m"} />)}</div>
      <div className="qr-logo"><Mark size={Math.round(size * 0.15)} /></div>
    </div>
    {label && <div className="qr-cap">{label}</div>}
  </div>;
}

Object.assign(window, { Icon, Mark, QRPlate, qrCells });
