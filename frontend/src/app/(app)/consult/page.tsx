"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { ConsultView, type ConsultContext } from "./consult-view";
import { useAuth } from "@/lib/auth";
import { getCodoContexto } from "@/lib/onboarding";

/**
 * /consult — vista de consulta a pantalla completa. El contexto sale del CoDo
 * activo (fijado en /select-codo → useAuth.setDoco) consultando el backend REAL
 * (`GET /mo/codos/{id}`): título, meta y `entidad_id` reales. Sin CANNED_CTX.
 * Si no hay CoDo activo o el contexto no resuelve, se vuelve a /select-codo
 * (no se finge un contexto). El `entidad_id` real se reenvía a /mo/query.
 */
export default function ConsultPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const docoId = useAuth((s) => s.docoId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["codo-contexto", docoId],
    queryFn: () => getCodoContexto(docoId as string, token as string),
    enabled: !!token && !!docoId,
    retry: false,
  });

  // Sin CoDo activo → a la selección (no inventamos contexto).
  useEffect(() => {
    if (!docoId) router.replace("/select-codo");
  }, [docoId, router]);

  if (!docoId || isLoading) {
    return (
      <div className="consult-empty" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <Icon name="loader-2" size={22} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="consult-empty" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
        <Icon name="triangle-alert" size={26} />
        <p>No pudimos cargar este CoDo. Elige otro para consultar.</p>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={() => router.replace("/select-codo")}>
          <Icon name="arrow-left" size={16} />
          Volver a mis CoDos
        </button>
      </div>
    );
  }

  const context: ConsultContext = {
    codo: data.id,
    entityId: data.entidad_id ?? undefined,
    entityName: data.nombre,
    entityTitle: data.titulo,
    entityMeta: data.meta,
  };
  return <ConsultView context={context} />;
}
