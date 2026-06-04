"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

/**
 * Expediente esquemático — the focal canvas for the expert user.
 * Three densities of the same CoDo:
 *  - "esquema": hub-and-spoke schematic, instant focal update (no spinner)
 *  - "documentos": granular tree + cross-doc search + cinnabar-highlighted span
 *    + annotations (incl. recurring-pattern surfacing)
 *  - config: vertical / language pairs / cache threshold / criticality
 * All data canned (copied from admin-views.jsx) — wire react-query when the
 * backend CoDo endpoint shape lands.
 */

// ── canned entity model (from admin-views.jsx ENTITY/CLUSTERS) ──
const ENTITY = {
  id: "CODO-LAB-04",
  name: "Centrífuga Hettich Rotina 380",
  facts: [
    ["clock-alert", "Calibración vence en 4 días", "warn"],
    ["files", "12 documentos vivos", "ok"],
    ["bell", "2 alertas", "warn"],
  ] as const,
};

type ClusterDef = {
  key: string;
  label: string;
  icon: string;
  items: readonly (readonly [string, string, ("warn" | undefined)?])[];
};

const CLUSTERS: Record<"top" | "left" | "right" | "bottom", ClusterDef> = {
  top: {
    key: "docs",
    label: "Documentos",
    icon: "file-text",
    items: [
      ["Manual VF-2", "§4.2.1"],
      ["Hettich — manual", "cap. 3"],
      ["MSDS refrigerante", "v3"],
      ["NOM-018-STPS", "pictogramas"],
    ],
  },
  left: {
    key: "proc",
    label: "Procedimientos",
    icon: "list-checks",
    items: [
      ["Cambio de filtro", "§7.3"],
      ["Arranque de turno", "rutina"],
      ["Limpieza CIP", "§2.1"],
    ],
  },
  right: {
    key: "cal",
    label: "Calibración",
    icon: "ruler",
    items: [
      ["Cert. CAL-22-117", "vence 4d", "warn"],
      ["Histórico 2025", "12 registros"],
    ],
  },
  bottom: {
    key: "alert",
    label: "Alertas",
    icon: "bell",
    items: [
      ["Calibración por vencer", "≤ 7 días", "warn"],
      ["Cert. CAL-21 vencido", "vencido", "warn"],
    ],
  },
};

interface Sel {
  id: string;
  label: string;
  meta: string;
  cluster: string;
  sev?: "warn";
}

