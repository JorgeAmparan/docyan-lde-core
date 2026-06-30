"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { citaLabel, type Cita } from "../consult-data";

/**
 * CitaInline — divulgación de cita en TRES niveles (Sprint UI-2 §1.2.7):
 *   1) chip de pedigree  →  2) fragmento verbatim EN LÍNEA  →  3) abrir documento.
 *
 * Antes el chip saltaba directo al overlay (nivel 1 → 3). Aquí se intercala el
 * nivel 2: el fragmento se despliega in situ, como en el demo público
 * (`DemoAnswerCard`). Gemelo fiel de ese patrón — NO una tercera implementación:
 * misma estructura (cabecera · span con <mark> · pedigree + abrir), reusando el
 * chip de marca `.cite`. Integridad de cita (regla absoluta): el verbatim es SÓLO
 * `cita.fragmento` (= chunk[start:end]); sin span → "fragmento no disponible"
 * honesto, jamás texto generado. `onOpenDoc` abre el nivel 3 (overlay de fuente).
 */
export function CitaInline({
  cita,
  onOpenDoc,
  emptyLabel = "Sin cita de fuente",
}: {
  cita?: Cita | null;
  /** Nivel 3 — abre el documento/overlay en el span exacto. */
  onOpenDoc: () => void;
  /** Texto cuando no hay cita (cada tipo de respuesta usa el suyo). */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = citaLabel(cita);

  if (!label || !cita) {
    return <span className="cite-empty">{emptyLabel}</span>;
  }

  const verbatim = cita.fragmento?.trim();

  return (
    <span className="cite-inline">
      <button
        type="button"
        className={"cite" + (open ? " open" : "")}
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-label={`Ver fragmento citado: ${label}`}
      >
        <span className="brk" aria-hidden="true" />
        {label}{" "}
        <span style={{ opacity: 0.6 }} aria-hidden="true">
          {open ? "▾" : "↗"}
        </span>
      </button>

      {open && (
        <div className="ci-src" data-testid="cita-inline-fragment">
          {verbatim ? (
            <>
              <div className="ci-head">
                <Icon name="file-text" size={12} />
                <span>Fragmento original</span>
              </div>
              <div className="ci-span">
                <mark>{verbatim}</mark>
              </div>
            </>
          ) : (
            <>
              <div className="ci-head">
                <Icon name="file-text" size={12} />
                <span>Fragmento no disponible</span>
              </div>
              <div className="ci-span na">
                Esta respuesta aún no tiene el span de caracteres del documento. Se muestra la
                procedencia, no texto generado.
              </div>
            </>
          )}
          <div className="ci-actions">
            <span className="ci-ped">
              <Icon name="shield-check" size={12} />
              {verbatim ? "Pedigree al fragmento exacto · SHA-256" : "Procedencia al documento · sin span exacto"}
            </span>
            <button type="button" className="ci-open" onClick={onOpenDoc}>
              <Icon name="external-link" size={12} />
              Abrir documento
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
