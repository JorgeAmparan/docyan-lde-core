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

  // El slot `.big` (display gigante) es SOLO para un valor corto tipo "85 N·m" o "SAE-30".
  // Una frase NUNCA va en `.big`: se lee como nota. Heurística: hay unidad, o el valor es un
  // token corto sin espacios (no una oración).
  const valor = (primary?.valor ?? "").trim();
  const unidad = (primary?.unidad ?? "").trim();
  const isShortValue = !!unidad || /^[\w.,:/+\-]{1,16}$/.test(valor);
  const hasBig = !!valor && isShortValue;

  // Texto de respuesta: la definición; o el valor cuando trae la prosa (no es número corto).
  const answerText = (payload.definicion ?? "").trim() || (!hasBig ? valor : "");

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
            {valor}
            {unidad ? <span className="u">{unidad}</span> : null}
          </div>
          {payload.definicion ? <p className="note">{payload.definicion}</p> : null}
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
                dato: valor || answerText || payload.titulo,
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
