"use client";

import { Icon } from "@/components/icon";
import type { SourceSpan } from "@/components/brand/consulta-span-overlay";
import { CitedFragment } from "./cited-fragment";
import { citaToSource, type DiagnosticTreePayload } from "../consult-data";

/**
 * Tipo 3 · Troubleshooting DEL MANUAL — árbol síntoma→causa→acción TAL COMO LO
 * DICE EL MANUAL. Línea absoluta (CLAUDE.md §11.1): no es un diagnóstico del
 * equipo; DOCYAN presenta el texto, el profesional decide. Las opciones navegan
 * re-consultando el siguiente nodo (`onNavigate`). Si es hoja, muestra causa
 * probable + acción resolutoria.
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
  const esHoja = !!(payload.es_hoja || payload.causa_probable || payload.accion_resolutoria);

  return (
    <div className="acard">
      <div className="q">{payload.titulo || "Lo que dice el manual"}</div>

      <div className="ans-banner">
        <Icon name="book-open" size={15} />
        Árbol de fallas <b>tal como aparece en el manual</b>. No es un diagnóstico de tu equipo —
        DOCYAN presenta el texto; el profesional decide.
      </div>

      {payload.pregunta && (
        <p style={{ color: "var(--fg)", fontSize: 14, marginTop: 8 }}>{payload.pregunta}</p>
      )}

      {esHoja ? (
        <ul className="ts-tree">
          <li className="ts-branch on">
            <div className="tsb-cond">
              <Icon name="git-branch" size={14} />
              <span>{payload.titulo || "El manual indica"}</span>
            </div>
            <div className="tsb-body">
              {payload.causa_probable && (
                <p>
                  <span className="tsb-lab">El manual indica</span>
                  {payload.causa_probable}
                </p>
              )}
              {payload.accion_resolutoria && (
                <p>
                  <span className="tsb-lab">Acción del manual</span>
                  {payload.accion_resolutoria}
                </p>
              )}
            </div>
          </li>
        </ul>
      ) : (
        <ul className="ts-tree">
          {opciones.map((o, i) => (
            <li key={i}>
              {/* Botón (no <li> clicable): foco visible + teclado + ≥44px — la
                  accesibilidad es no-negociable (brief §accesibilidad). */}
              <button
                type="button"
                className="ts-branch"
                onClick={() => o.siguiente_nodo_id && onNavigate?.(o.siguiente_nodo_id)}
              >
                <div className="tsb-cond">
                  <Icon name="git-branch" size={14} />
                  <span>{o.etiqueta}</span>
                  <Icon name="chevron-right" size={15} className="tsb-chev" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CitedFragment
        cita={cita}
        saved={saved}
        onSave={onSave}
        onOpenDoc={() => onCite(citaToSource(cita))}
      />
    </div>
  );
}
