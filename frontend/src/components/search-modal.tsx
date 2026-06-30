"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { listCodos } from "@/lib/onboarding";

/**
 * SearchModal — búsqueda command-palette del shell (P2, Matriz de Cierre).
 * Portado 1:1 del prototipo (`app/ui-kit.jsx` → `DCSearchHost`, clases `.dcs-*`):
 * barra + grupos Documentos / CoDos + fila "Preguntar". Aquí va contra el backend
 * REAL: el índice es la lista de CoDos del tenant (`GET /mo/codos`), filtrada en
 * cliente como en el prototipo. Un CoDo de tipo "documento" es un documento suelto;
 * uno de tipo "entidad" es un CoDo. Sin datos enlatados.
 */
export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [q, setQ] = useState("");
  const inRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["codos-search"],
    queryFn: () => listCodos(token as string),
    enabled: open && !!token,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  // Cierra y limpia la consulta (reset al cerrar, no en un effect → sin cascadas).
  const close = () => {
    setQ("");
    onClose();
  };

  const items = data?.items ?? [];
  const ql = q.trim().toLowerCase();
  const hits = ql
    ? items.filter((x) => x.nombre.toLowerCase().includes(ql) || x.id.toLowerCase().includes(ql))
    : items;
  const docs = hits.filter((x) => x.tipo === "documento").slice(0, 6);
  const codos = hits.filter((x) => x.tipo === "entidad").slice(0, 4);

  const goCodo = (id: string) => {
    close();
    router.push(`/admin/codos/${encodeURIComponent(id)}`);
  };
  const ask = () => {
    close();
    router.push("/consult");
  };

  return (
    <div className="dcs-scrim" onClick={close}>
      <div className="dcs" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Búsqueda">
        <div className="dcs-bar">
          <Icon name="search" size={18} className="lic" />
          <input
            ref={inRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un documento, un CoDo, o pregunta directo…"
            aria-label="Buscar"
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter" && ql) ask();
            }}
          />
          <kbd className="dcs-esc">esc</kbd>
        </div>
        <div className="dcs-body">
          {ql && (
            <button className="dcs-ask" onClick={ask}>
              <span className="dcs-ic cin">
                <Icon name="messages-square" size={16} />
              </span>
              <span className="dcs-asktxt">
                Preguntar: <b>“{q.trim()}”</b>
              </span>
              <Icon name="corner-down-left" size={15} />
            </button>
          )}

          {docs.length > 0 && <div className="dcs-grp">Documentos</div>}
          {docs.map((x) => (
            <button className="dcs-row" key={x.id} onClick={() => goCodo(x.id)}>
              <span className="dcs-ic">
                <Icon name="file-text" size={16} />
              </span>
              <span className="dcs-rtxt">
                <span className="dcs-rn">{x.nombre}</span>
                <span className="dcs-rm">
                  <span className="dcs-codo">{x.id}</span>
                  {x.tipo_documento ?? "documento"}
                </span>
              </span>
              <Icon name="arrow-right" size={15} className="lic" />
            </button>
          ))}

          {codos.length > 0 && <div className="dcs-grp">CoDos</div>}
          {codos.map((x) => (
            <button className="dcs-row" key={x.id} onClick={() => goCodo(x.id)}>
              <span className="dcs-ic">
                <Icon name="folder-tree" size={16} />
              </span>
              <span className="dcs-rtxt">
                <span className="dcs-rn">{x.nombre}</span>
                <span className="dcs-rm">
                  <span className="dcs-codo">{x.id}</span>
                  {x.documentos} {x.documentos === 1 ? "documento" : "documentos"}
                </span>
              </span>
              <Icon name="arrow-right" size={15} className="lic" />
            </button>
          ))}

          {docs.length === 0 && codos.length === 0 && !ql && (
            <div className="dcs-empty">Escribe para buscar en tus CoDos y documentos.</div>
          )}
          {docs.length === 0 && codos.length === 0 && ql && (
            <div className="dcs-empty">Sin resultados. Presiona Enter para preguntar directo.</div>
          )}
        </div>
      </div>
    </div>
  );
}
