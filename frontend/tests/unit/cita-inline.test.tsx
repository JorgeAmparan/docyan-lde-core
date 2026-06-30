import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CitaInline } from "@/app/(app)/consult/renderers/cita-inline";
import type { Cita } from "@/app/(app)/consult/consult-data";

/**
 * Sprint UI-2 §1.2.7 — divulgación de cita en TRES niveles:
 *   chip → fragmento verbatim EN LÍNEA → abrir documento.
 * Antes el chip saltaba directo al overlay; el nivel 2 (fragmento inline) es nuevo.
 */

const cita: Cita = {
  documento_nombre: "Manual Rotina 380",
  seccion: "§4.2.1",
  pagina: 12,
  fragmento: "El par de apriete del perno B es de 85 N·m.",
};

describe("CitaInline — 3 niveles de divulgación", () => {
  it("nivel 1: el chip se ve; el fragmento NO está desplegado de inicio", () => {
    render(<CitaInline cita={cita} onOpenDoc={vi.fn()} />);
    expect(screen.getByText(/Manual Rotina 380 · §4\.2\.1 · p\.12/)).toBeInTheDocument();
    expect(screen.queryByTestId("cita-inline-fragment")).toBeNull();
  });

  it("nivel 2: al pulsar el chip se despliega el verbatim EN LÍNEA", () => {
    render(<CitaInline cita={cita} onOpenDoc={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver fragmento citado/i }));
    const frag = screen.getByTestId("cita-inline-fragment");
    expect(frag).toHaveTextContent("El par de apriete del perno B es de 85 N·m.");
    expect(frag).toHaveTextContent(/Fragmento original/);
  });

  it("nivel 3: 'Abrir documento' invoca onOpenDoc (overlay de fuente)", () => {
    const onOpenDoc = vi.fn();
    render(<CitaInline cita={cita} onOpenDoc={onOpenDoc} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver fragmento citado/i }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir documento/i }));
    expect(onOpenDoc).toHaveBeenCalledOnce();
  });

  it("sin span: muestra 'fragmento no disponible' honesto, no texto generado", () => {
    const sinSpan: Cita = { documento_nombre: "Manual", seccion: "§1", fragmento: null };
    render(<CitaInline cita={sinSpan} onOpenDoc={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver fragmento citado/i }));
    expect(screen.getByTestId("cita-inline-fragment")).toHaveTextContent(/Fragmento no disponible/);
  });

  it("sin cita: muestra el fallback (no rompe)", () => {
    render(<CitaInline cita={null} onOpenDoc={vi.fn()} emptyLabel="Recurso de apoyo" />);
    expect(screen.getByText("Recurso de apoyo")).toBeInTheDocument();
  });
});
