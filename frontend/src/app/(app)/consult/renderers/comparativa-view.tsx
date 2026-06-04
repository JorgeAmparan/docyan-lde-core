"use client";

import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import { SaveBtn } from "./save-btn";

/** Tipo 8 · Comparativa — old/new versions + `.diff` (+/−/~) + `.cmp-sum`
 *  executive summary + EDB insight. Ported from consult.jsx CompareAnswer. */
type Diff =
  | { k: "chg"; lab: string; from: string; to: string }
  | { k: "add" | "del"; text: string };

const DIFF: Diff[] = [
  { k: "chg", lab: "Torque del perno B", from: "80 N·m", to: "85 N·m" },
  { k: "add", text: "Etapa de apriete en cruz en 3 pasos (40 → 65 → 85)." },
  { k: "del", text: "Lubricación del perno antes del montaje." },
];

export function ComparativaView({ saved, onSave, onCite }: { saved: boolean; onSave: () => void; onCite: () => void }) {
  return (
    <div className="acard">
      <div className="q">Comparativa · Manual VF-2</div>
      <div className="cmp-vers">
        <span className="ver old">
          Rev. C<small>mar 2025</small>
        </span>
        <Icon name="arrow-right" size={15} />
        <span className="ver new">
          Rev. D<small>vigente</small>
        </span>
      </div>
      <ul className="diff">
        {DIFF.map((d, i) => (
          <li key={i} className={"d-" + d.k}>
            {d.k === "chg" ? (
              <>
                <span className="dm">~</span>
                <span className="dt">
                  {d.lab}: <s>{d.from}</s> → <b>{d.to}</b>
                </span>
              </>
            ) : (
              <>
                <span className="dm">{d.k === "add" ? "+" : "−"}</span>
                <span className="dt">{d.text}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="cmp-sum">
        <span className="cs-lab">Resumen</span>
        La Rev. D endurece el apriete del perno B y formaliza el patrón en cruz; elimina la lubricación previa.
      </div>
      <div className="patterns slim">
        <div className="ph">
          <Icon name="sparkles" size={15} />
          Insight
        </div>
        <p>3 consultas usaron el valor antiguo (80 N·m) esta semana. DOCYAN sugiere notificar al turno.</p>
      </div>
      <div className="acard-foot">
        <CitationChip label="VF-2 · §4.2.1 · Δ rev." onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
