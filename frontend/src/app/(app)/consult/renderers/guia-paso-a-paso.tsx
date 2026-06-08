"use client";

import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitationChip } from "@/components/brand/citation-chip";
import { citaLabel, citaToSource, type ProcedureCardPayload } from "../consult-data";
import { SaveBtn } from "./save-btn";

/**
 * Tipo 2 · Guía paso a paso — numbered `.steps` + `.ppe` chips + ANSI-Z535 `.warn`,
 * from the real payload. Warning tone (triangle-alert) — never danger red.
 */
export function GuiaPasoAPaso({
  payload,
  saved,
  onSave,
  onCite,
}: {
  payload: ProcedureCardPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
}) {
  const pasos = payload.pasos ?? [];
  // EPP de-duplicado a nivel procedimiento (los pasos pueden repetirlo).
  const eppAll = Array.from(new Set(pasos.flatMap((p) => p.epp ?? [])));
  const advertencias = pasos.flatMap((p) => p.advertencias ?? []);
  const cita = (payload.citas ?? [])[0] ?? pasos.find((p) => p.cita)?.cita ?? null;
  const label = citaLabel(cita);

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>
      {eppAll.length > 0 && (
        <div className="ppe">
          {eppAll.map((t, i) => (
            <span className="chip" key={i}>
              <Icon name="shield" size={13} />
              {t}
            </span>
          ))}
        </div>
      )}
      <ol className="steps">
        {pasos.map((p, i) => (
          <li key={i}>
            <span className="st">{p.descripcion}</span>
            {(p.herramientas ?? []).length > 0 && (
              <span className="lnote">Herramientas: {(p.herramientas ?? []).join(", ")}</span>
            )}
          </li>
        ))}
      </ol>
      {advertencias.length > 0 && (
        <div className="warn">
          <Icon name="triangle-alert" size={16} />
          <div className="wt">
            <span className="wlab">Advertencia</span>
            {advertencias.join(" ")}
          </div>
        </div>
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
