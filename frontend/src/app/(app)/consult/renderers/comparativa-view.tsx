"use client";

import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitedFragment } from "./cited-fragment";
import { citaToSource, type ComparativeViewPayload } from "../consult-data";

/** Tipo 8 · Comparativa — diferencias campo a campo del payload real. Campo sin
 *  valor izquierdo = alta (+); sin valor derecho = baja (−); ambos = cambio (~).
 *  Los cambios de seguridad (`es_cambio_seguridad`) se resumen en `.cmp-sum`. */
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
  const esVersiones = payload.estrategia === "versiones_documento";

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Comparativa"}</div>
      <div className="cmp-vers">
        <span className="ver old">
          {payload.referencia_izquierda}
          <small>{esVersiones ? "anterior" : "A"}</small>
        </span>
        <Icon name="arrow-right" size={15} />
        <span className="ver new">
          {payload.referencia_derecha}
          <small>{esVersiones ? "vigente" : "B"}</small>
        </span>
      </div>
      <ul className="diff">
        {difs.map((d, i) => {
          const kind =
            d.valor_izquierda == null ? "add" : d.valor_derecha == null ? "del" : "chg";
          const mark = kind === "add" ? "+" : kind === "del" ? "−" : "~";
          return (
            <li key={i} className={"d-" + kind}>
              <span className="dm">{mark}</span>
              {kind === "chg" ? (
                <span className="dt">
                  {d.campo}: <s>{d.valor_izquierda ?? "—"}</s> → <b>{d.valor_derecha ?? "—"}</b>
                </span>
              ) : kind === "add" ? (
                <span className="dt">
                  {d.campo}: <b>{d.valor_derecha ?? "—"}</b>
                </span>
              ) : (
                <span className="dt">
                  {d.campo}: <s>{d.valor_izquierda ?? "—"}</s>
                </span>
              )}
            </li>
          );
        })}
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
      <CitedFragment
        cita={cita}
        saved={saved}
        onSave={onSave}
        onOpenDoc={() => onCite(citaToSource(cita))}
      />
    </div>
  );
}
