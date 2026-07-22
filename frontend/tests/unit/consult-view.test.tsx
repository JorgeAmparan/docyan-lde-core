import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mocks ───────────────────────────────────────────────────────────────────
const post = vi.fn();
vi.mock("@/lib/api-client", () => ({
  api: { post: (...a: unknown[]) => post(...a) },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "t" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ConsultView, type ConsultContext } from "@/app/(app)/consult/consult-view";

const SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

function ctx(over: Partial<ConsultContext> = {}): ConsultContext {
  return {
    codo: SHA,
    entityName: "Calibración Q1.pdf",
    entityTitle: "Bitácora de calibración",
    entityMeta: "documento · vivo",
    ...over,
  };
}

// La vista crea una sesión de chat (`POST /mo/sessions`) al montar; el mock por
// defecto la resuelve para no romper el effect. Los tests que ejercitan la consulta
// sobreescriben el comportamiento de las DEMÁS llamadas.
beforeEach(() => {
  post.mockReset();
  post.mockImplementation((url: string) =>
    url === "/mo/sessions" ? Promise.resolve({ session_id: "s1" }) : Promise.resolve({}),
  );
});

describe("ConsultView — DEF-4 (§1.2.6): nunca el SHA crudo en la cabecera", () => {
  it("muestra el nombre del CoDo, no el hash", () => {
    render(<ConsultView context={ctx()} />);
    // Shell-A (prototipo): la cabecera usa el eyebrow "Consultando".
    expect(screen.getByText(/Consultando/)).toBeInTheDocument();
    expect(screen.getAllByText(/Calibración Q1\.pdf/).length).toBeGreaterThan(0);
    // El SHA crudo no aparece por ningún lado de la cabecera.
    expect(screen.queryByText(new RegExp(SHA))).toBeNull();
  });

  it("conserva un código legible cuando NO es un hash", () => {
    render(<ConsultView context={ctx({ codo: "CODO-A12" })} />);
    // El eyebrow combina "Consultando · CODO-A12" en un nodo; basta el substring.
    expect(screen.getByText(/CODO-A12/)).toBeInTheDocument();
  });
});

describe("ConsultView — chip de procedencia = TIPO REAL del documento citado (PRIORIDAD 0 §4)", () => {
  async function preguntarYResolver(payload: Record<string, unknown>) {
    let resolveQuery: (v: unknown) => void = () => {};
    post.mockImplementation((url: string) =>
      url === "/mo/sessions"
        ? Promise.resolve({ session_id: "s1" })
        : new Promise((r) => { resolveQuery = r; }));
    render(<ConsultView context={ctx({ entityName: "Manual MAXI-10.pdf" })} />);
    const input = screen.getByPlaceholderText(/Pregunta sobre/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "¿Qué lubricante usa?" } });
    fireEvent.submit(input.closest("form")!);
    resolveQuery({ resultado: { payload, contexto_ccp: { cache_hit: false } } });
  }

  it("una Informativa sobre un manual_tecnico muestra 'Manual técnico', NO 'Ficha técnica'", async () => {
    // El bug: KIND_SCHEMA['info']='ficha_tecnica' pintaba "Ficha técnica" en toda
    // respuesta Informativa aunque la fuente fuera un manual. El chip debe leer
    // Cita.documento_tipo (dato real del backend).
    await preguntarYResolver({
      kind: "info_card",
      titulo: "Lubricación",
      especificaciones: [],
      citas: [{ documento_tipo: "manual_tecnico", documento_nombre: "Manual MAXI-10", documento_id: "d1" }],
    });
    await waitFor(() => expect(screen.getByText("Manual técnico")).toBeInTheDocument());
    expect(screen.queryByText("Ficha técnica")).toBeNull();
  });

  it("sin cita tipada cae al respaldo heurístico (comportamiento previo intacto)", async () => {
    await preguntarYResolver({ kind: "info_card", titulo: "X", especificaciones: [], citas: [] });
    await waitFor(() => expect(screen.getByText("Ficha técnica")).toBeInTheDocument());
  });
});

describe("ConsultView — lag del input (§1.2.8): la pregunta se pinta al instante", () => {
  it("la burbuja del usuario aparece y el campo se limpia ANTES de la respuesta", async () => {
    // La respuesta del motor queda PENDIENTE (deferred): si la pregunta dependiera
    // de ella, no se vería. Debe verse igual al instante; la respuesta llega después.
    let resolveQuery: (v: unknown) => void = () => {};
    post.mockImplementation((url: string) =>
      url === "/mo/sessions"
        ? Promise.resolve({ session_id: "s1" })
        : new Promise((r) => { resolveQuery = r; }));
    render(<ConsultView context={ctx()} />);
    const input = screen.getByPlaceholderText(/Pregunta sobre/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "¿Cuál es el torque?" } });
    fireEvent.submit(input.closest("form")!);
    // Instantáneo: la burbuja está en el DOM y el campo se limpió, con el motor aún pendiente.
    expect(screen.getByText("¿Cuál es el torque?")).toBeInTheDocument();
    expect(input.value).toBe("");
    // Cierra el flujo (evita promesa colgada): la respuesta llega después.
    resolveQuery({ resultado: { payload: { kind: "info_card", titulo: "T", especificaciones: [] }, contexto_ccp: { cache_hit: true } } });
    await waitFor(() => expect(screen.getByText("Respuesta instantánea · caché")).toBeInTheDocument());
  });
});
