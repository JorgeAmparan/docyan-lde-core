"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitationChip } from "@/components/brand/citation-chip";
import { citaLabel, citaToSource, type VideoPlayerPayload } from "../consult-data";
import { SaveBtn } from "./save-btn";

/** Tipo 4 · Video — recurso de apoyo (decisión B: no se analiza ni transcribe).
 *  Reproductor + capítulos del payload. Subtítulos solo si vienen en el par activo. */
function fmt(seg: number | null | undefined): string {
  const s = Math.max(0, Math.round(seg ?? 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function VideoPlayer({
  payload,
  saved,
  onSave,
  onCite,
}: {
  payload: VideoPlayerPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
}) {
  const capitulos = payload.capitulos ?? [];
  const subtitulos = payload.subtitulos ?? [];
  const [ch, setCh] = useState(0);
  const [tab, setTab] = useState<"cap" | "tr">("cap");
  const hasTranscript = !!payload.transcripcion || subtitulos.length > 0;
  const cita = (payload.citas ?? [])[0] ?? null;
  const label = citaLabel(cita);

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>
      <div className="vid-player">
        {payload.video_url ? (
          <video src={payload.video_url} controls style={{ width: "100%", borderRadius: 8 }} />
        ) : (
          <span className="ph-tag">VIDEO · recurso no disponible</span>
        )}
        {payload.subtitulos_disponibles_en_par_activo && (
          <span className="vid-cc">
            <Icon name="captions" size={13} />
            CC
          </span>
        )}
      </div>
      {(capitulos.length > 0 || hasTranscript) && (
        <div className="vid-tabs">
          <button type="button" className={tab === "cap" ? "on" : ""} onClick={() => setTab("cap")}>
            Capítulos
          </button>
          {hasTranscript && (
            <button type="button" className={tab === "tr" ? "on" : ""} onClick={() => setTab("tr")}>
              Transcripción
            </button>
          )}
        </div>
      )}
      {tab === "cap" && capitulos.length > 0 && (
        <ul className="chapters">
          {capitulos.map((c, i) => (
            <li key={i} className={ch === i ? "on" : ""} onClick={() => setCh(i)}>
              <span className="tc">{fmt(c.inicio_seg)}</span>
              <span className="cl">{c.titulo}</span>
              {ch === i && <Icon name="play" size={13} />}
            </li>
          ))}
        </ul>
      )}
      {tab === "tr" && hasTranscript && (
        <div className="transcript">
          {payload.transcripcion ? (
            <p>{payload.transcripcion}</p>
          ) : (
            subtitulos.map((s, i) => (
              <p key={i}>
                <span className="tc">{fmt(s.inicio_seg)}</span>
                {s.texto}
              </p>
            ))
          )}
        </div>
      )}
      <div className="acard-foot">
        {label ? (
          <CitationChip label={label} onOpen={() => onCite(citaToSource(cita))} />
        ) : (
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Recurso de apoyo</span>
        )}
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
