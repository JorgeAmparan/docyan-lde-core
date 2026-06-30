"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { QrFrame } from "@/components/brand/qr-frame";
import { api } from "@/lib/api-client";
import { listCodos, type CodoOut } from "@/lib/onboarding";
import { useAuth } from "@/lib/auth";

/**
 * Generar QRs — el QR es la puerta del colaborador al CoDo. Selección de CoDo +
 * entidad referenciada (datos REALES de `GET /mo/codos`), formato físico, la
 * placa de marca DOCYAN (`<QrFrame>`) y los QRs generados en esta sesión
 * (`POST /qr/generate`). No hay endpoint de listado histórico de QRs, así que
 * "Generados recientemente" muestra solo lo realmente generado en la sesión —
 * sin fabricar conteos de impresión. Markup y clases del prototipo `QRsView`.
 */

const FMTS = ["Etiqueta 5×5cm", "Placa 10×10cm", "Lámina A5"];

/** Respuesta real de POST /qr/generate (app/qr/qr_generator.py → to_dict). */
interface QrGenerated {
  token: string;
  url: string;
  entidad_id: string;
  nonce: string;
  tiene_imagen: boolean;
  svg?: string;
}

/** Un QR generado en esta sesión, con su contexto para la lista. */
interface RecentQr {
  entidadId: string;
  entidadNombre: string;
  codoId: string;
  url: string;
  nonce: string;
  revocado?: boolean;
}

export default function QrsPage() {
  const token = useAuth((s) => s.token);

  // CoDos reales del tenant; solo las entidades operativas son destino de QR.
  const { data: codosData } = useQuery({
    queryKey: ["codos"],
    queryFn: () => listCodos(token as string),
    enabled: !!token,
    retry: false,
  });
  const entidades: CodoOut[] = useMemo(
    () => (codosData?.items ?? []).filter((c) => c.tipo === "entidad"),
    [codosData],
  );

  const [qc, setQc] = useState<string>("");
  const [fmt, setFmt] = useState(1);
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState<RecentQr[]>([]);

  // La entidad activa: la seleccionada, o la primera real disponible.
  const activa = entidades.find((c) => c.id === qc) ?? entidades[0];
  const qrValue = activa ? activa.id : "docyan";
  const caption = activa ? `${activa.id} · ${activa.nombre}` : undefined;

  const gen = useMutation({
    mutationFn: () =>
      api.post<QrGenerated>(
        "/qr/generate",
        { entidad_id: activa?.id, render: true },
        { token },
      ),
    onSuccess: (r) => {
      if (!activa) return;
      setRecent((list) => [
        {
          entidadId: activa.id,
          entidadNombre: activa.nombre,
          codoId: activa.id,
          url: r?.url ?? "",
          nonce: r?.nonce ?? "",
        },
        ...list,
      ]);
      setSel(0);
    },
  });

  const revoke = useMutation({
    mutationFn: (nonce: string) => api.post("/qr/revoke", { nonce }, { token }),
    onSuccess: (_r, nonce) => {
      setRecent((list) =>
        list.map((it) => (it.nonce === nonce ? { ...it, revocado: true } : it)),
      );
    },
  });

  return (
    <div className="qrs-view">
      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h2">
            <h2>Nuevo QR persistente</h2>
          </div>
          <p className="qrs-lead">
            El QR es la puerta del colaborador al CoDo. Pégalo físicamente en el equipo, lugar o proceso.
          </p>

          <div className="field2">
            <label>CoDo</label>
            <div className="sel-box">
              <Icon name="folder-tree" size={15} />
              <select
                value={activa?.id ?? ""}
                onChange={(e) => setQc(e.target.value)}
                disabled={entidades.length === 0}
                aria-label="CoDo"
              >
                {entidades.length === 0 ? (
                  <option value="">Sin CoDos de entidad</option>
                ) : (
                  entidades.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.nombre}
                    </option>
                  ))
                )}
              </select>
              <Icon name="chevron-down" size={15} />
            </div>
          </div>

          <div className="field2">
            <label>Entidad referenciada</label>
            <div className="sel-box">
              <Icon name="box" size={15} />
              <span className="sel-val">{activa?.nombre ?? "—"}</span>
            </div>
          </div>

          <div className="field2">
            <label>Formato físico</label>
            <div className="fmt-seg2">
              {FMTS.map((o, i) => (
                <button key={o} className={fmt === i ? "on" : ""} onClick={() => setFmt(i)} type="button">
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="qr-acts">
            <button
              className="btn btn-primary"
              onClick={() => gen.mutate()}
              disabled={!activa || gen.isPending}
              type="button"
            >
              <Icon name="printer" size={15} />
              {gen.isPending ? "Imprimiendo…" : "Imprimir"}
            </button>
            <button
              className="mini-btn"
              onClick={() => gen.mutate()}
              disabled={!activa || gen.isPending}
              type="button"
            >
              <Icon name="download" size={14} />
              PNG / SVG
            </button>
          </div>
        </div>

        <div className="panel qrs-preview">
          <div className="sec-h2">
            <h2>Previsualización</h2>
          </div>
          <div className="qrs-plate-wrap">
            <QrFrame value={qrValue} caption={caption} size={188} />
          </div>

          <div className="sec-h2">
            <h2>Generados recientemente</h2>
          </div>
          {recent.length === 0 ? (
            <p className="qrs-lead qrs-empty">
              Aún no has generado QRs en esta sesión. Elige un CoDo y pulsa Imprimir.
            </p>
          ) : (
            recent.map((q, i) => (
              <div
                className={"qr-item" + (sel === i ? " on" : "")}
                key={q.nonce || i}
                onClick={() => setSel(i)}
                style={q.revocado ? { opacity: 0.5 } : undefined}
              >
                <QrFrame value={q.url || q.entidadId} size={40} showLogo={false} />
                <div style={{ minWidth: 0 }}>
                  <div className="qi-ent">{q.entidadNombre}</div>
                  <div className="qi-codo">
                    {q.codoId} · {q.revocado ? "revocado" : "generado"}
                  </div>
                </div>
                {q.revocado ? (
                  <Icon name="ban" size={15} color="var(--fg-subtle)" />
                ) : (
                  <button
                    className="qrs-revoke"
                    onClick={(e) => {
                      e.stopPropagation();
                      revoke.mutate(q.nonce);
                    }}
                    disabled={revoke.isPending}
                    type="button"
                  >
                    Revocar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
