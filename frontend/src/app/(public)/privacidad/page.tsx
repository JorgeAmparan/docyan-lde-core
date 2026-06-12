"use client";

import { LegalDoc, type LegalSection } from "@/components/commercial/legal-doc";

/* /privacidad (F3 N2). Layout legal con índice lateral, listo para el contenido real
   de Jorge tras revisión de la postura de PI. NO se inventa contenido legal:
   SECTIONS vacío → placeholder honesto. */
const SECTIONS: LegalSection[] = [];

export default function PrivacidadPage() {
  return (
    <LegalDoc
      eyebrow={{ es: "Legal", en: "Legal" }}
      title={{ es: "Aviso de privacidad", en: "Privacy notice" }}
      sections={SECTIONS}
    />
  );
}
