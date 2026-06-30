"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

/**
 * Glosario terminológico + lock de consulta (admin Capa A).
 *
 * Renderiza DENTRO del admin shell (admin/layout.tsx aporta el rail + topbar).
 * Markup, clases y copy portados VERBATIM del prototipo
 * (docs/DOCYAN LDE — Design System/app/org-views.jsx · GlosarioView/GlosTerm,
 *  datos en app/schemas.jsx). CSS en src/styles/kit-glosario.css, scopeado
 *  bajo `.glosario-view`.
 *
 * REGULATORIO — el lock terminológico preserva la CARGA DE OBLIGATORIEDAD
 * (shall ≠ should): colapsar una obligación en recomendación, o al revés, en un
 * MSDS o una NOM cambia el significado regulatorio. Es un diferenciador
 * defendible vs CAT tools, no cosmético. Esa intención se preserva en el banner
 * y en los badges de obligatoriedad.
 *
 * SIN ENDPOINT REAL — no existe endpoint de glosario/términos/lock en el backend
 * (verificado contra src/lib y src/types/api.ts). Esta es una vista nueva: se
 * renderiza la estructura del prototipo con sus términos canónicos como CONTENIDO
 * DE DISEÑO (catálogo de muestra), no como datos vivos por tenant. La edición
 * (elegir canónica, agregar/renombrar) es local en el cliente, igual que el
 * prototipo; cuando exista el endpoint se cablea aquí.
 */

/* ── Datos del prototipo (schemas.jsx · 5 · GLOSARIO TERMINOLÓGICO + LOCK) ── */

const GLOSARIO_PAR = { src: "EN-US", tgt: "ES-MX", label: "Inglés → Español (MX)" } as const;

type Sev = "info" | "caution" | "ok" | "warn";
type Origen = "publico" | "grafo" | "cliente";

const GLOSARIO_ORIGEN: Record<Origen, { label: string; sev: Sev; desc: string }> = {
  publico: { label: "Público", sev: "info", desc: "Glosario público — NOM Anillo 1 (DOF)." },
  grafo: { label: "Del grafo", sev: "caution", desc: "Entidad extraída al ingerir el documento." },
  cliente: { label: "Validado por el cliente", sev: "ok", desc: "Nomenclatura interna del tenant — activo propietario." },
};

type Modal = "shall" | "must" | "should" | "may";
const OBLIGATORIEDAD: Record<Modal, { label: string; sev: Sev; regla: string }> = {
  shall: { label: "shall · obligación", sev: "warn", regla: "→ deberá / debe · NUNCA 'debería'" },
  must: { label: "must · obligación", sev: "warn", regla: "→ deberá / debe · NUNCA 'debería'" },
  should: { label: "should · recomendación", sev: "caution", regla: "→ debería / se recomienda" },
  may: { label: "may · permiso", sev: "info", regla: "→ puede / podrá" },
};

type Variante = { t: string; o: Origen };
type GlosEntry = {
  id: string;
  src: string;
  variantes: Variante[];
  canonica: string;
  dom: string;
  anillo: 1 | 2;
  modal: Modal | null;
  critico?: boolean;
  cite: string;
};

