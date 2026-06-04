import type { Metadata } from "next";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "Centro de ayuda · DOCYAN LDE",
};

/* Recreated from the commercial kit `SupportPage` (pages.jsx §6.6).
   DESIGN: the kit's search/form are presentational (no handlers wired). Kept
   static here so the page stays a server component; wiring search + the
   contact form to the backend is a follow-up. */

const CATS: [icon: string, heading: string, body: string][] = [
  ["rocket", "Primeros pasos", "Configura tu cuenta y tu primer CoDo."],
  ["folder-tree", "Crear un CoDo", "Organiza documentos en contexto."],
  ["qr-code", "Generar y pegar QRs", "Imprime y coloca los QRs persistentes."],
  ["users", "Invitar a tu equipo", "Admins y colaboradores."],
];

const ARTS: string[] = [
  "¿Qué es un CoDo y cómo lo estructuro?",
  "Cómo subir mi primer documento y ver la cotización",
  "Cómo imprimir un QR persistente para un equipo",
  "Diferencia entre consulta guardada y Playbook",
  "Cómo cambiar mi par lingüístico por defecto",
];

export default function SupportPage() {
  return (
    <>
      <section className="band paper">
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">Centro de ayuda</span>
          <h1 className="page-h1" style={{ marginBottom: 22 }}>
            ¿En qué te ayudamos?
          </h1>
          <div className="help-search">
            <Icon name="search" size={18} />
            <input placeholder="Busca en la documentación…" aria-label="Buscar en la documentación" />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="help-cats">
            {CATS.map(([ic, h, p]) => (
              <div className="help-card" key={h}>
                <div className="hc-ic">
                  <Icon name={ic} size={20} />
                </div>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>

          <div className="two-col" style={{ marginTop: 40, alignItems: "start" }}>
            <div>
              <h2 className="sec-title" style={{ fontSize: 22 }}>
                Artículos populares
              </h2>
              <div className="art-list">
                {ARTS.map((a) => (
                  <a className="art" key={a}>
                    <Icon name="file-text" size={15} />
                    {a}
                    <Icon name="chevron-right" size={15} />
                  </a>
                ))}
              </div>
            </div>

            <div className="contact-card">
              <h3>¿No encuentras lo que buscas?</h3>
              <p>
                Escríbenos y te respondemos. Los planes con soporte prioritario
                incluyen chat y tickets.
              </p>
              <div className="field">
                <label htmlFor="soporte-correo">Correo</label>
                <input id="soporte-correo" type="email" placeholder="tu@empresa.com" />
              </div>
              <div className="field">
                <label htmlFor="soporte-consulta">¿Cómo te ayudamos?</label>
                <input id="soporte-consulta" placeholder="Describe tu consulta…" />
              </div>
              <button className="btn primary" style={{ width: "100%" }}>
                Enviar consulta
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
