"use client";

import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitedFragment } from "./cited-fragment";
import { citaToSource, type BilingualAlignmentPayload } from "../consult-data";

/**
 * Tipo 9 · Vista bilingüe alineada (memoria_traduccion · Pista B) — portada 1:1
 * del prototipo (`answers.jsx` → `BilingualAnswer`): `.ans-banner` + `.tm-list`
 * con segmentos `.tm-seg` (lado origen `.src` ↔ destino `.tgt`) y el candado del
 * lock terminológico (`.tm-lock`/`.tm-term`). Los segmentos vienen de la memoria
 * de traducción (DTM): `texto_origen` es verbatim del documento fuente.
 *
 * HONESTO: si el backend no halló memoria para el par (`desde_memoria=false`), no
 * se inventan equivalencias — se muestra el aviso y la cita queda vacía.
 */
export function BilingualAlignment({
  payload,
  saved,
  onSave,
  onCite,
}: {
  payload: BilingualAlignmentPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
}) {
  const segmentos = payload.segmentos ?? [];
  const cita = (payload.citas ?? [])[0] ?? null;
  const lang = segmentos[0]?.idioma_origen ?? "en-US";

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Memoria de traducción · EN-US → ES-MX"}</div>

      {payload.desde_memoria ? (
        <div className="ans-banner">
          <Icon name="languages" size={15} className="lic" />
          Segmentos alineados de la memoria. Los términos con <b>candado</b> son
          equivalencias fijadas (lock terminológico).
        </div>
      ) : (
        <div className="ans-banner">
          <Icon name="languages" size={15} className="lic" />
          No hay memoria de traducción para el par <b>{payload.par_linguistico}</b> en
          esta consulta. No se generan equivalencias: la traducción rigurosa es un flujo
          aparte (Pista A).
        </div>
      )}

      {segmentos.length > 0 && (
        <ul className="tm-list">
          {segmentos.map((p, i) => {
            const lock = (p.lock ?? [])[0] ?? null;
            return (
              <li className="tm-seg" key={i}>
                <div className="tm-side src">
                  <span className="tm-lang">{(p.idioma_origen ?? "EN-US").toUpperCase()}</span>
                  <span className="tm-txt">{p.texto_origen}</span>
                </div>
                <div className="tm-side tgt">
                  <span className="tm-lang">{(p.idioma_destino ?? "ES-MX").toUpperCase()}</span>
                  <span className="tm-txt">{p.texto_destino ?? "—"}</span>
                </div>
                {lock && (
                  <div className="tm-lock">
                    <Icon name="lock" size={11} className="lic" />
                    <span className="tm-term">{lock.termino_origen}</span>
                    <Icon name="arrow-right" size={11} />
                    <span className="tm-term">{lock.termino_destino}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CitedFragment
        cita={cita}
        saved={saved}
        onSave={onSave}
        onOpenDoc={() => onCite(citaToSource(cita))}
        emptyLabel="Sin segmento de memoria citado"
        lang={lang}
      />
    </div>
  );
}
