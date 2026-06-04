import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { Problem, HowItWorks, Verticals, Differentiators, Regulatory } from "@/components/commercial/landing-sections";

export const metadata: Metadata = { title: "Landing v1" };

const LEVELS: [string, string, string, string][] = [
  ["Nivel 1", "Consulta viva", "Documento consultable en tiempo real, en el punto de uso, con cita clickeable a la fuente.", "Escanea → pregunta → respuesta con cita."],
  ["Nivel 2", "Conocimiento capturado", "El usuario captura cómo consulta — qué pregunta y en qué orden — como objeto reutilizable.", "Una rutina de arranque se vuelve un Playbook."],
  ["Nivel 3", "Inteligencia organizacional", "Las consultas y anotaciones retienen el conocimiento tácito cuando la gente se va.", "DOCYAN detecta patrones de uso del equipo."],
];

/** Landing v1 — the original static "magic moment" landing, preserved. */
export default function LandingV1Page() {
  return (
    <>
      <div className="wrap">
        <div className="hero">
          <div>
            <span className="eyebrow">Live Document Environment</span>
            <h1>Tus documentos, vivos donde se necesitan.</h1>
            <p className="sub">Escanea el QR del equipo, pregunta y obtén respuesta con cita a la fuente exacta. Sin buscar, sin reescribir tus manuales.</p>
            <div className="cta">
              <Link href="/signup" className="btn primary lg"><Icon name="calendar" size={17} />Agendar demo de 30 min</Link>
              <Link href="/precios" className="btn sec lg">Ver planes</Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="mock">
              <div className="mctx">
                <DocyanMark size={22} />
                <div><div className="ml">Estás consultando</div><div className="mn">CODO-LAB-04 · Centrífuga Hettich</div></div>
              </div>
              <div style={{ textAlign: "right" }}><span className="mq">¿Torque del perno B?</span></div>
              <div className="macard">
                <div className="mqlab">Torque del perno B</div>
                <div className="mbig">85<span className="u"> N·m</span></div>
                <span className="cite"><span className="brk" />Manual VF-2 · §4.2.1 ↗</span>
              </div>
            </div>
            <div className="hero-tag" style={{ top: -14, left: -16 }}><Icon name="scan-line" size={15} />QR persistente</div>
            <div className="hero-tag" style={{ bottom: 22, right: -18 }}><Icon name="link" size={15} />Cita clickeable</div>
          </div>
        </div>
      </div>

      <Problem />
      <HowItWorks />

      <section className="band ink">
        <div className="wrap">
          <span className="eyebrow">Tres niveles</span>
          <h2 className="sec-title">De la consulta de hoy al foso de mañana.</h2>
          <div className="levels">
            {LEVELS.map(([lv, h, p, ex]) => (
              <div className="level" key={lv}>
                <div className="lv">{lv}</div>
                <h3>{h}</h3>
                <p>{p}</p>
                <div className="ex"><b>Ej. </b>{ex}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Verticals />
      <Differentiators />
      <Regulatory />
    </>
  );
}
