"use client";

import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitedFragment } from "./cited-fragment";
import { SolicitarBtn } from "./solicitar-btn";
import { citaToSource, type InfoCardPayload } from "../consult-data";
import type { SolicitarPrefill } from "./solicitud-modal";

/** Tipo 1 · Informativa — big value + unit + nota, from the real payload. */
export function InformativaCard({
  payload,
  saved,
  onSave,
  onCite,
  onSolicitar,
}: {
  payload: InfoCardPayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
  /** PROVISIONAL-ED2: abre el formulario de solicitud (solo en sesión autenticada). */
  onSolicitar?: (p: SolicitarPrefill) => void;
}) {
  const especs = payload.especificaciones ?? [];
  const primary = especs[0];
  const cita = primary?.cita ?? (payload.citas ?? [])[0] ?? null;
  // ED-2 §2.4: el botón aparece SOLO si el backend marcó el dato accionable.
  const accionable = !!primary?.accionable;

  // TÍTULO-DATO (paridad con el hero, `page.tsx` LiveDemo → DemoAnswerCard): el DATO
  // destacado es `nombre` ("1750 psi", "+12 VDC", "Flash Point: 52 °F") y la definición
  // es `valor`. Antes se usaba `valor` (la definición larga) en el slot `.big`, que por
  // no ser "corto" caía a nota → el demo mostraba la definición sin el valor arriba
  // (corrección Jorge #5). Ahora el valor va grande y la definición debajo, como el hero.
  const valorGrande = (primary?.nombre ?? "").trim();
  const unidadRaw = (primary?.unidad ?? "").trim();
  const unidad = unidadRaw && unidadRaw.toLowerCase() !== "none" ? unidadRaw : "";
  const hasBig = !!valorGrande;

  // Cuerpo: la definición del dato (`valor`), con respaldo a `payload.definicion`.
  const answerText = (primary?.valor ?? payload.definicion ?? "").trim();

  // §3.2 — degradación honesta: sin especificación relevante ni definición, la tarjeta
  // DICE que el documento no trae ese dato, en vez de un cuerpo vacío o (peor) relleno
  // de datos irrelevantes con citas correctas. El backend ya no emite ruido semántico
  // (§3.1 piso de coseno crudo); aquí se cierra el caso "nada relevante" honestamente.
  if (especs.length === 0 && !answerText) {
    return (
      <div className="acard">
        <div className="q">{payload.titulo}</div>
        <p className="note" style={{ fontSize: 14.5, color: "var(--fg-muted)" }}>
          No encontré ese dato en este documento. Prueba reformular la pregunta o
          consultar otro documento del CoDo.
        </p>
      </div>
    );
  }

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>

      {hasBig ? (
        <>
          <div className="big">
            {valorGrande}
            {unidad ? <span className="u">{unidad}</span> : null}
          </div>
          {answerText ? <p className="note">{answerText}</p> : null}
        </>
      ) : answerText ? (
        <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>
          {answerText}
        </p>
      ) : null}

      <CitedFragment
        cita={cita}
        saved={saved}
        onSave={onSave}
        onOpenDoc={() => onCite(citaToSource(cita))}
      />

      {accionable && onSolicitar ? (
        <div style={{ marginTop: 10, display: "flex" }}>
          <SolicitarBtn
            onClick={() =>
              onSolicitar({
                cita,
                tipoSugerido: primary?.tipo_sugerido ?? null,
                dato: valorGrande || answerText || payload.titulo,
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
