"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitedFragment } from "./cited-fragment";
import { citaToSource, type DiagramViewerPayload } from "../consult-data";

/** Tipo 3 · Gráficos / Diagramas — etiquetas (pins x,y) sobre la imagen real del
 *  recurso, sincronizadas con la leyenda. Datos del payload (curación asistida). */
export function GraficosViewer({
  payload,
  saved,
  onSave,
  onCite,
}: {
  payload: DiagramViewerPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const toggle = (n: number) => setActive(active === n ? null : n);
  const etiquetas = payload.etiquetas ?? [];
  const leyenda = payload.leyenda_simbolica ?? [];
  const cita = (payload.citas ?? [])[0] ?? null;

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>
      <div
        className="diag-img"
        style={
          payload.recurso_url
            ? { backgroundImage: `url(${payload.recurso_url})`, backgroundSize: "cover" }
            : undefined
        }
      >
        {!payload.recurso_url && <span className="ph-tag">DIAGRAMA TÉCNICO · DROP IMAGE</span>}
        {etiquetas.map((p, i) => (
          <button
            key={i}
            type="button"
            className={"pin" + (active === i ? " on" : "")}
            style={{ left: (p.x ?? 0) * 100 + "%", top: (p.y ?? 0) * 100 + "%" }}
            onClick={() => toggle(i)}
            aria-label={p.texto}
          >
            {i + 1}
          </button>
        ))}
        <span className="diag-zoom">
          <Icon name="zoom-in" size={14} />
          Pellizca para acercar
        </span>
      </div>
      <ol className="legend">
        {etiquetas.map((p, i) => (
          <li key={i} className={active === i ? "on" : ""} onClick={() => toggle(i)}>
            <span className="ln">{i + 1}</span>
            <div className="lc">
              <span className="lt">{p.texto}</span>
              {p.lookup_dtm && active === i && <span className="lnote">{p.lookup_dtm}</span>}
            </div>
            <Icon name="chevron-right" size={15} />
          </li>
        ))}
      </ol>
      {leyenda.length > 0 && (
        <ul className="steps" style={{ marginTop: 8 }}>
          {leyenda.map((s, i) => (
            <li key={i}>
              <span className="st">
                <b>{s.simbolo}</b> — {s.significado}
              </span>
            </li>
          ))}
        </ul>
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
