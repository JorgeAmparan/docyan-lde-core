"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import { ConsultaSpanOverlay, type SourceSpan } from "@/components/brand/consulta-span-overlay";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { components } from "@/types/api";

type DispararPlaybook = components["schemas"]["DispararPlaybookResponse"];
type PasoVista = components["schemas"]["PasoVistaUnificada"];
type Cita = components["schemas"]["Cita"];

/**
 * /playbook/[id] — Runner de Playbook. La página se compone en tiempo real, paso
 * a paso, y CADA paso conserva su cita a la fuente (regla de integridad de cita:
 * "citado" = el fragmento verbatim del span; sin span → honesto, sin chip falso).
 * Portado de playbook.jsx → PlaybookRun (markup .pb-run-* · .pb-step · .pb-num).
 *
 * POSTea /mo/playbooks/{id}/run y revela los pasos con un stagger (como el
 * "componiendo paso a paso" del prototipo).
 */

/** Primera cita real de un paso, si existe (ProcedureCard: `cita`; InfoCard: `citas[]`). */
function citaDePaso(paso: PasoVista): Cita | null {
  const payload = paso.resultado?.payload as
    | { cita?: Cita | null; citas?: Cita[] | null }
    | undefined;
  if (!payload) return null;
  if (payload.cita) return payload.cita;
  if (payload.citas && payload.citas.length > 0) return payload.citas[0];
  return null;
}

/** Etiqueta del chip de cita a partir de la Cita real (sin inventar §). */
function etiquetaCita(cita: Cita): string {
  const doc = cita.documento_nombre ?? "Fuente";
  const sec = cita.seccion ?? (cita.pagina != null ? `pág. ${cita.pagina}` : null);
  return sec ? `${doc} · ${sec}` : doc;
}

/**
 * SourceSpan honesto desde la Cita real. El resaltado verbatim solo se promete
 * cuando hay `fragmento` (= chunk[span_inicio:span_fin] del texto crudo). Sin
 * fragmento, se dice explícito que no hay fragmento disponible — nunca se finge.
 */
function spanDeCita(cita: Cita): SourceSpan {
  const tieneFragmento = Boolean(cita.fragmento && cita.fragmento.trim());
  return {
    title: cita.documento_nombre ?? "Fuente del paso",
    ref: cita.seccion ?? (cita.pagina != null ? `pág. ${cita.pagina}` : "fuente"),
    paragraphs: tieneFragmento
      ? [{ text: cita.fragmento as string, highlight: true }]
      : [{ text: "Fragmento no disponible para esta cita." }],
  };
}

export default function PlaybookRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [source, setSource] = useState<SourceSpan | null>(null);

  const { data } = useQuery({
    queryKey: ["playbook-run", id],
    queryFn: () => api.post<DispararPlaybook>(`/mo/playbooks/${id}/run`, undefined, { token }),
    retry: false,
  });

  const steps: PasoVista[] = data?.vista_unificada ?? [];
  const name = data?.playbook?.nombre ?? "Playbook";

  // Revelado escalonado: cada paso aparece con un retardo (el "componiendo" del kit).
  // El runner es per-id (ruta dinámica) → remonta al navegar, así que `shown`
  // arranca en 0 sin necesidad de un efecto de reset.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= steps.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 240 : 560);
    return () => clearTimeout(t);
  }, [shown, steps.length]);

  return (
    <div className="sheet" style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto" }}>
      <div className="sheet-head">
        <button className="x" onClick={() => router.push("/saved")} aria-label="Volver">
          <Icon name="arrow-left" size={18} />
        </button>
        <h2>Playbook · {name}</h2>
        <button className="x" onClick={() => router.push("/consult")} aria-label="Cerrar">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="sheet-body">
        <div className="playbook-run-view">
          <p className="pb-run-sub">
            Se compone en tiempo real, paso a paso. Cada paso conserva su cita a la fuente.
          </p>

          {steps.slice(0, shown).map((paso, i) => {
            const stepName = paso.nombre ?? paso.tipo_intencion ?? `Paso ${paso.orden}`;
            const nota = paso.nota_paso ?? paso.resultado?.nota ?? "Respuesta consolidada con su cita a la fuente.";
            const cita = citaDePaso(paso);
            return (
              <div className="pb-step" key={paso.consulta_guardada_id ?? i}>
                <div className="pb-step-h">
                  <span className="pb-num">{paso.orden ?? i + 1}</span>
                  <span className="pb-q">{stepName}</span>
                </div>
                <div className="pb-step-body">
                  <p style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.5, margin: "0 0 4px" }}>{nota}</p>
                  {paso.error ? (
                    <div className="warn">
                      <Icon name="triangle-alert" size={16} />
                      <div className="wt">
                        <span className="wlab">No se pudo resolver este paso</span>
                        {paso.error}
                      </div>
                    </div>
                  ) : null}
                  {cita ? (
                    <CitationChip label={etiquetaCita(cita)} onOpen={() => setSource(spanDeCita(cita))} />
                  ) : (
                    <span className="cite-empty">Fragmento no disponible para este paso.</span>
                  )}
                </div>
              </div>
            );
          })}

          {shown < steps.length ? (
            <div className="pb-composing">
              <Icon name="loader" size={15} />
              Componiendo paso {shown + 1} de {steps.length}…
            </div>
          ) : null}

          {shown >= steps.length && steps.length > 0 ? (
            <div className="pb-done">
              <Icon name="check-circle" size={16} />
              Playbook completo · {steps.length}{" "}
              {steps.length === 1 ? "consulta encadenada con su cita" : "consultas encadenadas con su cita"}
            </div>
          ) : null}
        </div>
      </div>

      <ConsultaSpanOverlay open={source !== null} onOpenChange={(o) => !o && setSource(null)} source={source} />
    </div>
  );
}
