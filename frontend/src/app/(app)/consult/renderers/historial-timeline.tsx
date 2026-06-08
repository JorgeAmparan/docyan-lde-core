"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import type { TimelinePayload } from "../consult-data";

/** Tipo 6 · Historial — timeline real (eventos + certificados + observaciones +
 *  mediciones) con patrones del EDB. Datos del payload, sin constantes locales. */
type Row = { ts: string; titulo: string; tag: string; icon: string };

const ICON_BY_TAG: Record<string, string> = {
  evento: "activity",
  certificado: "shield-check",
  observacion: "message-square",
  medicion: "gauge",
};

export function HistorialTimeline({
  payload,
  onSave,
}: {
  payload: TimelinePayload;
  saved: boolean;
  onSave: () => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    for (const e of payload.eventos ?? [])
      r.push({ ts: e.timestamp ?? "", titulo: e.descripcion, tag: "evento", icon: ICON_BY_TAG.evento });
    for (const c of payload.certificados_vigencia ?? [])
      r.push({ ts: c.timestamp ?? "", titulo: c.descripcion, tag: "certificado", icon: ICON_BY_TAG.certificado });
    for (const o of payload.observaciones ?? [])
      r.push({ ts: o.timestamp ?? "", titulo: o.descripcion, tag: "observacion", icon: ICON_BY_TAG.observacion });
    for (const m of payload.mediciones ?? [])
      r.push({ ts: m.timestamp ?? "", titulo: m.descripcion, tag: "medicion", icon: ICON_BY_TAG.medicion });
    return r.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [payload]);

  const tags = useMemo(() => ["Todo", ...Array.from(new Set(rows.map((r) => r.tag)))], [rows]);
  const [f, setF] = useState(0);
  const ev = f === 0 ? rows : rows.filter((r) => r.tag === tags[f]);

  const edb = payload.patrones_edb;
  const hasPatterns =
    !!edb &&
    ((edb.consultas_frecuentes ?? []).length > 0 ||
      (edb.problemas_recurrentes ?? []).length > 0 ||
      (edb.observaciones_acumuladas ?? []).length > 0);

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Historial"}</div>
      <div className="hist-filters">
        {tags.map((l, i) => (
          <button type="button" key={i} className={f === i ? "on" : ""} onClick={() => setF(i)}>
            {l}
          </button>
        ))}
      </div>
      <ul className="timeline">
        {ev.map((e, i) => (
          <li key={i}>
            <span className="dot">
              <Icon name={e.icon} size={13} />
            </span>
            <div className="tl-c">
              <span className="tl-d">{e.ts || "—"}</span>
              <span className="tl-t">{e.titulo}</span>
              <span className="tl-tag">{e.tag}</span>
            </div>
          </li>
        ))}
        {ev.length === 0 && <li className="tl-empty">Sin registros para este filtro.</li>}
      </ul>
      {hasPatterns && (
        <div className="patterns">
          <div className="ph">
            <Icon name="sparkles" size={15} />
            Patrones detectados
          </div>
          {(edb.consultas_frecuentes ?? []).length > 0 && (
            <p>
              Consultas frecuentes: <strong>{(edb.consultas_frecuentes ?? []).join(", ")}</strong>.
            </p>
          )}
          {(edb.problemas_recurrentes ?? []).length > 0 && (
            <p>Problemas recurrentes: {(edb.problemas_recurrentes ?? []).join(", ")}.</p>
          )}
          <button type="button" className="sug pat-cta" onClick={onSave}>
            <Icon name="git-branch" size={14} />
            Proponer Playbook
          </button>
        </div>
      )}
    </div>
  );
}
