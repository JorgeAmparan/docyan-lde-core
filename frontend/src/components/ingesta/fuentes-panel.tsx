"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

/**
 * FuentesPanel — modo "Conectar una fuente" del cotizador, portado del prototipo
 * `FuentesPanel` (org-views.jsx / cotizador.css).
 *
 * HONESTIDAD (no stubs que finjan capacidad): el backend NO tiene endpoints de
 * conectores (no hay `ingest_sources`). Por eso este panel es una superficie
 * EXPLÍCITAMENTE no funcional: muestra el catálogo de fuentes y el formulario de
 * conexión, pero "Conectar" no inventa una conexión ni trae documentos. Cada
 * fuente lleva el sello "Próximamente" y el formulario está deshabilitado con una
 * nota clara. Cuando exista el backend de conectores, este componente se cablea.
 */

interface Fuente {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

// Catálogo del prototipo. SIN estado "conectado": ninguna fuente está conectada
// porque no hay backend que lo respalde (no se fabrica una conexión falsa).
const FUENTES: Fuente[] = [
  { id: "google_drive", label: "Google Drive", icon: "hard-drive", desc: "Carpeta o unidad compartida" },
  { id: "onedrive", label: "OneDrive / SharePoint", icon: "cloud", desc: "Biblioteca de documentos" },
  { id: "ftp", label: "FTP / SFTP", icon: "server", desc: "Servidor de archivos por ruta" },
  { id: "notion", label: "Notion", icon: "book-open", desc: "Wiki como fuente documental" },
];

export function FuentesPanel() {
  const [sel, setSel] = useState<Fuente | null>(null);

  if (sel) {
    return (
      <div className="fuente-detail">
        <button className="fuente-back" onClick={() => setSel(null)}>
          <Icon name="arrow-left" size={15} />
          Fuentes
        </button>
        <div className="fuente-head">
          <span className="fuente-ic">
            <Icon name={sel.icon} size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fuente-l">{sel.label}</div>
            <div className="fuente-d">{sel.desc}</div>
          </div>
          <span className="fuente-soon">Próximamente</span>
        </div>

        <div className="fuente-form">
          {sel.id === "ftp" ? (
            <>
              <div className="field2">
                <label>Host</label>
                <input className="codigo-input" placeholder="sftp.ejemplo.mx" disabled />
              </div>
              <div className="field2">
                <label>Usuario</label>
                <input className="codigo-input" placeholder="docyan" disabled />
              </div>
              <div className="field2">
                <label>Ruta remota</label>
                <input className="codigo-input" placeholder="/documentos/normas" disabled />
              </div>
            </>
          ) : (
            <div className="field2">
              <label>
                {sel.id === "notion" ? "Token de integración" : "Carpeta / biblioteca a monitorear"}
              </label>
              <input
                className="codigo-input"
                placeholder={sel.id === "notion" ? "secret_…" : "ID o enlace de la carpeta"}
                disabled
              />
            </div>
          )}
        </div>

        <button className="primary-btn" style={{ width: "100%" }} disabled>
          <Icon name="plug" size={15} />
          Conectar {sel.label}
        </button>

        <div className="manual-note" style={{ marginTop: 12 }}>
          <Icon name="info" size={15} />
          Los conectores de fuentes están <b>en construcción</b>. Por ahora, sube documentos desde
          el modo <b>Subir documentos</b>. Cuando se liberen, DOCYAN traerá copias para hacerlas
          consultables — sin mover ni borrar nada en la fuente.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fuentes-grid">
        {FUENTES.map((f) => (
          <button key={f.id} className="fuente-card" onClick={() => setSel(f)}>
            <span className="fuente-ic">
              <Icon name={f.icon} size={20} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="fuente-l">{f.label}</div>
              <div className="fuente-d">{f.desc}</div>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
      </div>
      <div className="manual-note" style={{ marginBottom: 16 }}>
        <Icon name="info" size={15} />
        Los conectores de fuentes están <b>en construcción</b>. Mientras tanto, usa <b>Subir
        documentos</b> para cotizar e ingerir tu lote.
      </div>
    </>
  );
}
