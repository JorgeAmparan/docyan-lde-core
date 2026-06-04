"use client";

import { useRegion } from "@/lib/region-store";
import { useSignup } from "@/lib/signup-store";
import type { RegionKey } from "@/lib/pricing";

/**
 * Step 3 — region-specific fiscal data. The active commercial region selects which
 * fiscal block renders. No hard validation here (tax IDs are optional in most
 * regions); fields persist to the signup store on change for the summary + B9.1
 * Stripe Customer/Tax payload.
 */
export function StepFiscal({ formId }: { formId: string }) {
  const region = useRegion((s) => s.region);
  const fiscal = useSignup((s) => s.fiscal);
  const setFiscal = useSignup((s) => s.setFiscal);
  const markStepReached = useSignup((s) => s.markStepReached);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    markStepReached(4);
    window.dispatchEvent(new CustomEvent("signup:advance", { detail: { from: 3 } }));
  };

  return (
    <form id={formId} onSubmit={onSubmit} noValidate>
      <h2>Datos fiscales</h2>
      <p className="lead">{fiscalLead(region)}</p>
      {fiscalFields(region, fiscal, setFiscal)}
    </form>
  );
}

function fiscalLead(region: RegionKey): string {
  switch (region) {
    case "MX":
      return "México · facturación CFDI 4.0.";
    case "USA / CA":
      return "Estados Unidos / Canadá · facturación con tax ID.";
    case "UE":
      return "Unión Europea · IVA intracomunitario (VAT).";
    case "AU":
      return "Australia · ABN para GST.";
    case "UK":
      return "Reino Unido · VAT.";
    default:
      return "Datos de facturación de tu organización.";
  }
}

type Fiscal = ReturnType<typeof useSignup.getState>["fiscal"];
type SetFiscal = (f: Partial<Fiscal>) => void;

function fiscalFields(region: RegionKey, fiscal: Fiscal, set: SetFiscal) {
  const address = (
    <>
      <div className="field">
        <label>Dirección fiscal</label>
        <input
          placeholder="Calle, número, colonia"
          value={fiscal.addressLine}
          onChange={(e) => set({ addressLine: e.target.value })}
        />
      </div>
      <div className="row2c">
        <div className="field">
          <label>Ciudad</label>
          <input value={fiscal.city} onChange={(e) => set({ city: e.target.value })} />
        </div>
        <div className="field">
          <label>Código postal</label>
          <input value={fiscal.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
        </div>
      </div>
    </>
  );

  if (region === "MX") {
    return (
      <>
        <div className="row2c">
          <div className="field">
            <label>RFC</label>
            <input
              placeholder="XAXX010101000"
              value={fiscal.rfc}
              onChange={(e) => set({ rfc: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="field">
            <label>Razón social</label>
            <input
              placeholder="Laboratorio Estándar SA de CV"
              value={fiscal.razonSocial}
              onChange={(e) => set({ razonSocial: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Uso de CFDI</label>
          <select value={fiscal.usoCfdi} onChange={(e) => set({ usoCfdi: e.target.value })}>
            <option value="G03">G03 — Gastos en general</option>
            <option value="G01">G01 — Adquisición de mercancías</option>
            <option value="P01">P01 — Por definir</option>
          </select>
        </div>
        {address}
      </>
    );
  }

  if (region === "USA / CA") {
    return (
      <>
        <div className="row2c">
          <div className="field">
            <label>Company name</label>
            <input
              placeholder="Acme Labs Inc."
              value={fiscal.companyName}
              onChange={(e) => set({ companyName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Tax ID (opcional)</label>
            <input
              placeholder="EIN / BN"
              value={fiscal.taxId}
              onChange={(e) => set({ taxId: e.target.value })}
            />
          </div>
        </div>
        {address}
      </>
    );
  }

  if (region === "UE") {
    return (
      <>
        <div className="row2c">
          <div className="field">
            <label>Razón social</label>
            <input
              placeholder="Acme Labs SL"
              value={fiscal.companyName}
              onChange={(e) => set({ companyName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>VAT (opcional)</label>
            <input
              placeholder="ESB12345678"
              value={fiscal.vatId}
              onChange={(e) => set({ vatId: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        {address}
      </>
    );
  }

  if (region === "UK") {
    return (
      <>
        <div className="row2c">
          <div className="field">
            <label>Company name</label>
            <input
              placeholder="Acme Labs Ltd"
              value={fiscal.companyName}
              onChange={(e) => set({ companyName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>VAT (opcional)</label>
            <input
              placeholder="GB123456789"
              value={fiscal.vatId}
              onChange={(e) => set({ vatId: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        {address}
      </>
    );
  }

  if (region === "AU") {
    return (
      <>
        <div className="row2c">
          <div className="field">
            <label>Company name</label>
            <input
              placeholder="Acme Labs Pty Ltd"
              value={fiscal.companyName}
              onChange={(e) => set({ companyName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>ABN (opcional)</label>
            <input
              placeholder="12 345 678 901"
              value={fiscal.abn}
              onChange={(e) => set({ abn: e.target.value })}
            />
          </div>
        </div>
        {address}
      </>
    );
  }

  // Generic (LatAm + fallback)
  return (
    <>
      <div className="row2c">
        <div className="field">
          <label>Razón social</label>
          <input
            placeholder="Nombre legal de la organización"
            value={fiscal.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Identificación fiscal (opcional)</label>
          <input value={fiscal.taxId} onChange={(e) => set({ taxId: e.target.value })} />
        </div>
      </div>
      {address}
    </>
  );
}
