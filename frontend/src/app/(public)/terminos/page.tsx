"use client";

import { LegalDoc, type LegalSection } from "@/components/commercial/legal-doc";

/* /terminos (F3 N2). Layout legal con índice lateral, listo para el contenido real
   de Jorge tras revisión de la postura de PI. NO se inventa contenido legal:
   SECTIONS vacío → placeholder honesto. */
const SECTIONS: LegalSection[] = [];

export default function TerminosPage() {
  return (
    <LegalDoc
      eyebrow={{ es: "Legal", en: "Legal" }}
      title={{ es: "Términos del servicio", en: "Terms of service" }}
      sections={SECTIONS}
    />
  );
}
