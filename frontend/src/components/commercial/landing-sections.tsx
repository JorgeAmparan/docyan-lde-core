import Link from "next/link";
import { Icon } from "@/components/icon";

/* Shared landing sections — reused by Landing v1 and v2 (FLOW). Ported 1:1 from
   the design bundle `landing.jsx`. v2 adds the `.prob-trust` callout (Problem)
   and the `.reg-lead` governance paragraph (Regulatory). */

const PROBLEMS: [string, string, string][] = [
  ["files", "Documentos muertos y dispersos", "Manuales, MSDS y procedimientos repartidos en carpetas que nadie abre en el piso."],
  ["user-minus", "Conocimiento que se va con la gente", "Cuando el experto se jubila, su forma de resolver se va con él."],
  ["clock", "Tiempo perdido buscando", "Cada consulta empieza de cero: buscar, hojear, interpretar."],
  ["shield-alert", "Cumplimiento frágil", "La trazabilidad regulatoria depende de procesos manuales que fallan."],
];

const STEPS: [string, string, string][] = [
  ["upload", "Ingieres tus documentos como están", "Sin reescribir nada. DOCYAN los lee tal cual: PDFs, manuales, fichas, MSDS."],
  ["qr-code", "Pegas QRs en equipos, lugares y procesos", "Cada QR es la puerta a un CoDo — un contexto documental coherente."],
  ["scan-line", "Cualquiera escanea y consulta", "Pregunta en lenguaje natural; recibe respuesta con cita a la fuente exacta."],
];

const VERTS: [string, string, string, string[], string][] = [
  ["flask-conical", "Laboratorios ISO 17025", "Calibraciones, vigencias y procedimientos por equipo.", ["ISO 17025"], "laboratorios"],
  ["factory", "Maquiladoras IMMEX", "Manuales por línea, MSDS y procedimientos de seguridad.", ["NOM-018-STPS", "IATF 16949"], "maquiladoras"],
  ["pill", "Farmacéutica", "Documentación auditada con cadena criptográfica.", ["FDA", "TGA", "COFEPRIS"], "pharma"],
  ["sprout", "Agroexportación", "Documentación viva por mercado destino.", ["EU Organic"], "agribusiness"],
  ["mountain", "Minería", "Safety & compliance en el piso de mina.", ["AS/NZS"], "mining"],
  ["plane", "Aeroespacial", "Procedimientos críticos trazables.", ["AS9100"], "agencias"],
];

const DIFFS: [string, string, string][] = [
  ["timer", "Días, no meses", "Time-to-value medido en días — frente a los meses de una implementación tradicional."],
  ["file-check", "Ingiere como está", "No reescribimos tus documentos en otro sistema. Entran tal cual."],
  ["link", "Pedigree clickeable", "Cada respuesta lleva cita al span exacto del documento fuente."],
  ["brain", "Conocimiento retenido", "El saber tácito se queda en tu organización."],
  ["languages", "Multi-idioma nativo", "Consulta en español o inglés; expandible por mercado."],
  ["badge-dollar-sign", "Precio transparente", "Planes públicos con cifras. Sin cotización opaca."],
];

const NORMS = ["NOM-018-STPS", "NOM-026-STPS", "IATF 16949", "AS9100", "ISO 17025", "FDA 21 CFR", "EU Organic", "TGA", "GMP", "AS/NZS"];

export function Problem() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">El problema</span>
        <h2 className="sec-title">El conocimiento existe. No está donde se necesita.</h2>
        <div className="diffs" style={{ marginTop: 32 }}>
          {PROBLEMS.map(([ic, h, p]) => (
            <div className="diff" key={h}>
              <span className="di"><Icon name={ic} size={20} /></span>
              <div><h3>{h}</h3><p>{p}</p></div>
            </div>
          ))}
        </div>
        <div className="prob-trust">
          <Icon name="shield-alert" size={20} />
          <div>
            <h3>El problema no es solo dónde está el conocimiento. Es si puedes confiar en lo que te responde un sistema.</h3>
            <p>Los chatbots genéricos alucinan: inventan cifras, fabrican normas que no existen y no pueden mostrarte la fuente exacta. En una industria regulada, eso no es una limitación tolerable.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="band">
      <div className="wrap">
        <span className="eyebrow">Cómo funciona</span>
        <h2 className="sec-title">Tres pasos. Días, no meses.</h2>
        <div className="steps3">
          {STEPS.map(([ic, h, p], i) => (
            <div className="step3" key={h}>
              <div className="n">0{i + 1}</div>
              <div className="si"><Icon name={ic} size={22} /></div>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Verticals() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Casos de uso</span>
        <h2 className="sec-title">Hecho para industrias reguladas.</h2>
        <div className="verts">
          {VERTS.map(([ic, h, p, norms, slug]) => (
            <Link className="vert" key={h} href={`/verticales/${slug}`}>
              <div className="vi"><Icon name={ic} size={20} /></div>
              <h3>{h}</h3>
              <p>{p}</p>
              <div className="norms">{norms.map((n) => <span className="norm" key={n}>{n}</span>)}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Differentiators() {
  return (
    <section className="band">
      <div className="wrap">
        <span className="eyebrow">Por qué DOCYAN</span>
        <h2 className="sec-title">Lo que la categoría no te da.</h2>
        <div className="diffs">
          {DIFFS.map(([ic, h, p]) => (
            <div className="diff" key={h}>
              <span className="di"><Icon name={ic} size={20} /></span>
              <div><h3>{h}</h3><p>{p}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Regulatory() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Cumplimiento</span>
        <h2 className="sec-title">Marcos que DOCYAN soporta.</h2>
        <p className="sec-lead reg-lead">
          Los marcos regulatorios no se satisfacen con buenas intenciones. DOCYAN entrega lo que el auditor pide: cita cliqueable a fuente, trazabilidad criptográfica de cada respuesta servida, y bloqueo activo de cualquier output que no pueda sustentar. No son aspiración; son lo que el sistema ya respeta por diseño.
        </p>
        <div className="norms-big">{NORMS.map((n) => <span key={n}>{n}</span>)}</div>
        <div className="disc">
          <Icon name="info" size={18} />
          <p>
            DOCYAN es una capa de conocimiento, no un sistema de registro primario. Las alertas son administrativas — nunca decisiones clínicas u operativas.
          </p>
        </div>
      </div>
    </section>
  );
}
