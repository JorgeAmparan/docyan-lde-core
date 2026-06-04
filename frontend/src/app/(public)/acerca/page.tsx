import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acerca de XCID · DOCYAN LDE",
};

/* Recreated from the commercial kit `AboutPage` (pages.jsx §6.3.4). */

export default function AboutPage() {
  return (
    <section className="band paper">
      <div className="wrap narrow">
        <span className="eyebrow">Acerca de XCID</span>
        <h1 className="page-h1">El motor invisible detrás de DOCYAN.</h1>
        <p className="about-body">
          XCID SA de CV es una empresa mexicana de ingeniería de producto.
          Construimos DOCYAN para que el conocimiento documental de la industria
          regulada deje de estar muerto y disperso — y empiece a responder donde
          se necesita.
        </p>
        <p className="about-body">
          El nombre nace del náhuatl: <i>Yan</i>, “lugar” —{" "}
          <b>el lugar de los documentos</b>. La identidad se apoya en{" "}
          <i>“in tlilli, in tlapalli”</i>, la tinta negra y la tinta roja: la
          metáfora azteca de la escritura y el códice. Por eso cada cita aparece
          en rojo cinabrio, como en los códices originales.
        </p>
        <div className="about-contact">
          <div>
            <span className="ac-l">Contacto comercial</span>
            <a className="ac-v" href="mailto:ventas@xcid.mx">
              ventas@xcid.mx
            </a>
          </div>
          <div>
            <span className="ac-l">Ubicación</span>
            <span className="ac-v">México</span>
          </div>
        </div>
        <div className="cta" style={{ marginTop: 30 }}>
          <Link href="/signup" className="btn primary lg">
            Hablar con el equipo
          </Link>
        </div>
      </div>
    </section>
  );
}
