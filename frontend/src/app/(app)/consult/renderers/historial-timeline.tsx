"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

/** Tipo 6 · Historial — `.hist-filters` + `.timeline` + `.patterns` EDB card.
 *  Ported from consult.jsx HistoryAnswer. */
const HIST_F = ["Todo", "Esta semana", "Calibración", "Mantenimiento"];
const HIST_EV: Array<[string, string, string, string, number[]]> = [
  ["Hoy · 09:14", "Torque del perno B", "info", "gauge", [0, 1]],
  ["Ayer · 16:02", "Cambio del filtro de refrigerante", "guía", "wrench", [0, 1, 3]],
  ["12 may", "Vibración al arrancar — diagnóstico", "diagnóstico", "activity", [0]],
  ["08 may", "Calibración registrada · A. Ríos", "registro", "shield-check", [0, 2]],
];

export function HistorialTimeline({ onSave }: { saved: boolean; onSave: () => void }) {
  const [f, setF] = useState(0);
  const ev = HIST_EV.filter((e) => e[4].includes(f));
  return (
    <div className="acard">
      <div className="q">Historial · CODO-LAB-04</div>
      <div className="hist-filters">
        {HIST_F.map((l, i) => (
          <button type="button" key={i} className={f === i ? "on" : ""} onClick={() => setF(i)}>
            {l}
          </button>
        ))}
      </div>
      <ul className="timeline">
        {ev.map(([d, t, tag, ic], i) => (
          <li key={i}>
            <span className="dot">
              <Icon name={ic} size={13} />
            </span>
            <div className="tl-c">
              <span className="tl-d">{d}</span>
              <span className="tl-t">{t}</span>
              <span className="tl-tag">{tag}</span>
            </div>
          </li>
        ))}
        {ev.length === 0 && <li className="tl-empty">Sin registros para este filtro.</li>}
      </ul>
      <div className="patterns">
        <div className="ph">
          <Icon name="sparkles" size={15} />
          Patrones detectados
        </div>
        <p>
          Consultas el <strong>torque del perno B</strong> antes de cada arranque de turno. DOCYAN puede unir tus consultas recurrentes en un Playbook.
        </p>
        <button type="button" className="sug pat-cta" onClick={onSave}>
          <Icon name="git-branch" size={14} />
          Proponer Playbook
        </button>
      </div>
    </div>
  );
}
