"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";

/* DOCYAN sitio público v2 — tarjeta de respuesta UNIFICADA del demo (FLOW).
   Único render de consulta del sitio: lo usan el hero del index y los CoDos
   (/demo/[codo]). Estándar visual = el del hero (spec estructurada, valor
   prominente, cita con corner-bracket, fragmento verbatim inline). Ambas
   superficies viven bajo `.s2`, así que las clases del kit aplican igual.
   InfoCard (specs) + ProcedureCard (pasos numerados del manual). Integridad de
   cita: el verbatim es SOLO `cita.fragmento`; sin span → "fragmento no
   disponible" honesto, nunca texto generado. */

export interface DemoCardData {
  kind: "info" | "procedure" | "empty";
  // info_card
  value?: string;
  unit?: string;
  note?: string;
  extras?: { nombre?: string; valor?: string }[];
  // procedure_card
  titulo?: string;
  pasos?: { descripcion?: string; meta?: string }[];
  // cita (común)
  citeLabel?: string;
  page?: string | number | null;
  verbatim?: string | null;
  verbatimLang?: string | null;
  // fallback honesto (sin respuesta en el documento demo)
  fallback?: string;
}

export function DemoAnswerCard({ data, autoOpen = false }: { data: DemoCardData; autoOpen?: boolean }) {
  const t = useT();
  const [showSrc, setShowSrc] = useState(autoOpen);

  if (data.kind === "empty") {
    return (
      <div className="dc2-a">
        <div className="fa-mode dc-fallback-mode"><Icon name="info" size={14} />{t({ es: "Sin respuesta en este documento demo", en: "No answer in this demo document" })}</div>
        <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>{data.fallback}</p>
      </div>
    );
  }

  return (
    <div className="dc2-a">
      {data.kind === "procedure" ? (
        <>
          <div className="fa-mode"><span className="fa-pulse" />{t({ es: "Procedimiento citado al manual", en: "Procedure cited to the manual" })}</div>
          {data.titulo && <div className="fa-proc-t">{data.titulo}</div>}
          <ol className="fa-pasos">
            {(data.pasos ?? []).slice(0, 8).map((p, i) => (
              <li key={i}>
                <span className="fa-paso-d">{p.descripcion}</span>
                {p.meta ? <span className="fa-paso-meta">{p.meta}</span> : null}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <div className="big">{data.value}{data.unit ? <> <span className="u">{data.unit}</span></> : null}</div>
          {data.note ? <p className="note">{data.note}</p> : null}
          {(data.extras ?? []).length > 0 && (
            <ul className="dc2-extras">
              {data.extras!.slice(0, 3).map((e, i) => (
                <li key={i}>
                  <span className="dc2-extra-n">{e.nombre}</span>
                  {e.valor ? <span className="dc2-extra-v">{e.valor}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {data.citeLabel ? (
        <div className="dc2-citerow">
          <button className="cite2" onClick={() => setShowSrc((s) => !s)}>
            <span className="brk" />
            <span className="ctxt">{data.citeLabel}{data.page != null ? ` · ${t({ es: "pág.", en: "p." })} ${data.page}` : ""}</span> ↗
          </button>
        </div>
      ) : null}

      {showSrc && data.citeLabel ? (
        <div className="dc2-src">
          <span className="thread" />
          <div className="src2">
            {data.verbatim ? (
              <>
                <div className="s-head">
                  <Icon name="file-text" size={12} />
                  <span>{t({ es: "Fragmento original", en: "Original fragment" })}</span>
                </div>
                <div className="s-span"><mark>{data.verbatim}</mark></div>
                {data.verbatimLang ? (
                  <span className="s-orig"><Icon name="globe" size={11} />{t({ es: `Documento original en ${data.verbatimLang === "EN" ? "inglés" : "español"}`, en: `Original document in ${data.verbatimLang === "EN" ? "English" : "Spanish"}` })}</span>
                ) : null}
                <div className="s-actions">
                  <span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Pedigree al fragmento exacto · SHA-256", en: "Span pedigree · SHA-256" })}</span>
                </div>
              </>
            ) : (
              <>
                <div className="s-head">
                  <Icon name="file-text" size={12} />
                  <span>{t({ es: "Fragmento no disponible", en: "Fragment not available" })}</span>
                </div>
                <div className="s-span s-span-na">{t({ es: "Esta respuesta aún no tiene el span de caracteres del documento. Se muestra la procedencia, no texto generado.", en: "This answer doesn't yet have the document's character span. Provenance is shown, not generated text." })}</div>
                <div className="s-actions">
                  <span className="s-ped"><Icon name="shield-check" size={12} />{t({ es: "Procedencia al documento · sin span exacto", en: "Document provenance · no exact span" })}</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
