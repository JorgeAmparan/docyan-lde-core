"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api-client";
import { STRIPE_ENABLED, CONTACT_EMAIL } from "@/lib/config";

/**
 * Ingesta — the pre-ingest quote GATE (no bypass). Upload → /mo/ingesta/quote
 * (cost regional + tiempo + saldo) → EXPLICIT human confirmation → /mo/ingesta/
 * confirm enqueues. Insufficient balance: recharge (Stripe) or manual mailto.
 * Justification: PoC $5,000 incident. The gate is the decision; never auto-skip.
 */

interface Quote {
  cost_usd: number;
  eta_minutes: number;
  balance_usd: number;
  tokens?: number;
  doc_name?: string;
}

const CANNED_QUOTE: Quote = { cost_usd: 58.4, eta_minutes: 14, balance_usd: 184, doc_name: "documento.pdf" };

type QStatus = "encolado" | "procesando" | "terminado" | "fallido";
interface QItem {
  id: string;
  name: string;
  status: QStatus;
  pct: number;
  eta: string;
}

const CANNED_QUEUE: QItem[] = [
  { id: "q1", name: "Procedimiento de limpieza CIP.pdf", status: "procesando", pct: 62, eta: "~3 min" },
  { id: "q2", name: "Anexo IATF — registros.docx", status: "encolado", pct: 0, eta: "en cola" },
  { id: "q3", name: "Bitácora calibración Q1.xlsx", status: "terminado", pct: 100, eta: "completado" },
  { id: "q4", name: "Manual prensa (escaneo).pdf", status: "fallido", pct: 0, eta: "OCR ilegible" },
];

const ING_HIST: [string, string, string, string, "ok"][] = [
  ["28 may", "Manual CNC Haas VF-2.pdf", "$42.80", "11 min", "ok"],
  ["24 may", "Lote MSDS (×6)", "$66.10", "23 min", "ok"],
  ["19 may", "Histórico calibración 2024", "$18.30", "6 min", "ok"],
];

const BALANCE = { available: 184, consumed: 316, total: 500 };

