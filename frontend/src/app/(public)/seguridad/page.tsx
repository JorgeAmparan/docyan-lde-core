"use client";

/* DOCYAN sitio público v2 — SEGURIDAD.
   Confianza para industria regulada + sección "DOCYAN cuenta, no concluye".
   Port fiel de `commercial-v2/seguridad.jsx`. */

import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";

export default function SeguridadPage() {
  const t = useT();
  return (
    <main data-screen-label="Seguridad">
      <header className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "Seguridad y gobernanza", en: "Security & governance" })}</span>
          <h1>{t({ es: "Construido para industria regulada", en: "Built for regulated industry" })}</h1>
          <p className="sec-lead">{t({
            es: "Tus documentos son materia regulada y ventaja competitiva. DOCYAN los trata como ambas cosas: aislados por organización, íntegros por criptografía y gobernados por reglas explícitas.",
            en: "Your documents are regulated matter and competitive advantage. DOCYAN treats them as both: isolated per organization, cryptographically intact, and governed by explicit rules.",
          })}</p>
        </div>
      </header>

      <section className="band" data-screen-label="Seguridad — Pilares">
        <div className="wrap">
          <div className="sec-grid2">
            {[
              { ic: "building-2", h: { es: "Multi-tenancy con RLS", en: "Multi-tenancy with RLS" }, p: { es: "Aislamiento por organización a nivel de fila en la base de datos (Row-Level Security). Tus documentos no comparten espacio lógico con nadie.", en: "Per-organization isolation at the database row level (Row-Level Security). Your documents share logical space with no one." } },
              { ic: "hash", h: { es: "Cadena de integridad SHA-256", en: "SHA-256 integrity chain" }, p: { es: "Cada documento se registra con su hash al entrar; análisis y respuestas quedan ligados a él. Cualquier alteración es detectable.", en: "Every document is registered with its hash on entry; analyses and answers stay linked to it. Any alteration is detectable." } },
              { ic: "map-pin", h: { es: "Jurisdicción de datos", en: "Data jurisdiction" }, p: { es: "Residencia de datos definida por contrato y región. Sabes en qué jurisdicción viven tus documentos — y en cuál no.", en: "Data residency defined by contract and region. You know which jurisdiction your documents live in — and which they don't." } },
              { ic: "server", h: { es: "On-premise en Enterprise", en: "On-premise for Enterprise" }, p: { es: "Para operaciones que no pueden salir de su perímetro, el tier Enterprise contempla despliegue en tu infraestructura.", en: "For operations that can't leave their perimeter, the Enterprise tier supports deployment on your infrastructure." } },
              { ic: "key-round", h: { es: "Acceso por rol y por documento", en: "Role- and document-level access" }, p: { es: "Quién consulta qué se define por rol. El MSDS es de todos; el contrato del cliente, de quien debe verlo.", en: "Who consults what is defined by role. The MSDS is for everyone; the client contract, for those who should see it." } },
              { ic: "eye-off", h: { es: "Tus datos no entrenan modelos", en: "Your data doesn't train models" }, p: { es: "Los documentos y consultas de tu organización no se usan para entrenar modelos de terceros. Punto.", en: "Your organization's documents and queries are not used to train third-party models. Period." } },
            ].map((x, i) => (
              <div className="sec-item2" key={i}>
                <span className="ic"><Icon name={x.ic} size={20} /></span>
                <div><h3>{t(x.h)}</h3><p>{t(x.p)}</p></div>
              </div>
            ))}
          </div>

          {/* cuenta, no concluye */}
          <div className="count-band" data-comment-anchor="cuenta-no-concluye">
            <div>
              <span className="eyebrow">{t({ es: "No-juicio operativo", en: "Operational non-judgment" })}</span>
              <h2>{t({ es: "DOCYAN cuenta, no concluye", en: "DOCYAN counts, it doesn't conclude" })}</h2>
              <p>{t({
                es: "La inteligencia organizacional de DOCYAN reporta frecuencia y patrón: qué se pregunta, cuánto, desde dónde. Nunca diagnostica causas, nunca evalúa personas, nunca juzga tu operación. Esa frontera es de diseño — no una promesa comercial.",
                en: "DOCYAN's organizational intelligence reports frequency and pattern: what gets asked, how much, from where. It never diagnoses causes, never evaluates people, never judges your operation. That boundary is by design — not a marketing promise.",
              })}</p>
            </div>
            <div className="count-ex">
              <div className="count-row si">
                <Icon name="check" size={16} />
                <div><span className="cl">{t({ es: "Sí reporta", en: "It does report" })}</span>{t({ es: "«El documento X concentró el 40% de las consultas del turno B este mes.»", en: "“Document X drew 40% of shift B's queries this month.”" })}</div>
              </div>
              <div className="count-row no">
                <Icon name="x" size={16} />
                <div><span className="cl">{t({ es: "Nunca dirá", en: "It will never say" })}</span>{t({ es: "«El turno B no domina el proceso» — diagnosticar causas es trabajo tuyo, no del sistema.", en: "“Shift B doesn't master the process” — diagnosing causes is your work, not the system's." })}</div>
              </div>
              <div className="count-row si">
                <Icon name="check" size={16} />
                <div><span className="cl">{t({ es: "Sí reporta", en: "It does report" })}</span>{t({ es: "«12 preguntas recurrentes no encuentran buena fuente en tu documentación.»", en: "“12 recurring questions find no good source in your documentation.”" })}</div>
              </div>
              <div className="count-row no">
                <Icon name="x" size={16} />
                <div><span className="cl">{t({ es: "Nunca dirá", en: "It will never say" })}</span>{t({ es: "«Tu documentación es deficiente» — el dato es tuyo; la conclusión, también.", en: "“Your documentation is deficient” — the data is yours; so is the conclusion." })}</div>
              </div>
            </div>
          </div>

          {/* línea regulatoria */}
          <div className="unsafe" style={{ marginTop: 28 }}>
            <Icon name="scale" size={20} />
            <div>
              <h3>{t({ es: "Capa de conocimiento, no sistema de registro", en: "Knowledge layer, not system of record" })}</h3>
              <p>{t({
                es: "DOCYAN emite alertas administrativas y respuestas citadas para decidir mejor. No sustituye a tu LIMS, tu MES ni tu expediente regulatorio, y nunca toma la decisión clínica u operativa.",
                en: "DOCYAN raises administrative alerts and cited answers for better decisions. It doesn't replace your LIMS, your MES or your regulatory file, and it never makes the clinical or operational decision.",
              })}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="band paper" data-screen-label="Seguridad — CTA">
        <div className="wrap">
          <div className="cta-band">
            <h2 className="sec-title">{t({ es: "¿Tu equipo de seguridad quiere más detalle?", en: "Does your security team want more detail?" })}</h2>
            <p className="sec-lead" style={{ margin: "12px auto 0" }}>{t({ es: "El piloto asistido incluye sesión técnica con tu equipo de TI y seguridad.", en: "The guided pilot includes a technical session with your IT and security team." })}</p>
          </div>
          <Doors compact />
        </div>
      </section>
    </main>
  );
}
