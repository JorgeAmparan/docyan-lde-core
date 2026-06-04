import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estado del sistema · DOCYAN LDE",
};

/* Recreated from the commercial kit `StatusPage` (pages.jsx §6.3.7).
   DESIGN: static snapshot — same illustrative data as the kit. A live status
   page would fetch these rows from a health endpoint. */

type CompStatus = "operational" | "degraded";
type IncStatus = "degraded" | "resolved";

const COMP: [name: string, status: CompStatus][] = [
  ["API de consulta", "operational"],
  ["Ingesta de documentos", "operational"],
  ["Generación de QRs", "operational"],
  ["Dashboard de cuenta", "operational"],
  ["Pagos (Stripe)", "degraded"],
  ["Notificaciones por email", "operational"],
];

const INC: [day: string, title: string, meta: string, status: IncStatus][] = [
  ["Hoy", "Latencia elevada en pagos", "Investigando · 14:20", "degraded"],
  ["28 may", "Mantenimiento programado de ingesta", "Resuelto · 02:00–02:40", "resolved"],
];

export default function StatusPage() {
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Estado del sistema</span>
          <div className="status-hero">
            <span className="sh-dot" />
            <h1 className="page-h1" style={{ margin: 0 }}>
              Operación normal
            </h1>
          </div>
          <p className="sec-lead">
            Uptime 90 días · <b className="mono">99.98%</b>
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="status-list">
            {COMP.map(([name, st]) => (
              <div className="status-row" key={name}>
                <span className={"st-dot " + st} />
                <span className="st-name">{name}</span>
                <span className={"st-lab " + st}>
                  {st === "operational" ? "Operativo" : "Degradado"}
                </span>
              </div>
            ))}
          </div>
          <div className="sec-h-c">
            <h2 className="sec-title" style={{ fontSize: 22 }}>
              Incidentes recientes
            </h2>
          </div>
          {INC.map(([d, t, m, st], i) => (
            <div className="incident" key={i}>
              <span className={"st-dot " + st} />
              <div>
                <div className="inc-t">{t}</div>
                <div className="inc-m mono">
                  {d} · {m}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
