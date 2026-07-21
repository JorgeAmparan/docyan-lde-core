/**
 * Capa de datos de Alertas / Eventos Dirigidos (ED-1). Envoltorios tipados sobre el
 * backend, con los tipos generados desde OpenAPI (`@/types/api`). Sin tipos
 * paralelos ni datos enlatados: cada función pega un endpoint real.
 */
import { api } from "./api-client";
import type { components } from "@/types/api";

type S = components["schemas"];

export type ReglaAlertaOut = S["ReglaAlertaOut"];
export type ReglaAlertaUpdate = S["ReglaAlertaUpdate"];
export type DestinatarioOut = S["DestinatarioOut"];
export type DestinatarioCreate = S["DestinatarioCreate"];

/** Reglas de alerta del tenant (la global `*` es la que edita esta vista). */
export function listReglas(token: string): Promise<ReglaAlertaOut[]> {
  return api.get<ReglaAlertaOut[]>("/alertas/reglas", { token });
}

/** Upsert de la regla global de alertas (thresholds + destinatarios + canales). */
export function saveRegla(body: ReglaAlertaUpdate, token: string): Promise<ReglaAlertaOut> {
  return api.put<ReglaAlertaOut>("/alertas/reglas", body, { token });
}

/** Directorio de Destinatarios del tenant. */
export function listDestinatarios(token: string): Promise<DestinatarioOut[]> {
  return api.get<DestinatarioOut[]>("/destinatarios", { token });
}

/** Alta de un destinatario (el admin da de alta; el operador solo selecciona). */
export function createDestinatario(
  body: DestinatarioCreate,
  token: string,
): Promise<DestinatarioOut> {
  return api.post<DestinatarioOut>("/destinatarios", body, { token });
}
