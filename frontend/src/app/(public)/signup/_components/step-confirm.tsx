"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

/** Confirmation screen shown after the (placeholder) payment submit. */
export function StepConfirm() {
  return (
    <div className="auth" style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--success-100)",
          color: "var(--success-600)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "20px 0 0",
        }}
      >
        <Icon name="check" size={28} />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: "18px 0 8px" }}>Cuenta creada</h1>
      <p style={{ color: "var(--fg-muted)", fontSize: 15 }}>
        Enviaremos tu factura a tu correo. Vamos a configurar tu primera organización.
      </p>
      <Link className="btn primary lg" style={{ margin: "24px auto 0" }} href="/onboarding/1">
        Ir al onboarding
        <Icon name="arrow-right" size={17} />
      </Link>
    </div>
  );
}
