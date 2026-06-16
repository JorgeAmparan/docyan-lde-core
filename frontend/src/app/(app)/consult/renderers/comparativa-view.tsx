"use client";

import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitaInline } from "./cita-inline";
import { citaToSource, type ComparativeViewPayload } from "../consult-data";
import { SaveBtn } from "./save-btn";

/** Tipo 8 · Comparativa — diferencias campo a campo del payload real. Los cambios
 *  de seguridad (`es_cambio_seguridad`) se marcan; el resto como cambio normal. */
export function ComparativaView({
  payload,
  saved,
  onSave,
  onCite,
}: {
  payload: ComparativeViewPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
}) {
  const difs = payload.diferencias ?? [];
  const cita = (payload.citas ?? [])[0] ?? null;
  const seguridad = difs.filter((d) => d.es_cambio_seguridad).length;

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Comparativa"}</div>
      <div className="cmp-vers">
        <span className="ver old">
          {payload.referencia_izquierda}
          <small>{payload.estrategia === "versiones_documento" ? "izquierda" : "A"}</small>
        </span>
        <Icon name="arrow-right" size={15} />
        <span className="ver new">
          {payload.referencia_derecha}
          <small>{payload.estrategia === "versiones_documento" ? "derecha" : "B"}</small>
        </span>
      </div>
      <ul className="diff">
        {difs.map((d, i) => (
          <li key={i} className={"d-chg" + (d.es_cambio_seguridad ? " d-seg" : "")}>
            <span className="dm">{d.es_cambio_seguridad ? "⚠" : "~"}</span>
            <span className="dt">
              {d.campo}: <s>{d.valor_izquierda ?? "—"}</s> → <b>{d.valor_derecha ?? "—"}</b>
            </span>
          </li>
        ))}
        {difs.length === 0 && (
          <li className="d-chg">
            <span className="dt">Sin diferencias detectadas.</span>
          </li>
        )}
      </ul>
      {seguridad > 0 && (
        <div className="cmp-sum">
          <span className="cs-lab">Atención</span>
          {seguridad} cambio(s) marcados como relevantes para seguridad.
        </div>
      )}
      {payload.computo_asincrono && (
        <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>
          Comparación extensa: computándose en segundo plano.
        </p>
      )}
      <div className="acard-foot">
        <CitaInline cita={cita} onOpenDoc={() => onCite(citaToSource(cita))} emptyLabel="Comparativa de revisiones" />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
