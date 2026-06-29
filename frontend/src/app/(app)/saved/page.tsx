"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icon";
import { OrgShell } from "@/components/org-shell";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { playbookEarned } from "@/lib/playbook-naming";
import type { components } from "@/types/api";

type ConsultaGuardada = components["schemas"]["ConsultaGuardadaOut"];
type ConsultasList = components["schemas"]["ConsultasGuardadasList"];
type Sugerencia = components["schemas"]["SugerenciaOut"];
type Playbook = components["schemas"]["PlaybookOut"];

/**
 * /saved — Inteligencia a demanda. Superficie de consultas guardadas que se eleva
 * a dos niveles del prototipo (`InteligenciaView` en org-views.jsx):
 *   · Nivel C — Sugerencias: patrones detectados por el grafo (EDB). NO se ejecutan
 *     solos; tú decides. Aceptar una sugerencia la promueve a Playbook.
 *   · Nivel B — Playbooks: la biblioteca de secuencias YA ganadas (crear/correr/borrar).
 *
 * NAMING PROGRESIVO (regla no negociable): la palabra "Playbook" solo aparece
 * cuando se gana. Una sugerencia es "Sugerencia" hasta que se acepta; recién
 * entonces vive como "Playbook" en la biblioteca. Las consultas sueltas son
 * "consultas guardadas", nunca Playbooks de forma prematura.
 *
 * Wiring real (sin mocks de decisión):
 *   · GET  /mo/queries/saved              → consultas guardadas (+ termino_playbook_disponible)
 *   · GET  /mo/playbooks/sugerencias      → Nivel C (patrones)
 *   · POST /mo/playbooks/sugerencias/{id}/{accept|reject|ignore}
 *   · GET  /mo/playbooks                  → Nivel B (biblioteca)
 *   · DELETE /mo/playbooks/{id}           → borrar Playbook
 *   · POST /mo/playbooks/{id}/run         → correr (navega al runner)
 */

/** Etiquetas humanas por tipo_sugerencia real del backend (pedagogica | inteligencia). */
const SUG_META: Record<string, { icon: string; titulo: string }> = {
  pedagogica: { icon: "repeat", titulo: "Consultas que repites sobre el mismo equipo" },
  inteligencia: { icon: "sparkles", titulo: "Patrón de uso detectado en tus consultas" },
};

