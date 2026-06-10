"use client";

/* DOCYAN sitio público v2 — VERTICALES (HUB).
   Hub con paraguas transversal (la firma del trabajo que une sectores)
   + grid de 7. Port fiel de verticales.jsx (VerticalesHub + Umbrella + VertGrid). */

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";
import { VERTS, KEY_TO_SLUG, type Bi } from "@/lib/verticales-data";

export function VertGrid({ limit }: { limit?: number }) {
  const t = useT();
  const list = limit ? VERTS.slice(0, limit) : VERTS;
  return (
    <div className="verts2">
      {list.map((v) => {
        const href = v.built ? `/verticales/${KEY_TO_SLUG[v.key]}` : "/verticales";
        return (
          <Link className="vert2" key={v.key} href={href}>
            <span className="vi">
              <Icon name={v.ic} size={20} />
            </span>
            <h3>{t(v.name)}</h3>
            <p>{t(v.desc)}</p>
            <span className="vfoot">
              <span className="norm">{v.norm}</span>
              {v.built && (
                <span className="varrow">
                  <Icon name="arrow-right" size={15} />
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ---- paraguas transversal ---- */
function Umbrella() {
  const t = useT();
  const items: { ic: string; h: Bi; p: Bi }[] = [
    {
      ic: "file-check",
      h: { es: "Trabajo regido por documentos", en: "Work governed by documents" },
      p: { es: "Manuales, normas, métodos: el documento manda.", en: "Manuals, standards, methods: the document rules." },
    },
    {
      ic: "alert-triangle",
      h: { es: "El error cuesta", en: "Errors cost" },
      p: {
        es: "Paro de línea, hallazgo, incidente. Equivocarse no es gratis.",
        en: "Downtime, findings, incidents. Mistakes aren't free.",
      },
    },
    {
      ic: "map-pin",
      h: { es: "Punto de uso lejos de la oficina", en: "Point of use far from the office" },
      p: {
        es: "El dato se necesita frente al equipo, no en el escritorio.",
        en: "The data is needed at the machine, not at the desk.",
      },
    },
    {
      ic: "wifi-off",
      h: { es: "Conectividad no garantizada", en: "Connectivity not guaranteed" },
      p: {
        es: "Campo, plataforma, mina: una barra de señal es normal.",
        en: "Field, platform, mine: one bar of signal is normal.",
      },
    },
    {
      ic: "user-minus",
      h: { es: "Fuga de conocimiento tácito", en: "Tacit knowledge leak" },
      p: {
        es: "Cuando el experto se va, su saber se va con él.",
        en: "When the expert leaves, the knowledge goes too.",
      },
    },
  ];
  return (
    <div className="umb">
      {items.map((u, i) => (
        <div className="umb-item" key={i}>
          <Icon name={u.ic} size={20} />
          <h3>{t(u.h)}</h3>
          <p>{t(u.p)}</p>
        </div>
      ))}
    </div>
  );
}

export default function VerticalesHub() {
  const t = useT();
  return (
    <main data-screen-label="Verticales — Hub">
      <header className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{t({ es: "Sectores", en: "Industries" })}</span>
          <h1>{t({ es: "Siete escenas, una misma firma de trabajo", en: "Seven scenes, one signature of work" })}</h1>
          <p className="sec-lead">
            {t({
              es: "DOCYAN no es «para un sector»: es para un tipo de trabajo. Si tu operación comparte esta firma, te vas a reconocer en alguna de las escenas.",
              en: "DOCYAN isn't “for an industry”: it's for a kind of work. If your operation shares this signature, you'll recognize yourself in one of the scenes.",
            })}
          </p>
        </div>
      </header>
      <section className="band" data-screen-label="Verticales — Paraguas">
        <div className="wrap">
          <Umbrella />
        </div>
      </section>
      <section className="band paper" data-screen-label="Verticales — Grid">
        <div className="wrap">
          <h2 className="sec-title" style={{ marginTop: 0 }}>
            {t({ es: "Elige tu escena", en: "Pick your scene" })}
          </h2>
          <VertGrid />
        </div>
      </section>
      <section className="band" data-screen-label="Verticales — CTA">
        <div className="wrap">
          <Doors compact />
        </div>
      </section>
    </main>
  );
}
