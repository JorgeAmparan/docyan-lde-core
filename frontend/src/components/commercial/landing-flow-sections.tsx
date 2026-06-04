import { Fragment } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { VERTICALS } from "@/lib/demo-data";

/* Landing v2 sections — ported 1:1 from `landing-flow.jsx`:
   DemoExplore, ThreeLevelsFlow, GovernanceSection, MoatSchematic. */

export function DemoExplore() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Demo sin registro</span>
        <h2 className="sec-title">Explora un CoDo demo completo.</h2>
        <p className="sec-lead">Sin registro. Sin cargar nada. Navega documentación real de tu vertical como si fuera tu acervo.</p>
        <div className="demo-grid">
          {VERTICALS.map((v) => (
            <div className="dx-card" key={v.key}>
              <div className="dx-ic"><Icon name={v.icon} size={20} /></div>
              <h3>{v.label}</h3>
              <p>{v.blurb}</p>
              <div className="dx-count">3 documentos · 1 entidad operativa · ~12 consultas posibles</div>
              <Link className="btn primary" href={`/demo/${v.key}`}>Explorar este CoDo<Icon name="arrow-right" size={15} /></Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ThreeLevelsFlow() {
  return (
    <section className="band ink">
      <div className="wrap">
        <span className="eyebrow">Tres niveles</span>
        <h2 className="sec-title">De la consulta de hoy al foso de mañana.</h2>
        <div className="levels-flow">
          <div className="lvl-card">
            <div className="lv-badge"><span className="lv-n">01</span>Nivel 1</div>
            <div className="lv-vis v1">
              <div className="lvq">¿Torque del perno B?</div>
              <div className="lva">
                <span className="lvbig">85<small> N·m</small></span>
                <span className="cite sm"><span className="brk" />§4.2.1</span>
              </div>
            </div>
            <h3>Consulta viva</h3>
            <p>Documento consultable en tiempo real, en el punto de uso, con cita cliqueable a la fuente.</p>
          </div>
          <div className="lvl-arrow"><Icon name="chevron-right" size={20} /></div>
          <div className="lvl-card">
            <div className="lv-badge"><span className="lv-n">02</span>Nivel 2</div>
            <div className="lv-vis v2">
              <div className="lvstep"><span>1</span>Pregunta</div>
              <div className="lvstep"><span>2</span>Calibración</div>
              <div className="lvstep"><span>3</span>Arranque</div>
            </div>
            <h3>Conocimiento capturado</h3>
            <p>El colaborador captura cómo consulta — qué pregunta y en qué orden — como un Playbook reutilizable.</p>
          </div>
          <div className="lvl-arrow"><Icon name="chevron-right" size={20} /></div>
          <div className="lvl-card">
            <div className="lv-badge"><span className="lv-n">03</span>Nivel 3</div>
            <div className="lv-vis v3">
              <span className="lvnode n1" /><span className="lvnode n2" /><span className="lvnode n3" />
              <div className="lvhub"><Icon name="disc-3" size={20} /></div>
              <div className="lvpat">3 equipos · mismo patrón</div>
            </div>
            <h3>Inteligencia organizacional</h3>
            <p>Las consultas y anotaciones retienen el saber tácito cuando la gente se va.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const GOV: [string, string, string, string][] = [
  ["link-2", "Pedigree cliqueable a span", "Cada respuesta liga a la fuente exacta en el documento. Si el sistema no puede ligarla, no la sirve.", "abre el PDF y revisa"],
  ["scale", "Umbrales por criticidad", "Cada respuesta lleva un score de confianza. Seguridad ≥0.95, regulatorio ≥0.90, calidad ≥0.85 — si no alcanza, escala a humano.", "no la sirve como cierta"],
  ["octagon-x", "Freno de alucinación", "Si detecta una cifra, una norma o un identificador fabricado, bloquea la respuesta antes de servirla. Es función del sistema, no opción.", "bloquea antes de servir"],
  ["lock", "Cadena criptográfica SHA-256", "Cada respuesta y cada decisión de gobernanza queda en una cadena inmutable. Alterar un evento la rompe. Un auditor lo verifica en segundos.", "verificable en segundos"],
];

export function GovernanceSection() {
  return (
    <section className="band paper">
      <div className="wrap">
        <span className="eyebrow">Gobernanza por diseño</span>
        <h2 className="sec-title">No solo cita. Gobierna lo que sirve y bloquea lo que no puede sustentar.</h2>
        <div className="gov-flow">
          {GOV.map(([ic, h, p, tag], i) => (
            <Fragment key={h}>
              <div className="gov-card">
                <div className="gov-top">
                  <span className="gov-n">0{i + 1}</span>
                  <span className="gov-ic"><Icon name={ic} size={19} /></span>
                </div>
                <h3>{h}</h3>
                <p>{p}</p>
                <span className="gov-tag"><Icon name="check" size={12} />{tag}</span>
              </div>
              {i < GOV.length - 1 && <div className="gov-link"><Icon name="chevron-right" size={18} /></div>}
            </Fragment>
          ))}
        </div>
        <p className="gov-close">
          Las cuatro capas operan en runtime, en cada consulta, por cada usuario. No son promesas de marketing. Son el sistema.
        </p>
      </div>
    </section>
  );
}

const MOAT_NODES: [string, string, string][] = [
  ["top", "file-text", "Documentos"],
  ["right", "ruler", "Calibración"],
  ["bottom", "bell", "Alertas"],
  ["left", "list-checks", "Procedimientos"],
];

export function MoatSchematic() {
  return (
    <section className="band">
      <div className="wrap two-col moat">
        <div>
          <span className="eyebrow">El foso</span>
          <h2 className="sec-title">Cada equipo se vuelve un expediente vivo.</h2>
          <p className="sec-lead">
            DOCYAN conecta cada entidad operativa con sus documentos, procedimientos, calibraciones y alertas — un objeto cognitivo que retiene el conocimiento de tu organización, no una carpeta más.
          </p>
          <div className="moat-pts">
            {([["Relaciones, no archivos sueltos", "git-fork"], ["Patrones detectados por uso", "sparkles"], ["El saber tácito se queda", "brain"]] as [string, string][]).map(([t, ic]) => (
              <div className="moat-pt" key={t}><Icon name={ic} size={17} />{t}</div>
            ))}
          </div>
        </div>
        <div className="moat-vis">
          <div className="moat-grid">
            {MOAT_NODES.map(([pos, ic, label]) => (
              <div className={"moat-node " + pos} key={pos}><Icon name={ic} size={15} /><span>{label}</span></div>
            ))}
            <div className="moat-hub">
              <Icon name="disc-3" size={24} />
              <span className="mh-id">CODO-LAB-04</span>
              <span className="mh-n">Centrífuga Hettich</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
