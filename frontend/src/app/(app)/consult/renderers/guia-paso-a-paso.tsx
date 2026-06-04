"use client";

import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import type { StepsAnswerData } from "../consult-data";
import { SaveBtn } from "./save-btn";

/**
 * Tipo 2 · Guía paso a paso — numbered `.steps` + `.ppe` chips + ANSI-Z535 `.warn`.
 * Ported from consult.jsx StepsAnswer. Warning uses the warn (warning) tone with
 * the triangle-alert icon — never danger red.
 */
export function GuiaPasoAPaso({
  a,
  saved,
  onSave,
  onCite,
}: {
  a: StepsAnswerData;
  saved: boolean;
  onSave: () => void;
  onCite: () => void;
}) {
  return (
    <div className="acard">
      <div className="q">{a.title}</div>
      <div className="ppe">
        {a.ppe.map(([ic, t], i) => (
          <span className="chip" key={i}>
            <Icon name={ic} size={13} />
            {t}
          </span>
        ))}
      </div>
      <ol className="steps">
        {a.steps.map((s, i) => (
          <li key={i}>
            <span className="st">{s}</span>
          </li>
        ))}
      </ol>
      <div className="warn">
        <Icon name="triangle-alert" size={16} />
        <div className="wt">
          <span className="wlab">{a.warn.lab}</span>
          {a.warn.text}
        </div>
      </div>
      <div className="acard-foot">
        <CitationChip label={a.cite} onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
