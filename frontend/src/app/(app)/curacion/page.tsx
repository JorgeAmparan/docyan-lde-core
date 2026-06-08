"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { components } from "@/types/api";

/**
 * /curacion — Editor de curación asistida (B9.5 §2.4 / decisión C).
 *
 * La ingesta de Tipo 3 (diagrama) y Tipo 5 (árbol de diagnóstico) produce un
 * BORRADOR; aquí el humano lo corrige y confirma. Al confirmar, el backend
 * materializa el recurso en el grafo (`POST /curacion/{id}/confirmar`) y queda
 * vivo para la consulta. Tipos derivados del contrato OpenAPI.
 */
type DraftDiagrama = components["schemas"]["DraftDiagrama"];
type DraftArbol = components["schemas"]["DraftArbol"];
type DraftListItem = {
  draft_id?: string;
  draft: DraftDiagrama | DraftArbol;
  doc_id?: string | null;
  entidad_id?: string | null;
};

export default function CuracionPage() {
  const token = useAuth((s) => s.token);
  const [items, setItems] = useState<DraftListItem[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    const res = await api.get<{ borradores: DraftListItem[] }>("/curacion", { token });
    return res.borradores ?? [];
  }, [token]);

  /** Manual refresh (button) — safe to setState from an event handler. */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchDrafts());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchDrafts]);

  // Initial load: no synchronous setState in the effect body (rule
  // react-hooks/set-state-in-effect) — the first statement is the async fetch.
  useEffect(() => {
    let active = true;
    fetchDrafts()
      .then((b) => active && setItems(b))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fetchDrafts]);

  const current = sel != null ? items[sel] : null;

  return (
    <div className="sheet" style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto" }}>
      <div className="sheet-head">
        <h2>Curación asistida</h2>
        <button type="button" className="x" onClick={reload} aria-label="Recargar">
          <Icon name="refresh-cw" size={18} />
        </button>
      </div>
      <div className="sheet-body">
        {msg && (
          <div className="admin-banner" style={{ marginBottom: 10 }}>
            <Icon name="info" size={15} />
            {msg}
          </div>
        )}
        {loading && <p style={{ color: "var(--fg-muted)" }}>Cargando borradores…</p>}
        {!loading && items.length === 0 && (
          <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
            No hay borradores pendientes de curar. Los borradores aparecen aquí cuando la ingesta
            extrae un diagrama (Tipo 3) o un árbol de diagnóstico (Tipo 5).
          </p>
        )}
        {!loading && items.length > 0 && current == null && (
          <ul className="timeline">
            {items.map((it, i) => (
              <li key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <span className="dot">
                  <Icon name={it.draft.kind === "diagrama" ? "image" : "git-branch"} size={13} />
                </span>
                <div className="tl-c">
                  <span className="tl-t">{it.draft.titulo}</span>
                  <span className="tl-tag">{it.draft.kind === "diagrama" ? "Diagrama" : "Árbol"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {current && (
          <DraftEditor
            item={current}
            token={token}
            onDone={(m) => {
              setMsg(m);
              setSel(null);
              reload();
            }}
            onCancel={() => setSel(null)}
          />
        )}
      </div>
    </div>
  );
}

function DraftEditor({
  item,
  token,
  onDone,
  onCancel,
}: {
  item: DraftListItem;
  token: string | null;
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const draftId = item.draft_id ?? "";
  const [busy, setBusy] = useState(false);

  const confirmar = async () => {
    if (!draftId) {
      onDone("Este borrador no tiene id resoluble; recarga la lista.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/curacion/${draftId}/confirmar`, undefined, { token });
      onDone("Borrador confirmado y materializado en el grafo.");
    } catch {
      onDone("No se pudo confirmar el borrador.");
    } finally {
      setBusy(false);
    }
  };

  const descartar = async () => {
    setBusy(true);
    try {
      if (draftId) await api.del(`/curacion/${draftId}`, { token });
      onDone("Borrador descartado.");
    } catch {
      onDone("No se pudo descartar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acard">
      <div className="q">{item.draft.titulo}</div>
      {item.draft.kind === "diagrama" ? (
        <DiagramaPreview draft={item.draft} />
      ) : (
        <ArbolPreview draft={item.draft} />
      )}
      <div className="acard-foot" style={{ gap: 8 }}>
        <button type="button" className="sug" onClick={onCancel} disabled={busy}>
          Volver
        </button>
        <button type="button" className="sug" onClick={descartar} disabled={busy}>
          Descartar
        </button>
        <button
          type="button"
          className="sug"
          style={{ background: "var(--cinnabar-500)", color: "#fff", border: "none", fontWeight: 600 }}
          onClick={confirmar}
          disabled={busy}
        >
          Confirmar e ingerir
        </button>
      </div>
    </div>
  );
}

function DiagramaPreview({ draft }: { draft: components["schemas"]["DraftDiagrama"] }) {
  const etiquetas = draft.etiquetas ?? [];
  return (
    <>
      <div
        className="diag-img"
        style={draft.recurso_url ? { backgroundImage: `url(${draft.recurso_url})`, backgroundSize: "cover" } : undefined}
      >
        {!draft.recurso_url && <span className="ph-tag">SIN IMAGEN</span>}
        {etiquetas.map((e, i) => (
          <span key={i} className="pin" style={{ left: (e.x ?? 0) * 100 + "%", top: (e.y ?? 0) * 100 + "%" }}>
            {i + 1}
          </span>
        ))}
      </div>
      <ol className="legend">
        {etiquetas.map((e, i) => (
          <li key={i}>
            <span className="ln">{i + 1}</span>
            <div className="lc">
              <span className="lt">{e.texto}</span>
              <span className="lnote">
                x={(e.x ?? 0).toFixed(2)} · y={(e.y ?? 0).toFixed(2)}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>
        Revisa las etiquetas extraídas. Confirmar las materializa como recurso visual consultable.
      </p>
    </>
  );
}

function ArbolPreview({ draft }: { draft: components["schemas"]["DraftArbol"] }) {
  const nodos = draft.nodos ?? [];
  return (
    <>
      <ul className="timeline">
        {nodos.map((n, i) => (
          <li key={i}>
            <span className="dot">{n.orden ?? i}</span>
            <div className="tl-c">
              <span className="tl-t">{n.pregunta ?? n.causa_probable ?? n.id}</span>
              {(n.opciones ?? []).length > 0 && (
                <span className="tl-tag">{(n.opciones ?? []).map((o) => o.etiqueta).join(" · ")}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>
        Revisa el árbol extraído (preguntas, opciones, causas y acciones). Confirmar lo materializa
        como árbol de diagnóstico navegable.
      </p>
    </>
  );
}