export default function IngestaPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [queue, setQueue] = useState<QItem[]>(CANNED_QUEUE);

  const quoteMut = useMutation({
    mutationFn: (name: string) => api.post<Quote>("/mo/ingesta/quote", { doc_name: name }),
    onSuccess: (q) => setQuote(q),
    // DESIGN: canned quote when endpoint absent — but the GATE still requires confirm.
    onError: () => setQuote({ ...CANNED_QUOTE, doc_name: fileName ?? CANNED_QUOTE.doc_name }),
  });

  const confirmMut = useMutation({
    mutationFn: () => api.post<{ job_id: string }>("/mo/ingesta/confirm", { doc_name: fileName }),
    onSuccess: (r) => {
      setConfirmed(true);
      setQueue((q) => [
        { id: r?.job_id ?? `job-${Date.now()}`, name: fileName ?? "documento.pdf", status: "encolado", pct: 0, eta: "en cola" },
        ...q,
      ]);
    },
    // DESIGN: optimistic local enqueue if confirm endpoint absent.
    onError: () => {
      setConfirmed(true);
      setQueue((q) => [
        { id: `job-${Date.now()}`, name: fileName ?? "documento.pdf", status: "encolado", pct: 0, eta: "en cola" },
        ...q,
      ]);
    },
  });

  function onFile(name: string) {
    setFileName(name);
    setQuote(null);
    setConfirmed(false);
    quoteMut.mutate(name);
  }

  const balPct = Math.round((BALANCE.consumed / BALANCE.total) * 100);
  const q = quote;
  const insufficient = q ? q.cost_usd > q.balance_usd : false;

  function retry(id: string) {
    setQueue((cur) => cur.map((it) => (it.id === id ? { ...it, status: "encolado", eta: "reintentando…" } : it)));
  }
  function cancel(id: string) {
    setQueue((cur) => cur.filter((it) => it.id !== id));
  }

  return (
    <>
      <div className="ing-grid">
        <div className="panel">
          <div className="sec-h">
            <h2>Cotización pre-ingesta</h2>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f.name);
            }}
          />
          <div
            className="dropzone"
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f.name);
            }}
          >
            <Icon name="upload-cloud" size={26} />
            <div className="dz-t">
              {fileName ? fileName : <>Arrastra documentos o <b>selecciona</b></>}
            </div>
            <div className="dz-m">PDF · DOCX · XLSX · imágenes con OCR</div>
          </div>

          {quoteMut.isPending && (
            <div className="manual-note" style={{ marginTop: 14 }}>
              <Icon name="loader" size={15} />
              Cotizando con tiktoken…
            </div>
          )}

          {q && (
            <>
              <div className="quote">
                <div className="qr2">
                  <span>Costo estimado (regional)</span>
                  <b className="mono">${q.cost_usd.toFixed(2)} USD</b>
                </div>
                <div className="qr2">
                  <span>Tiempo estimado</span>
                  <b className="mono">~{q.eta_minutes} min</b>
                </div>
                <div className="qr2">
                  <span>Saldo disponible</span>
                  <b className={"mono " + (insufficient ? "warn" : "ok")}>${q.balance_usd.toFixed(2)} USD</b>
                </div>
              </div>

              {insufficient ? (
                STRIPE_ENABLED ? (
                  <Link className="primary-btn" href="/cuenta/recharge" style={{ marginTop: 12 }}>
                    <Icon name="credit-card" size={15} />
                    Recargar saldo
                  </Link>
                ) : (
                  <div className="manual-note">
                    <Icon name="info" size={15} />
                    Saldo insuficiente para esta ingesta.{" "}
                    <a href={`mailto:${CONTACT_EMAIL}?subject=Recarga de saldo de ingesta DOCYAN`}>
                      Contactar a DOCYAN para recargar saldo →
                    </a>
                  </div>
                )
              ) : (
                <>
                  {!STRIPE_ENABLED && (
                    <div className="manual-note">
                      <Icon name="info" size={15} />
                      Cobro manual durante el piloto.{" "}
                      <a href={`mailto:${CONTACT_EMAIL}?subject=Recarga de saldo de ingesta DOCYAN`}>
                        Contactar a DOCYAN para recargar saldo →
                      </a>
                    </div>
                  )}
                  {/* GATE: explicit human confirmation before enqueue. No bypass. */}
                  <button
                    className="primary-btn"
                    onClick={() => confirmMut.mutate()}
                    disabled={confirmMut.isPending || confirmed}
                  >
                    <Icon name="play" size={15} />
                    {confirmed ? "Encolado ✓" : confirmMut.isPending ? "Encolando…" : "Confirmar e ingerir"}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <div className="sec-h">
            <h2>Cola de ingesta</h2>
          </div>
          {queue.map((it) => (
            <div className="qitem" key={it.id}>
              <div className="qi-top">
                <span className={"q-dot " + it.status} />
                <span className="qi-name">{it.name}</span>
                <span className={"qi-st " + it.status}>{it.status}</span>
              </div>
              {it.status === "procesando" && (
                <div className="bar" style={{ marginTop: 8 }}>
                  <i style={{ width: it.pct + "%" }} />
                </div>
              )}
              <div className="qi-foot">
                <span className="mono">{it.eta}</span>
                {it.status === "fallido" && (
                  <button className="link-btn" onClick={() => retry(it.id)}>
                    Reintentar
                  </button>
                )}
                {it.status === "encolado" && (
                  <button className="link-btn" onClick={() => cancel(it.id)}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="two" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="sec-h">
            <h2>Saldo prepagado</h2>
            {STRIPE_ENABLED ? (
              <Link className="more" href="/cuenta/recharge">
                Recargar →
              </Link>
            ) : (
              <a className="more" href={`mailto:${CONTACT_EMAIL}?subject=Recarga de saldo de ingesta DOCYAN`}>
                Recargar →
              </a>
            )}
          </div>
          <div className="bal-row">
            <span className="bv">${BALANCE.available}</span>
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>USD disponibles</span>
          </div>
          <div className="bar">
            <i style={{ width: `${balPct}%` }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 7 }}>
            Consumido ${BALANCE.consumed} de ${BALANCE.total} este ciclo
          </div>
        </div>
        <div className="panel">
          <div className="sec-h">
            <h2>Historial</h2>
          </div>
          <table className="mini-tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Documento</th>
                <th>Costo</th>
                <th>Duración</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {ING_HIST.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="mono">{r[2]}</td>
                  <td className="mono">{r[3]}</td>
                  <td>
                    <Icon name="check" size={14} color="var(--success-600)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