function relatedCount(items: ConsultaGuardada[]): number {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = it.entidad_referenciada_id ?? "_";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

export default function SavedPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();

  const [borrando, setBorrando] = useState<string | null>(null);

  /** Consultas guardadas (acarrean termino_playbook_disponible). */
  const { data: listData } = useQuery({
    queryKey: ["saved"],
    queryFn: () => api.get<ConsultasList>("/mo/queries/saved", { token }),
    retry: false,
  });

  /** Nivel C — Sugerencias (patrones del grafo). */
  const { data: sugerencias } = useQuery({
    queryKey: ["playbook-suggestions"],
    queryFn: () => api.get<Sugerencia[]>("/mo/playbooks/sugerencias", { token }),
    retry: false,
  });

  /** Nivel B — Biblioteca de Playbooks. */
  const { data: playbooks } = useQuery({
    queryKey: ["playbooks"],
    queryFn: () => api.get<Playbook[]>("/mo/playbooks", { token }),
    retry: false,
  });

  const items = useMemo(() => listData?.items ?? [], [listData]);
  const sugs = useMemo(() => (sugerencias ?? []).filter((s) => s.estado === "propuesta"), [sugerencias]);
  const pbs = playbooks ?? [];

  /** Nombre de una consulta guardada por id (para los pasos del Playbook). */
  const savedById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) m.set(it.id, it.nombre);
    return m;
  }, [items]);

  // El término "Playbook" ya está ganado si el backend lo dice o si hay ≥2 consultas
  // relacionadas. (No bloquea las secciones del prototipo, que ya hablan de Playbook
  // de forma gobernada; sirve para el copy honesto del estado vacío.)
  const earned = playbookEarned(relatedCount(items), listData?.termino_playbook_disponible);

  const decideSug = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" | "ignore" }) =>
      api.post(
        `/mo/playbooks/sugerencias/${id}/${action}`,
        action === "accept" ? { nombre: null } : undefined,
        { token },
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["playbook-suggestions"] });
      qc.invalidateQueries({ queryKey: ["playbooks"] });
    },
  });

  const borrarPb = useMutation({
    mutationFn: (id: string) => api.del(`/mo/playbooks/${id}`, { token }),
    onSettled: () => {
      setBorrando(null);
      qc.invalidateQueries({ queryKey: ["playbooks"] });
    },
  });

  const crearPb = useMutation({
    mutationFn: () => {
      const pasos = items.map((it, i) => ({ consulta_guardada_id: it.id, nota_paso: null, orden: i + 1 }));
      return api.post<Playbook>("/mo/playbooks", { nombre: "Nuevo Playbook", pasos }, { token });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }),
  });

  const correrPb = (id: string) => router.push(`/playbook/${id}`);

  return (
    <OrgShell>
      <div className="inteligencia-view">
          {/* Banner — la inteligencia no interrumpe; nada se ejecuta sin que lo aceptes. */}
          <div className="admin-banner">
            <Icon name="sparkles" size={15} />
            <span>
              Inteligencia a demanda — DOCYAN detecta patrones de uso, pero <b>no interrumpe</b>. Tú decides qué se
              vuelve rutina. Nada se ejecuta sin que lo aceptes.
            </span>
          </div>

          {/* ───────── Nivel C — Sugerencias ───────── */}
          <div className="sec-h2" style={{ marginTop: 18 }}>
            <h2>Sugerencias</h2>
            <span className="cnt">{sugs.length} pendientes · patrones detectados</span>
          </div>
          {sugs.length === 0 ? (
            <div
              className="panel"
              style={{ textAlign: "center", color: "var(--fg-subtle)", fontSize: 13.5, padding: "26px 16px" }}
            >
              Sin sugerencias pendientes. Aparecen cuando el grafo detecta un patrón de uso repetido.
            </div>
          ) : (
            sugs.map((s) => {
              const meta = SUG_META[s.tipo_sugerencia] ?? SUG_META.inteligencia;
              const nConsultas = s.consulta_guardada_ids?.length ?? 0;
              const ec = (s.evidencia_conductual ?? {}) as { disparos_ventana?: number; ventana_dias?: number };
              const evidencia =
                typeof ec.disparos_ventana === "number" && typeof ec.ventana_dias === "number"
                  ? `${ec.disparos_ventana} usos · ${ec.ventana_dias} días`
                  : "patrón reciente";
              return (
                <div className="sug-card" key={s.id}>
                  <span className="sug-ic">
                    <Icon name={meta.icon} size={17} />
                  </span>
                  <div className="sug-body">
                    <div className="sug-t">{meta.titulo}</div>
                    <div className="sug-d">
                      {nConsultas} {nConsultas === 1 ? "consulta guardada" : "consultas guardadas"} se repiten juntas.
                      ¿Las encadenas como Playbook para correrlas de una?
                    </div>
                    <div className="sug-meta">
                      <span className="sug-ev">
                        <Icon name="activity" size={12} />
                        {evidencia}
                      </span>
                      <span className="sug-steps">
                        <Icon name="list" size={12} />
                        {nConsultas} {nConsultas === 1 ? "paso" : "pasos"}
                      </span>
                    </div>
                  </div>
                  <div className="sug-acts">
                    <button
                      type="button"
                      className="btn btn-primary sm"
                      disabled={decideSug.isPending}
                      onClick={() => decideSug.mutate({ id: s.id, action: "accept" })}
                    >
                      <Icon name="git-branch" size={14} />
                      Aceptar como Playbook
                    </button>
                    <div className="sug-acts2">
                      <button
                        type="button"
                        className="sug-ghost"
                        title="No es útil — descartar"
                        onClick={() => decideSug.mutate({ id: s.id, action: "reject" })}
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        className="sug-ghost"
                        title="Recuérdame después"
                        onClick={() => decideSug.mutate({ id: s.id, action: "ignore" })}
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* ───────── Nivel B — Biblioteca de Playbooks ───────── */}
          <div className="sec-h2" style={{ marginTop: 22 }}>
            <h2>Playbooks</h2>
            <button
              type="button"
              className="mini-btn"
              style={{ marginLeft: "auto" }}
              disabled={crearPb.isPending || items.length === 0}
              onClick={() => crearPb.mutate()}
            >
              <Icon name="plus" size={14} />
              Nuevo Playbook
            </button>
          </div>
          {pbs.length === 0 ? (
            <div
              className="panel"
              style={{ textAlign: "center", color: "var(--fg-subtle)", fontSize: 13.5, padding: "26px 16px" }}
            >
              {earned
                ? "Aún no tienes Playbooks. Acepta una sugerencia o crea uno desde tus consultas guardadas."
                : "Aún no tienes Playbooks. Guarda consultas y, cuando se repitan, podrás encadenarlas en uno."}
            </div>
          ) : (
            <div className="pb-grid">
              {pbs.map((p) => {
                const corridas = p.disparos_totales ?? 0;
                const pasos = (p.pasos ?? []).slice().sort((a, b) => a.orden - b.orden);
                return (
                  <div className="pb-card" key={p.id}>
                    <div className="pb-card-h">
                      <span className="pb-card-ic">
                        <Icon name="git-branch" size={16} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="pb-card-n">{p.nombre}</div>
                        {p.descripcion ? <div className="pb-card-d">{p.descripcion}</div> : null}
                      </div>
                      {p.tipo_creacion === "sugerencia" ? (
                        <span className="pb-origen" title="Nació de una sugerencia aceptada">
                          <Icon name="sparkles" size={11} />
                          de sugerencia
                        </span>
                      ) : null}
                    </div>
                    <div className="pb-steps">
                      {pasos.map((paso, i) => (
                        <div className="pb-step-mini" key={paso.id}>
                          <span className="pb-step-n">{i + 1}</span>
                          {savedById.get(paso.consulta_guardada_id) ?? paso.nota_paso ?? `Paso ${paso.orden}`}
                        </div>
                      ))}
                    </div>
                    <div className="pb-card-foot">
                      <span className="pb-card-meta">
                        <span className="mono" style={{ fontSize: 11, color: "var(--fg-subtle)" }}>
                          {corridas} {corridas === 1 ? "corrida" : "corridas"}
                        </span>
                      </span>
                      <div className="pb-card-acts">
                        {borrando === p.id ? (
                          <>
                            <button
                              type="button"
                              className="pb-act danger"
                              title="Confirmar borrado"
                              disabled={borrarPb.isPending}
                              onClick={() => borrarPb.mutate(p.id)}
                            >
                              <Icon name="check" size={14} />
                            </button>
                            <button
                              type="button"
                              className="pb-act"
                              title="Cancelar"
                              onClick={() => setBorrando(null)}
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="pb-act danger"
                              title="Borrar"
                              onClick={() => setBorrando(p.id)}
                            >
                              <Icon name="trash-2" size={14} />
                            </button>
                            <button type="button" className="btn btn-primary sm" onClick={() => correrPb(p.id)}>
                              <Icon name="play" size={13} />
                              Correr
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </OrgShell>
  );
}
