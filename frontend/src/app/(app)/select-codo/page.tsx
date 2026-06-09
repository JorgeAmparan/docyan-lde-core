"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { listCodos, type CodoOut } from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * /select-codo — el usuario elige el CoDo a consultar. Lista REAL del tenant
 * (`GET /mo/codos`): entidades operativas (QR) + documentos sueltos (onboarding
 * freemium). Sin datos enlatados: si el motor no responde se muestra un error
 * honesto; si no hay CoDos todavía, un estado vacío que lleva a cargar el primero.
 * Al elegir un CoDo se fija el doco activo (`useAuth.setDoco`) y se entra a /consult.
 */
export default function SelectCodoPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const setDoco = useAuth((s) => s.setDoco);
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["codos"],
    queryFn: () => listCodos(token as string),
    enabled: !!token,
    retry: false,
  });

  const codos: CodoOut[] = useMemo(() => data?.items ?? [], [data]);
  const loadErr = error
    ? error instanceof ApiError
      ? error.message
      : "El motor no respondió. Reintenta en unos segundos."
    : null;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return codos;
    return codos.filter(
      (c) => c.id.toLowerCase().includes(term) || c.nombre.toLowerCase().includes(term),
    );
  }, [codos, q]);

  const pick = (c: CodoOut) => {
    setDoco(c.id);
    router.push("/consult");
  };

  return (
    <div className="access-stage">
      <div className="codo-select">
        <div className="cs-head">
          <div>
            <span className="eyebrow-m">Selecciona un CoDo</span>
            <h1>
              {isLoading
                ? "Cargando tus CoDos…"
                : `Tienes acceso a ${codos.length} CoDo${codos.length === 1 ? "" : "s"}`}
            </h1>
          </div>
          <div className="search" style={{ marginLeft: "auto" }}>
            <Icon name="search" size={15} />
            <input placeholder="Buscar CoDo…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loadErr && (
          <p className="warn" role="alert" style={{ padding: "12px 4px" }}>
            {loadErr}
          </p>
        )}

        {!isLoading && !loadErr && codos.length === 0 && (
          <div className="consult-empty" style={{ padding: "28px 4px" }}>
            <Icon name="files" size={26} />
            <p>
              Aún no tienes documentos consultables. Carga tu primer documento y, cuando termine de
              ingerirse, aparecerá aquí como CoDo.
            </p>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => router.push("/documentos")}>
              <Icon name="upload-cloud" size={16} />
              Cargar un documento
            </button>
          </div>
        )}

        <div className="cs-grid">
          {filtered.map((c) => (
            <div
              className="cs-card"
              key={c.id}
              onClick={() => pick(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") pick(c);
              }}
            >
              <div className="cs-top">
                <Icon name={c.tipo === "entidad" ? "folder-tree" : "file-text"} size={18} />
                {c.estado === "warn" && (
                  <span className="badge warn">
                    <Icon name="alarm-clock" size={11} />
                    alertas
                  </span>
                )}
                {c.estado === "ok" && (
                  <span className="badge ok">
                    <Icon name="check" size={11} />
                    al día
                  </span>
                )}
              </div>
              <div className="cs-id mono">{c.tipo_documento ?? (c.tipo === "entidad" ? "Entidad" : "Documento")}</div>
              <div className="cs-name">{c.nombre}</div>
              <div className="cs-docs">
                {c.documentos} documento{c.documentos === 1 ? "" : "s"} vivo{c.documentos === 1 ? "" : "s"}
              </div>
            </div>
          ))}
          {!isLoading && !loadErr && codos.length > 0 && filtered.length === 0 && (
            <div style={{ color: "var(--fg-muted)", padding: "20px 4px" }}>
              Sin CoDos que coincidan con “{q}”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
