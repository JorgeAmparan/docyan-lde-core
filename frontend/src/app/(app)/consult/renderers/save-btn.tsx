"use client";

import { Icon } from "@/components/icon";

/** Save-consulta button — `.savebtn`/`.on`. Portado 1:1 de answers.jsx SaveBtn. */
export function SaveBtn({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <button type="button" className={"savebtn" + (saved ? " on" : "")} onClick={onSave}>
      <Icon name={saved ? "check" : "bookmark"} size={14} />
      {saved ? "Guardada" : "Guardar"}
    </button>
  );
}
