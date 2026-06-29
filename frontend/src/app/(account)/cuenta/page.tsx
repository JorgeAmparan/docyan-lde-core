"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { getCuenta } from "@/lib/onboarding";

/**
 * /cuenta — resumen REAL de la cuenta (B13/D4). Antes mostraba un FALLBACK enlatado
 * ("Plan Profesional · MXN 10,191" para un freemium = dato falso). Ahora consume
 * `GET /onboarding/cuenta`: plan, cupo de documentos (contado del grafo) y saldo de
 * ingesta reales del tenant. Sin storage/facturación inventados: lo que el backend
 * aún no expone no se finge.
 */
function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

export default function ResumenPage() {
  const token = useAuth((s) => s.token);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cuenta"],
    queryFn: () => getCuenta(token as string),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <h1>Resumen de cuenta</h1>
        <p style={{ color: "var(--fg-muted)" }}>Cargando tu cuenta…</p>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <h1>Resumen de cuenta</h1>
        <div className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <Icon name="triangle-alert" size={20} color="var(--danger-600)" />
          <span style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
            No pudimos cargar tu cuenta. Reintenta en unos segundos.
          </span>
        </div>
      </>
    );
  }

  const s = data;
  const isFreemium = s.plan === "freemium";
  const docLimit = s.doc_limit ?? 0;
  const docsPct = s.doc_limit ? pct(s.docs_usados, docLimit) : 0;
  const expira = fmtDate(s.freemium_expira);
  const nearLimit = !!s.doc_limit && docsPct >= 85;

  return (
    <>
      <h1>Resumen de cuenta</h1>

      {nearLimit && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
            padding: 16,
            borderColor: "var(--warning-300, var(--border-strong))",
            background: "var(--warning-50, var(--amate-100))",
          }}
        >
          <Icon name="triangle-alert" size={20} color="var(--warning-600, var(--cinnabar-600))" />
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
            Estás cerca del límite de documentos de tu plan. Elige un plan para cargar más.
          </div>
          <Link href="/plan" className="btn sec" style={{ marginLeft: "auto" }}>
            Ver planes
          </Link>
        </div>
      )}

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, padding: 18 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "var(--radius-md)",
            background: "var(--cinnabar-50)",
            color: "var(--cinnabar-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="badge-check" size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{s.plan_nombre}</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            {isFreemium
              ? expira
                ? `Cuenta gratuita · vigente hasta el ${expira}`
                : "Cuenta gratuita"
              : s.criticidad_segmento
                ? `Criticidad del segmento: ${s.criticidad_segmento}`
                : "Plan activo"}
          </div>
        </div>
        <Link href="/plan" className="btn sec" style={{ marginLeft: "auto" }}>
          {isFreemium ? "Elegir plan" : "Cambiar plan"}
        </Link>
      </div>

      <div className="usage">
        <div className="ucard">
          <div className="ul">Documentos vivos</div>
          <div className="uv">
            {s.docs_usados}
            {s.doc_limit != null ? ` / ${s.doc_limit}` : ""}
          </div>
          <div className="bar">
            <i style={{ width: `${docsPct}%` }} />
          </div>
          <div className="ud">
            {s.doc_limit != null
              ? `${docsPct}% del plan usado`
              : `${s.docs_usados} documento${s.docs_usados === 1 ? "" : "s"} · sin límite`}
          </div>
        </div>
        <div className="ucard">
          <div className="ul">Cupo de ingestas</div>
          <div className="uv" style={{ fontSize: 15, fontWeight: 600 }}>Incluido en tu plan</div>
          <div className="ud" style={{ marginTop: 8 }}>
            {isFreemium
              ? "Tu cuenta gratuita ingiere sin costo dentro del límite; sin saldo prepagado."
              : "Tu plan incluye ingestas sin costo cada mes; los adicionales se cotizan desde $15 antes de cobrar. Sin saldo prepagado."}
          </div>
        </div>
      </div>

      {/* Modelo comercial vigente (cotizador.md): cupo + excedente cotizado + método
          de pago. NADA de saldo prepagado / "recargar" — eso se eliminó. */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Icon name="credit-card" size={20} color="var(--cinnabar-600)" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Plan y método de pago</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Gestiona tu plan, tu cupo de ingestas y tu método de pago (tarjeta / SPEI).
          </div>
        </div>
        <Link href="/plan" className="btn primary" style={{ marginLeft: "auto" }}>
          Ir a Plan
        </Link>
      </div>
    </>
  );
}
