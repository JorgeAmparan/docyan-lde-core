"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import { SaveBtn } from "./save-btn";

/** Tipo 4 · Video — player + scrubber + CC + Capítulos/Transcripción tabs, both
 *  timestamped. Ported from consult.jsx VideoAnswer. */
const VID_CH: Array<[string, string]> = [
  ["00:00", "Preparación y EPP"],
  ["01:12", "Extracción del rotor"],
  ["02:40", "Limpieza del eje"],
  ["03:55", "Montaje y balanceo"],
];
const VID_TR: Array<[string, string, boolean?]> = [
  ["02:40", "Con el rotor fuera, limpia el eje con un paño sin pelusa."],
  ["02:52", "Verifica que no queden residuos en el asiento cónico.", true],
  ["03:08", "Aplica una capa fina del lubricante indicado."],
];

export function VideoPlayer({ saved, onSave, onCite }: { saved: boolean; onSave: () => void; onCite: () => void }) {
  const [ch, setCh] = useState(2);
  const [tab, setTab] = useState<"cap" | "tr">("cap");
  return (
    <div className="acard">
      <div className="q">Video · montaje del rotor</div>
      <div className="vid-player">
        <span className="ph-tag">VIDEO · 04:30 · DROP CLIP</span>
        <button type="button" className="vid-play" aria-label="Reproducir">
          <Icon name="play" size={20} />
        </button>
        <div className="vid-scrub">
          <span style={{ width: "58%" }} />
        </div>
        <span className="vid-cc">
          <Icon name="captions" size={13} />
          CC · ES
        </span>
      </div>
      <div className="vid-tabs">
        <button type="button" className={tab === "cap" ? "on" : ""} onClick={() => setTab("cap")}>
          Capítulos
        </button>
        <button type="button" className={tab === "tr" ? "on" : ""} onClick={() => setTab("tr")}>
          Transcripción
        </button>
      </div>
      {tab === "cap" && (
        <ul className="chapters">
          {VID_CH.map(([t, l], i) => (
            <li key={i} className={ch === i ? "on" : ""} onClick={() => setCh(i)}>
              <span className="tc">{t}</span>
              <span className="cl">{l}</span>
              {ch === i && <Icon name="play" size={13} />}
            </li>
          ))}
        </ul>
      )}
      {tab === "tr" && (
        <div className="transcript">
          {VID_TR.map(([t, l, cur], i) => (
            <p key={i} className={cur ? "on" : ""}>
              <span className="tc">{t}</span>
              {l}
            </p>
          ))}
        </div>
      )}
      <div className="acard-foot">
        <CitationChip label="Capacitación VF-2 · cap. 3" onOpen={onCite} />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
