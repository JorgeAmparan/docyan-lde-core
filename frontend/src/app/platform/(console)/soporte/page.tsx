"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { Badge, StateBlock } from "@/components/platform/atoms";
import { usePlatformApi, SUPPORT_STATE, fmtDate, type SupportThreadOut } from "@/lib/platform";

type Filter = "todos" | "abiertos" | "resueltos";

function asunto(t: SupportThreadOut): string {
  const first = (t.mensajes ?? []).find((m) => m.autor_tipo === "usuario") ?? (t.mensajes ?? [])[0];
  return first?.cuerpo ?? "(sin mensaje)";
}

export default function SoportePage() {
  const pf = usePlatformApi();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("todos");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const threads = useQuery({
    queryKey: ["platform", "support"],
    queryFn: () => pf.get<{ items: SupportThreadOut[] }>("/platform/support/threads"),
    enabled: !!pf.token,
    refetchInterval: 15000,
  });

  const items = threads.data?.items ?? [];
  const filtered = items.filter((t) =>
    filter === "todos" ? true : filter === "abiertos" ? t.estado === "abierto" : t.estado !== "abierto",
  );

  // Selección efectiva DERIVADA en render (sin setState-en-effect): si el fundador
  // no ha elegido un hilo, cae al primero de la lista filtrada. Evita el ciclo
  // render→effect→render y respeta react-hooks/set-state-in-effect.
  const effectiveSelected = selected ?? filtered[0]?.id ?? null;
  const current = items.find((t) => t.id === effectiveSelected) ?? null;

  const responder = useMutation({
    mutationFn: (cerrar: boolean) => pf.post<SupportThreadOut>(`/platform/support/threads/${effectiveSelected}/reply`, { cuerpo: reply.trim(), cerrar }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["platform", "support"] }); toast.success("Respuesta enviada"); },
    onError: () => toast.error("No se pudo enviar la respuesta"),
  });

  if (threads.isLoading) return <StateBlock>Cargando soporte…</StateBlock>;
  if (threads.isError) return <StateBlock kind="error">No se pudo cargar la bandeja de soporte.</StateBlock>;

  const abiertos = items.filter((t) => t.estado === "abierto").length;

  return (
    <>
      <div className="psec"><h2>Soporte</h2><span className="scount">{abiertos} abiertos · {items.length} hilos</span></div>

      <div className="filters">
        {(["todos", "abiertos", "resueltos"] as Filter[]).map((f) => (
          <button key={f} className={`fpill${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : f === "abiertos" ? "Abiertos" : "Resueltos"}
          </button>
        ))}
      </div>

      <div className="support-grid">
        <div className="sup-list">
          {filtered.map((t) => {
            const st = SUPPORT_STATE[t.estado] ?? { label: t.estado, tone: "muted" as const };
            return (
              <button key={t.id} className={`sup-item${effectiveSelected === t.id ? " on" : ""}`} onClick={() => setSelected(t.id)}>
                <div className="si-top">
                  <span className={`prio-dot t-${t.estado === "abierto" ? "warn" : t.estado === "respondido" ? "muted" : "muted"}`} />
                  <span className="si-org">{t.org_id}</span>
                  <span className="si-time">{fmtDate(t.updated_at ?? t.created_at)}</span>
                </div>
                <div className="si-subj">{asunto(t)}</div>
                <div className="si-foot">
                  {t.pantalla_origen && <span className="sup-ctx-pill">{t.pantalla_origen}</span>}
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="pstate" style={{ padding: 20 }}>Sin hilos en este filtro.</div>}
        </div>

        {current ? (
          <div className="sup-thread">
            <div className="st-head">
              <div className="sth-org">{current.org_id}</div>
              <div className="sth-subj">{asunto(current)}</div>
              <div className="st-ctx">
                <div className="ctx"><span className="cl">Usuario</span><span className="cv">{current.user_id ?? "—"}</span></div>
                <div className="ctx"><span className="cl">Pantalla de origen</span><span className="cv">{current.pantalla_origen ?? "—"}</span></div>
                <div className="ctx"><span className="cl">Estado</span><span className="cv">{SUPPORT_STATE[current.estado]?.label ?? current.estado}</span></div>
              </div>
            </div>
            <div className="st-body">
              {(current.mensajes ?? []).map((m) => (
                <div key={m.id} className={`msg ${m.autor_tipo === "founder" ? "soporte" : "user"}`}>
                  <div className="mb">{m.cuerpo}</div>
                  <div className="mt">{m.autor_tipo === "founder" ? "Fundador" : "Usuario"} · {fmtDate(m.created_at)}</div>
                </div>
              ))}
            </div>
            <div className="st-reply">
              <textarea
                placeholder="Responder al hilo…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && reply.trim()) responder.mutate(false); }}
              />
              <button className="pbtn primary" disabled={!reply.trim() || responder.isPending} onClick={() => responder.mutate(false)}>
                <Icon name="send-horizontal" size={15} /> Enviar
              </button>
            </div>
          </div>
        ) : (
          <div className="sup-thread"><div className="sup-empty">Selecciona un hilo para responder.</div></div>
        )}
      </div>
    </>
  );
}
