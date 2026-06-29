"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import {
  getCodoContexto,
  type CodoContextoOut,
  type DocumentoRefOut,
} from "@/lib/onboarding";

/**
 * Expediente esquemático del CoDo — superficie de inmersión del experto.
 * Portado pixel-perfect del prototipo `docs/DOCYAN LDE — Design System/app/
 * expediente.jsx` (`ExpedienteView`). Cuatro condiciones del prototipo:
 *  (1) META CLARA = goal strip siempre visible · (2) FEEDBACK INSTANTÁNEO =
 *  seleccionar un nodo revela su detalle sin espera · (3) RETO AJUSTABLE =
 *  densidad compacto/detallado · (4) AGENCIA TOTAL = sugerencias EDB a demanda.
 *
 * Cableado a datos reales: `GET /mo/codos/{id}` (CodoContextoOut: id, tipo,
 * entidad_id, nombre, titulo, meta, documentos: DocumentoRefOut[]). El árbol y el
 * detalle del documento salen de `documentos`. «Consultar» fija el CoDo activo
 * (`useAuth.setDoco`) y entra a /consult, igual que /select-codo.
 *
 * Honestidad de datos (sin fabricar): el backend no expone «relaciones
 * inmediatas» (calibración, MSDS, versiones…), ni sugerencias EDB, ni stats de
 * consultas/colaboradores por CoDo. Esas secciones se rinden con un estado vacío
 * explícito en vez de inventar nodos. Cuando un documento no trae `tipo`/`id`
 * mostrable se rinde «—».
 */

function entityIcon(ctx: CodoContextoOut): string {
  const t = (ctx.tipo ?? "").toLowerCase();
  const meta = (ctx.meta ?? "").toLowerCase();
  if (meta.includes("centrif") || meta.includes("rotor")) return "disc-3";
  if (meta.includes("cnc") || meta.includes("maquin")) return "cog";
  if (meta.includes("mezcl") || meta.includes("concret")) return "blend";
  if (t === "documento") return "file-text";
  return "folder";
}

type Sel = { type: "entity" } | { type: "doc"; doc: DocumentoRefOut };

function docKey(d: DocumentoRefOut): string {
  return d.id;
}

export function Expediente({ codoId }: { codoId?: string }) {
  const router = useRouter();
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

  const onBack = () => router.push("/admin/codos");
  const onConsult = () => {
    if (!ctx) return;
    setDoco(ctx.id);
    router.push("/consult");
  };

  // Sin id de CoDo (no debería ocurrir vía /admin/codos/[id]) → volver a la lista.
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
                key={docKey(d)}
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
                      {ctx.meta} · {docs.length} docs vivos · — colaboradores · — consultas
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
                          <span
                            className="ee-chip"
                            key={docKey(d)}
                            onClick={() => setSel({ type: "doc", doc: d })}
                          >
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
                    <div className="ee-empty">Sin relaciones inmediatas registradas para este CoDo.</div>
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
                      <div className="ee-qrm">
                        Pegado en el equipo · escanear abre la consulta de esta entidad
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {sel.type === "doc" && (
              <DocDetail doc={sel.doc} entityName={ctx.nombre} compact={compact} onConsult={onConsult} />
            )}
          </main>
        </div>

        {/* AGENCIA TOTAL — EDB a demanda, visible pero nunca empujado */}
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
}: {
  doc: DocumentoRefOut;
  entityName: string;
  compact: boolean;
  onConsult: () => void;
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
      <button className="btn btn-primary ed-cta" onClick={onConsult}>
        <Icon name="messages-square" size={15} />
        Consultar este documento
      </button>
    </div>
  );
}
