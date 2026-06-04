"use client";

import { useState } from "react";
import { CitationChip } from "@/components/brand/citation-chip";
import { SaveBtn } from "./save-btn";

/**
 * Tipo 5 · Troubleshooting — interactive decision tree, one node at a time, with
 * decision history. State persists in the component. Ported & extended from
 * consult.jsx TroubleshootAnswer (added a visible decision-history trail).
 */
type NodeId = "root" | "vacio" | "carga";

const NODES: Record<
  NodeId,
  {
    question?: string;
    answer?: string;
    options?: Array<{ label: string; next: NodeId }>;
  }
> = {
  root: {
    question: "¿La vibración aparece solo en vacío o también con carga?",
    options: [
      { label: "Solo en vacío", next: "vacio" },
      { label: "También con carga", next: "carga" },
    ],
  },
  vacio: {
    answer:
      "Causa probable: desbalance del rotor. Revisa el asiento de los tubos y verifica que las masas estén pareadas antes de continuar.",
  },
  carga: {
    answer:
      "Causa probable: holgura en el acople motor-eje. Inspecciona el acople y el par de apriete de la base.",
  },
};

export function TroubleshootingTree({ saved, onSave, onCite }: { saved: boolean; onSave: () => void; onCite: () => void }) {
  const [node, setNode] = useState<NodeId>("root");
  const [trail, setTrail] = useState<string[]>([]);
  const cur = NODES[node];

  const choose = (label: string, next: NodeId) => {
    setTrail((t) => [...t, label]);
    setNode(next);
  };
  const reset = () => {
    setTrail([]);
    setNode("root");
  };

  return (
    <div className="acard">
      <div className="q">Diagnóstico · vibración al arrancar</div>

      {trail.length > 0 && (
        <div className="ppe" style={{ marginTop: 8 }}>
          {trail.map((t, i) => (
            <span className="chip" key={i}>
              {t}
            </span>
          ))}
        </div>
      )}

      {cur.question && (
        <>
          <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>{cur.question}</p>
          <div className="ppe" style={{ marginTop: 12, gap: 8 }}>
            {cur.options?.map((o) => (
              <button
                type="button"
                key={o.next}
                className="sug"
                style={{ background: "var(--surface)" }}
                onClick={() => choose(o.label, o.next)}
              >
                {o.label}
                <span className="ar">→</span>
              </button>
            ))}
          </div>
        </>
      )}

      {cur.answer && (
        <>
          <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>
            <strong>{cur.answer.split(":")[0]}:</strong>
            {cur.answer.slice(cur.answer.indexOf(":") + 1)}
          </p>
          <div className="ppe" style={{ marginTop: 12 }}>
            <button type="button" className="sug" style={{ background: "var(--surface)" }} onClick={reset}>
              Empezar de nuevo
              <span className="ar">↺</span>
            </button>
          </div>
        </>
      )}

      <div className="acard-foot">
        <CitationChip label="Guía de fallas · §3.5" onOpen={onCite} />
        {node !== "root" && <SaveBtn saved={saved} onSave={onSave} />}
      </div>
    </div>
  );
}
