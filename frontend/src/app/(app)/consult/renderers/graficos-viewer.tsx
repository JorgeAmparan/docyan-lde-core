"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import { SaveBtn } from "./save-btn";

/** Tipo 3 · Gráficos / Diagramas. Numbered pins over a striped placeholder synced
 *  with a legend; clicking a pin highlights its legend item and vice-versa.
 *  Ported from consult.jsx DiagramAnswer. */
const DIAG_PINS: Array<{ n: number; x: number; y: number; label: string; note: string }> = [
  { n: 1, x: 33, y: 26, label: "Tapa del rotor", note: "Cierre de bayoneta. Alinear la marca con el punto antes de girar." },
  { n: 2, x: 58, y: 47, label: "Rotor de ángulo fijo", note: "6 × 50 ml. No exceder el desbalance máximo de carga." },
  { n: 3, x: 44, y: 72, label: "Acople motor-eje", note: "Inspeccionar ante vibración (ver diagnóstico §3.5)." },
];

export function GraficosViewer({ saved, onSave, onCite }: { saved: boolean; onSave: () => void; onCite: () => void }) {
  const [active, setActive] = useState<number | null>(null);
  const toggle = (n: number) => setActive(active === n ? null : n);
  return (
    <div className="acard">
      <div className="q">Diagrama · rotor y cabezal</div>
      <div className="diag-img">
        <span className="ph-tag">DIAGRAMA TÉCNICO · DROP IMAGE</span>
        {DIAG_PINS.map((p) => (
          <button
            key={p.n}
            type="button"
            className={"pin" + (active === p.n ? " on" : "")}
            style={{ left: p.x + "%", top: p.y + "%" }}
            onClick={() => toggle(p.n)}
            aria-label={p.label}
          >
            {p.n}
          </button>
        ))}
        <span className="diag-zoom">
          <Icon name="zoom-in" size={14} />
          Pellizca para acercar
        </span>
      </div>
      <ol className="legend">
        {DIAG_PINS.map((p) => (
          <li key={p.n} className={active === p.n ? "on" : ""} onClick={() => toggle(p.n)}>
            <span className="ln">{p.n}</span>
            <div className="lc">
              <span className="lt">{p.label}</span>
              {active === p.n && <span className="lnote">{p.note}</span>}
            </div>
            <Icon name="chevron-right" size={15} />
          </li>
        ))}
      </ol>
      <div className="acard-foot">
        <CitationChip label="Plano VF-2 · fig. 4" onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
