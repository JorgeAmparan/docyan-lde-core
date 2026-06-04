"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { components } from "@/types/api";

type ConsultaGuardada = components["schemas"]["ConsultaGuardadaOut"];
type ConsultasList = components["schemas"]["ConsultasGuardadasList"];
type Sugerencia = components["schemas"]["SugerenciaOut"];

/**
 * /saved — saved consultas with PROGRESSIVE NAMING. The word "Playbook" must NOT
 * appear until earned. Earned = backend `termino_playbook_disponible` (or the
 * dedicated naming-state endpoint) OR fallback ≥2 related saves. Recreated from
 * playbook.jsx SavedSheet (list mode) + builder.
 *
 * DESIGN: naming-state is read from /mo/queries/saved (ConsultasGuardadasList
 * carries `termino_playbook_disponible`); we also try a dedicated
 * /mo/queries/saved/playbook-naming-state and OR the two. "Related" = ≥2 saves
 * sharing entidad_referenciada_id (fallback heuristic).
 */
const CANNED_SAVED: ConsultaGuardada[] = [
  {
    id: "cg-1",
    nombre: "Torque del perno B",
    consulta_original: "¿Torque del perno B?",
    tipo_intencion: "informativa",
    entidad_referenciada_id: "ent-hettich",
    disparos_totales: 6,
    created_at: new Date().toISOString(),
  },
  {
    id: "cg-2",
    nombre: "Cambio del filtro de refrigerante",
    consulta_original: "¿Cómo cambio el filtro de refrigerante?",
    tipo_intencion: "guia",
    entidad_referenciada_id: "ent-hettich",
    disparos_totales: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: "cg-3",
    nombre: "Vibración al arrancar",
    consulta_original: "La centrífuga vibra al arrancar",
    tipo_intencion: "troubleshooting",
    entidad_referenciada_id: "ent-hettich",
    disparos_totales: 1,
    created_at: new Date().toISOString(),
  },
];

interface NamingState {
  termino_playbook_disponible: boolean;
}

function relatedEarned(items: ConsultaGuardada[]): boolean {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = it.entidad_referenciada_id ?? "_";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n >= 2);
}