const GLOSARIO: GlosEntry[] = [
  {
    id: "g1",
    src: "torque",
    variantes: [{ t: "par de apriete", o: "cliente" }, { t: "torsión", o: "publico" }, { t: "torque", o: "grafo" }],
    canonica: "par de apriete",
    dom: "Norma mecánica",
    anillo: 2,
    modal: null,
    cite: "Manual VF-2 · §4.2 · la planta usa 'par de apriete'",
  },
  {
    id: "g2",
    src: "shall",
    variantes: [{ t: "deberá", o: "publico" }, { t: "debe", o: "publico" }],
    canonica: "deberá",
    dom: "Regulatorio",
    anillo: 1,
    modal: "shall",
    cite: "NOM-018-STPS-2015 · cláusula de obligación",
  },
  {
    id: "g3",
    src: "should",
    variantes: [{ t: "debería", o: "publico" }, { t: "se recomienda", o: "publico" }],
    canonica: "debería",
    dom: "Regulatorio",
    anillo: 1,
    modal: "should",
    cite: "ISO/IEC 82079-1 · recomendación",
  },
  {
    id: "g4",
    src: "may",
    variantes: [{ t: "puede", o: "publico" }, { t: "podrá", o: "publico" }],
    canonica: "puede",
    dom: "Regulatorio",
    anillo: 1,
    modal: "may",
    cite: "NOM-018-STPS-2015 · permiso",
  },
  {
    id: "g5",
    src: "flammable: NONE",
    variantes: [{ t: "no inflamable", o: "grafo" }, { t: "ninguno (no inflamable)", o: "grafo" }],
    canonica: "no inflamable",
    dom: "MSDS / Seguridad",
    anillo: 1,
    modal: null,
    critico: true,
    cite: "SDS MAXI · §9 · dato negativo explícito — no colapsar a 'inflamable'",
  },
  {
    id: "g6",
    src: "lock-out/tag-out",
    variantes: [{ t: "bloqueo/etiquetado (LOTO)", o: "cliente" }, { t: "bloqueo y etiquetado", o: "publico" }],
    canonica: "bloqueo/etiquetado (LOTO)",
    dom: "Seguridad",
    anillo: 2,
    modal: null,
    cite: "Procedimiento de seguridad · cliente fija sigla LOTO",
  },
  {
    id: "g7",
    src: "bearing",
    variantes: [{ t: "rodamiento", o: "publico" }, { t: "balero", o: "cliente" }, { t: "cojinete", o: "grafo" }],
    canonica: "balero",
    dom: "Norma mecánica",
    anillo: 2,
    modal: null,
    cite: "Lista de partes MAXI · la planta usa 'balero'",
  },
  {
    id: "g8",
    src: "coolant filter",
    variantes: [{ t: "filtro de refrigerante", o: "grafo" }, { t: "filtro de líquido refrigerante", o: "publico" }],
    canonica: "filtro de refrigerante",
    dom: "Norma mecánica",
    anillo: 2,
    modal: null,
    cite: "Manual VF-2 · §6 mantenimiento",
  },
];

/* origen del término actualmente canónico (para el badge/leyenda). */
function origenCanonico(g: { variantes: Variante[]; canonica: string }, canonica?: string): Origen {
  const c = canonica == null ? g.canonica : canonica;
  const v = g.variantes.find((x) => x.t === c);
  return v ? v.o : "cliente";
}

/* ── Dropdown (portado de ui-kit.jsx · clases dc-dd) ── */

type Opt = { v: string; l: string };