function Cluster({
  pos,
  dense,
  sel,
  onPick,
}: {
  pos: keyof typeof CLUSTERS;
  dense: boolean;
  sel: string | null;
  onPick: (s: Sel) => void;
}) {
  const c = CLUSTERS[pos];
  return (
    <div className={"cluster " + pos}>
      <div className="cl-head">
        <span className="cl-ic">
          <Icon name={c.icon} size={14} />
        </span>
        {c.label}
        <span className="cl-n">{c.items.length}</span>
      </div>
      {dense && (
        <div className="cl-items">
          {c.items.map((it, i) => {
            const id = c.key + i;
            const on = sel === id;
            return (
              <button
                key={i}
                className={"snode" + (on ? " on" : "") + (it[2] === "warn" ? " warn" : "")}
                onClick={() => onPick({ id, label: it[0], meta: it[1], cluster: c.label, sev: it[2] })}
              >
                {it[0]}
                <span className="sn-m">{it[1]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Schematic() {
  const [dense, setDense] = useState(true);
  const [sel, setSel] = useState<Sel | null>(null);
  return (
    <>
      <div className="sch-controls">
        <span className="sch-hint mono">Esquema de la entidad · toca un nodo para ver su detalle</span>
        <div className="seg sm">
          <button className={dense ? "" : "on"} onClick={() => setDense(false)}>
            Compacto
          </button>
          <button className={dense ? "on" : ""} onClick={() => setDense(true)}>
            Detallado
          </button>
        </div>
      </div>
      <div className="schematic">
        <Cluster pos="top" dense={dense} sel={sel?.id ?? null} onPick={setSel} />
        <Cluster pos="left" dense={dense} sel={sel?.id ?? null} onPick={setSel} />
        <button className={"hub" + (!sel ? " on" : "")} onClick={() => setSel(null)}>
          <span className="hub-ic">
            <Icon name="disc-3" size={22} />
          </span>
          <span className="hub-id mono">{ENTITY.id}</span>
          <span className="hub-name">Centrífuga Hettich</span>
        </button>
        <Cluster pos="right" dense={dense} sel={sel?.id ?? null} onPick={setSel} />
        <Cluster pos="bottom" dense={dense} sel={sel?.id ?? null} onPick={setSel} />
      </div>
      <div className="focal">
        {!sel ? (
          <>
            <div className="fc-lab mono">Estás revisando</div>
            <div className="fc-name">{ENTITY.name}</div>
            <div className="fc-facts">
              {ENTITY.facts.map(([ic, t, sev], i) => (
                <span key={i} className={"fc-fact " + sev}>
                  <Icon name={ic} size={13} />
                  {t}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="fc-lab mono">
              {sel.cluster} {sel.sev === "warn" && "· requiere atención"}
            </div>
            <div className="fc-name">{sel.label}</div>
            <div className="fc-row">
              <span className="cite" style={{ marginTop: 0 }}>
                <span className="brk" />
                {sel.meta} ↗
              </span>
              <button className="mini-btn">
                <Icon name="external-link" size={13} />
                Abrir
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Documentos mode (tree + search + span + annotations) ────────
const CODO_TREE: [string, string, [string, string, string][]][] = [
  [
    "folder",
    "Manuales de equipo",
    [
      ["file-text", "Manual CNC Haas VF-2", "vivo"],
      ["file-text", "Hettich Rotina 380 — manual", "vivo"],
    ],
  ],
  [
    "folder",
    "Seguridad & MSDS",
    [
      ["file-text", "MSDS refrigerante sintético", "vivo"],
      ["file-text", "NOM-018-STPS — pictogramas", "vivo"],
    ],
  ],
  [
    "folder",
    "Calibración",
    [
      ["file-clock", "Histórico de calibración 2025", "vivo"],
      ["file-x", "Certificado CAL-21 (vencido)", "exp"],
    ],
  ],
];

function Documentos() {
  const [selDoc, setSelDoc] = useState("Manual CNC Haas VF-2");
  return (
    <>
      <div className="search-big">
        <Icon name="search" size={17} />
        <input placeholder="Busca en todos los documentos de este CoDo…" defaultValue="par de apriete perno B" />
        <span className="hits">3 coincidencias</span>
      </div>
      <div className="codo-detail" style={{ marginTop: 16 }}>
        <div className="panel tree-panel">
          <div className="cd-head">
            <div>
              <div className="cid">CODO-LAB-04</div>
              <div className="cn">Centrífugas & rotores</div>
            </div>
            <Icon name="chevrons-up-down" size={15} color="var(--fg-subtle)" />
          </div>
          <div className="tree">
            {CODO_TREE.map(([fic, fname, kids], i) => (
              <div key={i}>
                <div className="tnode folder">
                  <Icon name="chevron-down" size={13} />
                  <Icon name={fic} size={15} />
                  {fname}
                </div>
                {kids.map(([ic, name, st], j) => (
                  <div
                    key={j}
                    className={"tnode doc" + (selDoc === name ? " on" : "")}
                    onClick={() => setSelDoc(name)}
                  >
                    <Icon name={ic} size={15} />
                    {name}
                    <span className={"dstate " + (st === "exp" ? "exp" : "ok")}>{st === "exp" ? "vencido" : "vivo"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel doc-panel">
          <div className="cd-head">
            <div>
              <div className="cid">DOC · §4.2.1</div>
              <div className="cn">{selDoc}</div>
            </div>
            <button className="mini-btn">
              <Icon name="external-link" size={14} />
              Abrir
            </button>
          </div>
          <p className="doc-span">
            <mark>El par de apriete del perno B es 85&nbsp;N·m</mark>, aplicado en cruz en tres etapas progresivas (40 → 65
            → 85&nbsp;N·m).
          </p>
          <div className="anno-h">
            <Icon name="message-square" size={15} />
            Anotaciones <span className="cnt">3</span>
          </div>
          <div className="anno">
            <div className="aav">AR</div>
            <div>
              <div className="atx">El asiento cónico llega con rebaba de fábrica — limpiar antes de aplicar par.</div>
              <div className="amt">
                A. Ríos · hace 6 días · <span className="anode">sobre §4.2.1</span>
              </div>
            </div>
          </div>
          <div className="anno">
            <div className="aav">JM</div>
            <div>
              <div className="atx">Confirmo, mismo lote. Reportado a compras.</div>
              <div className="amt">J. Medina · hace 4 días</div>
            </div>
          </div>
          <div className="anno recurring">
            <div className="aic">
              <Icon name="sparkles" size={15} />
            </div>
            <div>
              <div className="atx">
                <b>Patrón detectado (Nivel 3):</b> 3 personas anotaron lo mismo sobre este span. DOCYAN lo eleva a
                observación del CoDo (<span className="mono">:Observacion</span>).
              </div>
            </div>
          </div>
          <button className="add-anno">
            <Icon name="plus" size={14} />
            Agregar anotación
          </button>
        </div>
      </div>

      <div className="sec-h" style={{ marginTop: 22 }}>
        <h2>Configuración del CoDo</h2>
      </div>
      <div className="cfg-grid">
        <div className="cfg">
          <label>Nombre</label>
          <div className="cfg-v">Centrífugas & rotores</div>
        </div>
        <div className="cfg">
          <label>Vertical</label>
          <div className="cfg-v">Laboratorio ISO 17025</div>
        </div>
        <div className="cfg">
          <label>Pares lingüísticos</label>
          <div className="cfg-v">ES-MX · EN-US</div>
        </div>
        <div className="cfg">
          <label>Umbral de confianza del caché</label>
          <div className="cfg-v mono">
            0.92 <span className="cfg-note">default DOCYAN</span>
          </div>
        </div>
        <div className="cfg">
          <label>Criticidad por segmento</label>
          <div className="cfg-v">
            <span className="badge warn">Seguridad ≥0.95</span> <span className="badge ok">Operacional ≥0.75</span>
          </div>
        </div>
      </div>
    </>
  );
}

export function Expediente({ codoId }: { codoId?: string }) {
  const [mode, setMode] = useState<"esquema" | "documentos">("esquema");
  // DESIGN: codoId is surfaced in the goal-strip; full per-CoDo data is canned
  // until the backend CoDo detail endpoint shape is defined.
  const id = codoId ?? ENTITY.id;
  return (
    <>
      <div className="goal-strip">
        <span className="gs-ic">
          <Icon name="disc-3" size={18} />
        </span>
        <div className="gs-t">
          <span className="gs-codo mono">{id}</span>
          <span className="gs-name">{ENTITY.name}</span>
        </div>
        <span className="gs-fact warn">
          <Icon name="clock-alert" size={13} />
          Calibración vence en 4 días
        </span>
        <span className="gs-fact">
          <Icon name="files" size={13} />
          12 docs vivos
        </span>
        <div className="seg sm" style={{ marginLeft: "auto" }}>
          <button className={mode === "esquema" ? "on" : ""} onClick={() => setMode("esquema")}>
            <Icon name="git-fork" size={13} />
            Esquema
          </button>
          <button className={mode === "documentos" ? "on" : ""} onClick={() => setMode("documentos")}>
            <Icon name="folder-tree" size={13} />
            Documentos
          </button>
        </div>
      </div>

      {mode === "esquema" ? (
        <div className="panel sch-panel">
          <Schematic />
        </div>
      ) : (
        <Documentos />
      )}
    </>
  );
}
