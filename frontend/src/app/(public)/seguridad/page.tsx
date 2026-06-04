import type { Metadata } from "next";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "Seguridad y cumplimiento · DOCYAN LDE",
};

/* Recreated from the commercial kit `SecurityPage` (pages.jsx §6.3.3). */

const SEC: [icon: string, heading: string, body: string][] = [
  ["layers", "Multi-tenancy absoluto", "Aislamiento total entre organizaciones. Ningún dato cruza tenants."],
  ["database", "RLS por tenant", "Row-Level Security en base de datos — el aislamiento se aplica en la capa de datos, no solo en la app."],
  ["shield-check", "Cadena criptográfica SHA-256", "Cada evento del FAT se encadena con hash. La bitácora de auditoría es verificable e inviolable."],
  ["globe-lock", "GDPR · Privacy Act AU · Aviso MX", "Cumplimiento de privacidad por jurisdicción, con residencia de datos según mercado."],
  ["server", "Opción on-premise (Enterprise)", "Despliegue dedicado en infraestructura del cliente para los requisitos más estrictos."],
  ["bug", "Responsible disclosure", "Canal de divulgación responsable para investigadores de seguridad."],
];

export default function SecurityPage() {
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Seguridad y cumplimiento</span>
          <h1 className="page-h1">Hecho para industria regulada, desde el dato.</h1>
          <p className="sec-lead">
            La trazabilidad no es un extra: es el producto. Así protegemos y
            auditamos cada consulta.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="sec-grid">
            {SEC.map(([ic, h, p]) => (
              <div className="sec-item" key={h}>
                <div className="si-ic">
                  <Icon name={ic} size={20} />
                </div>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="chain-card">
            <div className="cc-ic">
              <Icon name="shield-check" size={22} />
            </div>
            <div>
              <div className="cc-t">FAT · cadena íntegra</div>
              <div className="cc-m mono">
                SHA-256 · 8,412 eventos encadenados · última verificación hoy
              </div>
            </div>
            <span className="cc-ok">✓ Verificada</span>
          </div>
        </div>
      </section>
    </>
  );
}
