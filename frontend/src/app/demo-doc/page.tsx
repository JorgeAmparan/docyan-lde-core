"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import "@/styles/demo-doc.css";

/* DOCYAN demo source-doc viewer — ported from `demo-doc.html`. Opened in a new
   tab by the functional citation chip / "Abrir PDF", scrolled to the exact span.
   In production, swap for the real PDF at #page=N. Lives outside the (public)
   group so it has no nav/footer (a standalone document surface). */

const PRE: [string, string][] = [
  ["Propósito y alcance", "Este documento forma parte del acervo documental del CoDo y describe las condiciones de operación, los parámetros críticos y las precauciones aplicables. Su contenido es de cumplimiento obligatorio para el personal autorizado."],
  ["Condiciones previas", "Antes de cualquier intervención, verifica que las superficies de contacto estén limpias y libres de rebabas, y que el equipo se encuentre en estado seguro. Confirma la vigencia de los registros asociados."],
];
const POST: [string, string][] = [
  ["Registro", "Tras completar el procedimiento, registra el valor y la fecha en la bitácora del equipo. La trazabilidad de cada acción queda encadenada criptográficamente en el FAT de DOCYAN."],
  ["Referencias", "Consulta los documentos relacionados del CoDo (manuales, MSDS, certificados de calibración) para el contexto completo. Cada cita en DOCYAN apunta al span exacto de su fuente."],
];

function DemoDoc() {
  const sp = useSearchParams();
  const title = sp.get("doc") || "Documento fuente";
  const cite = sp.get("cite") || "Documento · §";
  const page = sp.get("page") || "—";
  const span = sp.get("span") || "Fragmento citado del documento fuente.";
  const codo = sp.get("codo") || "CODO-DEMO";
  const spanRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = `${title} · DOCYAN demo`;
    const m = spanRef.current;
    if (m) {
      const y = m.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top: y, behavior: "auto" });
    }
  }, [title, span]);

  const citedSection = cite.split("·").pop()?.trim() + " — sección citada";

  return (
    <div className="dv-body">
      <div className="dv-ribbon">
        <span className="dv-dot" />
        Documento demo de DOCYAN — contenido representativo para demostración.
        <button onClick={() => window.close()}>Cerrar</button>
      </div>
      <div className="dv-sheet">
        <div className="dv-eyebrow">
          <span>{cite}</span>
          <span className="dv-pg">pág. {page}</span>
        </div>
        <h1>{title}</h1>
        <div className="dv-meta">DOCYAN · {codo} · documento vivo · revisión vigente</div>
        <div className="dv-docbody">
          {PRE.map(([h, p]) => (
            <div key={h}>
              <h2>{h}</h2>
              <p>{p}</p>
            </div>
          ))}
          <h2>{citedSection}</h2>
          <p>
            En las condiciones definidas para esta entidad operativa, aplica lo siguiente.{" "}
            <mark className="dv-span" ref={spanRef}>{span}</mark>
            <span className="dv-span-tag">span citado por DOCYAN</span> Repite la verificación una segunda vez para asegurar el asentamiento y la consistencia del registro.
          </p>
          {POST.map(([h, p]) => (
            <div key={h}>
              <h2>{h}</h2>
              <p>{p}</p>
            </div>
          ))}
        </div>
        <div className="dv-foot">
          <span>Recuperado por DOCYAN con pedigree a span exacto · cadena SHA-256 verificable</span>
        </div>
      </div>
    </div>
  );
}

export default function DemoDocPage() {
  return (
    <Suspense fallback={null}>
      <DemoDoc />
    </Suspense>
  );
}
