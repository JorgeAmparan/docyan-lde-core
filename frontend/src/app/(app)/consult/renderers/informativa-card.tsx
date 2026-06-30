"use client";

import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitedFragment } from "./cited-fragment";
import { citaToSource, type InfoCardPayload } from "../consult-data";

/** Tipo 1 · Informativa — big value + unit + nota, from the real payload. */
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
  const extras = especs.slice(1);

  const hasBig = !!primary && (!!primary.valor || !!primary.unidad);

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>
      {hasBig ? (
        <>
          <div className="big">
            {primary.valor ?? "—"}
            {primary.unidad ? <span className="u">{primary.unidad}</span> : null}
          </div>
          {payload.definicion ? <p className="note">{payload.definicion}</p> : null}
        </>
      ) : payload.definicion ? (
        <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>
          {payload.definicion}
        </p>
      ) : null}

      {payload.match_multiple && (payload.desambiguacion ?? []).length > 0 && (
        <div className="ppe">
          {(payload.desambiguacion ?? []).map((d, i) => (
            <span className="chip" key={i}>
              {d}
            </span>
          ))}
        </div>
      )}

      {extras.length > 0 && (
        <ol className="steps">
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

      <CitedFragment
        cita={cita}
        saved={saved}
        onSave={onSave}
        onOpenDoc={() => onCite(citaToSource(cita))}
      />
    </div>
  );
}
