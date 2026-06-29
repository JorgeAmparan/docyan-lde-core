/* DOCYAN — Momento Playbook (capa de apropiación · valor #2).
   Naming PROGRESIVO: la palabra "Playbook" NO aparece hasta que se gana
   (≥2 consultas guardadas del mismo equipo). Antes solo "consulta guardada".
   Compartido por la Guardadas de escritorio (colab.jsx) y móvil (colab-mobile.jsx). */

const { useState: usePbState, useEffect: usePbEffect } = React;

const PB_MIN = 2; // umbral para "ganar" el Playbook

/* nudge que introduce el término por primera vez, con su línea explicativa */
function PlaybookNudge({ onRun }) {
  return <div className="pb-nudge">
    <div className="pb-nh"><Icon name="git-branch" size={17} />{t({ es: "Secuencia detectada", en: "Sequence detected" })}</div>
    <p>{t({ es: "Estas consultas tocan el mismo equipo. Un ", en: "These queries touch the same equipment. A " })}<strong>Playbook</strong>{t({ es: " es una secuencia que repites como rutina — DOCYAN puede unirlas en una.", en: " is a sequence you repeat as a routine — DOCYAN can join them into one." })}</p>
    <button className="pb-cta" onClick={onRun}><Icon name="play" size={15} />{t({ es: "Ejecutar como Playbook", en: "Run as Playbook" })}</button>
  </div>;
}

/* ejecución: la página se compone en tiempo real, paso a paso, con cita por paso */
function PlaybookRun({ items, onBack }) {
  const [shown, setShown] = usePbState(0);
  usePbEffect(() => {
    if (shown >= items.length) return;
    const id = setTimeout(() => setShown(s => s + 1), shown === 0 ? 240 : 560);
    return () => clearTimeout(id);
  }, [shown, items.length]);
  const codoId = items[0] ? items[0].codoId : "rutina";
  return <div className="pb-run">
    <div className="pb-run-head">
      <button className="pb-back" onClick={onBack}><Icon name="arrow-left" size={18} /></button>
      <div className="pb-run-t"><div className="pb-eyebrow"><Icon name="git-branch" size={13} />PLAYBOOK · {codoId}</div>
        <div className="pb-run-name">{t({ es: "Rutina de " + items.length + " pasos", en: "Routine of " + items.length + " steps" })}</div></div>
    </div>
    <p className="pb-run-sub">{t({ es: "Se compone en tiempo real, paso a paso. Cada paso conserva su cita a la fuente.", en: "It composes in real time, step by step. Each step keeps its citation to the source." })}</p>
    {items.slice(0, shown).map((it, i) => <div className="pb-step" key={i}>
      <div className="pb-step-h"><span className="pb-num">{i + 1}</span><span className="pb-q">{it.q}</span></div>
      <div className="pb-step-body">
        {ANSWERS[it.key]
          ? <AnswerBody a={ANSWERS[it.key]} />
          : <div className="dc-answer"><div className="acard"><div className="q">{it.q}</div><p className="note" style={{ color: "var(--fg)" }}>{t({ es: "Respuesta consolidada con su cita a la fuente.", en: "Consolidated answer with its citation to the source." })}</p>
              <div className="citerow"><span className="cite2"><span className="brk" />{it.cite} ↗</span></div></div></div>}
      </div>
    </div>)}
    {shown < items.length && <div className="pb-composing"><Icon name="loader" size={15} />{t({ es: "Componiendo paso " + (shown + 1) + " de " + items.length + "\u2026", en: "Composing step " + (shown + 1) + " of " + items.length + "\u2026" })}</div>}
    {shown >= items.length && items.length > 0 && <div className="pb-done"><Icon name="check-circle" size={16} />{t({ es: "Playbook completo · " + items.length + " consultas encadenadas con su cita", en: "Playbook complete · " + items.length + " queries chained with their citations" })}</div>}
  </div>;
}

Object.assign(window, { PlaybookNudge, PlaybookRun, PB_MIN });
