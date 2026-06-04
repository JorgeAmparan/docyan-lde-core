"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { ConsultView, type ConsultContext } from "@/app/(app)/consult/consult-view";
import { CANNED_CTX } from "@/app/(app)/consult/consult-data";

/**
 * PUBLIC collaborator entry — the QR is the credential, no auth (this route lives
 * OUTSIDE the middleware PROTECTED list). Resolves the [token] to CoDo + entity
 * context and renders the full consult view pre-loaded with it.
 *
 * DESIGN: GET /qr/{token} defaults to a 307 redirect; we request `?format=json`
 * to get the resolved context. Its shape is untyped in the OpenAPI, so we map
 * defensively across likely field names. On ANY failure (404/network) we render
 * the canned CODO-LAB-04 · Centrífuga Hettich context so the demo always works.
 */
interface QrResolved {
  codo?: string;
  codo_id?: string;
  doco_id?: string;
  entidad?: { id?: string; nombre?: string; titulo?: string; meta?: string };
  entidad_id?: string;
  entidad_nombre?: string;
  entidad_titulo?: string;
  documentos?: number;
}

function toContext(token: string, data?: QrResolved): ConsultContext {
  if (!data) return { ...CANNED_CTX, tokenQr: token };
  const ent = data.entidad ?? {};
  const name = ent.nombre ?? data.entidad_nombre ?? CANNED_CTX.entityName;
  const docs = typeof data.documentos === "number" ? data.documentos : undefined;
  return {
    codo: data.codo ?? data.codo_id ?? data.doco_id ?? CANNED_CTX.codo,
    entityName: name,
    entityTitle: ent.titulo ?? data.entidad_titulo ?? name,
    entityMeta:
      ent.meta ??
      (docs !== undefined ? `QR escaneado · ${docs} documentos vivos` : CANNED_CTX.entityMeta),
    entityId: ent.id ?? data.entidad_id,
    tokenQr: token,
  };
}

export default function QrEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const { data } = useQuery({
    queryKey: ["qr", token],
    queryFn: () => api.get<QrResolved>(`/qr/${token}`, { query: { format: "json" } }),
    retry: false,
    staleTime: 5 * 60_000,
  });

  return <ConsultView context={toContext(token, data)} />;
}
