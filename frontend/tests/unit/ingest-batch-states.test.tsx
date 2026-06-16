import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import "@/i18n/config";
import { IngestBatch } from "@/components/ingesta/ingest-batch";
import { type DocProgress, aggregateBatch } from "@/lib/ingesta";

/**
 * Sprint UI-2 §1.1.3/§1.1.4 — estados terminales visibles + acciones del documento
 * vivo. Un job jamás desaparece sin estado terminal; el documento vivo ofrece
 * Consultar + Reemplazar + Eliminar; completed_sin_documento es retryable.
 */

function done(p: Partial<DocProgress>): DocProgress {
  return {
    docId: "d",
    name: "doc.pdf",
    kind: "pdf",
    status: "completado",
    phase: "dedup",
    phaseFraction: 1,
    pct: 100,
    etaSeconds: 0,
    disponibleParaConsulta: true,
    consultUrl: "/consulta?doc=SHA123",
    ...p,
  };
}

describe("IngestBatch — documento vivo (§1.1.4)", () => {
  it("ofrece Consultar, Reemplazar y Eliminar, con sus callbacks", () => {
    const onConsult = vi.fn();
    const onReplace = vi.fn();
    const onDelete = vi.fn();
    render(
      <IngestBatch
        batch={aggregateBatch([done({})])}
        onConsult={onConsult}
        onReplace={onReplace}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Consultar|Query/i }));
    fireEvent.click(screen.getByRole("button", { name: /Reemplazar|Replace/i }));
    fireEvent.click(screen.getByRole("button", { name: /Eliminar|Delete/i }));
    expect(onConsult).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe("IngestBatch — completed_sin_documento (§1.1.3)", () => {
  it("estado terminal honesto + Reintentar (compatible con fail-fast)", () => {
    const onRetry = vi.fn();
    render(
      <IngestBatch
        batch={aggregateBatch([
          done({ disponibleParaConsulta: false, completedSinDocumento: true }),
        ])}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/no quedó documento vivo|no live document/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reintentar|Retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
