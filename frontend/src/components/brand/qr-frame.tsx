"use client";

import { useMemo } from "react";
import { DocyanMark } from "./docyan-mark";

/**
 * The DOCYAN QR brand object — cinnabar corner-bracket frame + a discrete logo,
 * ported from `admin.css` (.qr-frame/.qb/.qr-grid/.qr-logo). The matrix is a
 * deterministic 21×21 pattern derived from `value` for the on-brand plate
 * preview; production print/download wires the real encoder via `/qr/generate`.
 */
function deterministicMatrix(value: string, n = 21): boolean[] {
  const cells: boolean[] = [];
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const finder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (finder(r, c)) {
        const lr = r % (n - 7 > r ? 7 : n);
        const lc = c % 7;
        const rr = r >= n - 7 ? r - (n - 7) : r;
        const cc = c >= n - 7 ? c - (n - 7) : c;
        const ringR = r >= n - 7 ? rr : lr;
        const ringC = c >= n - 7 ? cc : lc;
        const onRing = ringR === 0 || ringR === 6 || ringC === 0 || ringC === 6;
        const core = ringR >= 2 && ringR <= 4 && ringC >= 2 && ringC <= 4;
        cells.push(onRing || core);
      } else {
        h = (h ^ (r * 31 + c * 7)) >>> 0;
        h = Math.imul(h, 2654435761) >>> 0;
        cells.push((h & 0x40) !== 0);
      }
    }
  }
  return cells;
}

export function QrFrame({
  value = "docyan",
  size = 168,
  caption,
  showLogo = true,
}: {
  value?: string;
  size?: number;
  caption?: string;
  showLogo?: boolean;
}) {
  const cells = useMemo(() => deterministicMatrix(value), [value]);
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const logo = Math.round(size * 0.2);
  return (
    <div className="qr-plate">
      <div className="qr-frame" style={{ width: size, height: size, padding: pad }}>
        <span className="qb tl" />
        <span className="qb tr" />
        <span className="qb bl" />
        <span className="qb br" />
        <div className="qr-grid" style={{ width: inner, height: inner }} role="img" aria-label={`Código QR · ${value}`}>
          {cells.map((on, i) => (
            <span key={i} className={on ? "m on" : "m"} />
          ))}
        </div>
        {showLogo && (
          <div className="qr-logo" style={{ width: logo, height: logo, alignItems: "center", justifyContent: "center" }}>
            <DocyanMark size={Math.round(logo * 0.7)} />
          </div>
        )}
      </div>
      {caption && <div className="qr-cap">{caption}</div>}
    </div>
  );
}
