/**
 * Capa de datos del onboarding + ciclo de uso (B13). Envoltorios tipados sobre el
 * backend B13, con los tipos generados desde OpenAPI (`@/types/api`). Sin tipos
 * paralelos ni datos enlatados: cada función pega un endpoint real.
 */
import { api } from "./api-client";
import type { components } from "@/types/api";

type S = components["schemas"];

export type SignupRequest = S["SignupRequest"];
export type SignupResponse = S["SignupResponse"];
export type ActivarPlanRequest = S["ActivarPlanRequest"];
export type OrgOut = S["OrgOut"];
export type CreateInvitationRequest = S["CreateInvitationRequest"];
export type InvitationOut = S["InvitationOut"];
export type InvitationList = S["InvitationList"];
export type AcceptInvitationRequest = S["AcceptInvitationRequest"];
export type AcceptInvitationResponse = S["AcceptInvitationResponse"];
export type DocumentosResponse = S["DocumentosResponse"];
export type DocumentoOut = S["DocumentoOut"];
export type DeleteDocumentoResponse = S["DeleteDocumentoResponse"];
export type TokenBundle = S["TokenBundle"];
export type UsuarioOut = S["UsuarioOut"];
export type UsuariosList = S["UsuariosList"];

/** Payload de rechazo de conversión (HTTP 402) del gate de tamaño freemium. */
export interface FreemiumExcedePayload {
  error: "freemium_documento_excede_paginas";
  plan: string;
  paginas: number;
  limite_paginas: number;
  mensaje: string;
  salidas: Array<{ accion: string; label: string }>;
}

// ── Fase 1 — registro (Freemium o, con codigo_acceso, Piloto) ────────────────

export function signup(body: SignupRequest): Promise<SignupResponse> {
  return api.post<SignupResponse>("/onboarding/signup", body);
}

// ── Fase 2 — activar plan + criticidad ───────────────────────────────────────

export function activarPlan(body: ActivarPlanRequest, token: string): Promise<OrgOut> {
  return api.post<OrgOut>("/onboarding/plan", body, { token });
}

export function getOrg(token: string): Promise<OrgOut> {
  return api.get<OrgOut>("/onboarding/org", { token });
}

export function listUsuarios(token: string): Promise<UsuariosList> {
  return api.get<UsuariosList>("/onboarding/usuarios", { token });
}

// ── Invitaciones ─────────────────────────────────────────────────────────────

export function createInvitation(
  body: CreateInvitationRequest,
  token: string,
): Promise<InvitationOut> {
  return api.post<InvitationOut>("/invitations", body, { token });
}

export function listInvitations(
  token: string,
  status?: string,
): Promise<InvitationList> {
  return api.get<InvitationList>("/invitations", {
    token,
    query: status ? { status } : undefined,
  });
}

export function acceptInvitation(
  body: AcceptInvitationRequest,
): Promise<AcceptInvitationResponse> {
  return api.post<AcceptInvitationResponse>("/invitations/accept", body);
}

// ── Gestión de documentos vivos ──────────────────────────────────────────────

export function listDocumentos(token: string): Promise<DocumentosResponse> {
  return api.get<DocumentosResponse>("/mis-documentos", { token });
}

export function deleteDocumento(
  docId: string,
  token: string,
): Promise<DeleteDocumentoResponse> {
  return api.del<DeleteDocumentoResponse>(`/mis-documentos/${encodeURIComponent(docId)}`, {
    token,
  });
}
