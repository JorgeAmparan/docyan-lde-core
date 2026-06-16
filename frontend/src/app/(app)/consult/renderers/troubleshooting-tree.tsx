"use client";

import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitaInline } from "./cita-inline";
import { citaToSource, type DiagnosticTreePayload } from "../consult-data";
import { SaveBtn } from "./save-btn";

/**
 * Tipo 5 · Troubleshooting — un nodo del árbol curado a la vez. Las opciones
 * navegan re-consultando el siguiente nodo (`onNavigate`). Si el payload es hoja,
 * muestra causa probable + acción resolutoria. Línea ANSI: tono warn, nunca rojo.
 */
export function TroubleshootingTree({
  payload,
  saved,
  onSave,
  onCite,
  onNavigate,
}: {
  payload: DiagnosticTreePayload;
  saved: boolean;
  onSave: () => void;
  onCite: (s: SourceSpan | null) => void;
  onNavigate?: (nodoId: string) => void;
}) {
  const opciones = payload.opciones ?? [];
  const cita = (payload.citas ?? [])[0] ?? null;

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Diagnóstico"}</div>

      {payload.pregunta && (
        <>
          <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>{payload.pregunta}</p>
          <div className="ppe" style={{ marginTop: 12, gap: 8 }}>
            {opciones.map((o, i) => (
              <button
                type="button"
                key={i}
                className="sug"
                style={{ background: "var(--surface)" }}
                disabled={!o.siguiente_nodo_id || !onNavigate}
                onClick={() => o.siguiente_nodo_id && onNavigate?.(o.siguiente_nodo_id)}
              >
                {o.etiqueta}
                <span className="ar">→</span>
              </button>
            ))}
          </div>
        </>
      )}

      {(payload.es_hoja || payload.causa_probable || payload.accion_resolutoria) && (
        <div style={{ marginTop: 8 }}>
          {payload.causa_probable && (
            <p style={{ color: "var(--fg)", fontSize: 14 }}>
              <strong>Causa probable:</strong> {payload.causa_probable}
            </p>
          )}
          {payload.accion_resolutoria && (
            <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 4 }}>
              <strong>Acción resolutoria:</strong> {payload.accion_resolutoria}
            </p>
          )}
        </div>
      )}

      <div className="acard-foot">
        <CitaInline cita={cita} onOpenDoc={() => onCite(citaToSource(cita))} emptyLabel="Árbol de diagnóstico" />
        <SaveBtn saved={saved} onSave={onSave} />
      </div>
    </div>
  );
}
