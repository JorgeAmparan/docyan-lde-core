/**
 * Cliente de la consulta demo pública (F3 §D).
 *
 * `POST /demo/query` — consulta real contra un tenant demo (solo lectura), sin auth,
 * rate-limited por IP en el backend. Es la CAPA 3 del input libre del handoff §8:
 * cuando no hay match exacto preparado, se pregunta al backend real; si el grafo demo
 * no sostiene la pregunta, el backend devuelve un fallback honesto (no inventa).
 */
import { api } from "./api-client";

export interface DemoQueryResult {
  servido: boolean;
  kind: string | null;
  /** ConsultaResuelta (shape de la PWA) cuando hay respuesta citada real. */
  resultado: Record<string, unknown> | null;
  /** Mensaje honesto cuando el grafo demo no sostiene la pregunta. */
  fallback: string | null;
  codo: string;
  tenant_demo: string;
}

/** Mensaje honesto por defecto si el backend no es alcanzable (offline-safe). */
export const DEMO_FALLBACK =
  "Esa pregunta no está en este documento demo — pruébalo con tus documentos.";

export async function demoQuery(texto: string, codo: string): Promise<DemoQueryResult> {
  try {
    return await api.post<DemoQueryResult>("/demo/query", { texto, codo });
  } catch {
    // El demo nunca rompe la UX del visitante: ante error de red/limite, fallback.
    return { servido: false, kind: null, resultado: null, fallback: DEMO_FALLBACK, codo, tenant_demo: "" };
  }
}
