"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { citaLabel, type Cita } from "../consult-data";
import { SaveBtn } from "./save-btn";

/**
 * CitedFragment — fila de cita del prototipo (`answers.jsx` → CitedFragment),
 * portada 1:1: `.citerow` (chip `.cite2` corner-bracket + `.openpdf` + `.savebtn`)
 * con el fragmento original revelado in situ (`.src`/`.src2`, abre solo tras 340ms).
 *
 * Integridad de cita (regla absoluta): el resaltado `<mark>` es SÓLO el verbatim
 * del documento (`cita.fragmento` = chunk[start:end]); sin span → "fragmento no
 * disponible" honesto, jamás texto generado. `onOpenDoc` abre el overlay (nivel 3).
 */
export function CitedFragment({
  cita,
  saved,
  onSave,
  onOpenDoc,
  emptyLabel = "Sin cita de fuente",
  lang,
}: {
  cita?: Cita | null;
  saved: boolean;
  onSave: () => void;
  onOpenDoc: () => void;
  emptyLabel?: string;
  /** Idioma del documento fuente (p.ej. "EN"); muestra el aviso bilingüe si ≠ ES. */
  lang?: string | null;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 340);
    return () => clearTimeout(id);
  }, []);

  const label = citaLabel(cita);

  if (!label || !cita) {
    return (
      <div className="citerow">
        <span className="cite-empty">{emptyLabel}</span>
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    );
  }

  const verbatim = cita.fragmento?.trim();
  const pagina = cita.pagina;

  return (
    <>
      <div className="citerow">
        <button
          type="button"
          className="cite2"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Ver fragmento citado: ${label}`}
        >
          <span className="brk" aria-hidden="true" />
          <span className="cite-lbl">{label}</span>
          <span style={{ opacity: 0.6 }} aria-hidden="true">
            {open ? " ▾" : " ↗"}
          </span>
        </button>
        <button type="button" className="openpdf" onClick={onOpenDoc}>
          <Icon name="external-link" size={13} />
          Abrir documento
        </button>
        <SaveBtn saved={saved} onSave={onSave} />
      </div>

      {open && (
        <div className="src" data-testid="cita-inline-fragment">
          <span className="thr" />
          <div className="src2">
            <div className="s-head">
              <Icon name="file-text" size={12} />
              <span>{verbatim ? "Fragmento original" : "Fragmento no disponible"}</span>
              {pagina != null && <span className="pg">p. {pagina}</span>}
            </div>
            <div className={"s-span" + (verbatim ? "" : " na")}>
              {verbatim ? (
                <mark>{verbatim}</mark>
              ) : (
                "Esta respuesta aún no tiene el span de caracteres del documento. Se muestra la procedencia, no texto generado."
              )}
            </div>
            {lang && lang.toUpperCase() !== "ES" && (
              <span className="s-orig">
                <Icon name="globe" size={11} />
                Documento original en {lang.toUpperCase()} · preguntaste en español
              </span>
            )}
            <div className="s-actions">
              <span className="s-ped">
                <Icon name="shield-check" size={12} />
                {verbatim
                  ? "Pedigree al fragmento exacto · SHA-256"
                  : "Procedencia al documento · sin span exacto"}
              </span>
              <button type="button" className="openpdf" onClick={onOpenDoc}>
                <Icon name="external-link" size={13} />
                Abrir documento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
