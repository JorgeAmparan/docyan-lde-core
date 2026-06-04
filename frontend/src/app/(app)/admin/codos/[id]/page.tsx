"use client";

import { use } from "react";
import { Expediente } from "../_expediente";

/** Expediente esquemático de un CoDo específico (deep-link desde Resumen). */
export default function CodoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Expediente codoId={decodeURIComponent(id)} />;
}
