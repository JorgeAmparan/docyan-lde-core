"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { ConsultView, type ConsultContext } from "@/app/(app)/consult/consult-view";

/**
 * PUBLIC collaborator entry — the QR is the credential, no auth (this route lives
 * OUTSIDE the middleware PROTECTED list). Resuelve el [token] al contexto REAL de
 * CoDo + entidad (`GET /qr/{token}?format=json` → ResolvedQr) y renderiza la vista
 * de consulta precargada. Sin contexto enlatado: si el token no resuelve (404/red)
 * se muestra un estado honesto, no una entidad falsa (fake-success).
 */
interface QrEntidad {
  id?: string;
  nombre?: string;
  tipo?: string;
}
interface QrResolved {
  tenant_id?: string;
  entidad_id?: string;
  entidad?: QrEntidad;
  documentos?: unknown[];
}

function toContext(token: string, data: QrResolved): ConsultContext {
  const ent = data.entidad ?? {};
  const name = ent.nombre ?? ent.tipo ?? data.entidad_id ?? "Entidad";
  const nDocs = Array.isArray(data.documentos) ? data.documentos.length : 0;
  return {
    codo: data.entidad_id ?? ent.id ?? token,
    entityId: data.entidad_id ?? ent.id,
    entityName: name,
    entityTitle: name,
    entityMeta: `QR escaneado · ${nDocs} documento${nDocs === 1 ? "" : "s"} vivo${nDocs === 1 ? "" : "s"}`,
    tokenQr: token,
  };
}

export default function QrEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["qr", token],
    queryFn: () => api.get<QrResolved>(`/qr/${token}`, { query: { format: "json" } }),
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="consult-empty" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <Icon name="loader-2" size={22} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="consult-empty"
        style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}
      >
        <Icon name="triangle-alert" size={26} />
        <p>Este código QR no es válido o ya no está disponible.</p>
      </div>
    );
  }

  return <ConsultView context={toContext(token, data)} />;
}
