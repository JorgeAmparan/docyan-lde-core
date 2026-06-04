"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { QrFrame } from "@/components/brand/qr-frame";
import { api } from "@/lib/api-client";

/**
 * Generar QRs — the QR is the collaborator's door into a CoDo. Select CoDo +
 * operative entity, physical size + format, preview via <QrFrame>, recent batch
 * with revoke, discrete DOCYAN mark in each plate. POST /qr/generate.
 */

const CODOS = [
  { id: "CODO-LAB-04", name: "Centrífugas & rotores" },
  { id: "CODO-LAB-02", name: "Balanzas analíticas" },
];
const ENTITIES: Record<string, string[]> = {
  "CODO-LAB-04": ["Centrífuga Hettich Rotina 380", "CNC Haas VF-2"],
  "CODO-LAB-02": ["Balanza analítica AB204"],
};

const SIZES = ["Etiqueta 4×4cm", "Etiqueta 8×8cm", "Placa 15×15cm", "Lámina A4"];
const FORMATS = ["PNG", "PDF"];

interface BatchItem {
  id: string;
  codo: string;
  entity: string;
  printed: number;
  revoked?: boolean;
}
const CANNED_BATCH: BatchItem[] = [
  { id: "b1", codo: "CODO-LAB-04", entity: "Centrífuga Hettich · Rotina 380", printed: 4 },
  { id: "b2", codo: "CODO-LAB-04", entity: "CNC Haas VF-2", printed: 7 },
  { id: "b3", codo: "CODO-LAB-02", entity: "Balanza analítica AB204", printed: 11 },
];

export default function QrsPage() {
  const [codo, setCodo] = useState(CODOS[0].id);
  const [entity, setEntity] = useState(ENTITIES[CODOS[0].id][0]);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [format, setFormat] = useState("PNG");
  const [batch, setBatch] = useState<BatchItem[]>(CANNED_BATCH);
  const [selected, setSelected] = useState(0);

  const codoName = CODOS.find((c) => c.id === codo)?.name ?? "";
  const qrValue = `https://docyan.app/q/${codo}/${encodeURIComponent(entity)}`;
  const caption = `${codo} · ${entity}`;

  const gen = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>("/qr/generate", {
        codo_id: codo,
        entity,
        size: SIZES[sizeIdx],
        format,
      }),
    onSuccess: (r) => {
      setBatch((b) => [{ id: r?.id ?? `b-${Date.now()}`, codo, entity, printed: 0 }, ...b]);
    },
    // DESIGN: optimistic local batch insert when endpoint absent.
    onError: () => setBatch((b) => [{ id: `b-${Date.now()}`, codo, entity, printed: 0 }, ...b]),
  });

  function revoke(id: string) {
    setBatch((b) => b.map((it) => (it.id === id ? { ...it, revoked: true } : it)));
  }

  return (
    <div className="ing-grid">
      <div className="panel">
        <div className="sec-h">
          <h2>Nuevo QR persistente</h2>
        </div>
        <p className="panel-lead">
          El QR es la puerta del colaborador al CoDo. Pégalo físicamente en el equipo, lugar o proceso.
        </p>

        <div className="field2">
          <label>CoDo</label>
          <select
            className="sel-box"
            value={codo}
            onChange={(e) => {
              setCodo(e.target.value);
              setEntity(ENTITIES[e.target.value][0]);
            }}
          >
            {CODOS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field2">
          <label>Entidad operativa referenciada</label>
          <select className="sel-box" value={entity} onChange={(e) => setEntity(e.target.value)}>
            {ENTITIES[codo].map((en) => (
              <option key={en} value={en}>
                {en}
              </option>
            ))}
          </select>
        </div>

        <div className="field2">
          <label>Tamaño físico</label>
          <div className="seg">
            {SIZES.map((o, i) => (
              <button key={o} className={i === sizeIdx ? "on" : ""} onClick={() => setSizeIdx(i)}>
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="field2">
          <label>Formato</label>
          <div className="seg">
            {FORMATS.map((o) => (
              <button key={o} className={o === format ? "on" : ""} onClick={() => setFormat(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="qr-acts">
          <button className="primary-btn" onClick={() => gen.mutate()} disabled={gen.isPending}>
            <Icon name="printer" size={15} />
            {gen.isPending ? "Generando…" : "Generar e imprimir"}
          </button>
          <button className="mini-btn" onClick={() => gen.mutate()}>
            <Icon name="download" size={14} />
            {format}
          </button>
        </div>
      </div>

      <div className="panel qr-preview-panel">
        <div className="sec-h">
          <h2>Previsualización</h2>
        </div>
        <QrFrame value={qrValue} caption={caption} />

        <div className="sec-h" style={{ marginTop: 22 }}>
          <h2>Generados recientemente</h2>
        </div>
        {batch.map((it, i) => (
          <div
            className={"qr-item" + (selected === i ? " on" : "")}
            key={it.id}
            onClick={() => setSelected(i)}
            style={it.revoked ? { opacity: 0.5 } : undefined}
          >
            <QrFrame value={`https://docyan.app/q/${it.codo}`} size={42} showLogo={false} />
            <div style={{ minWidth: 0 }}>
              <div className="qi-ent">{it.entity}</div>
              <div className="qi-codo mono">
                {it.codo} · {it.revoked ? "revocado" : `${it.printed} impresos`}
              </div>
            </div>
            {it.revoked ? (
              <Icon name="ban" size={15} color="var(--fg-subtle)" />
            ) : (
              <button
                className="link-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  revoke(it.id);
                }}
              >
                Revocar
              </button>
            )}
          </div>
        ))}
        <p className="panel-lead" style={{ marginTop: 10 }}>
          CoDo activo: {codoName}. Cada placa incluye la marca DOCYAN discreta.
        </p>
      </div>
    </div>
  );
}
