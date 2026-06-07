"use client";

import { api } from "./api-client";
import { usePlatformAuth } from "./platform-auth";
import type { components } from "@/types/api";

/* ── Tipos del contrato (generados desde OpenAPI) ──────────────────────────── */
export type OrgSummary = components["schemas"]["OrgSummary"];
export type OrgMetrics = components["schemas"]["OrgMetrics"];
export type PlatformSummary = components["schemas"]["PlatformSummary"];
export type PlatformTrends = components["schemas"]["PlatformTrends"];
export type JobSummary = components["schemas"]["JobSummary"];
export type AccessCodeOut = components["schemas"]["AccessCodeOut"];
export type PaymentOut = components["schemas"]["PaymentOut"];
export type BillingStatus = components["schemas"]["BillingStatus"];
export type SupportThreadOut = components["schemas"]["SupportThreadOut"];

/* ── Cliente ligado al token de plataforma ─────────────────────────────────── */
/**
 * Hook que devuelve un cliente REST con el JWT de `platform_admin` adjunto. Toda
 * llamada de la consola pasa por aquí, nunca por el `api` crudo, para no mezclar
 * con la sesión de tenant.
 */
export function usePlatformApi() {
  const token = usePlatformAuth((s) => s.token);
  return {
    token,
    get: <T = unknown>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
      api.get<T>(path, { token, query }),
    post: <T = unknown>(path: string, json?: unknown) => api.post<T>(path, json, { token }),
  };
}

/* ── Ciclo de vida de la organización (los 6 estados del Modelo Comercial) ──── */
// El backend modela lifecycle_status ∈ {active,grace,suspended,cancelled} y `plan`
// por separado. La consola los combina en UN "estado" para el filtro de 6 vías,
// derivándolo de campos REALES (sin inventar): grace/suspended/cancelled ganan;
// si está active, el plan distingue piloto/freemium/activa.
export type OrgEstado =
  | "activa" | "gracia" | "suspendida" | "cancelada" | "piloto" | "freemium";

export function deriveEstado(org: { lifecycle_status?: string | null; plan?: string | null }): OrgEstado {
  switch (org.lifecycle_status) {
    case "grace": return "gracia";
    case "suspended": return "suspendida";
    case "cancelled": return "cancelada";
  }
  const plan = (org.plan ?? "").toLowerCase();
  if (plan === "piloto" || plan === "prueba") return "piloto";
  if (plan === "freemium") return "freemium";
  return "activa";
}

export type Tone = "ok" | "warn" | "caution" | "danger" | "info" | "muted" | "ink";

export const ESTADO_META: Record<OrgEstado, { label: string; tone: Tone; icon: string }> = {
  activa:     { label: "Activa",     tone: "ok",      icon: "circle-check" },
  gracia:     { label: "Gracia",     tone: "warn",    icon: "alarm-clock" },
  suspendida: { label: "Suspendida", tone: "danger",  icon: "ban" },
  cancelada:  { label: "Cancelada",  tone: "muted",   icon: "circle-off" },
  piloto:     { label: "Piloto",     tone: "info",    icon: "flask-conical" },
  freemium:   { label: "Freemium",   tone: "caution", icon: "gift" },
};

export const PLAN_META: Record<string, { cls: string }> = {
  enterprise:  { cls: "pt-ink" },
  profesional: { cls: "pt-info" },
};
export function planClass(plan?: string | null): string {
  return PLAN_META[(plan ?? "").toLowerCase()]?.cls ?? "pt-muted";
}

/* ── Jobs ───────────────────────────────────────────────────────────────────── */
export const JOB_STATE: Record<string, { label: string; tone: Tone; icon: string }> = {
  queued:     { label: "En cola",    tone: "muted",  icon: "list-ordered" },
  processing: { label: "Procesando", tone: "info",   icon: "loader" },
  completed:  { label: "Completado", tone: "ok",     icon: "circle-check" },
  failed:     { label: "Error",      tone: "danger", icon: "x-octagon" },
  rejected:   { label: "Rechazado",  tone: "muted",  icon: "circle-off" },
  pending_confirmation: { label: "Por confirmar", tone: "muted", icon: "clock" },
};

export const PHASE_LABEL: Record<string, string> = {
  descarga: "Descarga", conversion: "Conversión", extraccion: "Extracción",
  grafo: "Escritura a grafo", dedup: "Deduplicación",
};

export const SUPPORT_STATE: Record<string, { label: string; tone: Tone }> = {
  abierto:    { label: "Abierto",    tone: "warn" },
  respondido: { label: "Respondido", tone: "info" },
  cerrado:    { label: "Cerrado",    tone: "ok" },
};

export const CODE_STATE: Record<string, { label: string; tone: Tone }> = {
  active:  { label: "Activo",    tone: "ok" },
  used:    { label: "Usado",     tone: "info" },
  expired: { label: "Expirado",  tone: "muted" },
  revoked: { label: "Revocado",  tone: "danger" },
};

/* ── Formato (metadata; nunca contenido) ───────────────────────────────────── */
export function fmtInt(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-MX").format(Math.round(n));
}
export function fmtMoney(n?: number | null, cur = "USD"): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
}
export function fmtBytes(bytes?: number | null): { value: string; unit: string } | null {
  if (bytes === null || bytes === undefined) return null;
  if (bytes < 1024) return { value: String(bytes), unit: "B" };
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return { value: v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2), unit: units[i] };
}
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function monthLabel(ym: string): string {
  // "2026-04" → "abr"
  const m = Number(ym.slice(5, 7));
  return MES[m - 1] ?? ym;
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
}
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
export function initials(value?: string | null): string {
  if (!value) return "DY";
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
