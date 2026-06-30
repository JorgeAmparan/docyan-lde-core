"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { OrgShell } from "@/components/org-shell";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { activarPlan, getCuenta, type CuentaResumen } from "@/lib/onboarding";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import {
  BANDS,
  bandCurrency,
  fmtTierPrice,
  type BandKey,
  type TierKey,
} from "@/lib/bands";

/**
 * Plan de la organización (vista de cuenta) — portada PIXEL-PERFECT de
 * `PlanView` (org-views.jsx). Tres piezas: planes canónicos por DOCUMENTOS VIVOS
 * × banda geográfica · método de pago · código de acceso (piloto −30%).
 *
 * Modelo comercial canónico (cotizador.md + modelo de precios v2.1): NO hay saldo
 * prepagado ni "recargar"; el plan se mide en documentos vivos y cada plan trae
 * su cupo de ingestas (Esencial 10+3/mes · Profesional 30+10/mes · Enterprise
 * negociado). FUENTE ÚNICA del precio: `bands.ts` (Banda A = MXN tabla fija;
 * B/C = USD). El cambio de plan pega el endpoint real `POST /onboarding/plan`.
 */

type PlanDef = {
  id: "free" | "esencial" | "pro" | "enterprise";
  /** Clave que entiende el backend (`ActivarPlanRequest.plan`). */
  apiPlan: "freemium" | "esencial" | "profesional" | "enterprise";
  /** Clave de precio en bands.ts (null = sin precio, plan gratuito). */
  tier: TierKey | null;
  label: string;
  blurb: string;
  docs: string;
  /** [arranque, recurrente/mes] · null = sin cupo · "negociado". */
  cupo: [number, number] | null | "negociado";
  rec?: boolean;
  from?: boolean;
  feats: string[];
};

/* Planes canónicos — alineados a la fuente única (bands.ts v2.1). Métrica:
   DOCUMENTOS VIVOS, no usuarios. Todas las capacidades en todos los planes. */
const PLANES: PlanDef[] = [
  {
    id: "free", apiPlan: "freemium", tier: null, label: "Gratuito",
    blurb: "Para empezar y evaluar, sin tarjeta.",
    docs: "3 documentos vivos · 30 días", cupo: null,
    feats: ["3 documentos vivos por 30 días", "Todas las capacidades del producto", "Usuarios ilimitados por QR", "Consulta con cita al original"],
  },
  {
    id: "esencial", apiPlan: "esencial", tier: "esencial", label: "Esencial",
    blurb: "Para un equipo o un CoDo.",
    docs: "hasta 50 documentos vivos", cupo: [10, 3],
    feats: ["Hasta 50 documentos vivos", "10 documentos de arranque + 3/mes", "Todas las capacidades del producto", "Usuarios ilimitados", "Consulta multilingüe citada al original"],
  },
  {
    id: "pro", apiPlan: "profesional", tier: "profesional", label: "Profesional",
    blurb: "Para operación multi-CoDo.", rec: true,
    docs: "hasta 300 documentos vivos", cupo: [30, 10],
    feats: ["Hasta 300 documentos vivos", "30 documentos de arranque + 10/mes", "Todo lo de Esencial", "Inteligencia organizacional (frecuencia y cobertura)", "Soporte prioritario"],
  },
  {
    id: "enterprise", apiPlan: "enterprise", tier: "enterprise", label: "Enterprise",
    from: true, blurb: "Para organizaciones reguladas a escala.",
    docs: "300+ · a la medida", cupo: "negociado",
    feats: ["Documentos vivos 300+ a la medida", "Arranque y cupo mensual negociados", "On-premise / jurisdicción dedicada", "SSO/SAML · residencia de datos", "Acompañamiento de implementación"],
  },
];

const PLAN_ADICIONAL = "Documentos sobre el cupo: desde $15, cotizados antes de cobrar.";

