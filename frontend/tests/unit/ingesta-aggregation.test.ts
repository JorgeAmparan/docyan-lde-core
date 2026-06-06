import { describe, it, expect } from "vitest";

import {
  type DocProgress,
  aggregateBatch,
  batchDone,
  isActive,
  isTerminal,
} from "@/lib/ingesta";

/**
 * F1 — agregación de lote DEL LADO CLIENTE (decisión rectora #3). El backend solo
 * da DocProgress por job; el cliente arma el BatchProgress. Estos tests fijan el
 * contrato de agregación (pct ponderado por trabajo, counts, eta) sin red.
 */

function doc(p: Partial<DocProgress> & { docId: string }): DocProgress {
  return {
    name: p.docId,
    kind: "pdf",
    status: "procesando",
    phase: "extraccion",
    phaseFraction: 0,
    pct: 0,
    etaSeconds: null,
    ...p,
  };
}

describe("aggregateBatch", () => {
  it("cuenta por estado", () => {
    const b = aggregateBatch([
      doc({ docId: "a", status: "completado", pct: 100 }),
      doc({ docId: "b", status: "procesando", pct: 40 }),
      doc({ docId: "c", status: "encolado", pct: 0 }),
      doc({ docId: "d", status: "error", pct: 22 }),
      doc({ docId: "e", status: "cargando", pct: 3 }),
    ]);
    expect(b.counts).toEqual({ completado: 1, procesando: 2, encolado: 1, error: 1 });
  });

  it("pct ponderado por trabajo, no por nº de docs", () => {
    // doc pesado (1000) al 80% + doc ligero (10) al 0%.
    const b = aggregateBatch(
      [
        doc({ docId: "big", status: "procesando", pct: 80 }),
        doc({ docId: "small", status: "encolado", pct: 0 }),
      ],
      { big: 1000, small: 10 },
    );
    // ≈ (1000*80 + 10*0) / 1010 = 79.2, no 40 (que daría el promedio simple).
    expect(b.pct).toBeGreaterThan(78);
    expect(b.pct).toBeLessThan(80);
  });

  it("completado cuenta como 100% aunque el doc traiga pct menor", () => {
    const b = aggregateBatch([doc({ docId: "a", status: "completado", pct: 0 })]);
    expect(b.pct).toBe(100);
  });

  it("suma ETAs de los docs activos para el ETA del lote", () => {
    const b = aggregateBatch([
      doc({ docId: "a", status: "procesando", pct: 50, etaSeconds: 120 }),
      doc({ docId: "b", status: "procesando", pct: 10, etaSeconds: 300 }),
      doc({ docId: "c", status: "completado", pct: 100, etaSeconds: 0 }),
    ]);
    expect(b.etaSeconds).toBe(420);
  });

  it("batchDone solo cuando todos terminales", () => {
    const docs = [
      doc({ docId: "a", status: "completado" }),
      doc({ docId: "b", status: "error" }),
    ];
    expect(batchDone(aggregateBatch(docs))).toBe(true);
    expect(batchDone(aggregateBatch([...docs, doc({ docId: "c", status: "procesando" })]))).toBe(
      false,
    );
  });
});

describe("helpers de estado", () => {
  it("isTerminal / isActive", () => {
    expect(isTerminal("completado")).toBe(true);
    expect(isTerminal("error")).toBe(true);
    expect(isActive("procesando")).toBe(true);
    expect(isActive("encolado")).toBe(true);
  });
});
