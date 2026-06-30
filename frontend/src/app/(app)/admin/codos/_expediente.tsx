"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import {
  getCodoContexto,
  getCodoRelaciones,
  type CodoContextoOut,
  type DocumentoRefOut,
  type RelacionInmediata,
  type ConsultaSugerida,
  type RecursoApoyo,
} from "@/lib/onboarding";

/**
 * Expediente esquemático del CoDo — superficie de inmersión del experto.
 * Portado 1:1 del prototipo `app/expediente.jsx` (`ExpedienteView`). Cuatro
 * condiciones: META CLARA (goal strip) · FEEDBACK INSTANTÁNEO (nodo→detalle) ·
 * RETO AJUSTABLE (densidad) · AGENCIA TOTAL (EDB a demanda).
 *
 * Datos REALES del grafo (P1, Matriz de Cierre):
 *  · `GET /mo/codos/{id}` → entidad/documentos (árbol + DocDetail).
 *  · `GET /mo/codos/{id}/relaciones` → relaciones inmediatas (rama del árbol +
 *    `RelDetail` + tarjeta "Relaciones"), consultas sugeridas por doc (`ed-sug`) y
 *    recursos de apoyo (`rec-item`). NADA canned: si el grafo no tiene relaciones,
 *    el estado vacío es REAL (no un placeholder de backend faltante).
 */

const SEV_COLOR: Record<string, string> = {
  ok: "var(--success-600)",
  warn: "var(--warning-600)",
  caution: "#C0820F",
  muted: "var(--fg-subtle)",
};

function entityIcon(ctx: CodoContextoOut): string {
  const meta = (ctx.meta ?? "").toLowerCase();
  if (meta.includes("centrif") || meta.includes("rotor")) return "disc-3";
  if (meta.includes("cnc") || meta.includes("maquin")) return "cog";
  if (meta.includes("mezcl") || meta.includes("concret")) return "blend";
  if ((ctx.tipo ?? "").toLowerCase() === "documento") return "file-text";
  return "folder";
}

type Sel =
  | { type: "entity" }
  | { type: "doc"; doc: DocumentoRefOut }
  | { type: "rel"; rel: RelacionInmediata };