export default function SavedPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [building, setBuilding] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
  const [playbookName, setPlaybookName] = useState("Arranque de centrífuga");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [muted, setMuted] = useState(false);

  /** Saved list (carries termino_playbook_disponible). */
  const { data: listData } = useQuery({
    queryKey: ["saved"],
    queryFn: async () => {
      try {
        return await api.get<ConsultasList>("/mo/queries/saved", { token });
      } catch {
        return { items: CANNED_SAVED, termino_playbook_disponible: relatedEarned(CANNED_SAVED) };
      }
    },
    retry: false,
  });

  /** Dedicated naming-state endpoint (best-effort; ORed with the list flag). */
  const { data: namingData } = useQuery({
    queryKey: ["playbook-naming-state"],
    queryFn: async () => {
      try {
        return await api.get<NamingState>("/mo/queries/saved/playbook-naming-state", { token });
      } catch {
        return null;
      }
    },
    retry: false,
  });

  /** EDB suggestions (on-demand). */
  const { data: suggestions, refetch: fetchSuggestions, isFetching: loadingSug } = useQuery({
    queryKey: ["playbook-suggestions"],
    queryFn: async () => {
      try {
        return await api.get<Sugerencia[]>("/mo/playbooks/sugerencias", { token });
      } catch {
        return [] as Sugerencia[];
      }
    },
    enabled: false,
    retry: false,
  });

  const items = listData?.items ?? CANNED_SAVED;
  const earned =
    Boolean(listData?.termino_playbook_disponible) ||
    Boolean(namingData?.termino_playbook_disponible) ||
    relatedEarned(items);

  const noun = earned ? "Playbook" : "consulta guardada";
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (it) => it.nombre.toLowerCase().includes(term) || it.consulta_original.toLowerCase().includes(term),
    );
  }, [items, q]);

  const renameMutation = useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) =>
      api.patch(`/mo/queries/saved/${id}`, { nombre }, { token }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.del(`/mo/queries/saved/${id}`, { token }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved"] }),
  });

  const createPlaybook = useMutation({
    mutationFn: async () => {
      const pasos = (order.length ? order : items.map((i) => i.id)).map((id, i) => ({
        consulta_guardada_id: id,
        nota_paso: stepNotes[id] || null,
        orden: i + 1,
      }));
      return api.post<components["schemas"]["PlaybookOut"]>(
        "/mo/playbooks",
        { nombre: playbookName, pasos },
        { token },
      );
    },
    onSuccess: (pb) => {
      if (pb?.id) router.push(`/playbook/${pb.id}`);
    },
  });

  const decideSug = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "reject" | "ignore" }) =>
      api.post(
        `/mo/playbooks/sugerencias/${id}/${action}`,
        action === "accept" ? { nombre: null } : undefined,
        { token },
      ),
    onSettled: () => fetchSuggestions(),
  });

  const startRename = (it: ConsultaGuardada) => {
    setRenaming(it.id);
    setRenameValue(it.nombre);
  };
  const commitRename = (id: string) => {
    if (renameValue.trim()) renameMutation.mutate({ id, nombre: renameValue.trim() });
    setRenaming(null);
  };

  const builderItems = order.length ? order.map((id) => items.find((i) => i.id === id)!).filter(Boolean) : items;

  return (
    <div className="sheet" style={{ position: "fixed", inset: 0, maxWidth: 560, margin: "0 auto" }}>
      <div className="sheet-head">
        <button className="x" onClick={() => router.back()} aria-label="Volver">
          <Icon name="arrow-left" size={18} />
        </button>
        <h2>{earned ? "Tus consultas" : "Mis consultas guardadas"}</h2>
        <button className="x" onClick={() => router.push("/consult")} aria-label="Cerrar">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="sheet-body">
        {/* Search */}
        <div className="search" style={{ marginBottom: 8 }}>
          <Icon name="search" size={15} />
          <input placeholder="Buscar consulta…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {items.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "40px 20px" }}>
            <Icon name="bookmark" size={28} />
            <p style={{ fontSize: 14, marginTop: 10 }}>
              Aún no guardas consultas.
              <br />
              Guarda una respuesta útil para volver a ella.
            </p>
          </div>
        )}

        {!building &&
          filtered.map((it, i) => (
            <div className="saved-item" key={it.id}>
              {earned ? (
                <span className="num">{i + 1}</span>
              ) : (
                <span className="grip">
                  <Icon name="grip-vertical" size={16} />
                </span>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                {renaming === it.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(it.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(it.id);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    style={{ width: "100%", font: "inherit" }}
                  />
                ) : (
                  <div className="si-t">{it.nombre}</div>
                )}
                <div className="si-m">CODO-LAB-04 · {it.disparos_totales} disparos</div>
              </div>
              <div className="al-acts">
                <button type="button" onClick={() => startRename(it)} aria-label="Renombrar">
                  <Icon name="pencil" size={14} />
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(it.id)} aria-label="Eliminar">
                  <Icon name="trash-2" size={14} />
                </button>
              </div>
            </div>
          ))}

        {/* Progressive nudge — only when "Playbook" is EARNED. */}
        {earned && !building && (
          <div className="nudge" style={{ marginTop: 4 }}>
            <div className="nh">
              <Icon name="git-branch" size={17} />
              Secuencia detectada
            </div>
            <p>
              Tienes consultas que se repiten. ¿Quieres encadenarlas como <strong>Playbook</strong>?
            </p>
            <button
              type="button"
              className="sug"
              style={{ background: "var(--cinnabar-500)", color: "#fff", border: "none", justifyContent: "center", fontWeight: 600 }}
              onClick={() => {
                setOrder(items.map((i) => i.id));
                setBuilding(true);
              }}
            >
              <Icon name="git-branch" size={15} />
              Crear Playbook
            </button>
          </div>
        )}

        {/* Builder — ordered list + name + per-step notes. */}
        {earned && building && (
          <div>
            <div className="field2">
              <label>Nombre del Playbook</label>
              <input value={playbookName} onChange={(e) => setPlaybookName(e.target.value)} />
            </div>
            {builderItems.map((it, i) => (
              <div className="saved-item" key={it.id} style={{ flexWrap: "wrap" }}>
                <span className="num">{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="si-t">{it.nombre}</div>
                  <input
                    placeholder="Nota para este paso (opcional)"
                    value={stepNotes[it.id] ?? ""}
                    onChange={(e) => setStepNotes((s) => ({ ...s, [it.id]: e.target.value }))}
                    style={{ width: "100%", marginTop: 6, font: "inherit" }}
                  />
                </div>
                <div className="al-acts">
                  <button
                    type="button"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() =>
                      setOrder((o) => {
                        const arr = o.length ? [...o] : items.map((x) => x.id);
                        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                        return arr;
                      })
                    }
                  >
                    <Icon name="arrow-up" size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar"
                    disabled={i === builderItems.length - 1}
                    onClick={() =>
                      setOrder((o) => {
                        const arr = o.length ? [...o] : items.map((x) => x.id);
                        [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                        return arr;
                      })
                    }
                  >
                    <Icon name="arrow-down" size={14} />
                  </button>
                </div>
              </div>
            ))}
            <div className="acts" style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="mini-btn" onClick={() => setBuilding(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ marginLeft: "auto" }}
                disabled={createPlaybook.isPending}
                onClick={() => createPlaybook.mutate()}
              >
                {createPlaybook.isPending ? "Creando…" : "Crear Playbook"}
              </button>
            </div>
          </div>
        )}

        {/* On-demand EDB suggestions. */}
        {!building && (
          <div className="patterns slim" style={{ marginTop: 12 }}>
            <div className="ph">
              <Icon name="sparkles" size={15} />
              ¿DOCYAN ve algún patrón en mis consultas?
            </div>
            {!muted ? (
              <>
                <button
                  type="button"
                  className="sug"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setShowSuggestions(true);
                    fetchSuggestions();
                  }}
                >
                  <Icon name="wand-2" size={14} />
                  {loadingSug ? "Buscando patrones…" : "Buscar patrones"}
                </button>

                {showSuggestions &&
                  (suggestions ?? []).map((s) => (
                    <div key={s.id} className="alert-card s-caution" style={{ marginTop: 10 }}>
                      <div className="al-top">
                        <span className="al-t">{s.tipo_sugerencia}</span>
                      </div>
                      <span className="al-m">
                        {(s.consulta_guardada_ids?.length ?? 0)} consultas relacionadas
                      </span>
                      <div className="al-foot">
                        <div className="al-acts">
                          <button type="button" onClick={() => decideSug.mutate({ id: s.id, action: "accept" })}>
                            Aceptar
                          </button>
                          <button type="button" onClick={() => decideSug.mutate({ id: s.id, action: "reject" })}>
                            Rechazar
                          </button>
                          <button type="button" onClick={() => decideSug.mutate({ id: s.id, action: "ignore" })}>
                            Ignorar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                {showSuggestions && (suggestions ?? []).length === 0 && !loadingSug && (
                  <p style={{ marginTop: 8, fontSize: 13, color: "var(--fg-muted)" }}>
                    Aún no hay patrones suficientes. Guarda más consultas y vuelve a intentar.
                  </p>
                )}
              </>
            ) : (
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--fg-muted)" }}>
                Sugerencias silenciadas.
              </p>
            )}
            <label className="chk" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
              Silenciar sugerencias
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
