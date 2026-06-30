"use client";

/* DOCYAN — Demo pública sin registro · superficie del prototipo (`app/demo-showcase.jsx`).
   Porta `DemoShowcase` PIXEL-PERFECT: `.demo-show` → `.ds-head` → `.ds-stage` con los
   marcos de dispositivo (`.ds-bezel.phone` / `.ds-bezel.tablet`, toggle) → `.ds-banner`
   con sus dos CTAs. DENTRO del marco va la consulta REAL (`ConsultView`), enrutada al
   backend demo real vía `demoQuery` — cero respuestas enlatadas (HARD CONSTRAINT #2).

   Demo = mezcladora MAXI-10ND (3 PDFs reales). El tenant demo `maxi` (graph `demo-maxi`)
   se siembra con `scripts/seed_demo_tenants.py --manifest docs/demo/manifest_maxi.json`
   en el backend DOCYAN (Supabase + worker de ingesta). Hasta que el grafo esté sembrado,
   `demoQuery` devuelve su fallback honesto (jamás respuestas enlatadas — HARD CONSTRAINT #2).
   Atribución real: las respuestas citan los 3 documentos de la MAXI-10ND del grafo. */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { useT } from "@/lib/site-i18n";
import {
  ConsultView,
  type ConsultContext,
  type QueryFn,
} from "@/app/(app)/consult/consult-view";
import {
  errorAnswer,
  mapResueltaToAnswer,
  type ConsultaResuelta,
} from "@/app/(app)/consult/consult-data";
import { demoQuery, DEMO_FALLBACK } from "@/lib/demo-query";

/* CoDo demo REAL contra el que corre la consulta libre. `codo` = clave de tenant demo
   sembrado (`maxi`). Los documentos y sugeridas son los reales del grafo `demo-maxi`
   (3 PDFs de la mezcladora MAXI-10ND). Nada enlatado: el clic/escrito va a `demoQuery`.
   El tenant `demo-maxi` se siembra con `scripts/seed_demo_tenants.py --manifest
   docs/demo/manifest_maxi.json` en el backend DOCYAN (Supabase + worker). */
const DEMO_CODO = "maxi";

const DEMO_DOCS: NonNullable<ConsultContext["documentos"]> = [
  {
    id: "demo-maxi-operacion",
    nombre: "Manual de operación — MAXI-10ND",
    tipo: "manual_tecnico",
    sugerencias: [
      "¿A cuántas RPM debe girar la olla?",
      "¿Cómo arranco la mezcladora de forma segura?",
      "¿Qué EPP requiere la operación?",
    ],
  },
  {
    id: "demo-maxi-ficha",
    nombre: "Ficha técnica — MAXI-10ND",
    tipo: "ficha_tecnica",
    sugerencias: [
      "¿Cuál es la capacidad de la mezcladora?",
      "¿Qué motor usa y a qué potencia?",
    ],
  },
  {
    id: "demo-maxi-partes",
    nombre: "Lista de partes — MAXI-10ND",
    tipo: "especificacion",
    sugerencias: [
      "¿Qué número de parte tiene el acople motor-eje?",
      "¿Qué refacciones lleva el sistema de transmisión?",
    ],
  },
];

/* El contexto del CoDo demo (real, sembrado). `codo` legible (no SHA) → la cabecera
   lo muestra. Documentos reales del grafo `demo-maxi` (mezcladora MAXI-10ND). */
const DEMO_CONTEXT: ConsultContext = {
  codo: "MAXI-10ND",
  entityName: "Mezcladora de concreto MAXI-10ND",
  entityTitle: "CoDo demo · 3 documentos vivos",
  entityMeta: "demo-maxi · solo lectura",
  documentos: DEMO_DOCS,
};

/* Función de consulta inyectada: TODA consulta (sugerida o libre) va al backend demo
   REAL (`demoQuery`, sin token, rate-limited por IP). El resultado servido se mapea con
   el MISMO `mapResueltaToAnswer` de la consulta autenticada → mismos renderers, mismas
   citas (verbatim, cinnabar, integridad de cita). Sin respuesta sostenida → error
   honesto con el fallback del backend (jamás se fabrica una respuesta). */
const demoQueryFn: QueryFn = async (label) => {
  const res = await demoQuery(label, DEMO_CODO);
  if (res.servido && res.resultado) {
    return mapResueltaToAnswer(res.resultado as unknown as ConsultaResuelta, label);
  }
  return errorAnswer(label, res.fallback || DEMO_FALLBACK);
};

type Dev = "phone" | "tablet";

export default function DemoPage() {
  const t = useT();
  const router = useRouter();
  const [dev, setDev] = useState<Dev>("phone");

  return (
    <main data-screen-label="Demo sin registro">
      <div className="demo-show">
        <div className="ds-head">
          <span className="ds-eyebrow">
            {t({ es: "Demo sin registro", en: "No-signup demo" })}
          </span>
          <h1 className="ds-title">
            {t({ es: "Pruébalo con documentos reales", en: "Try it with real documents" })}
          </h1>
          <p className="ds-lead">
            {t({
              es: "Mezcladora de concreto MAXI-10ND · 3 documentos vivos. Pregunta lo que preguntarías frente al equipo — la respuesta llega citada a la fuente, en tu idioma.",
              en: "MAXI-10ND concrete mixer · 3 live documents. Ask what you'd ask at the machine — the answer arrives cited to its source, in your language.",
            })}
          </p>
          <div className="ds-devtoggle" role="tablist" aria-label={t({ es: "Dispositivo", en: "Device" })}>
            <button
              className={"ds-dev" + (dev === "phone" ? " on" : "")}
              role="tab"
              aria-selected={dev === "phone"}
              onClick={() => setDev("phone")}
            >
              <Icon name="smartphone" size={15} />
              {t({ es: "Teléfono", en: "Phone" })}
            </button>
            <button
              className={"ds-dev" + (dev === "tablet" ? " on" : "")}
              role="tab"
              aria-selected={dev === "tablet"}
              onClick={() => setDev("tablet")}
            >
              <Icon name="tablet" size={15} />
              {t({ es: "Tablet", en: "Tablet" })}
            </button>
          </div>
        </div>

        <div className="ds-stage">
          <div className={"ds-bezel " + dev}>
            <div className="ds-screen">
              {/* La consulta REAL del producto, embebida en el marco. El mismo
                  ConsultView de /consult, pero con la consulta enrutada al backend
                  demo (demoQuery) — sin token, sin sesión autenticada. El marco
                  `phone`/`tablet` cambia el ancho; ConsultView responde (CSS). */}
              <ConsultView context={DEMO_CONTEXT} queryFn={demoQueryFn} />
            </div>
          </div>
        </div>

        <div className="ds-banner">
          <span className="dsb-dot">
            <span />
          </span>
          <div className="dsb-txt">
            <b>{t({ es: "Estás en un CoDo demo.", en: "You're in a demo CoDo." })}</b>{" "}
            {t({
              es: "Las respuestas vienen de los documentos reales del CoDo. Cuando quieras, hazlo con los tuyos.",
              en: "Answers come from the CoDo's real documents. When you're ready, do it with yours.",
            })}
          </div>
          <div className="dsb-cta">
            <button className="dsb-btn primary" onClick={() => router.push("/signup")}>
              {t({ es: "Ahora con tus documentos", en: "Now with your documents" })}
            </button>
            <button className="dsb-btn ghost" onClick={() => router.push("/codigo")}>
              {t({ es: "Agendar demo", en: "Book a demo" })}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
