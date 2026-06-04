import Link from "next/link";
import { Icon } from "@/components/icon";

/**
 * Vertical use-case template — recreated from the commercial kit `VerticalPage`
 * (pages.jsx §6.3.1, shown there as Laboratorios). One data object per vertical
 * drives: hero, problem-specific section, example collaborator flow (.flow3),
 * applicable regulatory frameworks (.norms-big), a product-shot placeholder
 * (.shot/.shot-tag) and CTAs (agendar demo / ver planes).
 */

/** [iconName, label] for a single problem bullet in the .prob-list. */
export type VerticalProblemItem = [icon: string, label: string];

/** [iconName, heading, body] for a single step in the example .flow3. */
export type VerticalFlowStep = [icon: string, heading: string, body: string];

export type VerticalData = {
  /** Small eyebrow above the H1, e.g. "Caso de uso · Laboratorios". */
  eyebrow: string;
  /** Page H1, e.g. "Laboratorios ISO/IEC 17025". */
  title: string;
  /** Hero lead paragraph. */
  lead: string;
  /** Problem section heading. */
  problemTitle: string;
  /** Problem section lead paragraph. */
  problemLead: string;
  /** Bullets rendered in the .prob-list. */
  problems: VerticalProblemItem[];
  /** Example-flow section heading, e.g. "Un día en el laboratorio.". */
  flowTitle: string;
  /** Three (or so) steps of the example collaborator flow. */
  flow: VerticalFlowStep[];
  /** Tag shown inside the product-shot placeholder, e.g. "CONSULTA EN PISO". */
  shotTag: string;
  /** Frameworks heading. */
  frameworksTitle: string;
  /** Applicable regulatory frameworks shown as pills in .norms-big. */
  frameworks: string[];
};

export function VerticalTemplate({ data }: { data: VerticalData }) {
  return (
    <>
      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">{data.eyebrow}</span>
          <h1 className="page-h1">{data.title}</h1>
          <p className="sec-lead">{data.lead}</p>
          <div className="cta" style={{ marginTop: 26 }}>
            <Link href="/signup" className="btn primary lg">
              <Icon name="calendar" size={17} />
              Agendar demo
            </Link>
            <Link href="/precios" className="btn sec lg">
              Ver planes
            </Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap two-col">
          <div>
            <span className="eyebrow">El problema</span>
            <h2 className="sec-title">{data.problemTitle}</h2>
            <p className="sec-lead">{data.problemLead}</p>
          </div>
          <div className="prob-list">
            {data.problems.map(([ic, t]) => (
              <div className="pl-item" key={t}>
                <Icon name={ic} size={18} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band paper">
        <div className="wrap">
          <span className="eyebrow">Ejemplo de flujo</span>
          <h2 className="sec-title">{data.flowTitle}</h2>
          <div className="flow3">
            {data.flow.map(([ic, h, p], i) => (
              <div className="flow-node" key={h}>
                <div className="fn-n">0{i + 1}</div>
                <div className="fn-ic">
                  <Icon name={ic} size={20} />
                </div>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
          <div className="shot" style={{ marginTop: 32 }}>
            <span className="shot-tag">{data.shotTag}</span>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <span className="eyebrow">Marcos aplicables</span>
          <h2 className="sec-title">{data.frameworksTitle}</h2>
          <div className="norms-big">
            {data.frameworks.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div className="disc">
            <Icon name="info" size={18} />
            <p>
              DOCYAN es capa de conocimiento, no sistema de registro primario.
              Las alertas son administrativas — nunca decisiones clínicas u
              operativas.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