/** Métodos de pago configurados del tenant (Capa B billing — estado local). */
type Metodo = {
  id: string; tipo: "card" | "spei"; marca: string; num: string | null;
  exp?: string; titular?: string; detalle?: string; principal: boolean;
};
const METODOS_PAGO_INICIAL: Metodo[] = [
  { id: "mp1", tipo: "card", marca: "Visa", num: "4421", exp: "08/27", titular: "Jorge Medina", principal: true },
  { id: "mp2", tipo: "spei", marca: "SPEI / transferencia", num: null, detalle: "CLABE ···· 8842 · BBVA", principal: false },
];

/** Modal de confirmación (reemplaza el `dcModal` del prototipo). */
type ModalSpec = {
  icon: string; title: string; body: string; confirm: string;
  tone?: "danger"; onConfirm?: () => void;
};

export default function PlanPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const [cuenta, setCuenta] = useState<CuentaResumen | null>(null);
  const [band, setBand] = useState<BandKey>("A");
  const [metodos, setMetodos] = useState<Metodo[]>(METODOS_PAGO_INICIAL);
  const [addCard, setAddCard] = useState(false);
  const [form, setForm] = useState({ titular: "", num: "", exp: "", cvv: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalSpec | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    getCuenta(token)
      .then((c) => {
        if (!alive) return;
        setCuenta(c);
      })
      .catch(() => {
        /* sin cuenta cargada se asume freemium · banda A */
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const cur = bandCurrency(band); // MXN (Banda A, fija) | USD (B/C)
  const actualApiPlan = cuenta?.plan ?? "freemium";
  const planActualLabel =
    PLANES.find((p) => p.apiPlan === actualApiPlan)?.label ?? "Gratuito";

  /** Cambia de plan vía el endpoint real, conservando la criticidad ya elegida. */
  const cambiarPlan = useCallback(
    async (p: PlanDef) => {
      if (busy || !token) return;
      setBusy(true);
      setErr(null);
      try {
        await activarPlan(
          {
            plan: p.apiPlan,
            // PlanView no re-pregunta criticidad: se conserva la del tenant
            // (decisión #15 ya fijada en onboarding); fallback seguro.
            criticidad_segmento: cuenta?.criticidad_segmento ?? "regulatorio",
            doc_limit: null,
            banda_mercado: band,
          },
          token,
        );
        const refreshed = await getCuenta(token).catch(() => null);
        if (refreshed) setCuenta(refreshed);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "No pudimos cambiar tu plan. Intenta de nuevo.");
      } finally {
        setBusy(false);
      }
    },
    [busy, token, cuenta, band],
  );

  const setPrincipal = (id: string) =>
    setMetodos((ms) => ms.map((m) => ({ ...m, principal: m.id === id })));

  const delMetodo = (m: Metodo) => {
    if (m.principal) {
      setModal({
        icon: "info", title: "No se puede eliminar",
        body: "Es tu método principal. Marca otro como principal antes de eliminar este.",
        confirm: "Entendido",
      });
      return;
    }
    setModal({
      icon: "trash-2", title: "Eliminar método de pago",
      body: "Se elimina “" + m.marca + (m.num ? " ···· " + m.num : "") + "” de tu cuenta.",
      confirm: "Eliminar", tone: "danger",
      onConfirm: () => setMetodos((ms) => ms.filter((x) => x.id !== m.id)),
    });
  };

  const guardarCard = () => {
    const num = form.num.replace(/\s/g, "").slice(-4);
    if (num.length < 4) {
      setAddCard(false);
      return;
    }
    setMetodos((ms) => [
      ...ms,
      { id: "mp" + Date.now(), tipo: "card", marca: "Tarjeta", num, exp: form.exp || "—", titular: form.titular || "—", principal: false },
    ]);
    setForm({ titular: "", num: "", exp: "", cvv: "" });
    setAddCard(false);
  };

  const closeModal = () => setModal(null);

  return (
    <OrgShell>
      <div className="plan-view">
      <div className="wrap">
        {/* C · Planes canónicos por documentos vivos × banda geográfica */}
        <div className="sec-h2">
          <h2>Tu plan</h2>
          <span className="cnt">Por documentos vivos, no por usuarios · {PLAN_ADICIONAL}</span>
        </div>
        <div className="banda-bar">
          <span className="banda-lab">
            <Icon name="globe" size={14} />
            Banda de precio
          </span>
          <div className="banda-seg">
            {(Object.values(BANDS)).map((bn) => (
              <button
                key={bn.key}
                className={"banda-chip" + (band === bn.key ? " on" : "")}
                onClick={() => setBand(bn.key)}
              >
                {bn.key} · {bn.regions.es}
              </button>
            ))}
          </div>
        </div>
        <div className="planes4">
          {PLANES.map((p) => {
            const esActual = p.apiPlan === actualApiPlan;
            return (
              <div className={"plan4" + (p.rec ? " rec" : "") + (esActual ? " on" : "")} key={p.id}>
                {p.rec && !esActual && <span className="p4-tag rec">Más elegido</span>}
                {esActual && <span className="p4-tag">Tu plan</span>}
                <div className="p4-name">{p.label}</div>
                <div className="p4-docs">{p.docs}</div>
                <div className="p4-price">
                  {p.tier === null ? (
                    <>
                      $0<small>/mes</small>
                    </>
                  ) : (
                    <>
                      {p.from && <span className="p4-from">desde</span>}
                      {fmtTierPrice(band, p.tier)}
                      <small>/mes</small>
                    </>
                  )}
                </div>
                <div className="p4-band">Banda {band} · {BANDS[band].regions.es} · {cur}</div>
                <div className="p4-cupo">
                  {p.cupo === null ? (
                    "Sin cupo de ingestas"
                  ) : p.cupo === "negociado" ? (
                    "Cupo de ingestas negociado"
                  ) : (
                    <>
                      <b>{p.cupo[0]}</b> de arranque + <b>{p.cupo[1]}</b>/mes
                    </>
                  )}
                </div>
                <div className="p4-blurb">{p.blurb}</div>
                <div className="p4-feats">
                  {p.feats.map((f, i) => (
                    <div className="p4-f" key={i}>
                      <Icon name="check" size={14} />
                      {f}
                    </div>
                  ))}
                </div>
                {esActual ? (
                  <button className="btn btn-ghost" style={{ width: "100%" }} disabled>
                    Plan actual
                  </button>
                ) : p.from ? (
                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%" }}
                    onClick={() =>
                      setModal({
                        icon: "layers",
                        title: "Hablar con ventas",
                        body: "Enterprise se cotiza a la medida: documentos vivos, cupo de ingestas, SSO/SAML, residencia de datos y on-premise.",
                        confirm: "Contactar a ventas",
                      })
                    }
                  >
                    Hablar con ventas
                  </button>
                ) : (
                  <button
                    className={"btn " + (p.rec ? "btn-primary" : "btn-ghost")}
                    style={{ width: "100%" }}
                    disabled={busy}
                    onClick={() => cambiarPlan(p)}
                  >
                    {p.id === "free" ? (
                      "Cambiar a Gratuito"
                    ) : p.rec ? (
                      <>
                        <Icon name="gem" size={15} />
                        Subir a {p.label}
                      </>
                    ) : (
                      "Cambiar a " + p.label
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {err && (
          <p className="warn" role="alert" style={{ textAlign: "center", margin: "12px 0 0" }}>
            {err}
          </p>
        )}
        <p style={{ fontSize: 12, color: "var(--fg-subtle)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
          Los tres planes consultan igual de bien. La diferencia es cuántos documentos viven en tu
          entorno. Banda según región · Banda A en MXN · B y C en USD/mes por organización.
        </p>

        {/* B · Método de pago — configuración completa */}
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="sec-h2">
            <h2>Método de pago</h2>
            <button className="mini-btn" style={{ marginLeft: "auto" }} onClick={() => setAddCard((v) => !v)}>
              <Icon name={addCard ? "x" : "plus"} size={14} />
              {addCard ? "Cancelar" : "Agregar tarjeta"}
            </button>
          </div>
          {addCard && (
            <div className="mp-form">
              <div className="mp-form-grid">
                <div className="field2" style={{ gridColumn: "1 / -1" }}>
                  <label>Titular (nombre completo)</label>
                  <input
                    className="codigo-input"
                    placeholder="Nombre del titular"
                    value={form.titular}
                    onChange={(e) => setForm((f) => ({ ...f, titular: e.target.value }))}
                  />
                </div>
                <div className="field2" style={{ gridColumn: "1 / -1" }}>
                  <label>Número de tarjeta</label>
                  <input
                    className="codigo-input"
                    placeholder="4242 4242 4242 4242"
                    value={form.num}
                    onChange={(e) => setForm((f) => ({ ...f, num: e.target.value }))}
                  />
                </div>
                <div className="field2">
                  <label>Vencimiento</label>
                  <input
                    className="codigo-input"
                    placeholder="MM/AA"
                    value={form.exp}
                    onChange={(e) => setForm((f) => ({ ...f, exp: e.target.value }))}
                  />
                </div>
                <div className="field2">
                  <label>CVV</label>
                  <input
                    className="codigo-input"
                    placeholder="3 dígitos"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.cvv}
                    onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value }))}
                  />
                </div>
              </div>
              <button className="btn btn-primary" onClick={guardarCard}>
                <Icon name="check" size={15} />
                Guardar tarjeta
              </button>
            </div>
          )}
          {metodos.map((m) => (
            <div className="mp-row" key={m.id}>
              <span className="mp-ic">
                <Icon name={m.tipo === "card" ? "credit-card" : "building-2"} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mp-n">
                  {m.marca}
                  {m.num ? " ···· " + m.num : ""}
                </div>
                <div className="mp-m">
                  {m.tipo === "card" ? "Vence " + m.exp + " · " + m.titular : m.detalle}
                </div>
              </div>
              {m.principal ? (
                <span className="badge ok">Principal</span>
              ) : (
                <button className="mp-link" onClick={() => setPrincipal(m.id)}>
                  Hacer principal
                </button>
              )}
              <button className="mp-del" title="Eliminar" onClick={() => delMetodo(m)}>
                <Icon name="trash-2" size={14} />
              </button>
            </div>
          ))}
          <div className="mp-info">
            <Icon name="info" size={15} />
            Aceptamos tarjeta, SPEI y OXXO. El cobro de ingestas (cupo + excedente desde $15) y la
            suscripción se cargan a tu método principal. Durante el piloto el cobro es manual.
          </div>
        </div>

        {/* Código de acceso · piloto */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="sec-h2">
            <h2>Código de acceso</h2>
            <span className="badge ok" style={{ marginLeft: "auto" }}>
              Piloto −30%
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
            ¿Tienes un código de piloto? Canjéalo para activar el plan <b>Esencial con −30%</b> por 60
            días, con cupo de ingestas incluido (10 + 3/mes).
          </p>
          <div className="codigo-row">
            <input className="codigo-input" placeholder="DOCYAN-PILOTO-XXXX" />
            <button
              className="btn btn-ghost"
              onClick={() =>
                setModal({
                  icon: "ticket",
                  title: "Canjear código de acceso",
                  body: "Se valida el código y, si es válido, activa el plan piloto (Esencial −30%) con su cupo de ingestas y ventana de 60 días.",
                  confirm: "Canjear código",
                })
              }
            >
              <Icon name="ticket" size={15} />
              Canjear
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--fg-subtle)", textAlign: "center", margin: "16px 0 0" }}>
          Plan actual: {planActualLabel}
        </p>
      </div>

      <Dialog open={modal !== null} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <Icon name={modal.icon} size={18} /> {modal.title}
                </DialogTitle>
                <DialogDescription>{modal.body}</DialogDescription>
              </DialogHeader>
              <div className="plan-modal-foot">
                <DialogClose asChild>
                  <button className="mini-btn">Cerrar</button>
                </DialogClose>
                <button
                  className={"primary-btn" + (modal.tone === "danger" ? " plan-modal-danger" : "")}
                  onClick={() => {
                    modal.onConfirm?.();
                    closeModal();
                  }}
                >
                  {modal.confirm}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </OrgShell>
  );
}
