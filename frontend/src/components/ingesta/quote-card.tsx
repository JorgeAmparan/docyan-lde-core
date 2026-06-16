"use client";

import { Icon } from "@/components/icon";

/**
 * QuoteCard — tarjeta de cotización por documento (Sprint UI-2 §1.1.2/§1.1.5).
 *
 * Da SUPERFICIE al pipeline cotizar→confirmar que el backend YA tiene: el usuario
 * VE el valor real de cada ingesta y aprueba (control de gasto explícito, ancla de
 * valor pre-conversión). Presentacional puro → unit-testable sin red:
 *   - Freemium: `valueUsd` (precio de setup real) TACHADO + "Descuento Freemium
 *     −100%" + Total $0.00. El cero no se inventa: el plan freemium lo incluye.
 *   - Pago: misma tarjeta sin tachado (cotización real + saldo + aprobación).
 *   - Tipo no cubierto por schema (`tipoNoCubierto`): aviso honesto ANTES de aprobar.
 *   - `rejected`/`overCap`: el estado no aprobado se dice, no se oculta.
 */
export interface QuoteCardProps {
  name: string;
  /** Tipo clasificado (heurística/usuario); null si el worker generará el schema. */
  tipo?: string | null;
  /** Plan freemium → 100% de descuento sobre el valor de setup. */
  isFreemium: boolean;
  /** Valor real de la ingesta (precio de setup comercial), en `currency`. */
  valueUsd: number;
  /** Costo total a pagar tras descuentos/cupo. Freemium → 0. */
  totalUsd: number;
  /** "USD" (internacional) | "MXN" (México, banda A). Etiqueta de moneda. */
  currency: string;
  /** Saldo disponible (solo se muestra en planes pagos). */
  saldoUsd?: number | null;
  /** Incluida en el cupo del plan (setup $0 sin ser freemium). */
  dentroCupo?: boolean;
  cupoRestante?: number | null;
  /** Tipo sin schema optimizado (worker_generara) → aviso honesto. */
  tipoNoCubierto?: boolean;
  /** Rechazada por saldo / hard cap, o fuera del cap de sesión. */
  rejected?: boolean;
  overCap?: boolean;
  /** Estimación poco confiable (p.ej. PDF escaneado) → el costo real puede variar. */
  advertencia?: string | null;
  onRemove?: () => void;
}

function money(v: number, currency: string): string {
  // MXN (Banda A): entero, agrupación es-MX. USD: dos decimales.
  if (currency === "MXN") return `$${Math.round(v).toLocaleString("es-MX")} MXN`;
  return `$${v.toFixed(2)} ${currency}`;
}

export function QuoteCard({
  name,
  tipo,
  isFreemium,
  valueUsd,
  totalUsd,
  currency,
  saldoUsd,
  dentroCupo,
  cupoRestante,
  tipoNoCubierto,
  rejected,
  overCap,
  advertencia,
  onRemove,
}: QuoteCardProps) {
  const free = isFreemium || dentroCupo;
  return (
    <div className={"quote-card" + (rejected ? " rejected" : "")} data-testid="quote-card">
      <div className="qc-head">
        <span className="qc-ic">
          <Icon name="file-text" size={17} />
        </span>
        <div className="qc-id">
          <div className="qc-name">{name}</div>
          <div className="qc-tipo">
            {tipo ? (
              <span className="qc-badge">{tipo}</span>
            ) : (
              <span className="qc-badge tentative">Tipo por clasificar</span>
            )}
          </div>
        </div>
        {onRemove && (
          <button
            className="link-btn qc-remove"
            onClick={onRemove}
            aria-label={`Quitar ${name} del lote`}
          >
            Quitar
          </button>
        )}
      </div>

      {/* Precio: ancla de valor. Freemium → valor tachado + descuento + $0.00. */}
      <div className="qc-price" data-testid="quote-price">
        {free ? (
          <>
            <span className="qc-was mono" data-testid="quote-struck">
              {money(valueUsd, currency)}
            </span>
            <span className="qc-disc" data-testid="quote-discount">
              {isFreemium ? "Descuento Freemium −100%" : "Incluido en tu plan"}
            </span>
            <span className="qc-total mono" data-testid="quote-total">
              {money(0, currency)}
            </span>
          </>
        ) : (
          <>
            <span className="qc-total mono" data-testid="quote-total">
              {money(totalUsd, currency)}
            </span>
            {saldoUsd != null && (
              <span className={"qc-saldo mono" + (rejected ? " warn" : "")}>
                Saldo: {money(saldoUsd, currency)}
              </span>
            )}
          </>
        )}
      </div>

      {!isFreemium && dentroCupo && cupoRestante != null && (
        <div className="qc-note">
          <Icon name="badge-check" size={14} />
          {cupoRestante} ingesta{cupoRestante === 1 ? "" : "s"} incluida{cupoRestante === 1 ? "" : "s"} restante{cupoRestante === 1 ? "" : "s"}
        </div>
      )}

      {/* §1.1.5 — aviso honesto de tipo no cubierto ANTES de aprobar. */}
      {tipoNoCubierto && (
        <div className="qc-note warn" data-testid="quote-tipo-warning" role="status">
          <Icon name="info" size={14} />
          Este tipo de documento aún no está optimizado; la consulta puede ser limitada.
        </div>
      )}

      {advertencia && (
        <div className="qc-note" role="status">
          <Icon name="alert-triangle" size={14} />
          {advertencia}
        </div>
      )}

      {rejected && (
        <div className="qc-note warn" data-testid="quote-rejected" role="alert">
          <Icon name="x-circle" size={14} />
          Rechazado por saldo o hard cap. No entra en este lote.
        </div>
      )}
      {!rejected && overCap && (
        <div className="qc-note warn" role="status">
          <Icon name="info" size={14} />
          Fuera del cap de sesión. Quita otro documento para incluirlo.
        </div>
      )}
    </div>
  );
}
