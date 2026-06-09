/**
 * Roles de organización — fuente única de verdad del LABEL en la UI (B13).
 *
 * El backend (DB/JWT) usa el enum `admin | editor | viewer` y NO cambia (sin tocar
 * migraciones). La UI muestra el modelo Admin / Editor / Consulta acordado con
 * Claude Design: `viewer` se RE-ETIQUETA a "Consulta". Este módulo centraliza el
 * mapeo valor↔label para que el relabel sea consistente y testeable en aislamiento.
 *
 * Regla de invitación (espejo del backend, que es la autoridad — el frontend solo
 * oculta opciones que el backend de todos modos rechaza):
 *   · admin  → puede invitar admin | editor | viewer
 *   · editor → solo puede invitar viewer (Consulta)
 *   · viewer → no puede invitar
 */

/** Valor real del rol tal como vive en DB/JWT. NO cambiar (es el enum del backend). */
export type OrgRole = "admin" | "editor" | "viewer";

export const ORG_ROLES: readonly OrgRole[] = ["admin", "editor", "viewer"] as const;

/** Label de UI por rol. `viewer` se muestra como "Consulta" (decisión de diseño). */
export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Consulta",
};

/** Descripción corta por rol (para selects/tooltips de invitación). */
export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  admin: "Dueño de la cuenta: todo, incluido plan/facturación e invitar a cualquiera.",
  editor: "Opera la cuenta: ingiere, elimina/reemplaza documentos e invita Consultas.",
  viewer: "Solo consulta: pregunta y recibe respuesta citada.",
};

/** Devuelve el label de UI de un rol; tolera valores desconocidos (fallback). */
export function roleLabel(role: string | null | undefined): string {
  if (role && role in ROLE_LABELS) return ROLE_LABELS[role as OrgRole];
  return role ?? "";
}

/**
 * Roles que un usuario con `inviterRole` puede invitar (espejo de la regla del
 * backend). Vacío si no puede invitar. El backend rechaza igual si se evade la UI.
 */
export function invitableRoles(inviterRole: string | null | undefined): OrgRole[] {
  if (inviterRole === "admin") return ["admin", "editor", "viewer"];
  if (inviterRole === "editor") return ["viewer"];
  return [];
}

/** ¿Puede `inviterRole` invitar a `targetRole`? (espejo del backend). */
export function canInvite(
  inviterRole: string | null | undefined,
  targetRole: string,
): boolean {
  return invitableRoles(inviterRole).includes(targetRole as OrgRole);
}
