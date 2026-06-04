"use client";

import { ConsultView, type ConsultContext } from "./consult-view";
import { useAuth } from "@/lib/auth";
import { CANNED_CTX } from "./consult-data";

/**
 * /consult — authenticated full-screen consult view. Context comes from the
 * active CoDo (set via /select-codo → useAuth.setDoco). DESIGN: the backend has
 * no CoDo-context endpoint in the generated OpenAPI yet, so we render the canned
 * Centrífuga Hettich context keyed by the active doco id. PENDIENTE DE JORGE:
 * confirm the CoDo-context endpoint to hydrate entityTitle/meta from real data.
 */
export default function ConsultPage() {
  const docoId = useAuth((s) => s.docoId);
  const context: ConsultContext = {
    ...CANNED_CTX,
    codo: docoId ?? CANNED_CTX.codo,
  };
  return <ConsultView context={context} />;
}
