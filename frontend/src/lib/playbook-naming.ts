/**
 * Progressive naming gate (design non-negotiable): the word "Playbook" must NOT
 * surface until the user's behavior earns it — ≥2 RELATED saved consultas (same
 * entity or a repeated sequence). The backend is the authority
 * (`GET /mo/queries/saved/playbook-naming-state`); the frontend falls back to the
 * local related-count when that state isn't available.
 *
 * Source of truth for the UI label so the rule is testable in isolation.
 */
export function playbookEarned(
  relatedSavedCount: number,
  backendEarned?: boolean | null,
): boolean {
  if (typeof backendEarned === "boolean") return backendEarned;
  return relatedSavedCount >= 2;
}

/** The label shown for the saved-consultas surface — never "Playbook" until earned. */
export function savedSurfaceLabel(
  relatedSavedCount: number,
  backendEarned?: boolean | null,
): "Mis consultas guardadas" | "Tus consultas" {
  return playbookEarned(relatedSavedCount, backendEarned) ? "Tus consultas" : "Mis consultas guardadas";
}