export function Expediente({ codoId }: { codoId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const token = useAuth((s) => s.token);
  const setDoco = useAuth((s) => s.setDoco);

  const [sel, setSel] = useState<Sel>({ type: "entity" });
  const [den, setDen] = useState<"detallado" | "compacto">("detallado");
  const [edb, setEdb] = useState(false);
  const compact = den === "compacto";

  const { data: ctx, isLoading, error } = useQuery({
    queryKey: ["codo-contexto", codoId],
    queryFn: () => getCodoContexto(codoId as string, token as string),
    enabled: !!token && !!codoId,
    retry: false,
  });

  // Relaciones inmediatas + sugerencias + recursos — del grafo real (P1).
  const { data: rel } = useQuery({
    queryKey: ["codo-relaciones", codoId],
    queryFn: () => getCodoRelaciones(codoId as string, token as string),
    enabled: !!token && !!codoId,
    retry: false,
  });
  const relaciones: RelacionInmediata[] = rel?.relaciones ?? [];
  const sugeridas: ConsultaSugerida[] = rel?.consultas_sugeridas ?? [];
  const recursos: RecursoApoyo[] = rel?.recursos ?? [];

  const onBack = () => router.push("/admin/codos");
  const onConsult = () => {
    if (!ctx) return;
    setDoco(ctx.id);
    router.push("/consult");
  };

  // Adjuntar video de apoyo — POST real a /recursos/video (no se finge).
  async function attachVideo(docId: string) {
    const titulo = window.prompt("Título del video de apoyo:");
    if (!titulo) return;
    const video_url = window.prompt("URL del video:");
    if (!video_url) return;
    try {
      await api.post("/recursos/video", { titulo, video_url, doc_id: docId }, { token });
      qc.invalidateQueries({ queryKey: ["codo-relaciones", codoId] });
    } catch {
      // El refetch reflejará el estado real del grafo.
    }
  }

  if (!codoId) {
    return (
      <div className="expediente-view">
        <div className="exp-state">
          <Icon name="folder-tree" size={26} />
          <p>Elige un CoDo de la lista para ver su expediente.</p>
          <button className="btn btn-primary" onClick={onBack}>
            <Icon name="arrow-left" size={16} />
            Volver a CoDos
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="expediente-view">
        <div className="exp-state">
          <Icon name="loader-2" size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (error || !ctx) {
    const msg = error instanceof ApiError ? error.message : "No pudimos cargar este CoDo.";
    return (
      <div className="expediente-view">
        <div className="exp-state" role="alert">
          <Icon name="triangle-alert" size={26} />
          <p>{msg}</p>
          <button className="btn btn-primary" onClick={onBack}>
            <Icon name="arrow-left" size={16} />
            Volver a CoDos
          </button>
        </div>
      </div>
    );
  }

  const docs = ctx.documentos ?? [];
  const icon = entityIcon(ctx);
  const isDoc = (d: DocumentoRefOut) => sel.type === "doc" && sel.doc.id === d.id;
  const isRel = (r: RelacionInmediata) => sel.type === "rel" && sel.rel.id === r.id;

  return (
    <div className="expediente-view">
      <div className="exp">
        {/* META CLARA — goal strip siempre visible */}
        <div className="exp-strip">
          <button className="exp-back" onClick={onBack} aria-label="Volver a CoDos">
            <Icon name="arrow-left" size={17} />
          </button>
          <div className="exp-strip-t">
            <div className="exp-eyebrow">
              <span className="dot" />
              EXPEDIENTE · {ctx.id}
            </div>
            <div className="exp-name">{ctx.nombre}</div>
          </div>
          <div className="exp-den" role="group" aria-label="Densidad">
            <button className={compact ? "" : "on"} onClick={() => setDen("detallado")}>
              Detallado
            </button>
            <button className={compact ? "on" : ""} onClick={() => setDen("compacto")}>
              Compacto
            </button>
          </div>
          <button className="btn btn-primary exp-consult" onClick={onConsult}>
            <Icon name="messages-square" size={15} />
            Consultar
          </button>
        </div>

        <div className="exp-body">
          {/* navegación granular del acervo */}
          <aside className="exp-tree">
            <div className="exp-tg">Entidad</div>
            <button
              className={"exp-node" + (sel.type === "entity" ? " on" : "")}
              onClick={() => setSel({ type: "entity" })}
            >
              <span className="en-ic">
                <Icon name={icon} size={17} />
              </span>
              <span className="en-t">{ctx.nombre}</span>
            </button>

            <div className="exp-tg">Acervo · {docs.length} docs</div>
            {docs.map((d) => (
              <button
                key={d.id}
                className={"exp-node" + (isDoc(d) ? " on" : "")}
                onClick={() => setSel({ type: "doc", doc: d })}
              >
                <span className="en-ic doc">
                  <Icon name="file-text" size={16} />
                </span>
                <span className="en-t">
                  {d.nombre ?? d.id}
                  <span className="en-m">{d.tipo ?? "—"}</span>
                </span>
              </button>
            ))}

            {relaciones.length > 0 && (
              <>
                <div className="exp-tg">Relaciones inmediatas</div>
                {relaciones.map((r) => (
                  <button
                    key={r.id}
                    className={"exp-node" + (isRel(r) ? " on" : "")}
                    onClick={() => setSel({ type: "rel", rel: r })}
                  >
                    <span className="en-ic">
                      <Icon name={r.icono} size={16} />
                    </span>
                    <span className="en-t">
                      {r.titulo}
                      <span className="en-tag" style={{ color: SEV_COLOR[r.severidad] ?? SEV_COLOR.muted }}>
                        {r.tag}
                      </span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </aside>

          {/* FEEDBACK INSTANTÁNEO — el detalle del nodo seleccionado */}
          <main className="exp-detail">
            {sel.type === "entity" && (
              <div className="exp-entity">
                <div className="ee-head">
                  <span className="ee-ic">
                    <Icon name={icon} size={30} />
                  </span>
                  <div>
                    <div className="ee-id">{ctx.id}</div>
                    <h2>{ctx.nombre}</h2>
                    <div className="ee-meta">
                      {ctx.meta} · {docs.length} docs vivos
                    </div>
                  </div>
                </div>

                {!compact && (
                  <p className="ee-lead">
                    El objeto de trabajo: esta entidad y sus relaciones inmediatas. Navega el acervo a la
                    izquierda; cada nodo revela su detalle aquí. Para preguntar en lenguaje natural con cita a
                    la fuente, entra a{" "}
                    <button className="ee-link" onClick={onConsult}>
                      Consultar
                    </button>
                    .
                  </p>
                )}

                <div className="ee-grid">
                  <div className="ee-card">
                    <div className="ee-cl">
                      <Icon name="files" size={14} />
                      Acervo por segmento
                    </div>
                    {docs.length > 0 ? (
                      <div className="ee-chips">
                        {docs.map((d) => (
                          <span className="ee-chip" key={d.id} onClick={() => setSel({ type: "doc", doc: d })}>
                            <Icon name="file-text" size={13} />
                            {d.nombre ?? d.id}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="ee-empty">Este CoDo aún no tiene documentos vivos.</div>
                    )}
                  </div>
                  <div className="ee-card">
                    <div className="ee-cl">
                      <Icon name="git-branch" size={14} />
                      Relaciones
                    </div>
                    {relaciones.length > 0 ? (
                      <div className="ee-rels">
                        {relaciones.map((r) => (
                          <button className="ee-rel" key={r.id} onClick={() => setSel({ type: "rel", rel: r })}>
                            <span className="rd" style={{ background: SEV_COLOR[r.severidad] ?? SEV_COLOR.muted }} />
                            <span className="rt">{r.titulo}</span>
                            <span className="rtag">{r.tag}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="ee-empty">Sin relaciones inmediatas registradas para este CoDo.</div>
                    )}
                  </div>
                </div>

                <div className="ee-qr">
                  <span className="ee-qr-ic">
                    <Icon name="qr-code" size={44} />
                  </span>
                  <div className="ee-qrt">
                    <div className="ee-qrl">QR PERSISTENTE</div>
                    <div className="ee-qrn">La puerta del colaborador a este CoDo</div>
                    {!compact && (
                      <div className="ee-qrm">Pegado en el equipo · escanear abre la consulta de esta entidad</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {sel.type === "doc" && (
              <DocDetail
                doc={sel.doc}
                entityName={ctx.nombre}
                compact={compact}
                onConsult={onConsult}
                sugeridas={sugeridas}
                recursos={recursos}
                onAttach={() => attachVideo(sel.doc.id)}
              />
            )}

            {sel.type === "rel" && <RelDetail rel={sel.rel} compact={compact} />}
          </main>
        </div>

        {/* AGENCIA TOTAL — EDB a demanda (observaciones; fuera de P1) */}
        <div className={"exp-edb" + (edb ? " open" : "")}>
          <button className="edb-toggle" onClick={() => setEdb((e) => !e)}>
            <Icon name="sparkles" size={15} />
            <span>Sugerencias de DOCYAN</span>
            <span className="edb-hint">a demanda</span>
            <Icon name={edb ? "chevron-down" : "chevron-up"} size={16} />
          </button>
          {edb && (
            <div className="edb-panel">
              <div className="edb-foot">
                <Icon name="info" size={13} />
                Las sugerencias viven aquí, a demanda. Aún no hay observaciones para este CoDo — DOCYAN no
                interrumpe tu trabajo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocDetail({
  doc,
  entityName,
  compact,
  onConsult,
  sugeridas,
  recursos,
  onAttach,
}: {
  doc: DocumentoRefOut;
  entityName: string;
  compact: boolean;
  onConsult: () => void;
  sugeridas: ConsultaSugerida[];
  recursos: RecursoApoyo[];
  onAttach: () => void;
}) {
  return (
    <div className="exp-doc">
      <div className="ed-head">
        <span className="ed-ic">
          <Icon name="file-text" size={24} />
        </span>
        <div>
          <div className="ed-eyebrow">DOCUMENTO · {doc.tipo ?? "—"}</div>
          <h2>{doc.nombre ?? doc.id}</h2>
          <div className="ed-meta">{doc.id} · documento vivo</div>
        </div>
      </div>
      {!compact && (
        <div className="ed-row">
          <span className="badge-vivo">
            <span className="bd" />
            vivo
          </span>
          <span className="ed-seg">Acervo de {entityName}</span>
        </div>
      )}

      {sugeridas.length > 0 && (
        <div className="ed-block">
          <div className="ed-bl">
            <Icon name="sparkles" size={13} className="lic" />
            Consultas sugeridas sobre este documento
          </div>
          {sugeridas.map((s, i) => (
            <button key={i} className="ed-sug" onClick={onConsult}>
              <Icon name={s.icono} size={15} className="lic" />
              <span>{s.texto}</span>
              <Icon name="arrow-right" size={14} className="lic" />
            </button>
          ))}
        </div>
      )}

      <div className="ed-block">
        <div className="ed-bl">
          <Icon name="video" size={13} className="lic" />
          Recursos de apoyo
          <span className="ed-bl-note">no se analizan · se sirven junto al documento</span>
        </div>
        {recursos.map((rc) => (
          <div className="rec-item" key={rc.id}>
            <span className="rec-ic">
              <Icon name="play" size={14} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="rec-t">{rc.titulo}</div>
              <div className="rec-m">{rc.meta ?? "video de apoyo"}</div>
            </div>
            <Icon name="external-link" size={14} color="var(--fg-subtle)" />
          </div>
        ))}
        <button className="add-q" onClick={onAttach}>
          <Icon name="plus" size={15} />
          Adjuntar video
        </button>
      </div>

      <button className="btn btn-primary ed-cta" onClick={onConsult}>
        <Icon name="messages-square" size={15} />
        Consultar este documento
      </button>
    </div>
  );
}

function RelDetail({ rel, compact }: { rel: RelacionInmediata; compact: boolean }) {
  const color = SEV_COLOR[rel.severidad] ?? SEV_COLOR.muted;
  return (
    <div className="exp-rel">
      <div className="er-head">
        <span className="er-ic" style={{ color }}>
          <Icon name={rel.icono} size={24} />
        </span>
        <div>
          <div className="er-eyebrow">RELACIÓN · {rel.meta ?? rel.id}</div>
          <h2>{rel.titulo}</h2>
          <span className="er-tag" style={{ color, borderColor: "currentColor" }}>
            {rel.tag}
          </span>
        </div>
      </div>
      {!compact && rel.nota && <p className="er-note">{rel.nota}</p>}
      {rel.severidad === "warn" && (
        <div className="er-banner">
          <Icon name="info" size={14} />
          Recordatorio administrativo — no es una instrucción operativa.
        </div>
      )}
      {rel.meta && (
        <div className="er-cite">
          <span className="brk" />
          {rel.meta} ↗
        </div>
      )}
    </div>
  );
}
