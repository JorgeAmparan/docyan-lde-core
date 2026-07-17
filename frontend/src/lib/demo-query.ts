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

/** Documento activo de las doc-tabs (fix §2.4): acota el retrieval a ESE
 *  `:DocumentoSource` — sin él, la consulta corre contra todo el CoDo y puede
 *  citar otro documento del mismo tenant demo (cross-citation). */
export async function demoQuery(
  texto: string,
  codo: string,
  documentoId?: string | null,
): Promise<DemoQueryResult> {
  try {
    return await api.post<DemoQueryResult>("/demo/query", { texto, codo, documento_id: documentoId ?? null });
  } catch {
    // El demo nunca rompe la UX del visitante: ante error de red/limite, fallback.
    return { servido: false, kind: null, resultado: null, fallback: DEMO_FALLBACK, codo, tenant_demo: "" };
  }
}

export interface DemoDocumentoOut {
  id: string;
  nombre?: string | null;
  tipo?: string | null;
}

export interface DemoCodoContextoOut {
  id: string;
  tipo: string;
  entidad_id?: string | null;
  nombre: string;
  titulo: string;
  meta: string;
  documentos: DemoDocumentoOut[];
}

/** Contexto REAL del CoDo demo (documentos con su id) — alimenta las doc-tabs.
 *  `GET /demo/codo/{key}/{codoId}`, sin auth, rate-limited por IP. Sin datos
 *  enlatados: si el CoDo demo no existe en el grafo, `api.get` lanza (404). */
export function getDemoCodoContexto(key: string, codoId: string): Promise<DemoCodoContextoOut> {
  return api.get<DemoCodoContextoOut>(
    `/demo/codo/${encodeURIComponent(key)}/${encodeURIComponent(codoId)}`,
  );
}
