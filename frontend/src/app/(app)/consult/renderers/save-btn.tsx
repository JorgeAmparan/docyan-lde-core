"use client";

import { Icon } from "@/components/icon";

/** Save-consulta button — `.save-btn`/`.saved`. Ported from consult.jsx SaveBtn. */
export function SaveBtn({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <button type="button" className={"save-btn" + (saved ? " saved" : "")} onClick={onSave}>
      <Icon name={saved ? "check" : "bookmark"} size={14} />
      {saved ? "Guardada" : "Guardar consulta"}
    </button>
  );
}
