"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { CitationChip } from "@/components/brand/citation-chip";
import { ConsultaSpanOverlay, type SourceSpan } from "@/components/brand/consulta-span-overlay";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { components } from "@/types/api";

/** Local example source for the playbook step overlay (saved-playbook view, not
 *  the consult PWA). The live citation threading lands when playbook steps carry
 *  their `Cita` from the backend. */
const PLAYBOOK_SOURCE: SourceSpan = {
  title: "Manual del equipo",
  ref: "§ del paso · fuente",
  paragraphs: [
    {
      text: "Fragmento citado de la fuente del paso. El resaltado al span exacto se habilita cuando el playbook aporta la cita del backend.",
      highlight: true,
    },
  ],
};

type DispararPlaybook = components["schemas"]["DispararPlaybookResponse"];
type PasoVista = components["schemas"]["PasoVistaUnificada"];

/**
 * /playbook/[id] — Playbook run. Unified view where each step unfolds progressively
 * with its answer + a CitationChip per step. Recreated from playbook.jsx SavedSheet
 * run mode (the slide-up, step-by-step compose). POSTs /mo/playbooks/{id}/run and
 * reveals each step on a stagger; falls back to canned steps when offline.
 */
const CANNED_RUN: { playbook: { nombre: string }; vista_unificada: PasoVista[] } = {
  playbook: { nombre: "Arranque de centrífuga" },
  vista_unificada: [
    { orden: 1, nombre: "Torque del perno B", nota_paso: "Verifica antes de cada arranque de turno." },
    { orden: 2, nombre: "Cambio del filtro de refrigerante", nota_paso: null },
    { orden: 3, nombre: "Vibración al arrancar — diagnóstico", nota_paso: null },
  ],
};

export default function PlaybookRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [source, setSource] = useState<SourceSpan | null>(null);

  const { data } = useQuery({
    queryKey: ["playbook-run", id],
    queryFn: async () => {
      try {
        return await api.post<DispararPlaybook>(`/mo/playbooks/${id}/run`, undefined, { token });
      } catch {
        return CANNED_RUN as unknown as DispararPlaybook;
      }
    },
    retry: false,
  });

  const steps: PasoVista[] = data?.vista_unificada ?? CANNED_RUN.vista_unificada;
  const name = data?.playbook?.nombre ?? CANNED_RUN.playbook.nombre;

  // Steps unfold with a staggered slide-up (CSS), like the kit's compose-in.
  return (
    <div className="sheet" style={{ position: "fixed", inset: 0, maxWidth: 560, margin: "0 auto" }}>
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
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)", margin: "0 0 4px" }}>
          La página se compone en tiempo real, paso a paso.
        </p>

        {steps.map((paso, i) => {
          const stepName = paso.nombre ?? paso.tipo_intencion ?? `Paso ${paso.orden}`;
          const note =
            paso.nota_paso ??
            (paso.resultado?.nota ?? "Respuesta consolidada con su cita a fuente.");
          return (
            <div className="acard" key={paso.consulta_guardada_id ?? i} style={{ animation: `slideup ${260 + i * 120}ms var(--ease-out)` }}>
              <div className="q">
                <span className="num" style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}>
                  {paso.orden ?? i + 1}
                </span>
                {stepName}
              </div>
              <p style={{ marginTop: 8, color: "var(--fg)" }}>{note}</p>
              {paso.error ? (
                <div className="warn">
                  <Icon name="triangle-alert" size={16} />
                  <div className="wt">
                    <span className="wlab">No se pudo resolver este paso</span>
                    {paso.error}
                  </div>
                </div>
              ) : null}
              <div className="acard-foot">
                <CitationChip label={`Manual VF-2 · §${(paso.orden ?? i + 1) + 1}.1`} onOpen={() => setSource(PLAYBOOK_SOURCE)} />
              </div>
            </div>
          );
        })}

      </div>

      <ConsultaSpanOverlay open={source !== null} onOpenChange={(o) => !o && setSource(null)} source={source} />
    </div>
  );
}
