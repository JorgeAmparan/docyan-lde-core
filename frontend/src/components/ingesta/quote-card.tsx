"use client";

import { Icon } from "@/components/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_TYPES, ESTADO_META, docTypeById } from "@/lib/doc-types";

/**
 * QuoteCard — tarjeta de cotización por documento, portada al prototipo `CotizaCard`
 * del design system (cotizador.css). Modelo Comercial Canónico: cupo del plan
 * cubre las primeras ($0) y el excedente se cotiza con la fórmula. NADA de saldo
 * prepagado.
 *
 * Da SUPERFICIE al pipeline cotizar→confirmar que el backend YA tiene: el usuario
 * VE el valor real de cada ingesta, corrige el tipo (regla transversal #1) y aprueba.
 * Presentacional puro → unit-testable sin red:
 *   - Freemium / dentroCupo: `valueUsd` (precio de setup real) TACHADO + chip
 *     "Incluido"/"$0". El cero no se inventa: el plan freemium / el cupo lo incluye.
 *   - Pago fuera de cupo: chip de cobro "$X.XX" + "excede el cupo".
 *   - Tipo no cubierto por schema (`tipoNoCubierto`): `cot-notice gen` honesto.
 *   - Escaneado (`advertencia`): `cot-notice ocr` (el costo real puede variar).
 *   - `rejected`/`overCap`: el estado no aprobado se dice, no se oculta.
 *   - Corrección de tipo: solo si se pasa `onTipoChange` (la página re-cotiza con
 *     `tipo_forzado`). En `/documentos` y onboarding la corrección no aplica.
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
  /** Metadatos del documento (prototipo `ct-meta`): formato · págs · MB · tokens. */
  fmt?: string | null;
  pages?: number | null;
  mb?: number | null;
  tokens?: number | null;
  /** Confianza del clasificador 0..1 (barra `ct-conf`). */
  confianza?: number | null;
  /** Quién resolvió el tipo: la etiqueta `ct-resuelto`. */
  resolvedBy?: "heuristica" | "usuario" | "worker_generara" | null;
  /** Corrección de tipo: si se provee, se muestra el dropdown `ct-correct`. */
  onTipoChange?: (tipoForzado: string) => void;
  /** Tipo forzado en curso (selección del usuario). */
  tipoForzado?: string | null;
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
  fmt,
  pages,
  mb,
  tokens,
  confianza,
  resolvedBy,
  onTipoChange,
  tipoForzado,
  onRemove,
}: QuoteCardProps) {
  const free = isFreemium || dentroCupo;
  const excede = !free && !rejected; // cobra setup (excede el cupo)

  // Tipo efectivo (corrección del usuario gana sobre la clasificación del backend).
  const tipoActivo = tipoForzado ?? tipo ?? null;
  const dt = docTypeById(tipoActivo);
  const est = dt ? ESTADO_META[dt.estado] : ESTADO_META.falta;
  const tbLabel = dt ? dt.label : tipoActivo ? tipoActivo : "Tipo no reconocido";
  const tbFase = dt ? est.label.toLowerCase() : "genérica";
  const conf = confianza != null ? Math.round(confianza * 100) : null;

  const resuelto = tipoForzado
    ? { ic: "user-check", txt: "corregido por ti" }
    : resolvedBy === "usuario"
      ? { ic: "user-check", txt: "corregido por ti" }
      : resolvedBy === "worker_generara"
        ? { ic: "sparkles", txt: "el worker generará el schema" }
        : { ic: "scan-line", txt: "clasificado automáticamente" };

  // Metadatos del documento (ct-meta) — solo los datos reales disponibles.
  const metaParts: string[] = [];
  if (fmt) metaParts.push(fmt);
  if (pages != null) metaParts.push(`${pages} ${pages === 1 ? "pág" : "págs"}`);
  if (mb != null) metaParts.push(`${mb.toFixed(1)} MB`);
  if (tokens != null) metaParts.push(`${(tokens / 1000).toFixed(1)}k tokens`);

  return (
    <div
      className={"cot-card" + (excede ? " excede" : "") + (rejected ? " rejected" : "")}
      data-testid="quote-card"
    >
      <div className="ct-head">
        <span className="ct-ic">
          <Icon name="file-text" size={16} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ct-name">{name}</div>
          {metaParts.length > 0 && <div className="ct-meta">{metaParts.join(" · ")}</div>}
        </div>
        <div className="ct-price" data-testid="quote-price">
          {isFreemium ? (
            <>
              <span className="price-chip incluido" data-testid="quote-total">
                <Icon name="check" size={13} />
                {money(0, currency)}
              </span>
              <div className="ct-price-sub">freemium · $0</div>
              {/* Ancla de valor: el precio real, tachado (solo freemium). */}
              <span className="ct-was mono" data-testid="quote-struck">
                {money(valueUsd, currency)}
              </span>
              <span className="qc-disc" data-testid="quote-discount" hidden>
                Descuento Freemium −100%
              </span>
            </>
          ) : dentroCupo ? (
            // Dentro de cupo (prototipo CotizaCard): chip de texto "Incluido", sin
            // precio tachado — "en tu plan · $0".
            <>
              <span className="price-chip incluido" data-testid="quote-total">
                <Icon name="check" size={13} />
                Incluido
              </span>
              <div className="ct-price-sub">en tu plan · $0</div>
            </>
          ) : (
            <>
              <span className="price-chip cobro" data-testid="quote-total">
                {money(totalUsd, currency)}
              </span>
              <div className="ct-price-sub">{rejected ? "no entra en el lote" : "excede el cupo"}</div>
              {saldoUsd != null && (
                <div className={"ct-price-sub" + (rejected ? " warn" : "")}>
                  Saldo: {money(saldoUsd, currency)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tipo documental clasificado + confianza */}
      <div className="ct-type">
        <span className="type-badge">
          <span className={"sev-dot " + est.sev} />
          <span className="tb-label">{tbLabel}</span>
          <span className="tb-fase">{tbFase}</span>
        </span>
        <span className="ct-resuelto">
          <Icon name={resuelto.ic} size={13} />
          {resuelto.txt}
        </span>
        {conf != null && (
          <span className="ct-conf">
            <span className="ct-conf-bar">
              <i className={conf < 75 ? "lo" : ""} style={{ width: conf + "%" }} />
            </span>
            <span className="ct-conf-v">{conf}%</span>
          </span>
        )}
      </div>

      {/* Corregir tipo (regla transversal #1) — solo cuando la página puede re-cotizar. */}
      {onTipoChange && (
        <div className="ct-correct">
          <span className="ccl">
            <Icon name="pencil" size={13} />
            Corregir tipo
          </span>
          <Select value={tipoActivo ?? undefined} onValueChange={(v) => onTipoChange(v)}>
            <SelectTrigger className="ct-select" aria-label="Corregir tipo de documento">
              <SelectValue placeholder="Elegir tipo…" />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                  {d.estado !== "activo" ? `  · ${ESTADO_META[d.estado].label.toLowerCase()}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Aviso honesto: tipo sin schema dedicado → extracción genérica. */}
      {tipoNoCubierto && (
        <div className="cot-notice gen" data-testid="quote-tipo-warning" role="status">
          <Icon name="alert-triangle" size={15} />
          <span>
            Este tipo de documento aún no está optimizado; la consulta puede ser limitada. Se ingiere
            con <b>extracción genérica</b> y un schema generado al vuelo — queda consultable con cita a
            la fuente.
          </span>
        </div>
      )}

      {/* Aviso honesto: documento escaneado → el costo real puede variar (OCR). */}
      {advertencia && (
        <div className="cot-notice ocr" role="status">
          <Icon name="scan" size={15} />
          <span>{advertencia}</span>
        </div>
      )}

      {rejected && (
        <div className="cot-notice warn" data-testid="quote-rejected" role="alert">
          <Icon name="alert-triangle" size={15} />
          <span>Alcanzaste el tope de tu plan o el cap de la sesión. No entra en este lote.</span>
        </div>
      )}
      {!rejected && overCap && (
        <div className="cot-notice ocr" role="status">
          <Icon name="info" size={15} />
          <span>Fuera del cap de sesión. Quita otro documento para incluirlo.</span>
        </div>
      )}

      {onRemove && (
        <div className="ct-correct" style={{ marginTop: 11 }}>
          <button
            className="link-btn ct-remove"
            onClick={onRemove}
            aria-label={`Quitar ${name} del lote`}
          >
            Quitar
          </button>
        </div>
      )}
    </div>
  );
}
