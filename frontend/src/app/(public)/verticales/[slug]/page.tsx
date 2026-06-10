"use client";

/* DOCYAN sitio público v2 — VERTICALES (DETALLE por slug).
   Detalle de los 3 verticales construidos: laboratorios (lab), maquila (maq),
   flotillas (flot). Port fiel de verticales.jsx (VerticalPage).
   Slug → key vía SLUG_TO_KEY; slug desconocido → notFound(). */

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import { Doors } from "@/components/commercial/site-chrome";
import { VERTS, VDETAIL, SLUG_TO_KEY, KEY_TO_SLUG } from "@/lib/verticales-data";

export default function VerticalPage() {
  const t = useT();
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const vkey = slug ? SLUG_TO_KEY[slug] : undefined;
  const d = vkey ? VDETAIL[vkey] : undefined;

  if (!d || !vkey) {
    notFound();
  }

  const others = VERTS.filter((v) => v.built && v.key !== vkey);

  return (
    <main data-screen-label={"Vertical — " + vkey}>
      <header className="vpage-hero">
        <div className="wrap">
          <span className="eyebrow">{t(d.eyebrow)}</span>
          <h1>{t(d.h1)}</h1>
          <p className="vpain">{t(d.pain)}</p>
          <div className="vmeta">
            {d.meta.map((m, i) => (
              <span key={i}>{typeof m === "string" ? m : t(m)}</span>
            ))}
          </div>
        </div>
      </header>
      <section className="band" style={{ paddingTop: 24 }} data-screen-label={"Vertical " + vkey + " — Escena"}>
        <div className="wrap">
          <div className="ph" style={{ aspectRatio: "21/8" }}>
            <span className="ph-tag">{t(d.tag)}</span>
          </div>
          <div className="flow32">
            {d.flow.map((f, i) => (
              <div className="fnode2" key={i}>
                <span className="fn">{"0" + (i + 1)}</span>
                <span className="fi">
                  <Icon name={f.ic} size={20} />
                </span>
                <h3>{t(f.h)}</h3>
                <p>{t(f.p)}</p>
              </div>
            ))}
          </div>
          <div className="unsafe" style={{ marginTop: 28 }}>
            <Icon name="scale" size={20} />
            <div>
              <h3>{t({ es: "La línea que no se cruza", en: "The line that isn't crossed" })}</h3>
              <p>{t(d.note)}</p>
            </div>
          </div>
          <div className="vlinks" style={{ marginTop: 26 }}>
            <Link className="vlink on" href="/demo">
              <Icon name="play" size={14} />
              {t({ es: "Pruébalo sin registro — CoDo de este sector", en: "Try it without signup — this industry's CoDo" })}
            </Link>
          </div>
          <div className="vlinks">
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-subtle)",
                alignSelf: "center",
              }}
            >
              {t({ es: "Otras escenas:", en: "Other scenes:" })}
            </span>
            {others.map((v) => (
              <Link className="vlink" key={v.key} href={`/verticales/${KEY_TO_SLUG[v.key]}`}>
                <Icon name={v.ic} size={14} />
                {t(v.name)}
              </Link>
            ))}
            <Link className="vlink" href="/verticales">
              <Icon name="layout-grid" size={14} />
              {t({ es: "Todas", en: "All" })}
            </Link>
          </div>
        </div>
      </section>
      <section className="band paper" data-screen-label={"Vertical " + vkey + " — CTA"}>
        <div className="wrap">
          <div className="cta-band">
            <h2 className="sec-title">
              {t({ es: "Pruébalo con tus propios documentos", en: "Try it with your own documents" })}
            </h2>
          </div>
          <Doors compact />
        </div>
      </section>
    </main>
  );
}
