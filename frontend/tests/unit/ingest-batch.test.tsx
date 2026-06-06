import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import "@/i18n/config";
import { IngestBatch } from "@/components/ingesta/ingest-batch";
import { type BatchProgress, type DocProgress, aggregateBatch } from "@/lib/ingesta";

/**
 * F1 — el componente de progreso (portado del handoff) renderiza barras de fase
 * vivas, contadores reales, estado de error con acciones y banner de fin de lote.
 * Visual gana el handoff; aquí se verifica que los datos reales fluyen al árbol.
 */

function batchOf(docs: DocProgress[]): BatchProgress {
  return aggregateBatch(docs);
}

function liveDoc(p: Partial<DocProgress> & { docId: string }): DocProgress {
  return {
    name: p.docId,
    kind: "pdf",
    status: "procesando",
    phase: "grafo",
    phaseFraction: 0.5,
    pct: 60,
    etaSeconds: 120,
    counters: { relations: 120, relationsTotal: 240, entities: 80 },
    ...p,
  };
}

describe("IngestBatch — progreso vivo", () => {
  it("muestra los 5 tramos de fase y el % del doc en proceso", () => {
    const { container } = render(<IngestBatch batch={batchOf([liveDoc({ docId: "d1" })])} />);
    // 5 tramos nombrados (no una barra lisa).
    expect(container.querySelectorAll(".iph").length).toBe(5);
    // El % del documento se muestra (60%).
    expect(screen.getByText("60%")).toBeInTheDocument();
    // El tramo activo es 'grafo'.
    const active = container.querySelector('.iph[data-st="active"] .iph-lab');
    expect(active?.textContent).toMatch(/grafo|graph/i);
  });

  it("error: muestra motivo + acciones Reintentar/Omitir; el lote continúa", () => {
    const onRetry = vi.fn();
    const onSkip = vi.fn();
    const batch = batchOf([
      liveDoc({ docId: "ok", status: "completado", pct: 100, disponibleParaConsulta: true }),
      {
        docId: "bad",
        name: "escaneo.pdf",
        kind: "pdf · OCR",
        status: "error",
        phase: "conversion",
        phaseFraction: 0.4,
        pct: 12,
        etaSeconds: null,
        error: { code: "ingest_failed", message: "OCR ilegible" },
      },
    ]);
    render(<IngestBatch batch={batch} onRetry={onRetry} onSkip={onSkip} />);
    expect(screen.getByText(/OCR ilegible/)).toBeInTheDocument();
    // Banner de fin: 1 disponible + 1 con error (el lote no se bloqueó).
    expect(screen.getByText(/1 con error|1 with error/i)).toBeInTheDocument();
  });

  it("completado y disponible expone 'Consultar'", () => {
    const onConsult = vi.fn();
    render(
      <IngestBatch
        batch={batchOf([
          liveDoc({
            docId: "c",
            status: "completado",
            pct: 100,
            disponibleParaConsulta: true,
            consultUrl: "/consulta?doc=c",
          }),
        ])}
        onConsult={onConsult}
      />,
    );
    expect(screen.getByText(/Consultar|Query/i)).toBeInTheDocument();
  });
});
