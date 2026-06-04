"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

/**
 * /select-codo — admin picks the active CoDo before consulting. Recreated from
 * access.jsx (codo-select step) with a search box. Clicking a card sets the
 * active doco (useAuth.setDoco) and routes to /consult.
 *
 * DESIGN: no CoDo-list endpoint exists in the generated OpenAPI yet. We try
 * GET /mo/codos and fall back to the canned ORG_CODOS list so the flow works.
 * PENDIENTE DE JORGE: confirm the CoDo-list endpoint path + shape.
 */
type Status = "warn" | "ok";
interface Codo {
  id: string;
  name: string;
  docs: number;
  status: Status;
}

const CANNED_CODOS: Codo[] = [
  { id: "CODO-LAB-04", name: "Centrífugas & rotores", docs: 24, status: "warn" },
  { id: "CODO-LAB-02", name: "Balanzas analíticas", docs: 31, status: "ok" },
  { id: "CODO-LAB-07", name: "Autoclaves & esterilización", docs: 18, status: "ok" },
  { id: "CODO-MAQ-01", name: "Línea de ensamble A", docs: 40, status: "warn" },
  { id: "CODO-MAQ-03", name: "Prensas hidráulicas", docs: 12, status: "ok" },
  { id: "CODO-LAB-11", name: "Espectrofotómetros", docs: 17, status: "ok" },
];

interface RawCodo {
  id?: string;
  codo_id?: string;
  nombre?: string;
  name?: string;
  documentos?: number;
  docs?: number;
  estado?: string;
}

function normalize(raw: RawCodo[]): Codo[] {
  return raw.map((c) => ({
    id: c.id ?? c.codo_id ?? "CODO",
    name: c.nombre ?? c.name ?? "CoDo",
    docs: c.documentos ?? c.docs ?? 0,
    status: c.estado === "warn" || c.estado === "alertas" ? "warn" : "ok",
  }));
}

export default function SelectCodoPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const setDoco = useAuth((s) => s.setDoco);
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["codos"],
    queryFn: async () => {
      try {
        const res = await api.get<{ items?: RawCodo[] } | RawCodo[]>("/mo/codos", { token });
        const list = Array.isArray(res) ? res : (res.items ?? []);
        return list.length ? normalize(list) : CANNED_CODOS;
      } catch {
        return CANNED_CODOS;
      }
    },
    retry: false,
  });

  const codos = data ?? CANNED_CODOS;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return codos;
    return codos.filter((c) => c.id.toLowerCase().includes(term) || c.name.toLowerCase().includes(term));
  }, [codos, q]);

  const pick = (c: Codo) => {
    setDoco(c.id);
    router.push("/consult");
  };

  return (
    <div className="access-stage">
      <div className="codo-select">
        <div className="cs-head">
          <div>
            <span className="eyebrow-m">Selecciona un CoDo</span>
            <h1>Tienes acceso a {codos.length} CoDos</h1>
          </div>
          <div className="search" style={{ marginLeft: "auto" }}>
            <Icon name="search" size={15} />
            <input placeholder="Buscar CoDo…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
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
                <Icon name="folder-tree" size={18} />
                {c.status === "warn" && (
                  <span className="badge warn">
                    <Icon name="alarm-clock" size={11} />
                    alertas
                  </span>
                )}
                {c.status === "ok" && (
                  <span className="badge ok">
                    <Icon name="check" size={11} />
                    al día
                  </span>
                )}
              </div>
              <div className="cs-id mono">{c.id}</div>
              <div className="cs-name">{c.name}</div>
              <div className="cs-docs">{c.docs} documentos vivos</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: "var(--fg-muted)", padding: "20px 4px" }}>
              Sin CoDos que coincidan con “{q}”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