function Dropdown({ value, options, onChange, icon }: { value: string; options: Opt[]; onChange: (v: string) => void; icon?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find((o) => o.v === value) ?? options[0];
  return (
    <div className={"dc-dd" + (open ? " open" : "")} ref={ref}>
      <button type="button" className="dc-dd-btn" onClick={() => setOpen((o) => !o)}>
        {icon && <Icon name={icon} size={15} className="lic" />}
        <span className="dc-dd-lab">{cur ? cur.l : ""}</span>
        <Icon name="chevron-down" size={15} className="lic" />
      </button>
      {open && (
        <div className="dc-dd-menu">
          {options.map((o) => (
            <button
              type="button"
              key={o.v}
              className={"dc-dd-item" + (o.v === value ? " on" : "")}
              onClick={() => {
                onChange(o.v);
                setOpen(false);
              }}
            >
              <span>{o.l}</span>
              {o.v === value && <Icon name="check" size={15} className="lic" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Fila de término gobernado (portado de org-views.jsx · GlosTerm) ── */

function GlosTerm({ g }: { g: GlosEntry }) {
  const [vars, setVars] = useState<Variante[]>(g.variantes);
  const [canon, setCanon] = useState(g.canonica);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editIx, setEditIx] = useState(-1);
  const [editVal, setEditVal] = useState("");
  const ob = g.modal ? OBLIGATORIEDAD[g.modal] : null;
  const orig = GLOSARIO_ORIGEN[origenCanonico({ variantes: vars, canonica: canon }, canon)] ?? GLOSARIO_ORIGEN.cliente;

  const addOwn = () => {
    const t = draft.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    if (!vars.some((v) => v.t === t)) setVars([...vars, { t, o: "cliente" }]);
    setCanon(t);
    setDraft("");
    setAdding(false);
  };
  const saveEdit = (i: number) => {
    const t = editVal.trim();
    if (!t) {
      setEditIx(-1);
      return;
    }
    const prev = vars[i].t;
    // renombrar = localizar → pasa a ser nomenclatura validada por el cliente
    setVars(vars.map((v, k) => (k === i ? { t, o: "cliente" } : v)));
    if (canon === prev) setCanon(t);
    setEditIx(-1);
  };

  return (
    <div className={"glos-row" + (g.critico ? " critico" : "")}>
      <div className="gr-src">
        <span className="gr-lock" title="Término gobernado — el lock lo impone como restricción dura">
          <Icon name="lock" size={12} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="gr-term">{g.src}</div>
          <div className="gr-lang">{GLOSARIO_PAR.src}</div>
        </div>
      </div>
      <Icon name="arrow-right" size={16} color="var(--fg-subtle)" />
      <div className="gr-tgt">
        <div className="gr-variants">
          {vars.map((v, i) =>
            editIx === i ? (
              <span className="gr-edit" key={i}>
                <input
                  autoFocus
                  className="gr-input"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(i);
                    if (e.key === "Escape") setEditIx(-1);
                  }}
                />
                <button
                  className="gr-ic ok"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveEdit(i);
                  }}
                  title="Guardar"
                  aria-label="Guardar"
                >
                  <Icon name="check" size={13} />
                </button>
                <button
                  className="gr-ic"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEditIx(-1);
                  }}
                  title="Cancelar"
                  aria-label="Cancelar"
                >
                  <Icon name="x" size={13} />
                </button>
              </span>
            ) : (
              <span key={i} className={"gr-var o-" + v.o + (v.t === canon ? " on" : "")}>
                <button
                  className="gr-var-pick"
                  onClick={() => setCanon(v.t)}
                  title={v.t === canon ? "Variante canónica del tenant" : "Fijar como canónica"}
                >
                  <span className="gr-vdot" title={GLOSARIO_ORIGEN[v.o].label} />
                  {v.t === canon && <Icon name="check" size={12} />}
                  {v.t}
                </button>
                <button
                  className="gr-var-edit"
                  onClick={() => {
                    setEditIx(i);
                    setEditVal(v.t);
                  }}
                  title="Editar / renombrar"
                  aria-label="Editar / renombrar"
                >
                  <Icon name="pencil" size={11} />
                </button>
              </span>
            ),
          )}
          {adding ? (
            <span className="gr-edit add">
              <input
                autoFocus
                className="gr-input"
                placeholder="tu término…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addOwn();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setDraft("");
                  }
                }}
              />
              <button
                className="gr-ic ok"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addOwn();
                }}
                title="Agregar"
                aria-label="Agregar"
              >
                <Icon name="check" size={13} />
              </button>
              <button
                className="gr-ic"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setAdding(false);
                  setDraft("");
                }}
                title="Cancelar"
                aria-label="Cancelar"
              >
                <Icon name="x" size={13} />
              </button>
            </span>
          ) : (
            <button className="gr-add" onClick={() => setAdding(true)} title="Agregar tu término propio (validado por el cliente)">
              <Icon name="plus" size={12} className="lic" />
              término propio
            </button>
          )}
        </div>
        <div className="gr-tgt-lang">
          {GLOSARIO_PAR.tgt} · el lock impone <b>{canon}</b> en cada consulta
        </div>
      </div>
      <div className="gr-meta">
        <span className="gr-dom">{g.dom}</span>
        <span className={"gr-origen " + orig.sev} title={orig.desc}>
          <span className={"sev-dot " + orig.sev} />
          {orig.label}
        </span>
        <span
          className="gr-anillo"
          title={g.anillo === 1 ? "Anillo 1 — NOM pública, sembrable" : "Anillo 2 — norma licenciada, confinada al tenant"}
        >
          Anillo {g.anillo}
        </span>
        {ob && (
          <span className={"gr-modal " + ob.sev} title={ob.regla}>
            <Icon name="shield-alert" size={11} className="lic" />
            {ob.label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Vista (portado de org-views.jsx · GlosarioView) ── */

export default function GlosarioPage() {
  const [par, setPar] = useState<string>(GLOSARIO_PAR.label);
  const counts = GLOSARIO.reduce<Record<string, number>>((a, g) => {
    const o = origenCanonico(g);
    a[o] = (a[o] || 0) + 1;
    return a;
  }, {});
  const conVariantes = GLOSARIO.filter((g) => g.variantes.length > 1).length;
  const regulatorios = GLOSARIO.filter((g) => g.modal).length;

  return (
    <div className="glosario-view">
      <div className="sch-head">
        <div>
          <div className="sh-t">Glosario terminológico · lock de consulta</div>
          <div className="sh-m">
            Los términos gobernados de tu organización. Antes de mostrar un fragmento traducido al idioma del usuario, el{" "}
            <b>lock</b> impone estos términos al modelo como restricción dura — no como sugerencia. El cliente fija su
            nomenclatura una vez; DOCYAN la respeta en todas las consultas.
          </div>
        </div>
        <div className="sch-legend">
          {(Object.entries(GLOSARIO_ORIGEN) as [Origen, (typeof GLOSARIO_ORIGEN)[Origen]][]).map(([k, m]) => (
            <span className="sl" key={k}>
              <span className={"sev-dot " + m.sev} />
              {m.label} · {counts[k] || 0}
            </span>
          ))}
        </div>
      </div>

      <div className="glos-toolbar">
        <Dropdown
          value={par}
          options={[
            { v: GLOSARIO_PAR.label, l: GLOSARIO_PAR.label },
            { v: "es", l: "Español (MX) → Inglés" },
          ]}
          icon="languages"
          onChange={setPar}
        />
        <div className="glos-stats">
          <span>
            <b>{GLOSARIO.length}</b> términos
          </span>
          <span>
            <b>{conVariantes}</b> con variantes
          </span>
          <span>
            <b>{regulatorios}</b> con carga regulatoria
          </span>
        </div>
      </div>

      <div className="glos-hint">
        <Icon name="info" size={13} className="lic" />
        Cada variante muestra su origen — <span className="gh-dot o-publico" />
        público (NOM) · <span className="gh-dot o-grafo" />del grafo · <span className="gh-dot o-cliente" />tuyo. Elige la
        canónica, <b>agrega tu término propio</b> o renómbralo: editar una sugerida la convierte en nomenclatura validada
        por ti.
      </div>

      <div className="admin-banner" style={{ marginBottom: 14 }}>
        <Icon name="shield-alert" size={15} className="lic" />
        Carga de obligatoriedad — <b>shall</b> ≠ <b>should</b>. Colapsar una obligación en recomendación (o al revés) en un
        MSDS o una NOM cambia el significado regulatorio. El lock preserva la carga; es obligatorio, no opcional.
      </div>

      <div className="glos-list">
        {GLOSARIO.map((g) => (
          <GlosTerm key={g.id} g={g} />
        ))}
      </div>

      <div className="glos-foot">
        <div className="glos-foot-card">
          <div className="gf-h">
            <Icon name="git-compare" size={15} className="lic" />
            No es una CAT tool
          </div>
          <p>
            Una CAT tool gobierna la terminología de un proyecto de traducción cerrado, para producir un documento
            entregable. El lock de DOCYAN gobierna la terminología de una <b>consulta viva</b> en el punto de uso — el
            operador lee el fragmento con su fuente al lado, vía QR. Distinta naturaleza, no &quot;mejor lock&quot;.
          </p>
        </div>
        <div className="glos-foot-card">
          <div className="gf-h">
            <Icon name="badge-alert" size={15} className="lic" />
            Informa, no certifica
          </div>
          <p>
            El render asistido siempre lleva su marca <span className="mono">&quot;traducción asistida — fuente en
            [idioma]&quot;</span>. Para criticidad alta —valores de seguridad, límites de exposición, obligaciones
            normativas— se muestra <b>junto</b> al original, nunca en reemplazo.
          </p>
        </div>
      </div>
    </div>
  );
}
