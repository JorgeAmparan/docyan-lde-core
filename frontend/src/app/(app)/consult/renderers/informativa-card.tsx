"use client";

import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitationChip } from "@/components/brand/citation-chip";
import { citaLabel, citaToSource, type InfoCardPayload } from "../consult-data";
import { SaveBtn } from "./save-btn";

/** Tipo 1 · Informativa — big value + unit + CitationChip, from the real payload. */
export function InformativaCard({
  payload,
  saved,
  onSave,
  onCite,
}: {
  payload: InfoCardPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
}) {
  const especs = payload.especificaciones ?? [];
  const primary = especs[0];
  const cita = primary?.cita ?? (payload.citas ?? [])[0] ?? null;
  const label = citaLabel(cita);
  const extras = especs.slice(1);

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>
      {primary && (primary.valor || primary.unidad) ? (
        <div className="big">
          {primary.valor ?? "—"}
          {primary.unidad ? <span className="u">{primary.unidad}</span> : null}
        </div>
      ) : null}
      {payload.definicion ? <p>{payload.definicion}</p> : null}

      {payload.match_multiple && (payload.desambiguacion ?? []).length > 0 && (
        <div className="ppe" style={{ marginTop: 8 }}>
          {(payload.desambiguacion ?? []).map((d, i) => (
            <span className="chip" key={i}>
              {d}
            </span>
          ))}
        </div>
      )}

      {extras.length > 0 && (
        <ol className="steps" style={{ marginTop: 8 }}>
          {extras.map((e, i) => (
            <li key={i}>
              <span className="st">
                {e.nombre}
                {e.valor ? `: ${e.valor}${e.unidad ? " " + e.unidad : ""}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="acard-foot">
        {label ? (
          <CitationChip label={label} onOpen={() => onCite(citaToSource(cita))} />
        ) : (
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Sin cita de fuente</span>
        )}
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
