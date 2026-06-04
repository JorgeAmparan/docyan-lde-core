"use client";

import { CitationChip } from "@/components/brand/citation-chip";
import type { InfoAnswerData } from "../consult-data";
import { SaveBtn } from "./save-btn";

/** Tipo 1 · Informativa — big value + unit + CitationChip. Ported from consult.jsx InfoAnswer. */
export function InformativaCard({
  a,
  saved,
  onSave,
  onCite,
}: {
  a: InfoAnswerData;
  saved: boolean;
  onSave: () => void;
  onCite: () => void;
}) {
  return (
    <div className="acard">
      <div className="q">{a.q}</div>
      <div className="big">
        {a.value}
        <span className="u">{a.unit}</span>
      </div>
      <p>{a.note}</p>
      <div className="acard-foot">
        <CitationChip label={a.cite} onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
